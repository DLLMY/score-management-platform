#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
P1-2 补遗：nlp_scoring_rules / nlp_rule_usages 的 score_change INTEGER -> REAL（幂等）

背景：P1-2 当时只重建了 score_record/approval；NLP 两张表 score_change 仍声明 INTEGER。
SQLite 不支持 ALTER COLUMN 改类型，采用「建新表 -> 拷数据 -> 删旧 -> 改名」重建并保持索引。
表小（nlp_scoring_rules 57 行 / nlp_rule_usages 0 行），不整库备份（磁盘紧），依赖既有 pre 基线。

用法：
  python scripts/migrate_nlp_score_change_float.py            # 执行
  python scripts/migrate_nlp_score_change_float.py --check-only  # 仅报告
"""
import os
import re
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "instance", "score_management.db")
CHECK_ONLY = "--check-only" in sys.argv

TARGETS = ("nlp_scoring_rules", "nlp_rule_usages")


def retype_table(conn, tbl):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
    if not cur.fetchone():
        print(f"[skip] 表 {tbl} 不存在，跳过")
        return
    cur.execute(f"PRAGMA table_info({tbl})")
    cols = {r[1]: r[2] for r in cur.fetchall()}
    cur_typ = cols.get("score_change", "")
    if cur_typ.upper() in ("REAL", "FLOAT", "DOUBLE"):
        print(f"[skip] {tbl}.score_change 已是 {cur_typ}，无需处理")
        return
    if CHECK_ONLY:
        print(f"[check-only] {tbl}.score_change 当前 {cur_typ}，待重建为 REAL（未修改）")
        return

    print(f"[start] {tbl}.score_change 当前 {cur_typ}，重建为 REAL")
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
    create_sql = cur.fetchone()[0]
    cur.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
        (tbl,),
    )
    index_sqls = [r[0] for r in cur.fetchall()]

    new_create = re.sub(r"\bscore_change\s+INTEGER", "score_change REAL", create_sql, flags=re.I)
    new_create = re.sub(
        r"CREATE TABLE\s+\"?%s\"?" % re.escape(tbl),
        f"CREATE TABLE {tbl}_new",
        new_create,
        flags=re.I,
    )

    cur.execute(f"ALTER TABLE {tbl} RENAME TO {tbl}_old")
    cur.execute(new_create)
    col_list = list(cols.keys())
    cur.execute(
        f"INSERT INTO {tbl}_new ({','.join(col_list)}) SELECT {','.join(col_list)} FROM {tbl}_old"
    )
    old_n = cur.execute(f"SELECT COUNT(*) FROM {tbl}_old").fetchone()[0]
    new_n = cur.execute(f"SELECT COUNT(*) FROM {tbl}_new").fetchone()[0]
    if old_n != new_n:
        raise RuntimeError(f"{tbl} 行数不一致 old={old_n} new={new_n}")
    cur.execute(f"DROP TABLE {tbl}_old")
    cur.execute(f"ALTER TABLE {tbl}_new RENAME TO {tbl}")
    for ix in index_sqls:
        try:
            cur.execute(ix)
        except sqlite3.OperationalError as e:
            print(f"[warn] 重建索引跳过: {e}")
    print(f"[done] {tbl}.score_change -> REAL (rows={new_n})")


def main():
    if not os.path.exists(DB_PATH):
        print(f"[error] 找不到数据库: {DB_PATH}")
        sys.exit(2)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys=OFF")
        for tbl in TARGETS:
            retype_table(conn, tbl)
        conn.execute("PRAGMA foreign_keys=ON")
        conn.commit()
        print("[done] NLP score_change 类型统一完成")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败并回滚: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
