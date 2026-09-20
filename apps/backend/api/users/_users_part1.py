# -*- coding: utf-8 -*-
# part of api/users/users_routes.py (D2 split)

from flask import request
from utils.response import APIResponse
from utils.pagination import get_pagination
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from models import User, ClassInfo, get_by_id
from utils.permission import (
    requires_permission,
    get_current_admin,
    get_allowed_classes,
    can_access_student,
)
from utils.logger import log_operation
from utils.validation import (
    ValidationRules,
    validate_card_id,
    validate_phone,
    validate_score,
    validate_student_id,
    validate_name,
    validation_error_response,
)
from services.redis_cache_service import get_cache_service
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.class_time_checker import ClassTimeChecker
from services.user_service import user_service
from services.user_list_service import get_user_list_view
from datetime import datetime
import io
import csv
import re
import logging
from flask_restx import Namespace, Resource, fields

from api.users.users_routes import logger, limiter, ns_users, USER_CREATE_FIELDS, USER_DETAIL_FIELDS, USER_BY_CARD_FIELDS, login_model, user_model, user_list_response, batch_score_model, detect_encoding, _check_user_create_class_scope, _validate_create_user_fields, _validate_create_user_name, _validate_create_user_card_id, _validate_create_user_phones, _validate_create_user_score, _validate_create_user_card_unique, _validate_import_user, _validate_import_user_card_id, _validate_import_user_name, _validate_import_user_class, _validate_import_user_gender, _validate_import_user_phone, _build_import_user, _CSV_USER_HEADER_MAPPING, _check_csv_upload_file, _read_and_parse_csv, _build_csv_row_dict, _validate_csv_row, _csv_validate_card_id, _csv_validate_name, _csv_validate_class_name, _csv_validate_gender, _csv_validate_phones, _csv_validate_score, _build_csv_user, _build_csv_user_updates

@ns_users.route("/")
class UserList(Resource):
    @ns_users.doc(
        "list_users",
        description="获取学生列表",
        security="Bearer",
        params={
            "page": "页码，默认1",
            "per_page": "每页数量，默认100",
            "search": "搜索关键词（姓名、学号、电话）",
            "class_name": "班级名称筛选",
        },
    )
    @ns_users.response(200, "成功", user_list_response)
    @requires_permission("student.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取学生列表
        根据权限返回学生列表。超级管理员可以查看所有学生，教师只能查看所属班级的学生。
        查询参数：
        - page: 页码（默认1）
        - per_page: 每页数量（默认100）
        - search: 搜索关键词，匹配姓名、卡号、电话
        - class_name: 班级名称筛选
        返回分页结果，包含用户列表和分页信息。
        """
        admin = get_current_admin()
        page, per_page = get_pagination(default=100)
        search = request.args.get("search", "")
        class_name = request.args.get("class_name", "")
        class_id = request.args.get("class_id", type=int)
        skip_cache = request.args.get("skip_cache", "false").lower() == "true"
        # 高级筛选参数
        keyword = request.args.get("keyword", "")
        min_score = request.args.get("min_score", type=int)
        max_score = request.args.get("max_score", type=int)
        sort_by = request.args.get("sort_by", "name")
        sort_order = request.args.get("sort_order", "asc")
        # 缓存键包含所有筛选参数，处理admin为None和admin.role为None的情况
        admin_role = admin.role if admin and admin.role else "anonymous"
        cache_key = (
            f"users_list:{admin_role}:{page}:{per_page}:{search}:"
            f"{class_name}:{class_id}:{keyword}:{min_score}:{max_score}:"
            f"{sort_by}:{sort_order}"
        )
        # 如果不跳过缓存，尝试从缓存获取
        if not skip_cache:
            cached_result = get_cache_service().get(cache_key)
            if cached_result is not None:
                return APIResponse.success(data=cached_result)
        result = get_user_list_view(
            admin,
            page,
            per_page,
            search,
            class_name,
            class_id,
            keyword,
            min_score,
            max_score,
            sort_by,
            sort_order,
            cache_key,
        )
        return APIResponse.success(data=result)

    @ns_users.doc("create_user", description="创建学生", security="Bearer")
    @ns_users.expect(user_model)
    @ns_users.response(201, "创建成功")
    @ns_users.response(400, "参数错误")
    @requires_permission("student.create")
    def post(self):
        """
        创建新学生
        创建一个新的学生账户。
        非管理员用户只能为关联班级创建学生。
        请求体：
        - name: 学生姓名（必填）
        - gender: 性别（可选）
        - class_name: 班级（可选）
        - phone: 联系电话（可选）
        - father_name: 父亲姓名（可选）
        - father_phone: 父亲电话（可选）
        - mother_name: 母亲姓名（可选）
        - mother_phone: 母亲电话（可选）
        - guardian_name: 监护人姓名（可选）
        - guardian_phone: 监护人电话（可选）
        - guardian_relation: 监护关系（可选）
        - card_id: 学号（必填，8-16位数字）
        - current_score: 当前积分（可选，默认0，范围-1000到1000）
        """
        data = ns_users.payload
        # 数据隔离检查：只能为关联班级创建学生
        deny = _check_user_create_class_scope(data)
        if deny is not None:
            return deny
        errors = _validate_create_user_fields(data)
        if errors:
            return validation_error_response(errors)
        user_id = user_service.create_user(data)
        user = get_by_id(User, user_id)
        # 更新FTS搜索索引
        try:
            from utils.fulltext_search import get_search_engine

            search_engine = get_search_engine()
            search_engine.add_to_index(
                user.id, user.name, user.card_id, user.phone, user.class_name
            )
        except Exception as e:
            # 索引更新失败：新数据搜不到（索引与 DB 不一致），须留痕
            logger.warning(f"FTS索引更新失败(user_id={user.id}): {e}", exc_info=True)
        log_operation(
            operation_type="create",
            target_type="user",
            target_id=user.id,
            description=f"创建学生: {user.name}",
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("users")
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(
            data={
                "user": {
                    **user.to_dict(USER_CREATE_FIELDS),
                    "role": "student",
                }
            },
            message="用户创建成功",
            status_code=201,
        )

@ns_users.route("/<int:id>")
@ns_users.param("id", "用户ID")
class UserResource(Resource):
    @ns_users.doc("get_user", description="获取单个学生信息")
    @ns_users.response(200, "成功", user_model)
    @ns_users.response(404, "学生不存在")
    @requires_permission("student.view")
    def get(self, id):
        """
        获取单个学生详细信息
        根据学生ID获取详细信息。
        非管理员用户只能查看关联班级的学生。
        """
        user = User.query.get_or_404(id)
        if not can_access_student(id):
            return APIResponse.error(message="无权查看该学生", status_code=403)
        return APIResponse.success(
            data={
                **user.to_dict(USER_DETAIL_FIELDS),
                "score": user.current_score,
                "role": "student",
            }
        )

    @ns_users.doc("update_user", description="更新学生信息", security="Bearer")
    @ns_users.expect(user_model)
    @ns_users.response(200, "更新成功")
    @ns_users.response(404, "学生不存在")
    @requires_permission("student.edit")
    def put(self, id):
        """
        更新学生信息
        更新指定学生的信息。
        非管理员用户只能更新关联班级的学生。
        请求体参数均为可选，只更新提供的字段。
        """
        user = User.query.get_or_404(id)
        if not can_access_student(id):
            return APIResponse.error(message="无权更新该学生", status_code=403)
        before_data = {
            "name": user.name,
            "gender": user.gender,
            "class_name": user.class_name,
            "phone": user.phone,
            "card_id": user.card_id,
            "current_score": user.current_score,
        }
        data = ns_users.payload
        user.name = data.get("name", user.name)
        user.gender = data.get("gender", user.gender)
        user.class_name = data.get("class_name", user.class_name)
        user.phone = data.get("phone", user.phone)
        user.father_name = data.get("father_name", user.father_name)
        user.father_phone = data.get("father_phone", user.father_phone)
        user.mother_name = data.get("mother_name", user.mother_name)
        user.mother_phone = data.get("mother_phone", user.mother_phone)
        user.guardian_name = data.get("guardian_name", user.guardian_name)
        user.guardian_phone = data.get("guardian_phone", user.guardian_phone)
        user.guardian_relation = data.get("guardian_relation", user.guardian_relation)
        user.card_id = data.get("card_id", user.card_id)
        user.current_score = data.get("current_score", user.current_score)
        user_id = user_service.update_user(id, data)
        user = get_by_id(User, user_id)
        # 更新FTS搜索索引
        try:
            from utils.fulltext_search import (
                get_search_engine,
            )  # 函数内 import（与 create 分支一致，缺失会 NameError）

            search_engine = get_search_engine()
            search_engine.add_to_index(
                user.id, user.name, user.card_id, user.phone, user.class_name
            )
        except Exception as e:
            # 索引更新失败：改动后搜不到（索引与 DB 不一致），须留痕
            logger.warning(f"FTS索引更新失败(user_id={user.id}): {e}", exc_info=True)
        log_operation(
            operation_type="update",
            target_type="user",
            target_id=user.id,
            description=f"更新学生信息: {user.name}",
            before_data=before_data,
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("users")
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(
            data={
                "user": {
                    **user.to_dict(USER_CREATE_FIELDS),
                    "role": "student",
                }
            },
            message="用户更新成功",
        )

    @ns_users.doc("delete_user", description="删除学生", security="Bearer")
    @ns_users.response(200, "删除成功")
    @ns_users.response(404, "学生不存在")
    @requires_permission("student.delete")
    def delete(self, id):
        """
        删除学生
        删除指定的学生账户。
        非管理员用户只能删除关联班级的学生。
        """
        user = User.query.get_or_404(id)
        if not can_access_student(id):
            return APIResponse.error(message="无权删除该学生", status_code=403)
        before_data = {
            "name": user.name,
            "class_name": user.class_name,
            "card_id": user.card_id,
            "current_score": user.current_score,
        }
        # 先清理所有关联子表，避免 SQLite 外键 NOT NULL 约束导致删除失败
        # （级联清理 + 用户删除同处一个事务，收口至 service）
        user_service.delete_user(id)

        # 从FTS搜索索引移除
        try:
            from utils.fulltext_search import get_search_engine  # 函数内 import（缺失会 NameError）

            search_engine = get_search_engine()
            search_engine.remove_from_index(id)
        except Exception as e:
            # 索引移除失败：已删除用户仍可被搜到（索引残留），须留痕
            logger.warning(f"FTS索引移除失败(user_id={id}): {e}", exc_info=True)
        log_operation(
            operation_type="delete",
            target_type="user",
            target_id=id,
            description=f'删除学生: {before_data["name"]}',
            before_data=before_data,
        )
        get_cache_service().invalidate_by_tag("users")
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(message="用户删除成功")

@ns_users.route("/by-card/<string:cardId>")
@ns_users.param("cardId", "卡片ID")
class UserByCard(Resource):
    @ns_users.doc("get_user_by_card", description="通过卡片ID获取学生信息")
    @ns_users.response(200, "成功")
    @ns_users.response(404, "未找到用户")
    @requires_permission("student.view")
    def get(self, cardId):
        """
        通过卡片ID获取学生信息
        根据学生的卡片ID查询学生信息。
        非管理员用户只能查看关联班级的学生。
        """
        user = User.query.filter_by(card_id=cardId).first()
        if not user:
            return APIResponse.error(message="未找到用户", status_code=404)
        if not can_access_student(user.id):
            return APIResponse.error(message="无权查看该学生", status_code=403)
        return APIResponse.success(
            data={
                **user.to_dict(USER_BY_CARD_FIELDS),
            }
        )

@ns_users.route("/import")
class UserImport(Resource):
    @ns_users.doc("import_users", description="批量导入学生（JSON格式）", security="Bearer")
    @ns_users.expect(
        ns_users.model(
            "UserImportRequest",
            {
                "users": fields.List(
                    fields.Nested(user_model), required=True, description="学生列表"
                )
            },
        )
    )
    @ns_users.response(200, "导入完成")
    @ns_users.response(400, "没有导入数据")
    @requires_permission("student.create")
    def post(self):
        """
        批量导入学生（JSON格式）
        通过JSON格式批量导入学生数据。
        非管理员用户只能为关联班级导入学生。
        请求体：
        - users: 学生列表数组
        返回导入结果，包含成功和失败数量。
        """
        data = request.get_json()
        users_data = data.get("users", [])
        if not users_data:
            return APIResponse.error(message="没有导入数据", status_code=400)
        imported_count = 0
        error_count = 0
        errors = []
        pending_users = []
        # R8 修复: 批内 card_id 去重（原只查 DB，同批重复卡号通过预检 → commit IntegrityError 无回滚脏 session）
        seen_card_ids = set()
        for idx, user_data in enumerate(users_data):
            try:
                user, row_errors, _row_data = _validate_import_user(user_data, idx, seen_card_ids)
                if row_errors:
                    error_count += 1
                    errors.append(
                        {
                            "row": idx + 1,
                            "message": "; ".join(
                                [f'{err["field"]}: {err["message"]}' for err in row_errors]
                            ),
                            "row_data": _row_data,
                            "error_fields": [err["field"] for err in row_errors],
                        }
                    )
                    continue
                pending_users.append(user)
                seen_card_ids.add(str(user_data.get("card_id")).strip())
                imported_count += 1
            except Exception as e:
                error_count += 1
                errors.append(
                    {
                        "row": idx + 1,
                        "message": str(e),
                        "row_data": user_data,
                        "error_fields": ["system"],
                    }
                )
        try:
            user_service.bulk_create_users(pending_users)
        except Exception as e:
            # R8 修复: 唯一约束/数据异常 → 回滚避免脏 session（service 内 db_session_scope 已回滚）
            return APIResponse.error(
                message=f"导入失败：数据库写入冲突（{str(e)[:120]}），已回滚",
                data={"imported": 0, "errors": errors},
                status_code=400,
            )
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(
            data={"imported": imported_count, "errors": errors},
            message=f"导入完成: 成功{imported_count}条, 失败{error_count}条",
        )

@ns_users.route("/batch-delete")
class UserBatchDelete(Resource):
    @ns_users.doc("batch_delete_users", description="批量删除学生", security="Bearer")
    @ns_users.expect(
        ns_users.model(
            "BatchDeleteRequest",
            {"ids": fields.List(fields.Integer, required=True, description="用户ID列表")},
        )
    )
    @ns_users.response(200, "删除完成")
    @ns_users.response(400, "没有提供删除ID")
    @requires_permission("student.delete")
    def post(self):
        """
        批量删除学生
        批量删除指定的学生。
        非管理员用户只能删除关联班级的学生。
        请求体：
        - ids: 用户ID列表
        返回删除结果。
        """
        data = request.get_json()
        ids = data.get("ids", [])
        if not ids:
            return APIResponse.error(message="没有提供删除ID", status_code=400)
        target_ids = []
        for user_id in ids:
            if not can_access_student(user_id):
                continue
            user = get_by_id(User, user_id)
            if user:
                target_ids.append(user_id)
        deleted_count = user_service.bulk_delete_users(target_ids)
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(message=f"批量删除完成: 成功{deleted_count}条")

@ns_users.route("/batch-score")
class UserBatchScore(Resource):
    @ns_users.doc("batch_update_user_score", description="批量调整学生积分", security="Bearer")
    @ns_users.expect(batch_score_model)
    @ns_users.response(200, "调整完成")
    @ns_users.response(400, "没有提供用户ID")
    @requires_permission("score.entry")
    def post(self):
        """
        批量调整学生积分
        为多个学生同时调整积分。
        非管理员用户只能为关联班级的学生调整积分。
        请求体：
        - ids: 用户ID列表（必填）
        - score_change: 积分变化量（必填，正数加分，负数扣分）
        - description: 操作描述（可选）
        返回调整结果。
        """
        data = request.get_json()
        ids = data.get("ids", [])
        score_change = data.get("score_change", 0)
        description = data.get("description", "批量积分调整")
        if not ids:
            return APIResponse.error(message="没有提供用户ID", status_code=400)
        # 数据隔离：过滤掉无权操作的学生
        allowed_ids = [uid for uid in ids if can_access_student(uid)]
        if not allowed_ids:
            return APIResponse.error(message="无权为这些学生调整积分", status_code=403)
        # 性能优化：使用批量更新（写入路径收口至 service）
        updated_count = user_service.bulk_score_update(allowed_ids, score_change, description)
        # 发送积分变动通知到远程客户端（积分窗口显示）
        try:
            from api.monitoring.mqtt_routes import publish_mqtt

            blocked, check_message, reason_code = ClassTimeChecker.is_broadcast_blocked(
                force_send=False
            )
            if not blocked:
                users = User.query.filter(User.id.in_(ids)).all()
                score_change_str = f"{score_change:+g}" if score_change > 0 else str(score_change)
                for user in users:
                    score_change_text = (
                        f"学生:{user.name}, {score_change_str}分, 原因:{description}"
                    )
                    score_notification = {
                        "type": "score_change",
                        "text": score_change_text,
                        "popup": True,
                        "timestamp": datetime.now().isoformat(),
                    }
                    publish_mqtt("phonebox/remote/notify", score_notification)
                logger.info(
                    f"[ScoreChange] 批量积分变动通知已发送: {updated_count}个用户, {score_change_str}分"
                )
            else:
                ClassTimeChecker.log_notify_audit(
                    "score_change",
                    None,
                    None,
                    {"users": ids},
                    reason_code or "GLOBAL_TIME_RULE",
                    check_message,
                    force_send=False,
                )
                logger.info(
                    f"[ScoreChange] 批量积分变动通知被拦截（上课时间）: {updated_count}个用户, {score_change_str}分"
                )
        except Exception as e:
            logger.warning(f"[ScoreChange] 批量发送积分变动通知失败: {e}", exc_info=True)
        invalidate_cache("api:/api/users/*")
        return APIResponse.success(message=f"批量积分调整完成: 成功{updated_count}条")
