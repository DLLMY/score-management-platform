#!/usr/bin/env python
"""
数据库索引优化脚本

此脚本用于为数据库表添加必要的索引，提升查询性能。
索引策略基于以下原则：
1. 频繁查询的字段需要添加索引
2. 外键字段需要添加索引
3. 排序字段需要添加索引
4. 复合索引用于覆盖常用查询模式

M11: 索引纳入部署闸门——新增 verify_indexes()/--verify，
由 scripts/verify_indexes.py 与 scripts/run_regression.sh 调用；
create_indexes() 保持幂等（已存在跳过）。
"""

import datetime
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    Alert,
    Approval,
    Device,
    DeviceHeartbeat,
    Exam,
    Notification,
    OperationLog,
    Score,
    ScoreRecord,
    User,
    db,
)


# ========== 核心性能索引清单（单一来源：create / verify 共用） ==========
def _get_app_db():
    """确保 db engine 绑定 + application context 可用，返回 (app, db)。
    - db_init 启动自举：已有 app context（init_app 已执行）→ 直接取 current_app，不递归；
    - 脚本直跑（--verify/--create / 闸门）：无 context → get_app() 完成初始化并 push。
    """
    from flask import current_app, has_app_context

    if not has_app_context():
        from app import get_app

        get_app().app_context().push()
    return current_app._get_current_object(), db


def get_all_indexes():
    """返回 [(table_name, [(index_name, [columns...])])] 清单。"""
    user_table = User.__tablename__
    record_table = ScoreRecord.__tablename__
    device_table = Device.__tablename__
    heartbeat_table = DeviceHeartbeat.__tablename__
    alert_table = Alert.__tablename__
    exam_table = Exam.__tablename__
    score_table = Score.__tablename__
    notification_table = Notification.__tablename__
    approval_table = Approval.__tablename__
    log_table = OperationLog.__tablename__

    return [
        # User 表（已存在的索引：name, class_name, phone, card_id, current_score, is_blacklisted, is_active, created_at）
        (
            user_table,
            [
                ("ix_user_card_id_is_active", ["card_id", "is_active"]),
                ("ix_user_class_name_is_active", ["class_name", "is_active"]),
                ("ix_user_current_score", ["current_score"]),
                ("ix_user_created_at", ["created_at"]),
            ],
        ),
        # ScoreRecord 表（已存在：user_id, rule_id, score_change, created_at）
        # R6 修复：ix_score_record_user_created（同列重复 student_created）已移除；
        # created_at 单列索引以规范名 ix_score_record_created_at 在此统一管理
        # （reconcile 不托管该单列索引，避免与模型索引同名异构造成重复索引）。
        (
            record_table,
            [
                ("ix_score_record_created_at", ["created_at"]),
            ],
        ),

        # Device 表（已存在：device_id, status, last_heartbeat, class_info_id, admin_id）
        (
            device_table,
            [
                ("ix_device_status_class", ["status", "class_info_id"]),
                ("ix_device_last_heartbeat", ["last_heartbeat"]),
                # R16: 设备列表排序复合索引（created_at, id）
                ("ix_device_created_at_id", ["created_at", "id"]),
            ],
        ),
        # DeviceHeartbeat 表
        (
            heartbeat_table,
            [
                ("ix_heartbeat_device_time", ["device_id", "received_at"]),
                ("ix_heartbeat_received_at", ["received_at"]),
            ],
        ),
        # Alert 表（F9-A 合并 device_alert 后统一存放；已存在：alert_type, severity, device_id, is_read, created_at, source, is_resolved）
        (
            alert_table,
            [
                ("ix_alert_device_resolved", ["device_id", "is_resolved"]),
                ("ix_alert_created_desc", ["created_at"]),
            ],
        ),
        # Exam 表（已存在：name, start_time, end_time, importance, class_id, status, created_by）
        (
            exam_table,
            [
                ("ix_exam_class_status", ["class_id", "status"]),
                ("ix_exam_start_time", ["start_time"]),
            ],
        ),
        # Score 表（已存在：exam_id, student_id, subject, status, entered_by）
        (
            score_table,
            [
                ("ix_score_exam_student", ["exam_id", "student_id"]),
                ("ix_score_exam_subject", ["exam_id", "subject_id"]),
                ("ix_score_student_subject", ["student_id", "subject_id"]),
                # R16: 排行榜/成绩列表排序复合索引
                ("ix_scores_exam_id_score_id", ["exam_id", "score", "id"]),
                ("ix_scores_score_id", ["score", "id"]),
            ],
        ),
        # Notification 表（已存在：user_id, type, status, created_at）
        (
            notification_table,
            [
                ("ix_notification_user_status", ["student_id", "status"]),
                # R16: 通知列表筛选+排序复合索引（recipient_type + created_at, id）
                ("ix_notification_recipient_created_id", ["recipient_type", "created_at", "id"]),
            ],
        ),
        # Approval 表（已存在：user_id, type, status, approver_id, created_at）
        (
            approval_table,
            [
                ("ix_approval_status_type", ["status", "type"]),
            ],
        ),
        # Alert 通用（已存在：alert_type, severity, device_id, is_read, created_at）
        (
            alert_table,
            [
                ("ix_alert_severity_read", ["severity", "is_read"]),
                ("ix_alert_device_read", ["device_id", "is_read"]),
            ],
        ),
        # OperationLog 表
        # 注：created_at 索引现由模型 system_models.OperationLog.__table_args__ 统一管理
        # （ix_operation_log_created_at，reconcile 幂等建索引），故此处不再定义 ix_log_created_desc。
        (
            log_table,
            [
                ("ix_log_operation_type", ["operation_type"]),
                ("ix_log_operator", ["operator"]),
            ],
        ),

        # R16: 列表排序复合索引（消弭端点 order_by 的 USE TEMP B-TREE FOR ORDER BY，与模型 __table_args__ 双处对齐）
        (
            "course_schedules",
            [
                ("ix_course_schedule_day_period", ["day_of_week", "period_number"]),
            ],
        ),
        (
            "duty_group",
            [
                ("ix_duty_group_day_name", ["day_of_week", "name"]),
            ],
        ),
        (
            "subject",
            [
                ("ix_subject_sort_order_name", ["sort_order", "name"]),
            ],
        ),
        (
            "device_groups",
            [
                ("ix_device_group_sort_order_name", ["sort_order", "name"]),
            ],
        ),
        (
            "score_rule",
            [
                ("ix_score_rule_is_active_category_id", ["is_active", "category_id"]),
            ],
        ),

        # R10: 补全排序字段索引（消除 order_by TEMP B-TREE 排序溢出）
        (
            "firmware_versions",
            [
                ("ix_firmware_version_created_at", ["created_at"]),
            ],
        ),
        (
            "device_firmware_updates",
            [
                ("ix_device_firmware_update_started_at", ["started_at"]),
                ("ix_device_firmware_update_created_at", ["created_at"]),
            ],
        ),
        (
            "approval",
            [
                ("ix_approval_end_time", ["end_time"]),
                ("ix_approval_start_date", ["start_date"]),
            ],
        ),
        (
            "rate_limit_records",
            [
                ("ix_rate_limit_record_window_start", ["window_start"]),
            ],
        ),
        (
            "nlp_corrections",
            [
                ("ix_nlp_correction_learn_count", ["learn_count"]),
            ],
        ),
        (
            "mental_health_record",
            [
                ("ix_mental_health_record_created_at", ["created_at"]),
            ],
        ),
        (
            "homework_assignment",
            [
                ("ix_homework_assignment_due_date", ["due_date"]),
            ],
        ),
        (
            "contact_log",
            [
                ("ix_contact_log_contact_time", ["contact_time"]),
            ],
        ),
        (
            "seating_chart",
            [
                ("ix_seating_chart_created_at", ["created_at"]),
            ],
        ),
        (
            "seating_seat",
            [
                ("ix_seating_seat_row_col", ["row", "col"]),
            ],
        ),
        (
            "study_guide",
            [
                ("ix_study_guide_created_at", ["created_at"]),
            ],
        ),
        (
            "improvement_plan",
            [
                ("ix_improvement_plan_start_date", ["start_date"]),
            ],
        ),
        (
            "class_committee",
            [
                ("ix_class_committee_position", ["position"]),
            ],
        ),
        (
            "committee_term",
            [
                ("ix_committee_term_start_date", ["start_date"]),
            ],
        ),
        (
            "study_group",
            [
                ("ix_study_group_score", ["score"]),
            ],
        ),
        (
            "activity",
            [
                ("ix_activity_start_date", ["start_date"]),
            ],
        ),
    ]


def create_indexes():
    """创建数据库索引（幂等：已存在跳过）"""
    indexes_created = []
    indexes_already_exist = []

    # 直接使用全局 engine（不依赖 app 实例/上下文，供 app 启动链自举安全调用）
    _app, _db = _get_app_db()
    conn = _db.engine.connect()
    inspector = _db.inspect(_db.engine)

    all_indexes = get_all_indexes()

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
                conn.execute(_db.text(sql))
                conn.commit()
                indexes_created.append(f"{table_name}.{index_name}")
                print(f"Created index: {table_name}.{index_name} ({columns_str})")
            except Exception as e:
                print(f"Failed to create index {table_name}.{index_name}: {e}")

    conn.close()

    # 输出统计信息
    print("\n" + "=" * 60)
    print(f"Index creation completed - {datetime.datetime.now()}")
    print("=" * 60)
    print(f"Created indexes: {len(indexes_created)}")
    if indexes_created:
        for idx in indexes_created:
            print(f"  + {idx}")

    print(f"\nExisting indexes: {len(indexes_already_exist)}")
    if indexes_already_exist:
        for idx in indexes_already_exist:
            print(f"  - {idx}")

    print("\nIndex optimization completed!")

    return {
        "created": indexes_created,
        "already_exist": indexes_already_exist,
        "total_created": len(indexes_created),
        "total_already_exist": len(indexes_already_exist),
    }


def verify_indexes():
    """校验清单内核心索引是否全部存在（只读，闸门用）。

    Returns:
        list[str]: 缺失索引列表（空 = 全部存在）
    """
    missing = []
    _app, _db = _get_app_db()
    inspector = _db.inspect(_db.engine)
    for table_name, indexes in get_all_indexes():
        try:
            existing_index_names = {idx["name"] for idx in inspector.get_indexes(table_name)}
        except Exception as e:
            missing.append(f"{table_name} (检查失败: {e})")
            continue
        for index_name, _columns in indexes:
            if index_name not in existing_index_names:
                missing.append(f"{table_name}.{index_name}")
    return missing


def check_existing_indexes():
    """检查已存在的索引"""
    _app, _db = _get_app_db()
    inspector = _db.inspect(_db.engine)

    tables = [
        User.__tablename__,
        ScoreRecord.__tablename__,
        Device.__tablename__,
        DeviceHeartbeat.__tablename__,
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
    parser.add_argument(
        "--verify", action="store_true", help="校验核心索引齐全（缺失退出码 1，闸门用）"
    )

    args = parser.parse_args()

    if args.verify:
        missing = verify_indexes()
        if missing:
            print(f"[失败] 缺失 {len(missing)} 个索引:")
            for m in missing:
                print(f"  - {m}")
            print("提示：运行 python scripts/create_indexes.py --create 补建")
            sys.exit(1)
        print("[OK] 核心索引全部存在")
    elif args.check:
        check_existing_indexes()
    elif args.create:
        create_indexes()
    else:
        print("请指定操作：--verify / --check / --create")
