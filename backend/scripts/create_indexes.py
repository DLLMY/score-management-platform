#!/usr/bin/env python
"""
数据库索引优化脚本

此脚本用于为数据库表添加必要的索引，提升查询性能。
索引策略基于以下原则：
1. 频繁查询的字段需要添加索引
2. 外键字段需要添加索引
3. 排序字段需要添加索引
4. 复合索引用于覆盖常用查询模式
"""

import os
import sys
import datetime

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from models import (
    User,
    ScoreRecord,
    Device,
    DeviceHeartbeat,
    DeviceAlert,
    Exam,
    Score,
    Notification,
    Approval,
    Alert,
    OperationLog,
)


def create_indexes():
    """创建数据库索引"""
    indexes_created = []
    indexes_already_exist = []

    with app.app_context():
        # 获取当前连接
        conn = db.engine.connect()
        inspector = db.inspect(db.engine)

        # ========== User 表索引 ==========
        user_table = User.__tablename__
        user_indexes = [
            # 已存在的索引：name, class_name, phone, card_id, current_score, is_blacklisted, is_active, created_at
            ("ix_user_card_id_is_active", ["card_id", "is_active"]),
            ("ix_user_class_name_is_active", ["class_name", "is_active"]),
            ("ix_user_current_score", ["current_score"]),
            ("ix_user_created_at", ["created_at"]),
        ]

        # ========== ScoreRecord 表索引 ==========
        record_table = ScoreRecord.__tablename__
        record_indexes = [
            # 已存在的索引：user_id, rule_id, score_change, created_at
            ("ix_score_record_user_created", ["user_id", "created_at"]),
            ("ix_score_record_created_desc", ["created_at"]),
        ]

        # ========== Device 表索引 ==========
        device_table = Device.__tablename__
        device_indexes = [
            # 已存在的索引：device_id, status, last_heartbeat, class_info_id, admin_id
            ("ix_device_status_class", ["status", "class_info_id"]),
            ("ix_device_last_heartbeat", ["last_heartbeat"]),
        ]

        # ========== DeviceHeartbeat 表索引 ==========
        heartbeat_table = DeviceHeartbeat.__tablename__
        heartbeat_indexes = [
            ("ix_heartbeat_device_time", ["device_id", "received_at"]),
            ("ix_heartbeat_received_at", ["received_at"]),
        ]

        # ========== DeviceAlert 表索引 ==========
        alert_table = DeviceAlert.__tablename__
        alert_indexes = [
            # 已存在的索引：device_id, is_resolved, created_at
            ("ix_alert_device_resolved", ["device_id", "is_resolved"]),
            ("ix_alert_created_desc", ["created_at"]),
        ]

        # ========== Exam 表索引 ==========
        exam_table = Exam.__tablename__
        exam_indexes = [
            # 已存在的索引：name, start_time, end_time, importance, class_id, status, created_by
            ("ix_exam_class_status", ["class_id", "status"]),
            ("ix_exam_start_time", ["start_time"]),
        ]

        # ========== Score 表索引 ==========
        score_table = Score.__tablename__
        score_indexes = [
            # 已存在的索引：exam_id, student_id, subject, status, entered_by
            ("ix_score_exam_student", ["exam_id", "student_id"]),
            ("ix_score_exam_subject", ["exam_id", "subject"]),
            ("ix_score_student_subject", ["student_id", "subject"]),
        ]

        # ========== Notification 表索引 ==========
        notification_table = Notification.__tablename__
        notification_indexes = [
            # 已存在的索引：user_id, type, status, created_at
            ("ix_notification_user_status", ["user_id", "status"]),
        ]

        # ========== Approval 表索引 ==========
        approval_table = Approval.__tablename__
        approval_indexes = [
            # 已存在的索引：user_id, type, status, approver_id, created_at
            ("ix_approval_status_type", ["status", "type"]),
        ]

        # ========== Alert 表索引 ==========
        alert_general_table = Alert.__tablename__
        alert_general_indexes = [
            # 已存在的索引：alert_type, severity, device_id, is_read, created_at
            ("ix_alert_severity_read", ["severity", "is_read"]),
            ("ix_alert_device_read", ["device_id", "is_read"]),
        ]

        # ========== OperationLog 表索引 ==========
        log_table = OperationLog.__tablename__
        log_indexes = [
            ("ix_log_operation_type", ["operation_type"]),
            ("ix_log_created_desc", ["created_at"]),
            ("ix_log_operator", ["operator"]),
        ]

        # 收集所有索引
        all_indexes = [
            (user_table, user_indexes),
            (record_table, record_indexes),
            (device_table, device_indexes),
            (heartbeat_table, heartbeat_indexes),
            (alert_table, alert_indexes),
            (exam_table, exam_indexes),
            (score_table, score_indexes),
            (notification_table, notification_indexes),
            (approval_table, approval_indexes),
            (alert_general_table, alert_general_indexes),
            (log_table, log_indexes),
        ]

        # 创建索引
        for table_name, indexes in all_indexes:
            existing_indexes = inspector.get_indexes(table_name)
            existing_index_names = {idx["name"] for idx in existing_indexes}

            for index_name, columns in indexes:
                if index_name in existing_index_names:
                    indexes_already_exist.append(f"{table_name}.{index_name}")
                    continue

                try:
                    # 构建创建索引的SQL
                    columns_str = ", ".join(columns)
                    sql = f"CREATE INDEX {index_name} ON {table_name} ({columns_str})"
                    conn.execute(db.text(sql))
                    conn.commit()
                    indexes_created.append(f"{table_name}.{index_name}")
                    print("Created index: {0}.{1} ({2})".format(table_name, index_name, columns_str))
                except Exception as e:
                    print("Failed to create index {0}.{1}: {2}".format(table_name, index_name, e))

        conn.close()

        # 输出统计信息
        print("\n" + "=" * 60)
        print("Index creation completed - {0}".format(datetime.datetime.now()))
        print("=" * 60)
        print("Created indexes: {0}".format(len(indexes_created)))
        if indexes_created:
            for idx in indexes_created:
                print("  + {0}".format(idx))

        print("\nExisting indexes: {0}".format(len(indexes_already_exist)))
        if indexes_already_exist:
            for idx in indexes_already_exist:
                print("  - {0}".format(idx))

        print("\nIndex optimization completed!")

        return {
            "created": indexes_created,
            "already_exist": indexes_already_exist,
            "total_created": len(indexes_created),
            "total_already_exist": len(indexes_already_exist),
        }


def check_existing_indexes():
    """检查已存在的索引"""
    with app.app_context():
        inspector = db.inspect(db.engine)

        tables = [
            User.__tablename__,
            ScoreRecord.__tablename__,
            Device.__tablename__,
            DeviceHeartbeat.__tablename__,
            DeviceAlert.__tablename__,
            Exam.__tablename__,
            Score.__tablename__,
            Notification.__tablename__,
            Approval.__tablename__,
            Alert.__tablename__,
            OperationLog.__tablename__,
        ]

        print("当前数据库索引状态:")
        print("=" * 60)

        for table in tables:
            indexes = inspector.get_indexes(table)
            print(f"\n表: {table}")
            print(f"  索引数量: {len(indexes)}")
            for idx in indexes:
                columns = ", ".join(idx["column_names"])
                unique = " (唯一)" if idx.get("unique", False) else ""
                print(f"    - {idx['name']}{unique}: {columns}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="数据库索引管理")
    parser.add_argument("--check", action="store_true", help="检查当前索引状态")
    parser.add_argument("--create", action="store_true", help="创建缺失的索引")

    args = parser.parse_args()

    if args.check:
        check_existing_indexes()
    elif args.create:
        create_indexes()
    else:
        print("请指定操作：--check 或 --create")
