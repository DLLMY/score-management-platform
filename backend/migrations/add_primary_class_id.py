""" """

"""
为admin表添加primary_class_id字段
"""
"""
"""

import os
import sys

from app import create_app
from models import db
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def column_exists(conn, table_name, column_name):
    cursor = conn.execute(db.text(f"PRAGMA table_info({table_name})"))
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


app = create_app()

with app.app_context():
    print("Running migration: adding primary_class_id column to admin table...")

    try:
        with db.engine.connect() as conn:
            if not column_exists(conn, "admin", "primary_class_id"):
                print("Adding primary_class_id column...")
                conn.execute(db.text("""
                    ALTER TABLE admin ADD COLUMN primary_class_id INTEGER
                """))
                print("Creating index for primary_class_id...")
                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_admin_primary_class_id ON admin(primary_class_id)
                """))
                conn.commit()
                print("   primary_class_id column added successfully")
            else:
                print("   primary_class_id column already exists")

        print("\nMigration completed successfully!")
    except Exception as e:
        print(f"\nError during migration: {e}")

        traceback.print_exc()
