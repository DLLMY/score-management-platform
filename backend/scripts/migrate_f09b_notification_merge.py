"""
F9-B: 将 admin_notifications 物理合并进 notification 表。

背景：
- 原 admin_notifications 表存放管理员通知中心数据（1 行），notification 表存放用户短信/通知（12 行）。
- 合并后统一用 notification 表，新增 recipient_type 列区分接收方（'user' | 'admin'）。
- 物理表命名：AdminNotification 有 __tablename__='admin_notifications'；Notification 无 __tablename__，物理名='notification'（单数）。

字段映射（admin_notifications -> notification, recipient_type='admin'）：
- message -> content
- status 无对应 -> 置 'sent'
- user_id 置 NULL

操作（幂等、单事务）：
1. 物理备份
2. 关闭 FK
3. 给 notification 增加 recipient_type/admin_id/priority/is_read/read_at/extra_data（已存在跳过）
4. 既有 user 通知的 recipient_type 置 'user'（ADD COLUMN DEFAULT 已生效；此处再显式确认）
5. 拷贝 admin_notifications 全部行 -> notification(recipient_type='admin')
6. 校验拷贝行数
7. 删除 admin_notifications
8. 恢复 FK 并提交

运行：系统 Python 3.11
  python scripts/migrate_f09b_notification_merge.py
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

DB_PATH = os.path.abspath(DB_URI[len("sqlite:///") :])
if not os.path.exists(DB_PATH):
    raise SystemExit(f"数据库文件不存在: {DB_PATH}")


def backup_db():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{DB_PATH}.pre_F09B_{ts}"
    shutil.copy2(DB_PATH, dst)
    print(f"[backup] {DB_PATH} -> {dst}")
    return dst


def main():
    backup_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA foreign_keys=OFF")

        cur.execute("PRAGMA table_info(notification)")
        existing = {row[1] for row in cur.fetchall()}
        for col, ddl in [
            ("recipient_type", "VARCHAR(20) DEFAULT 'user'"),
            ("admin_id", "INTEGER"),
            ("priority", "VARCHAR(20) DEFAULT 'normal'"),
            ("is_read", "BOOLEAN DEFAULT 0"),
            ("read_at", "DATETIME"),
            ("extra_data", "TEXT"),
        ]:
            if col not in existing:
                cur.execute(f"ALTER TABLE notification ADD COLUMN {col} {ddl}")
                print(f"[alter] notification 增加列 {col}")
            else:
                print(f"[alter] notification 列 {col} 已存在，跳过")

        # 显式确认既有用户通知 recipient_type='user'（ADD COLUMN DEFAULT 通常已生效，双保险）
        cur.execute(
            "UPDATE notification SET recipient_type='user' WHERE recipient_type IS NULL OR recipient_type=''"
        )
        print("[update] 既有通知 recipient_type 置 'user'")

        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='admin_notifications'"
        )
        if not cur.fetchone():
            print("[copy] admin_notifications 表不存在，无需合并（可能已执行过）")
            cur.execute("PRAGMA foreign_keys=ON")
            conn.commit()
            conn.close()
            return

        cur.execute("SELECT COUNT(*) FROM admin_notifications")
        src_count = cur.fetchone()[0]
        print(f"[copy] admin_notifications 现有 {src_count} 行")

        cur.execute("""
            INSERT INTO notification (
                user_id, type, title, content, status, phone, created_at, sent_at,
                recipient_type, admin_id, priority, is_read, read_at, extra_data
            )
            SELECT
                NULL, type, title, message, 'sent', NULL, created_at, NULL,
                'admin', admin_id, priority, is_read, read_at, extra_data
            FROM admin_notifications
            """)
        cur.execute("SELECT COUNT(*) FROM notification WHERE recipient_type='admin'")
        dst_count = cur.fetchone()[0]
        print(f"[copy] notification(recipient_type='admin') 现有 {dst_count} 行")

        if src_count and dst_count < src_count:
            raise SystemExit(f"[copy] 校验失败: 期望 >= {src_count} 行，实际 {dst_count} 行，回滚")

        cur.execute("DROP TABLE admin_notifications")
        print("[drop] admin_notifications 表已删除")

        cur.execute("PRAGMA foreign_keys=ON")
        conn.commit()
        print("[done] F9-B 合并完成")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败并回滚: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
