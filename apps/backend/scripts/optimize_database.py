from datetime import datetime
from sqlalchemy import text, Table, MetaData
from app import app
from models import db
import os
import sys

"""
数据库索引优化脚本
为高频查询场景添加复合索引，提升查询性能
"""
"""
"""
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# (索引名, DDL 原文) —— 顺序即创建顺序
INDEX_DEFS = [
    (
        "idx_notification_user_status",
        """
                    CREATE INDEX IF NOT EXISTS idx_notification_user_status
                    ON notification(user_id, status, created_at)
                """,
    ),
    (
        "idx_approval_status_created",
        """
                    CREATE INDEX IF NOT EXISTS idx_approval_status_created
                    ON approval(status, created_at, user_id)
                """,
    ),
    (
        "idx_score_exam_student_subject",
        """
                    CREATE INDEX IF NOT EXISTS idx_score_exam_student_subject
                    ON scores(exam_id, student_id, subject)
                """,
    ),
    (
        "idx_score_student_exam",
        """
                    CREATE INDEX IF NOT EXISTS idx_score_student_exam
                    ON scores(student_id, exam_id)
                """,
    ),
    (
        "idx_class_info_grade_active",
        """
                    CREATE INDEX IF NOT EXISTS idx_class_info_grade_active
                    ON class_info(grade, is_active)
                """,
    ),
    (
        "idx_device_heartbeat_device_time",
        """
                    CREATE INDEX IF NOT EXISTS idx_device_heartbeat_device_time
                    ON device_heartbeat(device_id, timestamp DESC)
                """,
    ),
    (
        "idx_admin_username_role",
        """
                    CREATE INDEX IF NOT EXISTS idx_admin_username_role
                    ON admin(username, role)
                """,
    ),
    (
        "idx_admin_class_admin_class",
        """
                    CREATE INDEX IF NOT EXISTS idx_admin_class_admin_class
                    ON admin_class(admin_id, class_info_id)
                """,
    ),
    (
        "idx_exam_status_time",
        """
                    CREATE INDEX IF NOT EXISTS idx_exam_status_time
                    ON exams(status, start_time, class_id)
                """,
    ),
    (
        "idx_alert_unread_severity",
        """
                    CREATE INDEX IF NOT EXISTS idx_alert_unread_severity
                    ON alert(is_read, severity, created_at DESC)
                """,
    ),
    (
        "idx_alert_student_source_resolved",
        """
                    CREATE INDEX IF NOT EXISTS idx_alert_student_source_resolved
                    ON alert(student_id, source, is_resolved)
                """,
    ),
    (
        "idx_composite_score_user_ranking",
        """
                    CREATE INDEX IF NOT EXISTS idx_composite_score_user_ranking
                    ON composite_scores(user_id, ranking, composite_score DESC)
                """,
    ),
    (
        "idx_mqtt_config_active",
        """
                    CREATE INDEX IF NOT EXISTS idx_mqtt_config_active
                    ON mqtt_config(is_active)
                """,
    ),
    (
        "idx_system_config_key",
        """
                    CREATE INDEX IF NOT EXISTS idx_system_config_key
                    ON system_config(config_key)
                """,
    ),
    (
        "idx_time_rule_active_class",
        """
                    CREATE INDEX IF NOT EXISTS idx_time_rule_active_class
                    ON time_rule(is_active, class_info_id)
                """,
    ),
    (
        "idx_score_record_user_rule_created",
        """
                    CREATE INDEX IF NOT EXISTS idx_score_record_user_rule_created
                    ON score_record(user_id, rule_id, created_at DESC)
                """,
    ),
    (
        "idx_user_class_score",
        """
                    CREATE INDEX IF NOT EXISTS idx_user_class_score
                    ON user(class_name, current_score DESC)
                """,
    ),
]

def _create_index(conn, name, ddl, created):
    """创建单个索引；成功记入 created，失败打印（保持原 try/except 语义）。"""
    try:
        conn.execute(text(ddl))
        created.append(name)
    except Exception as e:
        print(f"创建索引 {name} 失败: {e}")


def create_missing_indexes():
    """创建缺失的索引"""
    indexes_created = []
    with app.app_context():
        with db.engine.connect() as conn:
            for name, ddl in INDEX_DEFS:
                _create_index(conn, name, ddl, indexes_created)
            conn.commit()
        print(f"\n成功创建 {len(indexes_created)} 个索引")
        for idx in indexes_created:
            print(f"  OK {idx}")


def analyze_table_sizes():
    """分析表大小"""
    with app.app_context():
        print("\n=== 表大小分析 ===")
        with db.engine.connect() as conn:
            tables_result = conn.execute(text("""
                SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
            """))
            tables = tables_result.fetchall()
            metadata = MetaData()
            for table in tables:
                table_name = table[0]
                try:
                    table_obj = Table(table_name, metadata, autoload_with=db.engine)
                    row_count = conn.execute(table_obj.count()).scalar()
                except Exception:
                    row_count = "N/A"
                try:
                    idx_count_result = conn.execute(
                        text(
                            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=:name"
                        ),
                        {"name": table_name},
                    )
                    idx_count = idx_count_result.scalar()
                except Exception:
                    idx_count = "N/A"
                print(f"  {table_name:<30} 行数: {row_count:<8} 索引数: {idx_count}")


def optimize_database():
    """执行数据库优化（VACUUM）"""
    with app.app_context():
        print("\n=== 执行数据库优化 ===")
        print("正在执行 VACUUM...")
        try:
            with db.engine.connect() as conn:
                conn.execute(text("VACUUM"))
                conn.commit()
            print("OK VACUUM 执行完成")
            with db.engine.connect() as conn:
                conn.execute(text("ANALYZE"))
                conn.commit()
            print("OK ANALYZE 执行完成")
        except Exception as e:
            print(f"优化执行失败: {e}")


def main():
    print("=" * 60)
    print("数据库索引优化脚本")
    print(f"执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    analyze_table_sizes()
    create_missing_indexes()
    optimize_database()
    print("\n" + "=" * 60)
    print("优化完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
