# -*- coding: utf-8 -*-
"""幂等迁移脚本（R2 修复）：user 表加 weekly_unlock_count / week_start_date 列。

UnlockValidator 的周开锁限额此前依赖内存属性（模型无对应列）→ 周限额从不持久化。
此处为 SQLite 幂等 ADD COLUMN（已存在则跳过）。

用法（须系统 Python 3.11）:
    python scripts/migrate_user_weekly_unlock.py
"""
import os
import sqlite3

DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "instance", "score_management.db"))


def main():
    if not os.path.exists(DB):
        print("[migrate] DB 不存在，跳过:", DB)
        return
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    try:
        cols = [r[1] for r in cur.execute("PRAGMA table_info(user)").fetchall()]
        added = []
        if "weekly_unlock_count" not in cols:
            cur.execute("ALTER TABLE user ADD COLUMN weekly_unlock_count INTEGER DEFAULT 0")
            added.append("weekly_unlock_count")
        if "week_start_date" not in cols:
            cur.execute("ALTER TABLE user ADD COLUMN week_start_date DATE")
            added.append("week_start_date")
        conn.commit()
        print("[migrate] user 表新增列:", added if added else "（均已存在，跳过）")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
