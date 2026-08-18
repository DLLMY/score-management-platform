"""
F9-C: 为通知相关表补充外键关联列。

- scheduled_notifies 增加 template_id INTEGER REFERENCES notify_templates(id)
- notify_histories 增加 notification_id INTEGER REFERENCES notification(id)

说明：
- 两张表当前均为空表（0 行），新增 FK 列安全。
- FK 目标物理表名：notify_templates（NotifyTemplate.__tablename__）、notification（无 __tablename__，单数物理名）。

操作（幂等、单事务）：
1. 物理备份
2. 关闭 FK
3. 列不存在则 ALTER ADD COLUMN（带 REFERENCES）；存在则跳过
4. 恢复 FK 并提交
"""
import os
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

# 磁盘空间阈值：完整备份约 2.3G，低于阈值则跳过文件备份（依赖 pre_F09B 回滚基线）
FREE_SPACE_THRESHOLD = 5 * 1024 * 1024 * 1024


def free_space(path):
    try:
        return shutil.disk_usage(path).free
    except Exception:
        return 0


def backup_db():
    free = free_space(os.path.dirname(DB_PATH))
    if free < FREE_SPACE_THRESHOLD:
        print(
            f"[warn] 可用空间仅 {free / 1024 / 1024 / 1024:.2f}GB，低于 {FREE_SPACE_THRESHOLD / 1024 / 1024 / 1024:.0f}GB 阈值，"
            f"跳过完整文件备份。回滚基线依赖已存在的 pre_F09B 备份 + DROP COLUMN 可逆操作。"
        )
        return None
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{DB_PATH}.pre_F09C_{ts}"
    shutil.copy2(DB_PATH, dst)
    print(f"[backup] {DB_PATH} -> {dst}")
    return dst


def add_column_if_missing(cur, table, col, ddl):
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    if col in existing:
        print(f"[alter] {table}.{col} 已存在，跳过")
        return
    cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
    print(f"[alter] {table} 增加列 {col} ({ddl})")


def main():
    backup_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA foreign_keys=OFF")

        # scheduled_notifies.template_id -> notify_templates(id)
        add_column_if_missing(
            cur, "scheduled_notifies", "template_id",
            "INTEGER REFERENCES notify_templates(id)",
        )

        # notify_histories.notification_id -> notification(id)
        add_column_if_missing(
            cur, "notify_histories", "notification_id",
            "INTEGER REFERENCES notification(id)",
        )

        cur.execute("PRAGMA foreign_keys=ON")
        conn.commit()
        print("[done] F9-C 外键关联列补充完成")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败并回滚: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
