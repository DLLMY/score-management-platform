"""
数据库架构修复迁移脚本
- 为admin表添加force_password_change字段
- 创建scheduled_notify表（如果不存在）
- 添加必要的索引
"""

import os
import sys

from app import app
from models import db
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def table_exists(conn, table_name):
    cursor = conn.execute(
        db.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"), {"name": table_name}
    )
    return cursor.fetchone() is not None


def column_exists(conn, table_name, column_name):
    cursor = conn.execute(db.text(f"PRAGMA table_info({table_name})"))
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


with app.app_context():
    print("Running migration: fixing database schema...")

    try:
        with db.engine.connect() as conn:
            print("1. Adding force_password_change column to admin table...")
            if not column_exists(conn, "admin", "force_password_change"):
                conn.execute(db.text("""
                    ALTER TABLE admin ADD COLUMN force_password_change BOOLEAN DEFAULT 0
                """))
                print("   force_password_change column added")
            else:
                print("   force_password_change column already exists")

            print("2. Creating scheduled_notify table...")
            if not table_exists(conn, "scheduled_notify"):
                conn.execute(db.text("""
                    CREATE TABLE scheduled_notify (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        text TEXT,
                        volume REAL DEFAULT 1.0,
                        speak BOOLEAN DEFAULT 0,
                        popup BOOLEAN DEFAULT 1,
                        timeout_sec INTEGER DEFAULT 5,
                        urgent BOOLEAN DEFAULT 0,
                        send_mode TEXT,
                        device_id TEXT,
                        scheduled_at TEXT,
                        repeat_type TEXT DEFAULT 'once',
                        repeat_interval INTEGER,
                        repeat_day_of_week INTEGER,
                        repeat_end_at TEXT,
                        status TEXT DEFAULT 'pending',
                        last_sent_at TEXT,
                        next_send_at TEXT,
                        template_id INTEGER,
                        created_by INTEGER,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                print("   scheduled_notify table created")

                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_scheduled_notify_status ON scheduled_notify(status)
                """))
                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_scheduled_notify_next_send ON scheduled_notify(next_send_at)
                """))
                print("   Indexes created for scheduled_notify")
            else:
                print("   scheduled_notify table already exists")

            print("3. Adding missing indexes...")
            try:
                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_admin_role ON admin(role)
                """))
                print("   Index idx_admin_role created")
            except Exception as e:
                print(f"   Index idx_admin_role already exists: {e}")

            try:
                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_user_class_name ON user(class_name)
                """))
                print("   Index idx_user_class_name created")
            except Exception as e:
                print(f"   Index idx_user_class_name already exists: {e}")

            conn.commit()

        print("\nAll database schema migrations completed successfully!")
    except Exception as e:
        print(f"\nError during migration: {e}")

        traceback.print_exc()
