"""
P1-2: 将 score_change 字段统一为浮点类型（REAL / Float）。

现状（2026-08-16 实测物理库）：
- score_record.score_change  : INTEGER  (3118 行)  -> 应改为 REAL
- approval.score_change      : INTEGER  (0 行)     -> 应改为 REAL
- study_group_score.score_change     : FLOAT  (已是，跳过)
- nlp_match_results.score_change    : FLOAT  (已是，跳过)

SQLite 不支持 ALTER COLUMN 改类型，采用「建新表 -> 拷数据 -> 删旧 -> 改名」重建，
并保持索引与数据完整。幂等：若已是 REAL/FLOAT 则跳过；若表不存在则跳过。

运行：系统 Python 3.11
  python scripts/migrate_score_change_float.py
"""
import os
import re
import sys
import shutil
import sqlite3
from datetime import datetime

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from app import app

DB_URI = app.config.get("SQLALCHEMY_DATABASE_URI", "")
if not DB_URI.startswith("sqlite:///"):
    raise SystemExit(f"非预期数据库类型: {DB_URI}")

DB_PATH = os.path.abspath(DB_URI[len("sqlite:///"):])
if not os.path.exists(DB_PATH):
    raise SystemExit(f"数据库文件不存在: {DB_PATH}")


def backup_db():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{DB_PATH}.pre_P12_{ts}"
    shutil.copy2(DB_PATH, dst)
    print(f"[backup] {DB_PATH} -> {dst}")
    return dst


def retype_table(conn, tbl):
    cur = conn.cursor()
    cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{tbl}'")
    if not cur.fetchone():
        print(f"[skip] 表 {tbl} 不存在，跳过")
        return

    cur.execute(f"PRAGMA table_info({tbl})")
    cols = {r[1]: r[2] for r in cur.fetchall()}
    cur_typ = cols.get("score_change", "")
    if cur_typ.upper() in ("REAL", "FLOAT", "DOUBLE"):
        print(f"[skip] {tbl}.score_change 已是 {cur_typ}，无需处理")
        return

    print(f"[start] {tbl}.score_change 当前 {cur_typ}，重建为 REAL")

    # 读取原建表 SQL 与索引定义（RENAME 之前读取，引用原表名）
    cur.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{tbl}'")
    create_sql = cur.fetchone()[0]
    cur.execute(
        f"SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='{tbl}' AND sql IS NOT NULL"
    )
    index_sqls = [r[0] for r in cur.fetchall()]

    # 替换 score_change 类型为 REAL，并改表名为 _new
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

    cur.execute(f"SELECT COUNT(*) FROM {tbl}_old")
    old_n = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {tbl}_new")
    new_n = cur.fetchone()[0]
    if old_n != new_n:
        raise SystemExit(f"[error] {tbl} 行数不一致 old={old_n} new={new_n}，回滚")

    cur.execute(f"DROP TABLE {tbl}_old")
    cur.execute(f"ALTER TABLE {tbl}_new RENAME TO {tbl}")

    # 重建索引（索引定义引用原表名，此时 tbl 已是新表）
    for ix in index_sqls:
        try:
            cur.execute(ix)
        except sqlite3.OperationalError as e:
            print(f"[warn] 重建索引跳过: {e}")

    print(f"[done] {tbl}.score_change -> REAL (rows={new_n})")


def main():
    backup_db()
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys=OFF")
        retype_table(conn, "score_record")
        retype_table(conn, "approval")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.commit()
        print("[done] P1-2 score_change 类型统一完成")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败并回滚: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
