""" """

"""
创建课程表数据表
"""
"""
"""

import os
import sys

from app import app, db

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


with app.app_context():
    print("Creating course_schedule table...")

    try:
        with db.engine.connect() as conn:
            conn.execute(db.text("""
                CREATE TABLE IF NOT EXISTS course_schedule (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    class_info_id INTEGER NOT NULL,
                    subject_id INTEGER NOT NULL,
                    day_of_week INTEGER NOT NULL,
                    period_number INTEGER NOT NULL,
                    teacher_name VARCHAR(100),
                    classroom VARCHAR(100),
                    description VARCHAR(500),
                    color VARCHAR(20) DEFAULT '#3B82F6',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (class_info_id) REFERENCES class_info(id),
                    FOREIGN KEY (subject_id) REFERENCES subject(id),
                    UNIQUE(class_info_id, day_of_week, period_number)
                )
            """))

            conn.execute(db.text("""
                CREATE INDEX IF NOT EXISTS idx_course_schedule_class ON course_schedule(class_info_id)
            """))

            conn.execute(db.text("""
                CREATE INDEX IF NOT EXISTS idx_course_schedule_day_period ON course_schedule(day_of_week, period_number)
            """))

            conn.commit()

        print("course_schedule table created successfully!")
    except Exception as e:
        print(f"Error creating table: {e}")
