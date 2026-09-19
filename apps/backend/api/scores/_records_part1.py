# -*- coding: utf-8 -*-
# part of api/scores/records_routes.py (D2 split)

import logging
from flask import request
from flask_restx import Namespace, Resource, fields
from utils.response import APIResponse
from utils.pagination import get_pagination
from models import ScoreRecord, User, ScoreRule, get_by_id
from utils.permission import (
    requires_permission,
    get_current_admin,
    get_allowed_classes,
    can_access_student,
)
from utils.logger import log_operation
from services.redis_cache_service import get_cache_service
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.class_time_checker import ClassTimeChecker
from services.score_record_service import (
    create_record,
    create_score_entry,
    delete_record,
    commit_batch_score_entry,
    serialize_score_record,
    get_record_statistics_view,
    get_record_list_view,
    get_record_list_by_user_view,
    get_score_entry_view,
)
from services.score_recalc import enqueue_or_recalc_user_score
from datetime import datetime
try:
    from app import csrf_exempt
except ImportError:

    def csrf_exempt(f):
        return f
try:
    from api.system.admin_notifications_routes import create_admin_notification
except ImportError:
    import logging

    def create_admin_notification(**kwargs):
        logging.getLogger(__name__).warning(
            "admin_notifications_routes 导入失败，成绩变动相关的管理员通知被静默丢弃"
        )
        return
from .score_record_orchestration import (
    check_rule_limits,
    _resolve_score_entry_change,
    _compute_rank_change,
    _notify_rank_change,
    _notify_score_change,
    _invalidate_score_caches,
    _recalc_composite_score,
    _resolve_batch_entry_rule,
    _build_batch_record,
    _validate_batch_entry,
    _recalc_composite_scores_after_batch,
)

from api.scores.records_routes import logger, ns_records, record_model, record_list_response, record_statistics_response

@ns_records.route("/")
class RecordList(Resource):
    @ns_records.doc(
        "list_records",
        description="获取积分记录列表",
        params={
            "page": "页码（默认1）",
            "per_page": "每页数量（默认50）",
            "user_id": "学生ID筛选",
            "rule_id": "规则ID筛选",
            "start_date": "开始日期（ISO格式）",
            "end_date": "结束日期（ISO格式）",
        },
    )
    @ns_records.response(200, "成功", record_list_response)
    @requires_permission("score.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取积分记录列表

        支持分页、学生筛选、规则筛选和日期范围筛选。
        非管理员用户只能查看关联班级的数据。
        权限隔离、日期解析与查询聚合已下沉到 score_record_service.get_record_list_view。
        """
        page, per_page = get_pagination(default=50)
        user_id = request.args.get("user_id", type=int)
        rule_id = request.args.get("rule_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        admin = get_current_admin()
        view = get_record_list_view(admin, user_id, rule_id, start_date, end_date, page, per_page)
        if "error" in view:
            return APIResponse.error(
                message=view["error"],
                status_code=view["status"],
                error_code=view.get("error_code"),
            )
        return APIResponse.success(data=view["data"])

    @ns_records.doc("create_record", description="创建积分记录", security="Bearer")
    @ns_records.expect(record_model)
    @ns_records.response(201, "创建成功")
    @ns_records.response(400, "请求参数错误")
    @requires_permission("score.entry")
    def post(self):
        """
        创建积分记录

        创建新的积分变动记录。同时会更新学生的当前积分。
        非管理员用户只能为关联班级的学生创建记录。

        请求体：
        - user_id: 学生ID（必填）
        - rule_id: 规则ID
        - score_change: 积分变化（必填，正数加分，负数扣分）
        - description: 操作说明
        - operator: 操作人（默认system）
        """
        data = request.get_json() or ns_records.payload

        user_id = data.get("user_id")
        if user_id is None:
            return APIResponse.bad_request(message="user_id 为必填项")
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return APIResponse.bad_request(message="user_id 必须为整数")

        score_change = data.get("score_change")
        if score_change is None:
            return APIResponse.bad_request(message="score_change 为必填项")
        try:
            score_change = float(score_change)
        except (TypeError, ValueError):
            return APIResponse.bad_request(message="score_change 必须为数字")

        # 数据隔离检查
        if not can_access_student(user_id):
            return APIResponse.error(message="无权为该学生创建记录", status_code=403)

        try:
            record, user_name = create_record(
                {
                    "user_id": user_id,
                    "rule_id": data.get("rule_id"),
                    "score_change": score_change,
                    "description": data.get("description"),
                    "operator": data.get("operator", "system"),
                }
            )
        except Exception as e:
            logger.error("%s: %s", "创建积分记录失败", e, exc_info=True)
            return APIResponse.error(message="创建积分记录失败", status_code=500)

        # R4: 手动创建积分记录同样触发综合评分重算（异步入队，无 broker 时同步回退）
        composite_score_status = "ok"
        try:
            enqueue_or_recalc_user_score(user_id)
        except Exception as e:
            logger.error("手动创建记录后综合评分重算失败 user_id=%s: %s", user_id, e, exc_info=True)
            composite_score_status = "recalculate_failed"

        # 记录操作日志（失败不影响主流程）
        try:
            log_operation(
                operation_type="score_change",
                target_type="record",
                target_id=record.id,
                description=(
                    f"积分变动: {user_name} "
                    f'{"+" if score_change > 0 else ""}'
                    f"{score_change}分"
                ),
                after_data=data,
            )
        except Exception as e:
            logger.warning("记录积分操作日志失败 record_id=%s: %s", record.id, e, exc_info=True)

        invalidate_cache("api:/api/records/*")

        return APIResponse.success(
            data={"record_id": record.id, "composite_score": composite_score_status},
            message="记录创建成功",
            status_code=201,
        )

@ns_records.route("/user/<int:user_id>")
@ns_records.param("user_id", "用户ID")
class RecordByUser(Resource):
    @ns_records.doc(
        "get_records_by_user",
        description="获取指定学生的积分记录",
        params={"page": "页码（默认1）", "per_page": "每页数量（默认50）"},
    )
    @ns_records.response(200, "成功", record_list_response)
    @requires_permission("score.view")
    def get(self, user_id):
        """
        获取指定学生的积分记录

        根据学生ID获取该学生的所有积分变动记录。
        非管理员用户只能查看关联班级的学生记录。
        数据隔离与查询聚合已下沉到 score_record_service.get_record_list_by_user_view。
        """
        page, per_page = get_pagination(default=50)
        view = get_record_list_by_user_view(user_id, page, per_page)
        if "error" in view:
            return APIResponse.error(message=view["error"], status_code=view["status"])
        return APIResponse.success(data=view["data"])

@ns_records.route("/statistics")
class RecordStatistics(Resource):
    @ns_records.doc(
        "get_record_statistics",
        description="获取积分统计信息",
        params={
            "user_id": "学生ID筛选",
            "class_name": "班级名称筛选",
            "start_date": "开始日期（ISO格式）",
            "end_date": "结束日期（ISO格式）",
        },
    )
    @ns_records.response(200, "成功", record_statistics_response)
    @requires_permission("score.view")
    def get(self):
        """
        获取积分统计信息

        获取积分记录的统计数据，包括总记录数、累计加分、累计扣分等。
        非管理员用户只能查看关联班级的统计数据。
        权限隔离与统计聚合已下沉到 score_record_service.get_record_statistics_view。
        """
        user_id = request.args.get("user_id", type=int)
        class_name = request.args.get("class_name")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        cache_key = f"score_statistics:{user_id}:{class_name}:{start_date}:{end_date}"
        cached_result = get_cache_service().get(cache_key)
        if cached_result:
            return APIResponse.success(data=cached_result)

        admin = get_current_admin()
        view = get_record_statistics_view(admin, user_id, class_name, start_date, end_date)
        if "error" in view:
            return APIResponse.error(
                message=view["error"],
                status_code=view["status"],
                error_code=view.get("error_code"),
            )

        # 使用标签缓存，便于积分变动时清除
        get_cache_service().set(cache_key, view["data"], ttl=300, tags=["statistics"])

        return APIResponse.success(data=view["data"])
