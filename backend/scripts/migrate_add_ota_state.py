"""
幂等迁移：为 device 表新增 OTA 自动推送所需列。

新增列：
- auto_update    BOOLEAN  是否允许后端自动推送 OTA（默认 True）
- ota_status     VARCHAR   idle/pending/upgrading/failed（默认 idle）
- last_ota_push_at DATETIME 最近一次自动推送指令下发时间

用法（激活后端 venv 后）：
    python scripts/migrate_add_ota_state.py

已存在则跳过（可安全重复执行）。
"""

import os
import sys
import sqlite3

# 让脚本能 import app / db
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db
from sqlalchemy import text


def main():
    db_path = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    # 支持 sqlite:/// 绝对/相对路径
    if db_path.startswith("sqlite:///"):
        # 去掉协议头，剩下相对 backend 的路径或绝对路径
        rest = db_path[len("sqlite:///") :]
        if rest.startswith("/"):
            sqlite_file = rest
        else:
            sqlite_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))), rest
            )
    else:
        sqlite_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "instance",
            "score_management.db",
        )

    if not os.path.exists(sqlite_file):
        print(f"[migrate] 数据库文件不存在: {sqlite_file}")
        sys.exit(1)

    cols = [
        r[1] for r in sqlite3.connect(sqlite_file).execute("PRAGMA table_info(device)").fetchall()
    ]
    targets = {
        "auto_update": "BOOLEAN",
        "ota_status": "VARCHAR(20)",
        "last_ota_push_at": "DATETIME",
    }
    added = []
    with sqlite3.connect(sqlite_file) as conn:
        for name, typ in targets.items():
            if name in cols:
                print(f"[migrate] device.{name} 已存在，跳过")
                continue
            conn.execute(f"ALTER TABLE device ADD COLUMN {name} {typ}")
            added.append(name)
    if added:
        print(f"[migrate] 已新增列: {', '.join(added)}")
    else:
        print("[migrate] 无需变更")

    # 使用 ORM 同步默认值（auto_update=True / ota_status='idle'）到已有行
    with app.app_context():
        updated = db.session.execute(
            text("UPDATE device SET auto_update = 1 WHERE auto_update IS NULL")
        )
        db.session.execute(
            text(
                "UPDATE device SET ota_status = 'idle' WHERE ota_status IS NULL OR ota_status = ''"
            )
        )
        db.session.commit()
        print(f"[migrate] 已同步默认值（auto_update 行数影响: {updated.rowcount}）")

    print("[migrate] 完成")


if __name__ == "__main__":
    main()
