import os
import sys

from app import app
from models import db

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_migration():
    with app.app_context():
        from sqlalchemy import text

        print("开始数据迁移：将score_change字段从INTEGER改为FLOAT")

        try:
            db.session.execute(text("ALTER TABLE score_record ALTER COLUMN score_change TYPE REAL"))
            db.session.commit()
            print("成功修改 score_record.score_change 类型")
        except Exception as e:
            if "no such column" in str(e).lower():
                print("字段不存在，跳过")
            else:
                print(f"修改score_record失败: {e}")
                print("尝试使用SQLite兼容方式...")
                try:
                    db.session.execute(text("""
                        CREATE TABLE score_record_new (
                            id INTEGER PRIMARY KEY,
                            user_id INTEGER,
                            rule_id INTEGER,
                            score_change REAL NOT NULL,
                            description TEXT,
                            operator TEXT,
                            created_at DATETIME,
                            operation_log_id INTEGER,
                            FOREIGN KEY (user_id) REFERENCES user(id),
                            FOREIGN KEY (rule_id) REFERENCES score_rule(id),
                            FOREIGN KEY (operation_log_id) REFERENCES operation_log(id)
                        )
                    """))
                    db.session.execute(text("""
                        INSERT INTO score_record_new
                        SELECT id, user_id, rule_id, CAST(score_change AS REAL),
                               description, operator, created_at, operation_log_id
                        FROM score_record
                    """))
                    db.session.execute(text("DROP TABLE score_record"))
                    db.session.execute(text("ALTER TABLE score_record_new RENAME TO score_record"))

                    db.session.execute(
                        text("CREATE INDEX idx_score_record_user_created_new ON score_record(user_id, created_at)")
                    )
                    db.session.execute(
                        text("CREATE INDEX idx_score_record_rule_created_new ON score_record(rule_id, created_at)")
                    )
                    db.session.execute(
                        text(
                            "CREATE INDEX idx_score_record_cover_new ON "
                            "score_record(user_id, rule_id, score_change, created_at)"
                        )
                    )
                    db.session.execute(
                        text("CREATE INDEX idx_score_record_operation_log_new ON score_record(operation_log_id)")
                    )

                    db.session.commit()
                    print("使用SQLite兼容方式成功修改score_record")
                except Exception as e2:
                    print(f"SQLite兼容方式也失败: {e2}")

        try:
            db.session.execute(text("ALTER TABLE approval ALTER COLUMN score_change TYPE REAL"))
            db.session.commit()
            print("成功修改 approval.score_change 类型")
        except Exception as e:
            if "no such column" in str(e).lower():
                print("字段不存在，跳过")
            else:
                print(f"修改approval失败: {e}")
                try:
                    db.session.execute(text("""
                        CREATE TABLE approval_new (
                            id INTEGER PRIMARY KEY,
                            user_id INTEGER,
                            type TEXT NOT NULL,
                            title TEXT,
                            description TEXT,
                            score_change REAL,
                            status TEXT,
                            approver_id INTEGER,
                            approve_time DATETIME,
                            comment TEXT,
                            created_at DATETIME,
                            FOREIGN KEY (user_id) REFERENCES user(id)
                        )
                    """))
                    db.session.execute(text("""
                        INSERT INTO approval_new
                        SELECT id, user_id, type, title, description,
                               CAST(score_change AS REAL), status, approver_id,
                               approve_time, comment, created_at
                        FROM approval
                    """))
                    db.session.execute(text("DROP TABLE approval"))
                    db.session.execute(text("ALTER TABLE approval_new RENAME TO approval"))
                    db.session.commit()
                    print("使用SQLite兼容方式成功修改approval")
                except Exception as e2:
                    print(f"SQLite兼容方式也失败: {e2}")

        print("迁移完成!")


if __name__ == "__main__":
    run_migration()
