""" """

"""
添加外键关联字段迁移脚本
"""
-course_schedule表添加teacher_id外键关联admin表
-scores表添加subject_id外键关联subject表
"""
"""

import os
import sys

from app import app, db
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def column_exists(conn, table_name, column_name):
    cursor = conn.execute(db.text(f"PRAGMA table_info({table_name})"))
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


with app.app_context():
    print("Running migration: adding foreign key fields...")

    try:
        with db.engine.connect() as conn:
            print("1. Adding teacher_id to course_schedule table...")
            if not column_exists(conn, "course_schedule", "teacher_id"):
                conn.execute(db.text("""
                    ALTER TABLE course_schedule ADD COLUMN teacher_id INTEGER
                """))
                print("   teacher_id column added")
            else:
                print("   teacher_id column already exists")

            try:
                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_course_schedule_teacher ON course_schedule(teacher_id)
                """))
                print("   Index idx_course_schedule_teacher created")
            except Exception as e:
                print(f"   Index already exists: {e}")

            print("2. Adding subject_id to scores table...")
            if not column_exists(conn, "scores", "subject_id"):
                conn.execute(db.text("""
                    ALTER TABLE scores ADD COLUMN subject_id INTEGER
                """))
                print("   subject_id column added")
            else:
                print("   subject_id column already exists")

            try:
                conn.execute(db.text("""
                    CREATE INDEX IF NOT EXISTS idx_score_subject ON scores(subject_id)
                """))
                print("   Index idx_score_subject created")
            except Exception as e:
                print(f"   Index already exists: {e}")

            conn.commit()

        print("\nAll migrations completed successfully!")
    except Exception as e:
        print(f"\nError during migration: {e}")

        traceback.print_exc()
