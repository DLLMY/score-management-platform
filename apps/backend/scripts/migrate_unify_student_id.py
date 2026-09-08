#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
P0-1 字段统一化迁移：将 7 张表中指向「学生」的 user_id 列统一重命名为 student_id，
并对原本缺少 FK 的 4 张表补上 student_id REFERENCES user(id)。

设计要点：
- 学生即 user 表中 role='student' 的行（与 Attendance.student_id  convention 一致）。
- 已确认 7 张表的 user_id 仅承载学生 user.id，重命名语义安全。
- 已有 FK 的 3 张表（score_record/notification/approval）用 ALTER TABLE RENAME COLUMN；
  缺 FK 的 4 张表（student_clusters/composite_scores/risk_warnings/nlp_match_results）用
  「建新表→拷数据→删旧→改名」重建并补 FK。
- 孤儿值处理：nullable 表将孤儿(非 NULL 且不在 user)置 NULL 保留行；NOT NULL 表删除孤儿行。
- 幂等：student_id 已存在则跳过该表；执行前物理备份；foreign_keys=OFF；单事务。

仅改 7 张表，不触碰 OperationLog/SecurityAudit/NLPRuleUsage/PhoneBoxPolicy 等审计列。
"""

import os
import shutil
import sqlite3
import sys
from datetime import datetime

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance", "score_management.db"
)

# (table, nullable, 是否补 FK) — fk=True 表示目标列应带 REFERENCES user(id)
CONFIG = {
    "score_record": {"nullable": True, "add_fk": False},  # 已有 FK
    "notification": {"nullable": True, "add_fk": False},  # 已有 FK
    "approval": {"nullable": True, "add_fk": False},  # 已有 FK
    "student_clusters": {"nullable": False, "add_fk": True},
    "composite_scores": {"nullable": False, "add_fk": True},
    "risk_warnings": {"nullable": False, "add_fk": True},
    "nlp_match_results": {"nullable": True, "add_fk": True},
}


def q(name):
    return '"' + name.replace('"', '""') + '"'


def backup(db_path):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = db_path + ".bak_unify_student_id_" + ts
    shutil.copy2(db_path, dst)
    return dst


def rename_column_with_alter(conn, table):
    """已有 FK 的表：简单 RENAME COLUMN（自动更新索引/FK 定义）。"""
    conn.execute(f'ALTER TABLE {q(table)} RENAME COLUMN "user_id" TO "student_id"')


def rebuild_table_add_fk(conn, table, nullable):
    """缺 FK 的表：重建并补 FK + 孤儿清理。"""
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({q(table)})")
    cols = cur.fetchall()  # cid,name,type,notnull,dflt,pk
    col_names = [c[1] for c in cols]
    if "student_id" in col_names:
        return "skip"  # 已迁移
    if "user_id" not in col_names:
        return "skip"

    # 建新表 DDL
    ddl = []
    for cid, name, ctype, notnull, dflt, pk in cols:
        if name == "user_id":
            name = "student_id"
            ctype = "INTEGER"
            fk_clause = ' REFERENCES "user"(id)'
        else:
            fk_clause = ""
        pk_clause = " PRIMARY KEY" if pk else ""
        nn_clause = " NOT NULL" if notnull else ""
        df_clause = f" DEFAULT {dflt}" if dflt is not None else ""
        ddl.append(f"{q(name)} {ctype}{pk_clause}{nn_clause}{df_clause}{fk_clause}")
    new_table = table + "_new"
    cur.execute(f"DROP TABLE IF EXISTS {q(new_table)}")
    cur.execute(f"CREATE TABLE {q(new_table)} ({', '.join(ddl)})")

    # 拷贝数据（孤儿清理）
    new_names = [("student_id" if c == "user_id" else c) for c in col_names]
    select_parts = []
    for c in col_names:
        if c == "user_id":
            if nullable:
                select_parts.append(
                    'CASE WHEN "user_id" IS NOT NULL AND "user_id" NOT IN (SELECT id FROM "user") '
                    'THEN NULL ELSE "user_id" END AS student_id'
                )
            else:
                select_parts.append('"user_id" AS student_id')
        else:
            select_parts.append(q(c))
    insert_sql = (
        f"INSERT INTO {q(new_table)} ({', '.join(q(n) for n in new_names)}) "
        f"SELECT {', '.join(select_parts)} FROM {q(table)}"
    )
    if not nullable:
        total = cur.execute(f"SELECT COUNT(*) FROM {q(table)}").fetchone()[0]
        insert_sql += ' WHERE "user_id" IS NULL OR "user_id" IN (SELECT id FROM "user")'
        cur.execute(insert_sql)
        kept = cur.execute(f"SELECT COUNT(*) FROM {q(new_table)}").fetchone()[0]
        orphans = total - kept
    else:
        cur.execute(insert_sql)
        orphans = 0
    print(f"  [{table}] 重建完成：拷贝行，孤儿(删除/置空)={orphans}")

    # 删旧表 + 改名
    cur.execute(f"DROP TABLE {q(table)}")
    cur.execute(f"ALTER TABLE {q(new_table)} RENAME TO {q(table)}")

    # 重建索引（含 user_id→student_id 重命名）
    cur.execute(f"PRAGMA index_list({q(table)})")
    indexes = cur.fetchall()  # seq,name,unique,origin,partial
    for seq, idx_name, unique, origin, partial in indexes:
        if origin == "pk":
            continue
        cur.execute(f"PRAGMA index_info({q(idx_name)})")
        idx_cols = [r[2] for r in cur.fetchall()]
        new_idx_cols = [("student_id" if c == "user_id" else c) for c in idx_cols]
        uniq = "UNIQUE " if unique else ""
        cur.execute(
            f"CREATE {uniq}INDEX {q(idx_name)} ON {q(table)} "
            f"({', '.join(q(c) for c in new_idx_cols)})"
        )
    return "rebuilt"


def clean_orphans_nullable(conn, table):
    """nullable 表：将孤儿 student_id 置 NULL（保留行，满足 FK）。"""
    cur = conn.cursor()
    n = cur.execute(
        f'UPDATE {q(table)} SET "student_id"=NULL WHERE "student_id" IS NOT NULL '
        f'AND "student_id" NOT IN (SELECT id FROM "user")'
    ).rowcount
    if n:
        print(f"  [clean] {table}: 置空 {n} 条孤儿 student_id（保留行）")
    return n


def verify(conn):
    cur = conn.cursor()
    ok = True
    for table, cfg in CONFIG.items():
        cur.execute(f"PRAGMA table_info({q(table)})")
        names = [r[1] for r in cur.fetchall()]
        has_student = "student_id" in names
        has_user = "user_id" in names
        # FK 检查
        cur.execute(f"PRAGMA foreign_key_list({q(table)})")
        fks = cur.fetchall()
        has_fk = any(r[2] == "user" for r in fks)
        if not has_student or has_user:
            print(f"  [FAIL] {table}: student_id={has_student} user_id={has_user}")
            ok = False
            continue
        if cfg["add_fk"] and not has_fk:
            print(f"  [FAIL] {table}: 缺少 FK→user")
            ok = False
            continue
        # 孤儿检查
        orn = cur.execute(
            f'SELECT COUNT(*) FROM {q(table)} WHERE "student_id" IS NOT NULL '
            f'AND "student_id" NOT IN (SELECT id FROM "user")'
        ).fetchone()[0]
        if orn:
            print(f"  [FAIL] {table}: 仍存 {orn} 条孤儿 student_id")
            ok = False
            continue
        print(f"  [OK] {table}: student_id 存在, FK={has_fk}, 孤儿=0")
    return ok


def main():
    if not os.path.exists(DB_PATH):
        print("DB 不存在:", DB_PATH)
        sys.exit(1)
    dst = backup(DB_PATH)
    print("已备份:", dst)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=OFF")
    try:
        for table, cfg in CONFIG.items():
            cur = conn.cursor()
            cur.execute(f"PRAGMA table_info({q(table)})")
            names = [r[1] for r in cur.fetchall()]
            if "student_id" in names:
                # 已迁移：对 nullable 表补做孤儿清理（幂等）
                if cfg["nullable"]:
                    clean_orphans_nullable(conn, table)
                else:
                    print(f"  [skip] {table}: student_id 已存在")
                continue
            if "user_id" not in names:
                print(f"  [skip] {table}: 无 user_id 列")
                continue
            if cfg["add_fk"]:
                res = rebuild_table_add_fk(conn, table, cfg["nullable"])
            else:
                rename_column_with_alter(conn, table)
                res = "renamed"
            # 已有 FK 的 nullable 表：清孤儿（置空保留行）
            if not cfg["add_fk"] and cfg["nullable"]:
                clean_orphans_nullable(conn, table)
            print(f"  [done] {table}: {res}")
        conn.commit()
        print("提交成功，开始校验...")
        if not verify(conn):
            conn.rollback()
            print("校验失败，已回滚（备份可用）")
            sys.exit(1)
        print("校验通过。")
    except Exception as e:
        conn.rollback()
        print("异常回滚:", repr(e))
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
