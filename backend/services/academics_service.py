"""academics 域写入/事务路径薄封装（F17 防腐层渐进重构）。

按 F17 范式：仅将写入/事务路径的 db.session 内联逻辑收口到此模块，路由层保留
get_or_404（404 语义）、请求级校验、缓存失效、操作日志、跨切面副作用与响应构造。
只读 db.session.query 路径暂缓不动。逐字节复刻原响应体/状态码/错误。

本文件为 academics 域唯一 service 承载：
- 第 1 子批（admin_classes + exam_import）：assign_class_to_admin / remove_class_from_admin / execute_score_import
- 后续子批（subject / exam / course_schedule / import）追加方法，不回改既有方法。
"""

import re
from datetime import datetime

from models import (
    db,
    Admin,
    AdminClass,
    ClassInfo,
    Subject,
    SubjectClass,
    Score,
    User,
    Exam,
    CourseSchedule,
    ImportConfig,
    get_by_id,
    cascade_delete_related_records,
)
from utils.datetime_utils import parse_date, parse_datetime
from utils.db_session import db_session_scope


class AcademicsService:
    # ------------------------------------------------------------------
    # 第 1 子批：admin_classes（管理员-班级关联）
    # ------------------------------------------------------------------

    def assign_class_to_admin(self, admin_id, class_id, is_primary, class_info):
        """为管理员分配班级（含班主任主班同步）。404 语义由路由层 get_or_404 保证。

        一次性事务：新增/更新 AdminClass 关联；若设为主班，同步 ClassInfo.head_teacher_id，
        并将该管理员其他班级 is_primary 置 False，且清理原班主任的 is_primary。
        """
        with db_session_scope():
            existing_link = AdminClass.query.filter_by(
                admin_id=admin_id, class_info_id=class_id
            ).first()
            if existing_link:
                existing_link.is_primary = is_primary
            else:
                link = AdminClass(
                    admin_id=admin_id,
                    class_info_id=class_id,
                    is_primary=is_primary,
                    assigned_at=datetime.now(),
                )
                db.session.add(link)

            if is_primary:
                # 保存之前的班主任ID，用于后续清理
                prev_head_teacher_id = class_info.head_teacher_id

                # 将该班级的班主任设置为当前管理员
                class_info.head_teacher_id = admin_id

                # 将该管理员其他班级的 is_primary 设置为 False
                AdminClass.query.filter(
                    AdminClass.admin_id == admin_id, AdminClass.class_info_id != class_id
                ).update({"is_primary": False})

                # 将该班级之前的班主任的 is_primary 设置为 False（如果存在且不同）
                if prev_head_teacher_id and prev_head_teacher_id != admin_id:
                    prev_admin_link = AdminClass.query.filter_by(
                        admin_id=prev_head_teacher_id, class_info_id=class_id
                    ).first()
                    if prev_admin_link:
                        prev_admin_link.is_primary = False

    def remove_class_from_admin(self, admin_id, class_id):
        """移除管理员与班级的关联。返回 False 表示未找到关联记录（路由据此回 404）。"""
        link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
        if not link:
            return False

        with db_session_scope():
            # 如果移除的是主要班级（班主任），清空 ClassInfo.head_teacher_id
            class_info = get_by_id(ClassInfo, class_id)
            if class_info and class_info.head_teacher_id == admin_id:
                class_info.head_teacher_id = None

            db.session.delete(link)

        return True

    # ------------------------------------------------------------------
    # 第 1 子批：exam_import（成绩 Excel 导入写入）
    # ------------------------------------------------------------------

    def execute_score_import(
        self, exam_id, entered_by, update_existing, validate_score, parsed_rows, headers
    ):
        """执行成绩导入写入，返回统计 dict。调用方（路由）负责 exam 存在/已发布校验与文件解析。

        行为与原 ExecuteImport.post 内联逻辑逐字节一致：逐行解析、按 (exam_id, student_id,
        subject_id) 去重 upsert；整段 commit，异常由路由外层捕获后 rollback 回 500。
        """
        # 延迟导入以避免与 exam_routes 共享的辅助类形成模块级循环依赖
        from services.score_import_helper import ScoreImportHelper, _resolve_subject_id

        card_id_idx = ScoreImportHelper.find_column_index(headers, "card_id")
        subject_idx = ScoreImportHelper.find_column_index(headers, "subject")
        score_idx = ScoreImportHelper.find_column_index(headers, "score")
        full_score_idx = ScoreImportHelper.find_column_index(headers, "full_score")
        remark_idx = ScoreImportHelper.find_column_index(headers, "remark")

        success_count = 0
        update_count = 0
        insert_count = 0
        failed_count = 0
        errors = []

        for i, row_data in enumerate(parsed_rows):
            try:
                card_id = (
                    str(row_data.get(headers[card_id_idx], "")).strip()
                    if card_id_idx >= 0 and row_data.get(headers[card_id_idx])
                    else None
                )
                subject = (
                    row_data.get(headers[subject_idx]) if subject_idx >= 0 else None
                )  # noqa: F841
                subject_id = _resolve_subject_id(subject, None)
                score_val = (
                    ScoreImportHelper.parse_score_value(row_data.get(headers[score_idx]))
                    if score_idx >= 0
                    else None
                )
                full_score = (
                    ScoreImportHelper.parse_score_value(row_data.get(headers[full_score_idx]))
                    if full_score_idx >= 0
                    else 100
                )
                remark = (
                    str(row_data.get(headers[remark_idx], "")).strip()
                    if remark_idx >= 0 and row_data.get(headers[remark_idx])
                    else None
                )

                if not card_id or not subject:
                    failed_count += 1
                    errors.append(f"行{i+2}: 必需字段为空")
                    continue
                if subject_id is None:
                    failed_count += 1
                    errors.append(f"行{i+2}: 科目「{subject}」未配置")
                    continue

                student = User.query.filter_by(card_id=card_id).first()
                if not student:
                    failed_count += 1
                    errors.append(f"行{i+2}: 学号{card_id}不存在")
                    continue

                if validate_score:
                    is_valid, msg = ScoreImportHelper.validate_score_range(score_val, full_score)
                    if not is_valid:
                        failed_count += 1
                        errors.append(f"行{i+2}: {student.name}-{subject} - {msg}")
                        continue

                existing_score = Score.query.filter_by(
                    exam_id=exam_id, student_id=student.id, subject_id=subject_id
                ).first()

                if existing_score:
                    if update_existing:
                        existing_score.score = score_val
                        existing_score.full_score = full_score
                        existing_score.remark = remark
                        existing_score.status = "pending"
                        existing_score.entered_by = entered_by
                        update_count += 1
                    else:
                        failed_count += 1
                        errors.append(f"行{i+2}: {student.name}-{subject}已存在")
                        continue
                else:
                    score = Score(
                        exam_id=exam_id,
                        student_id=student.id,
                        subject_id=subject_id,
                        score=score_val,
                        full_score=full_score,
                        remark=remark,
                        status="pending",
                        entered_by=entered_by,
                    )
                    db.session.add(score)
                    insert_count += 1

                success_count += 1

            except Exception as e:
                failed_count += 1
                errors.append(f"行{i+2}: {str(e)}")

        db.session.commit()

        return {
            "imported_count": success_count,
            "insert_count": insert_count,
            "update_count": update_count,
            "failed_count": failed_count,
            "errors": errors[:50],
        }

    # ------------------------------------------------------------------
    # 第 2 子批：subject（科目 / 科目-班级关联 / 排序 / 导入）
    # ------------------------------------------------------------------

    def create_subject(self, data):
        """创建科目。名称/代码重复校验（请求级 400）由路由层完成；本方法仅负责写入并返回新 id。"""
        subject = Subject(
            name=data["name"],
            code=data.get("code"),
            grade=data.get("grade"),
            description=data.get("description"),
            color=data.get("color", "#10B981"),
            is_active=data.get("is_active", True),
        )
        with db_session_scope():
            db.session.add(subject)
            db.session.flush()
            return subject.id

    def toggle_subject(self, subject):
        """切换科目启用/禁用。subject 由路由 get_or_404 加载（同作用域 session，autoflush 落库）。"""
        with db_session_scope():
            subject.is_active = not subject.is_active
            subject.updated_at = datetime.now()
            return subject.id

    def update_subject(self, subject, data):
        """更新科目字段。名称/代码重复校验由路由层完成；本方法逐字节复刻字段赋值与 updated_at。"""
        with db_session_scope():
            subject.name = data.get("name", subject.name)
            subject.code = data.get("code", subject.code)
            subject.grade = data.get("grade", subject.grade)
            subject.description = data.get("description", subject.description)
            subject.color = data.get("color", subject.color)
            subject.is_active = data.get("is_active", subject.is_active)
            subject.updated_at = datetime.now()
            return subject.id

    def delete_subject(self, subject_id):
        """删除科目（先级联清理子表关联，再删父记录）。404 语义由路由 get_or_404 保证。"""
        with db_session_scope():
            subject = Subject.query.get(subject_id)
            if subject is None:
                return
            cascade_delete_related_records(Subject, subject_id)
            db.session.delete(subject)

    def create_subject_class(self, subject_id, class_info_id, teacher_id):
        """新增科目-班级关联。重复/班级存在校验由路由层完成；返回新关联 id。"""
        link = SubjectClass(
            subject_id=subject_id, class_info_id=class_info_id, teacher_id=teacher_id
        )
        with db_session_scope():
            db.session.add(link)
            db.session.flush()
            return link.id

    def update_subject_class(self, link, teacher_id):
        """更新科目-班级关联（如更换授课教师）。link 由路由 first_or_404 加载；teacher_id 为 None 表示清空。"""
        with db_session_scope():
            link.teacher_id = teacher_id
            return link.id

    def delete_subject_class(self, link):
        """删除科目-班级关联。link 由路由 first_or_404 加载。"""
        with db_session_scope():
            db.session.delete(link)

    def update_subject_order(self, data):
        """批量更新科目排序；异常由 db_session_scope 回滚并上抛，路由捕获后回 500。"""
        with db_session_scope():
            for item in data:
                subject = Subject.query.get(item.get("id"))
                if subject:
                    subject.sort_order = item.get("order", 0)

    def execute_subject_import(self, import_list, validation_rules, conflict_strategy):
        """执行科目批量导入写入，返回统计 dict。

        路由负责 config 解析与文件解析（import_list 为已映射的列表，可能含 __error__ 哨兵项）。
        行为与原 SubjectImport.post 内联处理逐字节一致：逐行校验、关联解析、按名称 upsert 科目，
        并 upsert 科目-班级关联；整段提交，单项异常被捕获后计入 failed 不中断整体。
        """
        with db_session_scope():
            success_count = 0
            failed_count = 0
            messages = []

            def validate_item(item):
                errors = []
                for rule in validation_rules:
                    field = rule["field"]
                    rule_type = rule["rule_type"]
                    params = rule.get("params", {})
                    message = rule.get("message", f"{field}验证失败")
                    value = item.get(field)

                    if rule_type == "required" and value is None:
                        errors.append(message)
                    elif (
                        rule_type == "max_length"
                        and value
                        and len(str(value)) > params.get("max", 100)
                    ):
                        errors.append(message)
                    elif (
                        rule_type == "min_length"
                        and value
                        and len(str(value)) < params.get("min", 1)
                    ):
                        errors.append(message)
                    elif (
                        rule_type == "regex"
                        and value
                        and not re.match(params.get("pattern", ""), str(value))
                    ):
                        errors.append(message)
                return errors

            def resolve_relations(item):
                resolved = item.copy()
                validation_errors = []

                class_name = item.get("class_name")
                class_id = item.get("class_id")
                resolved_class_id = None

                if class_id and class_name:
                    validation_errors.append("不能同时提供班级ID和班级名称")
                elif class_name:
                    if not isinstance(class_name, str) or len(class_name.strip()) == 0:
                        validation_errors.append("班级名称格式无效，必须为非空字符串")
                    elif len(class_name.strip()) > 100:
                        validation_errors.append("班级名称长度超过限制（最大100字符）")
                    else:
                        class_info = ClassInfo.query.filter_by(name=class_name.strip()).first()
                        if not class_info:
                            validation_errors.append(f'班级 "{class_name}" 在系统中不存在')
                        else:
                            resolved_class_id = class_info.id
                elif class_id:
                    if not isinstance(class_id, (int, str)):
                        validation_errors.append("班级ID格式无效")
                    else:
                        try:
                            cid = int(class_id)
                            class_info = get_by_id(ClassInfo, cid)
                            if not class_info:
                                validation_errors.append(f'班级ID "{class_id}" 在系统中不存在')
                            else:
                                resolved_class_id = cid
                        except ValueError:
                            validation_errors.append("班级ID必须为有效数字")

                teacher_name = item.get("teacher_name")
                teacher_id = item.get("teacher_id")
                resolved_teacher_id = None

                if teacher_id and teacher_name:
                    validation_errors.append("不能同时提供教师ID和教师姓名")
                elif teacher_name:
                    if not isinstance(teacher_name, str) or len(teacher_name.strip()) == 0:
                        validation_errors.append("教师姓名格式无效，必须为非空字符串")
                    elif len(teacher_name.strip()) > 50:
                        validation_errors.append("教师姓名长度超过限制（最大50字符）")
                    else:
                        admin = Admin.query.filter(Admin.real_name == teacher_name.strip()).first()
                        if not admin:
                            admin = Admin.query.filter(
                                Admin.username == teacher_name.strip()
                            ).first()
                        if not admin:
                            validation_errors.append(f'教师 "{teacher_name}" 在系统中不存在')
                        else:
                            if admin.role not in ["admin", "teacher"]:
                                validation_errors.append(
                                    f'用户 "{teacher_name}" 的角色不是管理员或教师，无法担任授课教师'
                                )
                            resolved_teacher_id = admin.id
                elif teacher_id:
                    if not isinstance(teacher_id, (int, str)):
                        validation_errors.append("教师ID格式无效")
                    else:
                        try:
                            tid = int(teacher_id)
                            admin = get_by_id(Admin, tid)
                            if not admin:
                                validation_errors.append(f'教师ID "{teacher_id}" 在系统中不存在')
                            else:
                                if admin.role not in ["admin", "teacher"]:
                                    validation_errors.append(
                                        f'用户ID "{teacher_id}" 的角色不是管理员或教师，无法担任授课教师'
                                    )
                                resolved_teacher_id = tid
                        except ValueError:
                            validation_errors.append("教师ID必须为有效数字")

                resolved["_validation_errors"] = validation_errors
                resolved["_class_id"] = resolved_class_id
                resolved["_teacher_id"] = resolved_teacher_id
                return resolved

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

                    errors = validate_item(item)
                    if errors:
                        failed_count += 1
                        messages.append(
                            {
                                "name": item.get("name", "未知"),
                                "action": "failed",
                                "message": f'验证失败: {", ".join(errors)}',
                                "row_data": item,
                                "error_fields": list(
                                    set(
                                        [
                                            rule["field"]
                                            for rule in validation_rules
                                            if item.get(rule["field"]) is None
                                        ]
                                    )
                                ),
                            }
                        )
                        continue

                    resolved_item = resolve_relations(item)

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

                    existing = Subject.query.filter_by(name=resolved_item["name"]).first()
                    subject_id = None

                    if existing:
                        if conflict_strategy == "skip":
                            messages.append(
                                {
                                    "name": resolved_item["name"],
                                    "action": "skipped",
                                    "message": f'科目 "{resolved_item["name"]}" 已存在，已跳过',
                                }
                            )
                            continue
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

                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    messages.append(
                        {
                            "name": item.get("name", "未知"),
                            "action": "failed",
                            "message": f"导入失败: {str(e)}",
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

    # ------------------------------------------------------------------
    # 第 3 子批：exam / score（考试与成绩写入路径）
    # ------------------------------------------------------------------

    def create_exam(self, data):
        """创建考试。name/date 必填校验（请求级 400）由路由层完成；本方法仅负责写入并返回新 id。

        字段解析（parse_date/parse_datetime）与原文 ExamList.post 内联逻辑逐字节一致。
        """
        exam = Exam(
            name=data.get("name"),
            description=data.get("description"),
            date=parse_date(data.get("date")),
            subjects=data.get("subjects", []),
            start_time=parse_datetime(data.get("start_time")),
            end_time=parse_datetime(data.get("end_time")),
            importance=data.get("importance", "medium"),
            class_id=data.get("class_id"),
            status=data.get("status", "draft"),
            created_by=data.get("created_by"),
        )
        with db_session_scope():
            db.session.add(exam)
            db.session.flush()
            return exam.id

    def update_exam(self, exam_id, data):
        """更新考试字段。404 语义由路由层 get_by_id 保证；逐字节复刻字段赋值与 updated_at。"""
        with db_session_scope():
            exam = get_by_id(Exam, exam_id)
            if exam is None:
                return
            for key in [
                "name",
                "description",
                "date",
                "subjects",
                "start_time",
                "end_time",
                "importance",
                "class_id",
                "status",
            ]:
                if key in data:
                    if key in ("start_time", "end_time"):
                        setattr(exam, key, parse_datetime(data[key]))
                    elif key == "date":
                        setattr(exam, key, parse_date(data[key]))
                    else:
                        setattr(exam, key, data[key])
            exam.updated_at = datetime.now()
            return exam.id

    def delete_exam(self, exam_id):
        """删除考试（先级联清理子表成绩，再删父记录）。404 语义由路由层 get_by_id 保证。"""
        with db_session_scope():
            cascade_delete_related_records(Exam, exam_id)
            exam = get_by_id(Exam, exam_id)
            if exam:
                db.session.delete(exam)

    def publish_exam(self, exam_id):
        """发布考试（草稿→已发布）。状态前置校验（已发布幂等/非草稿报错）由路由层完成。"""
        with db_session_scope():
            exam = get_by_id(Exam, exam_id)
            if exam is None:
                return
            exam.status = "published"
            exam.updated_at = datetime.now()
            return exam.id

    def close_exam(self, exam_id):
        """结束考试（已发布→已关闭）。状态前置校验由路由层完成。"""
        with db_session_scope():
            exam = get_by_id(Exam, exam_id)
            if exam is None:
                return
            exam.status = "closed"
            exam.updated_at = datetime.now()
            return exam.id

    def create_score(
        self, exam_id, student_id, subject_id, score_val, full_score, status, remark, entered_by
    ):
        """创建单条成绩。科目解析/考试存在/已关闭禁录/分数范围/冲突检测（请求级）由路由层完成。

        返回新成绩 id；唯一约束冲突由 db_session_scope 回滚并上抛 IntegrityError，路由捕获后回 400。
        """
        score = Score(
            exam_id=exam_id,
            student_id=student_id,
            subject_id=subject_id,
            score=score_val,
            full_score=full_score,
            status=status,
            remark=remark,
            entered_by=entered_by,
        )
        with db_session_scope():
            db.session.add(score)
            db.session.flush()
            return score.id

    def batch_create_scores(self, score_dicts):
        """批量写入成绩。逐条校验/解析/冲突检测由路由层完成；本方法仅整段提交已验证的 score_dicts。

        唯一约束冲突由 db_session_scope 回滚并上抛 IntegrityError，路由捕获后回 400（避免半提交）。
        """
        with db_session_scope():
            for d in score_dicts:
                db.session.add(
                    Score(
                        exam_id=d["exam_id"],
                        student_id=d["student_id"],
                        subject_id=d["subject_id"],
                        score=d.get("score"),
                        full_score=d.get("full_score", 100),
                        status=d.get("status", "pending"),
                        remark=d.get("remark"),
                        entered_by=d.get("entered_by"),
                    )
                )

    def update_score(self, score_id, data):
        """更新成绩字段。考试关闭禁改校验由路由层完成；逐字节复刻 setattr 循环与范围校验。

        分数格式非法/越界抛 ValueError（路由捕获回 400）；唯一冲突由 scope 回滚抛 IntegrityError。
        """
        with db_session_scope():
            score = get_by_id(Score, score_id)
            if score is None:
                return
            for key in ["score", "full_score", "rank", "status", "remark"]:
                if key in data:
                    setattr(score, key, data[key])
            # E13 修复: 更新后范围校验
            if score.score is not None:
                full = score.full_score or 100
                try:
                    score.score = float(score.score)
                    full = float(full)
                except (TypeError, ValueError):
                    raise ValueError("分数格式非法")
                if score.score < 0 or (full > 0 and score.score > full):
                    raise ValueError("成绩需在 0 ~ %s 之间" % full)
            score.updated_at = datetime.now()
            return score.id

    def delete_score(self, score_id):
        """删除成绩。考试关闭禁删校验由路由层完成；404 语义由路由层 get_by_id 保证。"""
        with db_session_scope():
            score = get_by_id(Score, score_id)
            if score:
                db.session.delete(score)

    def confirm_all_scores(self, exam_id):
        """批量确认某次考试的所有成绩（pending/normal → confirmed）。

        返回更新条数；异常由 db_session_scope 回滚并上抛，路由捕获后回 500。
        """
        with db_session_scope():
            updated = Score.query.filter(
                Score.exam_id == exam_id,
                Score.status.in_(["pending", "normal"]),
            ).update(
                {"status": "confirmed", "updated_at": datetime.now()},
                synchronize_session=False,
            )
            return int(updated or 0)

    # ------------------------------------------------------------------
    # 第 4 子批：course_schedule（课程表写入路径）
    # ------------------------------------------------------------------

    def create_course_schedule(self, data):
        """创建课程安排。冲突检测/教师校验/数据隔离（请求级 400/403）由路由层完成；
        本方法仅负责写入并返回新 id。逐字节复刻 CourseScheduleList.post 的字段赋值。
        """
        schedule = CourseSchedule(
            class_info_id=data["class_info_id"],
            subject_id=data["subject_id"],
            day_of_week=data["day_of_week"],
            period_number=data["period_number"],
            teacher_id=data.get("teacher_id"),
            teacher_name=data.get("teacher_name"),
            classroom=data.get("classroom"),
            description=data.get("description"),
            color=data.get("color"),
            is_active=data.get("is_active", True),
        )
        with db_session_scope():
            db.session.add(schedule)
            db.session.flush()
            return schedule.id

    def update_course_schedule(self, schedule_id, data):
        """更新课程安排字段。404 语义由路由层 get_or_404 保证；逐字节复刻字段赋值与 updated_at。"""
        with db_session_scope():
            schedule = get_by_id(CourseSchedule, schedule_id)
            if schedule is None:
                return
            schedule.class_info_id = data["class_info_id"]
            schedule.subject_id = data["subject_id"]
            schedule.day_of_week = data["day_of_week"]
            schedule.period_number = data["period_number"]
            schedule.teacher_id = data["teacher_id"]
            schedule.teacher_name = data["teacher_name"]
            schedule.classroom = data["classroom"]
            schedule.description = data["description"]
            schedule.color = data["color"]
            schedule.is_active = data["is_active"]
            schedule.updated_at = datetime.now()
            return schedule.id

    def delete_course_schedule(self, schedule_id):
        """删除课程安排。404 语义由路由层 get_or_404 保证。"""
        with db_session_scope():
            schedule = get_by_id(CourseSchedule, schedule_id)
            if schedule:
                db.session.delete(schedule)

    def apply_course_schedule_import(self, creates, updates):
        """批量写入课程表导入结果。creates: 新建行字段 dict 列表；updates: (existing_id, 字段 dict) 列表。

        路由负责文件解析、逐行校验、关联解析、冲突检测与 messages/计数构建；本方法仅整段提交已验证的
        写操作（与原 CourseScheduleImport.post 内联 add + 末尾 commit 单事务语义逐字节一致）。
        返回 (created_count, updated_count)。
        """
        with db_session_scope():
            created = 0
            updated = 0
            for fields in creates:
                schedule = CourseSchedule(
                    class_info_id=fields["class_info_id"],
                    subject_id=fields["subject_id"],
                    day_of_week=fields["day_of_week"],
                    period_number=fields["period_number"],
                    teacher_name=fields.get("teacher_name"),
                    classroom=fields.get("classroom"),
                    description=fields.get("description"),
                    color=fields.get("color"),
                    is_active=fields.get("is_active", True),
                )
                db.session.add(schedule)
                created += 1
            for schedule_id, fields in updates:
                existing = get_by_id(CourseSchedule, schedule_id)
                if existing is None:
                    continue
                existing.subject_id = fields["subject_id"]
                existing.teacher_name = fields.get("teacher_name", existing.teacher_name)
                existing.classroom = fields.get("classroom", existing.classroom)
                existing.description = fields.get("description", existing.description)
                existing.color = fields.get("color", existing.color)
                existing.is_active = fields.get("is_active", existing.is_active)
                existing.updated_at = datetime.now()
                updated += 1
            return created, updated

    # ------------------------------------------------------------------
    # 第 4 子批：import（导入配置写入路径）
    # ------------------------------------------------------------------

    def create_import_config(self, data):
        """创建导入配置。module_name/config_name 必填与同名冲突校验（请求级 400）由路由层完成；
        本方法仅负责写入（含 is_default 互斥清理）并返回新 id。逐字节复刻 ImportConfigList.post。
        """
        with db_session_scope():
            if data.get("is_default"):
                ImportConfig.query.filter_by(
                    module_name=data["module_name"], is_default=True
                ).update({"is_default": False})
            config = ImportConfig(
                module_name=data["module_name"],
                config_name=data["config_name"],
                field_mappings=data.get("field_mappings", []),
                validation_rules=data.get("validation_rules", []),
                conflict_strategy=data.get("conflict_strategy", "update"),
                default_values=data.get("default_values", {}),
                is_active=data.get("is_active", True),
                is_default=data.get("is_default", False),
                description=data.get("description"),
                created_by=data.get("created_by"),
            )
            db.session.add(config)
            db.session.flush()
            return config.id

    def update_import_config(self, config_id, data):
        """更新导入配置。改名冲突校验（请求级 400）由路由层完成；逐字节复刻字段赋值与 is_default 互斥清理。"""
        with db_session_scope():
            config = get_by_id(ImportConfig, config_id)
            if config is None:
                return
            if "config_name" in data:
                config.config_name = data["config_name"]
            if "field_mappings" in data:
                config.field_mappings = data["field_mappings"]
            if "validation_rules" in data:
                config.validation_rules = data["validation_rules"]
            if "conflict_strategy" in data:
                config.conflict_strategy = data["conflict_strategy"]
            if "default_values" in data:
                config.default_values = data["default_values"]
            if "is_active" in data:
                config.is_active = data["is_active"]
            if "is_default" in data and data["is_default"] and not config.is_default:
                ImportConfig.query.filter_by(
                    module_name=config.module_name, is_default=True
                ).update({"is_default": False})
            if "is_default" in data:
                config.is_default = data["is_default"]
            if "description" in data:
                config.description = data["description"]
            config.updated_at = datetime.now()
            return config.id

    def delete_import_config(self, config_id):
        """删除导入配置。is_default 禁删校验（请求级 400）由路由层完成；404 语义由路由层 get_or_404 保证。"""
        with db_session_scope():
            config = get_by_id(ImportConfig, config_id)
            if config:
                db.session.delete(config)

    def set_default_import_config(self, config_id):
        """将指定配置设为模块默认（清理同模块其他默认）。404 语义由路由层 get_or_404 保证。"""
        with db_session_scope():
            config = get_by_id(ImportConfig, config_id)
            if config is None:
                return
            ImportConfig.query.filter_by(module_name=config.module_name, is_default=True).update(
                {"is_default": False}
            )
            config.is_default = True
            config.updated_at = datetime.now()
            return config.id


academics_service = AcademicsService()
