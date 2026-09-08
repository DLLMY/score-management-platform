"""
数据库迁移脚本：创建考试科目关联表exam_subjects
"""

import os
import sys

from app import app, db
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def table_exists(conn, table_name):
    """检查表是否存在"""
    cursor = conn.execute(
        db.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"), {"name": table_name}
    )
    return cursor.fetchone() is not None


def column_exists(conn, table_name, column_name):
    """检查字段是否存在"""
    cursor = conn.execute(db.text("PRAGMA table_info(:table_name)"), {"table_name": table_name})
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


def constraint_exists(conn, table_name, constraint_name):
    """检查约束是否存在"""
    cursor = conn.execute(db.text("PRAGMA foreign_key_list(:table_name)"), {"table_name": table_name})
    constraints = [row[7] for row in cursor.fetchall()]
    return constraint_name in constraints


with app.app_context():
    print("Running migration: creating exam_subjects table...")

    try:
        with db.engine.connect() as conn:
            print("1. Creating exam_subjects table...")
            if not table_exists(conn, "exam_subjects"):
                conn.execute(db.text("""
                    CREATE TABLE exam_subjects (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        exam_id INTEGER NOT NULL,
                        subject_id INTEGER NOT NULL,
                        full_score REAL DEFAULT 100,
                        `order` INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
                        FOREIGN KEY (subject_id) REFERENCES subject(id) ON DELETE CASCADE,
                        UNIQUE (exam_id, subject_id)
                    )
                """))
                print("   exam_subjects table created successfully")
            else:
                print("   exam_subjects table already exists")

            # 创建索引
            print("\n2. Creating indexes...")
            try:
                conn.execute(db.text("CREATE INDEX idx_exam_subjects_exam ON exam_subjects(exam_id)"))
                print("   idx_exam_subjects_exam index created")
            except Exception as e:
                print(f"   idx_exam_subjects_exam index already exists or error: {e}")

            try:
                conn.execute(db.text("CREATE INDEX idx_exam_subjects_subject ON exam_subjects(subject_id)"))
                print("   idx_exam_subjects_subject index created")
            except Exception as e:
                print(f"   idx_exam_subjects_subject index already exists or error: {e}")

            conn.commit()

        print("\nMigration completed successfully!")
        print("\nSummary:")
        print("- exam_subjects table created with foreign key constraints")
        print("- Indexes created for exam_id and subject_id")
        print("- Unique constraint on (exam_id, subject_id)")

    except Exception as e:
        print(f"\nError during migration: {e}")

        traceback.print_exc()
        sys.exit(1)
