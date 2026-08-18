from datetime import datetime
from sqlalchemy import text, Table, MetaData
from app import app
from models import db
import os
import sys
from models import User
from models import Admin

"""
数据库索引优化脚本
为高频查询场景添加复合索引，提升查询性能
"""
"""
"""
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def create_missing_indexes():
    """创建缺失的索引"""
    indexes_created = []
    with app.app_context():
        with db.engine.connect() as conn:
            # 1. Notification: 用户通知列表查询（高频）
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_notification_user_status
                    ON notification(user_id, status, created_at)
                """))
                indexes_created.append("idx_notification_user_status")
            except Exception as e:
                print(f"创建索引 idx_notification_user_status 失败: {e}")
            # 2. Approval: 审批列表查询（按状态和时间）
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_approval_status_created
                    ON approval(status, created_at, user_id)
                """))
                indexes_created.append("idx_approval_status_created")
            except Exception as e:
                print(f"创建索引 idx_approval_status_created 失败: {e}")
            # 3. Score: 考试成绩查询（高频）
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_score_exam_student_subject
                    ON scores(exam_id, student_id, subject)
                """))
                indexes_created.append("idx_score_exam_student_subject")
            except Exception as e:
                print(f"创建索引 idx_score_exam_student_subject 失败: {e}")
            # 4. Score: 学生成绩查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_score_student_exam
                    ON scores(student_id, exam_id)
                """))
                indexes_created.append("idx_score_student_exam")
            except Exception as e:
                print(f"创建索引 idx_score_student_exam 失败: {e}")
            # 5. ClassInfo: 按年级查询班级
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_class_info_grade_active
                    ON class_info(grade, is_active)
                """))
                indexes_created.append("idx_class_info_grade_active")
            except Exception as e:
                print(f"创建索引 idx_class_info_grade_active 失败: {e}")
            # 6. DeviceHeartbeat: 设备心跳查询（高频写入/查询）
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_device_heartbeat_device_time
                    ON device_heartbeat(device_id, timestamp DESC)
                """))
                indexes_created.append("idx_device_heartbeat_device_time")
            except Exception as e:
                print(f"创建索引 idx_device_heartbeat_device_time 失败: {e}")
            # 7. Admin: 管理员按用户名和角色查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_admin_username_role
                    ON admin(username, role)
                """))
                indexes_created.append("idx_admin_username_role")
            except Exception as e:
                print(f"创建索引 idx_admin_username_role 失败: {e}")
            # 8. AdminClass: 管理员班级关联查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_admin_class_admin_class
                    ON admin_class(admin_id, class_info_id)
                """))
                indexes_created.append("idx_admin_class_admin_class")
            except Exception as e:
                print(f"创建索引 idx_admin_class_admin_class 失败: {e}")
            # 9. Exam: 考试按状态和时间查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_exam_status_time
                    ON exams(status, start_time, class_id)
                """))
                indexes_created.append("idx_exam_status_time")
            except Exception as e:
                print(f"创建索引 idx_exam_status_time 失败: {e}")
            # 10. Alert: 告警查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_alert_unread_severity
                    ON alert(is_read, severity, created_at DESC)
                """))
                indexes_created.append("idx_alert_unread_severity")
            except Exception as e:
                print(f"创建索引 idx_alert_unread_severity 失败: {e}")
            # 11. Alert(风险/心理预警): P0-6 合并后 student 预警落在 alert(source IN ('risk','mental'))
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_alert_student_source_resolved
                    ON alert(student_id, source, is_resolved)
                """))
                indexes_created.append("idx_alert_student_source_resolved")
            except Exception as e:
                print(f"创建索引 idx_alert_student_source_resolved 失败: {e}")
            # 12. CompositeScore: 综合评分查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_composite_score_user_ranking
                    ON composite_scores(user_id, ranking, composite_score DESC)
                """))
                indexes_created.append("idx_composite_score_user_ranking")
            except Exception as e:
                print(f"创建索引 idx_composite_score_user_ranking 失败: {e}")
            # 13. MQTTConfig: 活动配置查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_mqtt_config_active
                    ON mqtt_config(is_active)
                """))
                indexes_created.append("idx_mqtt_config_active")
            except Exception as e:
                print(f"创建索引 idx_mqtt_config_active 失败: {e}")
            # 14. SystemConfig: 配置键查询
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_system_config_key
                    ON system_config(config_key)
                """))
                indexes_created.append("idx_system_config_key")
            except Exception as e:
                print(f"创建索引 idx_system_config_key 失败: {e}")
            # 15. TimeRule: 时间规则查询（按状态和班级）
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_time_rule_active_class
                    ON time_rule(is_active, class_info_id)
                """))
                indexes_created.append("idx_time_rule_active_class")
            except Exception as e:
                print(f"创建索引 idx_time_rule_active_class 失败: {e}")
            # 16. ScoreRecord: 积分记录复合索引
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_score_record_user_rule_created
                    ON score_record(user_id, rule_id, created_at DESC)
                """))
                indexes_created.append("idx_score_record_user_rule_created")
            except Exception as e:
                print(f"创建索引 idx_score_record_user_rule_created 失败: {e}")
            # 17. User: 用户复合索引（按班级和积分）
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_user_class_score
                    ON user(class_name, current_score DESC)
                """))
                indexes_created.append("idx_user_class_score")
            except Exception as e:
                print(f"创建索引 idx_user_class_score 失败: {e}")
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
                        text("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=:name"),
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
