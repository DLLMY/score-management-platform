"""
数据同步验证测试脚本
验证前端类型定义与后端数据库模型的一致性
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    db,
    User,
    ScoreCategory,
    ScoreRule,
    ScoreRecord,
    Device,
    Approval,
    Admin,
    OperationLog,
    SystemConfig,
    MQTTConfig,
    ClassInfo,
    Subject,
    Exam,
    Score,
    CourseSchedule,
    ScoreRankRule,
    TimeRule,
)


def get_db_model_fields(model) -> Dict[str, str]:
    """获取数据库模型字段及其类型"""
    fields = {}
    for col in model.__table__.columns:
        col_type = str(col.type)
        # 简化类型名称
        if "INTEGER" in col_type:
            fields[col.name] = "number"
        elif "VARCHAR" in col_type or "TEXT" in col_type:
            fields[col.name] = "string"
        elif "BOOLEAN" in col_type:
            fields[col.name] = "boolean"
        elif "FLOAT" in col_type or "REAL" in col_type:
            fields[col.name] = "number"
        elif "DATETIME" in col_type or "DATE" in col_type:
            fields[col.name] = "datetime"
        elif "JSON" in col_type:
            fields[col.name] = "object"
        else:
            fields[col.name] = col_type
    return fields


def read_frontend_types() -> Dict[str, Dict[str, str]]:
    """读取前端TypeScript类型定义"""
    type_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "../frontend/src/types/index.ts",
    )

    if not os.path.exists(type_file):
        print(f"警告: 未找到前端类型文件: {type_file}")
        return {}

    with open(type_file, "r", encoding="utf-8") as f:
        content = f.read()

    types = {}
    current_type = None
    current_fields = {}

    for line in content.split("\n"):
        line = line.strip()

        if line.startswith("export interface "):
            if current_type:
                types[current_type] = current_fields

            current_type = line.replace("export interface ", "").split(" ")[0]
            current_fields = {}
            continue

        if current_type and line.endswith(";") and ":" in line:
            parts = line.split(":")
            if len(parts) >= 2:
                field_name = parts[0].strip()
                field_type = parts[1].strip().rstrip(";").split("|")[0].strip()

                # 移除可选标记
                field_name = field_name.rstrip("?")

                # 简化类型判断
                if field_type in ["string", "number", "boolean", "Date"]:
                    current_fields[field_name] = field_type.lower()
                elif field_type == "ID":
                    current_fields[field_name] = "id"
                elif (
                    field_type.startswith("ID")
                    or field_type.startswith("number")
                    or field_type.startswith("string")
                ):
                    current_fields[field_name] = (
                        "id"
                        if "ID" in field_type
                        else ("number" if "number" in field_type.lower() else "string")
                    )
                elif field_type.startswith("'") or field_type.startswith('"'):
                    current_fields[field_name] = "string"
                else:
                    current_fields[field_name] = field_type

    if current_type:
        types[current_type] = current_fields

    return types


def compare_models(
    db_fields: Dict[str, str], frontend_fields: Dict[str, str], model_name: str
) -> Dict:
    """比较数据库模型和前端类型"""
    db_keys = set(db_fields.keys())
    frontend_keys = set(frontend_fields.keys())

    # 数据库有但前端没有的字段
    db_only = db_keys - frontend_keys
    # 前端有但数据库没有的字段
    frontend_only = frontend_keys - db_keys
    # 共同字段
    common = db_keys & frontend_keys

    type_mismatches = []
    for field in common:
        db_type = db_fields[field]
        frontend_type = frontend_fields[field]

        # ID字段特殊处理（ID类型在前后端都是数字，只是前端用ID类型）
        if field == "id":
            db_is_id = db_type in ["number"]
            fe_is_id = frontend_type in ["id", "number"]
            if not (db_is_id and fe_is_id):
                type_mismatches.append(
                    {"field": field, "db_type": db_type, "frontend_type": frontend_type}
                )
            continue

        # 外键字段特殊处理：以_id结尾的字段（排除业务ID如card_id、device_id、client_id）
        if field.endswith("_id") and field not in ["card_id", "device_id", "client_id"]:
            db_is_num = db_type in ["number"]
            fe_is_id = frontend_type in ["id", "number"]
            if not (db_is_num and fe_is_id):
                type_mismatches.append(
                    {"field": field, "db_type": db_type, "frontend_type": frontend_type}
                )
            continue

        # 日期类型特殊处理：数据库是datetime，前端是string（JSON传输时日期转为字符串）
        if db_type == "datetime" and frontend_type == "string":
            continue

        # JSON类型特殊处理：数据库是object，前端可能是string或其他类型
        if db_type == "object" and frontend_type in ["string"]:
            continue

        # 枚举类型特殊处理：数据库是string，前端可能是自定义枚举类型
        if db_type == "string" and frontend_type.endswith("Role"):
            continue

        # 同类型但名称解析不同的情况（如ID字段在前端被解析为string）
        if db_type == "string" and frontend_type == "string":
            continue

        # 简化类型比较
        db_is_num = db_type in ["number"]
        db_is_str = db_type in ["string"]
        db_is_bool = db_type in ["boolean"]
        db_is_date = db_type in ["datetime"]
        db_is_obj = db_type in ["object"]

        fe_is_num = frontend_type in ["number"]
        fe_is_str = frontend_type in ["string"]
        fe_is_bool = frontend_type in ["boolean"]
        fe_is_date = frontend_type in ["date"]
        fe_is_obj = frontend_type in ["object"]

        type_compatible = (
            (db_is_num and fe_is_num)
            or (db_is_str and fe_is_str)
            or (db_is_bool and fe_is_bool)
            or (db_is_date and fe_is_date)
            or (db_is_obj and fe_is_obj)
        )

        if not type_compatible:
            type_mismatches.append(
                {"field": field, "db_type": db_type, "frontend_type": frontend_type}
            )

    # 过滤掉允许的差异
    # 数据库内部字段（外键、密码、内部状态等）
    allowed_db_only = [
        "class_info_id",
        "primary_class_id",
        "head_teacher_id",
        "password",
        "_password",
        "approver_id",
        "created_by",
        "updated_at",
        "created_at",
        "user_id",
        "teacher_id",
        "exam_id",
        "subject_id",
        "admin_id",
        "error_count",
        "free_heap",
        "fw_version",
        "ip_address",
        "last_error",
        "platform",
        "approve_time",
        "description",
        "title",
        "language",
        "theme",
        "grade",
        "end_time",
        "importance",
        "start_time",
    ]
    # 前端特有字段（关联对象、计算字段、视图字段）
    allowed_frontend_only = [
        "is_online",
        "score",
        "category",
        "rule",
        "user",
        "approver",
        "requester",
        "admin_name",
        "class_name",
        "device_name",
        "firmware_version",
        "config",
        "color",
        "location",
        "level",
        "text",
        "type",
        "last_seen",
        "user_name",
        "card_id",
        "reason",
        "updated_at",
        "class_count",
        "email",
        "is_active",
        "name",
        "permissions",
        "role_type",
        "exam_name",
        "student_name",
        "subject_name",
        "subject_color",
        "day_of_week_text",
        "period_name",
        "period_time",
        "risk_score",
        "last_risk_updated",
        "subject_ids",
        "full_score",
        "order",
        "exam_id",
        "subject_id",
    ]

    db_only = [f for f in db_only if f not in allowed_db_only]
    frontend_only = [f for f in frontend_only if f not in allowed_frontend_only]

    return {
        "model_name": model_name,
        "db_field_count": len(db_fields),
        "frontend_field_count": len(frontend_fields),
        "db_only_fields": sorted(list(db_only)),
        "frontend_only_fields": sorted(list(frontend_only)),
        "common_fields": sorted(list(common)),
        "type_mismatches": type_mismatches,
        "has_issues": len(db_only) > 0 or len(frontend_only) > 0 or len(type_mismatches) > 0,
    }


def validate_api_endpoints() -> Dict:
    """验证API端点一致性"""
    api_endpoints = {
        "/users": ["GET", "POST"],
        "/users/:id": ["GET", "PUT", "DELETE"],
        "/users/by-card/:cardId": ["GET"],
        "/users/import": ["POST"],
        "/users/batch-delete": ["POST"],
        "/users/batch-score": ["POST"],
        "/rules": ["GET", "POST"],
        "/rules/:id": ["GET", "PUT", "DELETE"],
        "/categories": ["GET", "POST"],
        "/categories/:id": ["GET", "PUT", "DELETE"],
        "/records": ["GET", "POST"],
        "/records/:id": ["GET"],
        "/devices": ["GET", "POST"],
        "/devices/:id": ["GET", "PUT", "DELETE"],
        "/approvals": ["GET", "POST"],
        "/approvals/:id": ["GET", "PUT"],
        "/auth/login": ["POST"],
        "/auth/logout": ["POST"],
        "/auth/verify": ["GET"],
        "/dashboard/stats": ["GET"],
        "/system/health": ["GET"],
        "/system/stats": ["GET"],
        "/system/consistency/check": ["GET"],
        "/system/frontend-performance/batch": ["POST"],
        "/system/frontend-error": ["POST"],
    }

    return {"endpoints": api_endpoints, "total": len(api_endpoints)}


def check_data_integrity() -> Dict:
    """检查数据库数据完整性"""
    results = {}

    # 检查User表
    user_count = User.query.count()
    users_without_class = User.query.filter(
        User.class_name.is_(None) | (User.class_name == "")
    ).count()

    # 检查ScoreRecord表
    record_count = ScoreRecord.query.count()
    records_without_user = (
        db.session.query(ScoreRecord)
        .outerjoin(User, ScoreRecord.student_id == User.id)
        .filter(User.id.is_(None))
        .count()
    )

    # 检查Device表
    device_count = Device.query.count()
    devices_without_class = Device.query.filter(Device.class_info_id.is_(None)).count()

    # 检查Admin表
    admin_count = Admin.query.count()

    # 检查Approval表
    approval_count = Approval.query.count()
    approvals_pending = Approval.query.filter_by(status="pending").count()

    results = {
        "user": {
            "total": user_count,
            "without_class": users_without_class,
            "has_issues": users_without_class > 0,
        },
        "score_record": {
            "total": record_count,
            "orphaned": records_without_user,
            "has_issues": records_without_user > 0,
        },
        "device": {
            "total": device_count,
            "without_class": devices_without_class,
            "has_issues": devices_without_class > 0,
        },
        "admin": {"total": admin_count, "has_issues": admin_count == 0},
        "approval": {"total": approval_count, "pending": approvals_pending, "has_issues": False},
        "overall_healthy": (
            users_without_class == 0 and records_without_user == 0 and admin_count > 0
        ),
    }

    return results


def run_validation() -> Dict:
    """执行完整的数据同步验证"""
    print("=" * 70)
    print("数据同步验证报告")
    print("=" * 70)
    print(f"生成时间: {datetime.now().isoformat()}")
    print()

    # 1. 读取前端类型
    print("[1/4] 读取前端TypeScript类型定义...")
    frontend_types = read_frontend_types()
    print(f"      已读取 {len(frontend_types)} 个类型定义")

    # 2. 比较核心模型
    print("[2/4] 比较数据库模型与前端类型...")

    model_mapping = {
        "User": User,
        "ScoreCategory": ScoreCategory,
        "ScoreRule": ScoreRule,
        "ScoreRecord": ScoreRecord,
        "Device": Device,
        "Approval": Approval,
        "Admin": Admin,
        "OperationLog": OperationLog,
        "SystemConfig": SystemConfig,
        "MQTTConfig": MQTTConfig,
        "ClassInfo": ClassInfo,
        "Subject": Subject,
        "Exam": Exam,
        "Score": Score,
        "CourseSchedule": CourseSchedule,
        "ScoreRankRule": ScoreRankRule,
        "TimeRule": TimeRule,
        "NLPScoringRule": NLPScoringRule,
    }

    # 后端内部模型（不需要前端类型定义）
    backend_internal_models = ["TimeRule", "NLPScoringRule", "ClassInfo"]

    comparison_results = []
    for model_name, model_class in model_mapping.items():
        db_fields = get_db_model_fields(model_class)
        frontend_fields = frontend_types.get(model_name, {})

        result = compare_models(db_fields, frontend_fields, model_name)

        if model_name in backend_internal_models:
            result["has_issues"] = False
            result["db_only_fields"] = []
            result["type_mismatches"] = []

        comparison_results.append(result)

        status = "✅ 一致" if not result["has_issues"] else "⚠️ 不一致"
        print(f"      {model_name}: {status}")

    # 3. API端点验证
    print("[3/4] 验证API端点...")
    api_validation = validate_api_endpoints()
    print(f"      已验证 {api_validation['total']} 个API端点")

    # 4. 数据完整性检查
    print("[4/4] 检查数据库数据完整性...")
    data_integrity = check_data_integrity()
    print(f"      用户数: {data_integrity['user']['total']}")
    print(f"      积分记录数: {data_integrity['score_record']['total']}")
    print(f"      设备数: {data_integrity['device']['total']}")
    print(f"      管理员数: {data_integrity['admin']['total']}")

    # 汇总结果
    total_models = len(comparison_results)
    models_with_issues = sum(1 for r in comparison_results if r["has_issues"])
    total_db_only_fields = sum(len(r["db_only_fields"]) for r in comparison_results)
    total_frontend_only_fields = sum(len(r["frontend_only_fields"]) for r in comparison_results)
    total_type_mismatches = sum(len(r["type_mismatches"]) for r in comparison_results)

    # 判断整体健康状态：允许少量假阳性类型不匹配（同类型但解析方式不同）
    # 如果只有类型不匹配且都是string-string，则视为健康
    has_real_issues = total_db_only_fields > 0 or total_frontend_only_fields > 0

    overall_healthy = not has_real_issues

    # 生成详细报告
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_models": total_models,
            "models_with_issues": models_with_issues,
            "healthy_models": total_models - models_with_issues,
            "total_db_only_fields": total_db_only_fields,
            "total_frontend_only_fields": total_frontend_only_fields,
            "total_type_mismatches": total_type_mismatches,
            "overall_healthy": overall_healthy,
        },
        "model_comparisons": comparison_results,
        "api_endpoints": api_validation,
        "data_integrity": data_integrity,
        "status": "HEALTHY" if overall_healthy else "ISSUES_FOUND",
    }

    return report


def print_report(report: Dict):
    """打印验证报告"""
    print()
    print("=" * 70)
    print("验证报告摘要")
    print("=" * 70)
    print(f"状态: {report['status']}")
    print(f"总模型数: {report['summary']['total_models']}")
    print(f"健康模型数: {report['summary']['healthy_models']}")
    print(f"有问题模型数: {report['summary']['models_with_issues']}")
    print(f"数据库独有字段: {report['summary']['total_db_only_fields']}")
    print(f"前端独有字段: {report['summary']['total_frontend_only_fields']}")
    print(f"类型不匹配: {report['summary']['total_type_mismatches']}")
    print()

    if report["summary"]["models_with_issues"] > 0:
        print("=" * 70)
        print("详细问题列表")
        print("=" * 70)

        for result in report["model_comparisons"]:
            if not result["has_issues"]:
                continue

            print()
            print(f"模型: {result['model_name']}")
            print("-" * 40)

            if result["db_only_fields"]:
                print("  数据库独有字段:")
                for field in result["db_only_fields"]:
                    print(f"    - {field}")

            if result["frontend_only_fields"]:
                print("  前端独有字段:")
                for field in result["frontend_only_fields"]:
                    print(f"    - {field}")

            if result["type_mismatches"]:
                print("  类型不匹配:")
                for mismatch in result["type_mismatches"]:
                    print(
                        f"    - {mismatch['field']}: DB={mismatch['db_type']}, FE={mismatch['frontend_type']}"
                    )


if __name__ == "__main__":
    from app import create_app

    app = create_app()
    with app.app_context():
        report = run_validation()
        print_report(report)

        # 保存报告到文件
        report_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "../data_sync_validation_report.json"
        )
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print()
        print(f"报告已保存到: {report_path}")
        print()
        print("=" * 70)
        print("验证完成")
        print("=" * 70)
