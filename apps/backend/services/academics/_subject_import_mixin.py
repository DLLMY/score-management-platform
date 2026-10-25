"""科目批量导入：execute_subject_import + 校验/班级教师解析/关系落地十助手。"""

import re
from datetime import datetime

from models import (
    Admin,
    AdminClass,
    ClassInfo,
    CourseSchedule,
    Exam,
    ImportConfig,
    Score,
    Subject,
    SubjectClass,
    User,
    cascade_delete_related_records,
    db,
    get_by_id,
)
from utils.db_session import db_session_scope


def _validate_subject_import_item(item, validation_rules):
    """纯规则校验，与 execute_subject_import 内嵌 validate_item 逐字节一致。"""
    errors = []
    for rule in validation_rules:
        field = rule["field"]
        rule_type = rule["rule_type"]
        params = rule.get("params", {})
        message = rule.get("message", f"{field}验证失败")
        value = item.get(field)

        if (
            rule_type == "required" and value is None
            or (rule_type == "max_length" and value and len(str(value)) > params.get("max", 100))
            or (rule_type == "min_length" and value and len(str(value)) < params.get("min", 1))
            or (
                rule_type == "regex"
                and value
                and not re.match(params.get("pattern", ""), str(value))
            )
        ):
            errors.append(message)
    return errors

def _resolve_class_by_name(class_name):
    errors = []
    name = class_name.strip()
    class_info = None
    if not isinstance(class_name, str) or len(name) == 0:
        errors.append("班级名称格式无效，必须为非空字符串")
    elif len(name) > 100:
        errors.append("班级名称长度超过限制（最大100字符）")
    else:
        class_info = ClassInfo.query.filter_by(name=name).first()
        if not class_info:
            errors.append(f'班级 "{class_name}" 在系统中不存在')
    return (class_info.id if class_info else None), errors

def _resolve_class_by_id(class_id):
    errors = []
    if not isinstance(class_id, (int, str)):
        errors.append("班级ID格式无效")
        return None, errors
    try:
        cid = int(class_id)
        class_info = get_by_id(ClassInfo, cid)
        if not class_info:
            errors.append(f'班级ID "{class_id}" 在系统中不存在')
        else:
            return cid, errors
    except ValueError:
        errors.append("班级ID必须为有效数字")
    return None, errors

def _resolve_subject_import_class(item):
    errors = []
    class_name = item.get("class_name")
    class_id = item.get("class_id")
    resolved_class_id = None
    if class_id and class_name:
        errors.append("不能同时提供班级ID和班级名称")
    elif class_name:
        resolved_class_id, ce = _resolve_class_by_name(class_name)
        errors.extend(ce)
    elif class_id:
        resolved_class_id, ce = _resolve_class_by_id(class_id)
        errors.extend(ce)
    return resolved_class_id, errors

def _resolve_teacher_by_name(teacher_name):
    errors = []
    name = teacher_name.strip()
    admin = None
    if not isinstance(teacher_name, str) or len(name) == 0:
        errors.append("教师姓名格式无效，必须为非空字符串")
    elif len(name) > 50:
        errors.append("教师姓名长度超过限制（最大50字符）")
    else:
        admin = Admin.query.filter(Admin.real_name == name).first()
        if not admin:
            admin = Admin.query.filter(Admin.username == name).first()
        if not admin:
            errors.append(f'教师 "{teacher_name}" 在系统中不存在')
        else:
            if admin.role not in ["admin", "teacher"]:
                errors.append(f'用户 "{teacher_name}" 的角色不是管理员或教师，无法担任授课教师')
    return (admin.id if admin else None), errors

def _resolve_teacher_by_id(teacher_id):
    errors = []
    if not isinstance(teacher_id, (int, str)):
        errors.append("教师ID格式无效")
        return None, errors
    try:
        tid = int(teacher_id)
        admin = get_by_id(Admin, tid)
        if not admin:
            errors.append(f'教师ID "{teacher_id}" 在系统中不存在')
        else:
            if admin.role not in ["admin", "teacher"]:
                errors.append(f'用户ID "{teacher_id}" 的角色不是管理员或教师，无法担任授课教师')
            return tid, errors
    except ValueError:
        errors.append("教师ID必须为有效数字")
    return None, errors

def _resolve_subject_import_teacher(item):
    errors = []
    teacher_name = item.get("teacher_name")
    teacher_id = item.get("teacher_id")
    resolved_teacher_id = None
    if teacher_id and teacher_name:
        errors.append("不能同时提供教师ID和教师姓名")
    elif teacher_name:
        resolved_teacher_id, te = _resolve_teacher_by_name(teacher_name)
        errors.extend(te)
    elif teacher_id:
        resolved_teacher_id, te = _resolve_teacher_by_id(teacher_id)
        errors.extend(te)
    return resolved_teacher_id, errors

def _resolve_subject_import_relations(item):
    resolved = item.copy()
    class_id, class_errors = _resolve_subject_import_class(item)
    teacher_id, teacher_errors = _resolve_subject_import_teacher(item)
    resolved["_validation_errors"] = class_errors + teacher_errors
    resolved["_class_id"] = class_id
    resolved["_teacher_id"] = teacher_id
    return resolved

def _upsert_subject(resolved_item, conflict_strategy, messages):
    """按 conflict_strategy upsert 科目，返回 {"subject_id": id_or_None, "skipped": bool}。

    与原 execute_subject_import 内联 existing/conflict 分支逐字节等价：
    skip -> skipped=True（调用方 continue，不计入 success_count）；update/create -> 返回 subject_id。
    """
    existing = Subject.query.filter_by(name=resolved_item["name"]).first()
    subject_id = None
    skipped = False
    if existing:
        if conflict_strategy == "skip":
            messages.append(
                {
                    "name": resolved_item["name"],
                    "action": "skipped",
                    "message": f'科目 "{resolved_item["name"]}" 已存在，已跳过',
                }
            )
            skipped = True
        elif conflict_strategy == "update":
            existing.code = resolved_item.get("code", existing.code)
            existing.grade = resolved_item.get("grade", existing.grade)
            existing.description = resolved_item.get(
                "description", existing.description
            )
            existing.color = resolved_item.get("color", existing.color)
            existing.is_active = resolved_item.get("is_active", existing.is_active)
            existing.updated_at = datetime.now()
            subject_id = existing.id

            messages.append(
                {
                    "name": resolved_item["name"],
                    "action": "updated",
                    "message": f'科目 "{resolved_item["name"]}" 已更新',
                }
            )
    else:
        new_subject = Subject(
            name=resolved_item["name"],
            code=resolved_item.get("code"),
            grade=resolved_item.get("grade"),
            description=resolved_item.get("description"),
            color=resolved_item.get("color", "#10B981"),
            is_active=resolved_item.get("is_active", True),
        )
        db.session.add(new_subject)
        db.session.flush()
        subject_id = new_subject.id

        messages.append(
            {
                "name": resolved_item["name"],
                "action": "created",
                "message": f'科目 "{resolved_item["name"]}" 已创建',
            }
        )
    return {"subject_id": subject_id, "skipped": skipped}

def _upsert_subject_class_link(subject_id, resolved_item, messages):
    """upsert 科目-班级关联（含教师绑定）。与原 execute_subject_import 内联 link 分支逐字节等价。"""
    if subject_id and resolved_item.get("_class_id"):
        existing_link = SubjectClass.query.filter(
            SubjectClass.subject_id == subject_id,
            SubjectClass.class_info_id == resolved_item["_class_id"],
        ).first()
        if existing_link:
            if resolved_item.get("_teacher_id"):
                existing_link.teacher_id = resolved_item["_teacher_id"]
                messages.append(
                    {
                        "name": resolved_item["name"],
                        "action": "updated",
                        "message": f'科目 "{resolved_item["name"]}" 与班级关联已更新',
                    }
                )
        else:
            new_link = SubjectClass(
                subject_id=subject_id,
                class_info_id=resolved_item["_class_id"],
                teacher_id=resolved_item.get("_teacher_id"),
            )
            db.session.add(new_link)
            messages.append(
                {
                    "name": resolved_item["name"],
                    "action": "created",
                    "message": f'科目 "{resolved_item["name"]}" 与班级关联已创建',
                }
            )


class _SubjectImportMixin:
    def execute_subject_import(self, import_list, validation_rules, conflict_strategy):
        """执行科目批量导入写入，返回统计 dict。

        路由负责 config 解析与文件解析（import_list 为已映射的列表，可能含 __error__ 哨兵项）。
        行为与原 SubjectImport.post 内联处理逐字节一致：逐行校验、关联解析、按名称 upsert 科目，
        并 upsert 科目-班级关联；整段提交，单项异常被捕获后计入 failed 不中断整体。
        """
        with db_session_scope(detach=False):
            success_count = 0
            failed_count = 0
            messages = []


            for item in import_list:
                try:
                    if item.get("__error__"):
                        failed_count += 1
                        messages.append(
                            {
                                "name": "未知",
                                "action": "failed",
                                "message": item.get("__message__", "数据格式错误"),
                                "row_data": item,
                            }
                        )
                        continue

                    errors = _validate_subject_import_item(item, validation_rules)
                    if errors:
                        failed_count += 1
                        messages.append(
                            {
                                "name": item.get("name", "未知"),
                                "action": "failed",
                                "message": f'验证失败: {", ".join(errors)}',
                                "row_data": item,
                                "error_fields": list(
                                    {
                                        
                                            rule["field"]
                                            for rule in validation_rules
                                            if item.get(rule["field"]) is None
                                        
                                    }
                                ),
                            }
                        )
                        continue

                    resolved_item = _resolve_subject_import_relations(item)

                    relation_errors = resolved_item.get("_validation_errors", [])
                    if relation_errors:
                        failed_count += 1
                        messages.append(
                            {
                                "name": item.get("name", "未知"),
                                "action": "failed",
                                "message": f'关联验证失败: {", ".join(relation_errors)}',
                                "row_data": item,
                                "error_fields": [
                                    "class_name",
                                    "class_id",
                                    "teacher_name",
                                    "teacher_id",
                                ],
                            }
                        )
                        continue

                    result = _upsert_subject(resolved_item, conflict_strategy, messages)
                    if result["skipped"]:
                        continue
                    subject_id = result["subject_id"]
                    _upsert_subject_class_link(subject_id, resolved_item, messages)

                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    messages.append(
                        {
                            "name": item.get("name", "未知"),
                            "action": "failed",
                            "message": f"导入失败: {e!s}",
                            "row_data": item,
                            "error_fields": ["system"],
                        }
                    )

        return {
            "success": True,
            "total": len(import_list),
            "success_count": success_count,
            "failed_count": failed_count,
            "messages": messages,
        }
