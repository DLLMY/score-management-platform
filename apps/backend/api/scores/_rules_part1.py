# -*- coding: utf-8 -*-
# part of api/scores/rules_routes.py (D2 split)

import logging
from flask import request, send_file
from flask_restx import Namespace, Resource, fields
from models import ScoreRule, ScoreCategory, get_by_id
from utils.permission import requires_permission
from utils.decorators import safe_handle
from utils.logger import log_info, log_operation
from utils.response import APIResponse
from utils.pagination import get_pagination
from utils.validation import (
    ValidationRules,
    validate_score,
    validate_id,
    validate_positive_int,
    validation_error_response,
)
from services.redis_cache_service import get_cache_service
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.score_rule_service import (
    create_rule,
    update_rule,
    delete_rule,
    import_rules,
    apply_rule_template,
)
from services.score_rule_query_service import (
    get_rule_list_view,
    get_rule_statistics_view,
)
from datetime import datetime
import io
import csv

from api.scores.rules_routes import logger, RULE_CREATE_FIELDS, ns_rules, rule_model, rule_list_response, _validate_rule_create_payload, _validate_rule_name, _validate_rule_score, _validate_rule_category, _validate_rule_limits, RULE_TEMPLATES, apply_template_model

@ns_rules.route("/")
class RuleList(Resource):
    @ns_rules.doc(
        "list_rules",
        description="获取积分规则列表",
        params={
            "page": "页码（默认1）",
            "per_page": "每页数量（默认100）",
            "category_id": "分类ID筛选",
            "is_active": "是否启用筛选（true/false）",
        },
    )
    @ns_rules.response(200, "成功", rule_list_response)
    @requires_permission("rule.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取积分规则列表
        支持分页、分类筛选和状态筛选。需要规则查看权限。
        """
        page, per_page = get_pagination(default=100)
        category_id = request.args.get("category_id", type=int)
        is_active = request.args.get("is_active")
        cache_key = f"rules_list:{page}:{per_page}:{category_id}:{is_active}"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return APIResponse.success(data=cached_result)
        result = get_rule_list_view(page, per_page, category_id, is_active)
        get_cache_service().set(cache_key, result, ttl=300, tags=["rules"])
        return APIResponse.success(data=result)

    @ns_rules.doc("create_rule", description="创建积分规则", security="Bearer")
    @ns_rules.expect(rule_model)
    @ns_rules.response(201, "创建成功")
    @ns_rules.response(400, "请求参数错误")
    @requires_permission("rule.manage")
    def post(self):
        """
        创建积分规则
        创建新的积分规则，需要规则管理权限。
        请求体：
        - name: 规则名称（必填）
        - description: 规则描述
        - category_id: 分类ID
        - score: 分数（正数加分，负数扣分，必填，范围-1000到1000）
        - is_active: 是否启用（默认true）
        - daily_limit: 每日上限（0表示无限制）
        - min_interval: 最小间隔（秒，0表示无限制）
        """
        data = ns_rules.payload
        # 参数校验
        errors = _validate_rule_create_payload(data)
        if errors:
            return validation_error_response(errors)
        rule = create_rule(data)
        log_operation(
            "rule.create",
            "rule",
            rule.id,
            f"创建积分规则: {rule.name}",
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("rules")
        invalidate_cache("api:/api/rules/*")
        return APIResponse.success(
            data=rule.to_dict(RULE_CREATE_FIELDS),
            message="规则创建成功",
            status_code=201,
        )

@ns_rules.route("/<int:id>")
@ns_rules.param("id", "规则ID")
class RuleResource(Resource):
    @ns_rules.doc("get_rule", description="获取单个规则详情")
    @ns_rules.response(200, "成功", rule_model)
    @ns_rules.response(404, "规则不存在")
    @requires_permission("rule.view")
    def get(self, id):
        """
        获取单个规则详情
        根据规则ID获取规则的详细信息。需要规则查看权限。
        """
        cache_key = f"rule:{id}"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return APIResponse.success(data=cached_result)
        rule = ScoreRule.query.get_or_404(id)
        result = rule.to_dict()  # 默认输出 = 详情 11 字段契约
        get_cache_service().set(cache_key, result, ttl=300, tags=["rules"])
        return APIResponse.success(data=result)

    @ns_rules.doc("update_rule", description="更新规则", security="Bearer")
    @ns_rules.expect(rule_model)
    @ns_rules.response(200, "更新成功")
    @ns_rules.response(404, "规则不存在")
    @requires_permission("rule.manage")
    def put(self, id):
        """
        更新规则
        更新指定规则的信息，需要规则管理权限。
        """
        rule = ScoreRule.query.get_or_404(id)
        data = ns_rules.payload
        update_rule(rule, data)
        log_operation(
            "rule.update",
            "rule",
            rule.id,
            f"更新积分规则: {rule.name}",
            before_data={
                "name": data.get("name", rule.name),
                "score": data.get("score", rule.score),
                "is_active": data.get("is_active", rule.is_active),
            },
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("rules")
        invalidate_cache("api:/api/rules/*")
        return APIResponse.success(message="规则更新成功")

    @ns_rules.doc("delete_rule", description="删除规则", security="Bearer")
    @ns_rules.response(200, "删除成功")
    @ns_rules.response(404, "规则不存在")
    @requires_permission("rule.manage")
    def delete(self, id):
        """
        删除规则
        删除指定的规则，需要规则管理权限。
        """
        rule = ScoreRule.query.get_or_404(id)
        _deleted_name = rule.name
        delete_rule(rule)
        log_operation("rule.delete", "rule", id, f"删除积分规则: {_deleted_name}")
        get_cache_service().invalidate_by_tag("rules")
        invalidate_cache("api:/api/rules/*")
        return APIResponse.success(message="规则删除成功")

@ns_rules.route("/export")
class RuleExport(Resource):
    @ns_rules.doc("export_rules", description="导出规则列表", security="Bearer")
    @requires_permission("report.export")
    def get(self):
        """
        导出规则列表
        返回 JSON 结构，由前端序列化为 .json 文件下载，需要报表导出权限。
        """
        rules = ScoreRule.query.all()
        data = [
            {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "category": rule.category.name if rule.category else "",
                "category_id": rule.category_id,
                "score": rule.score,
                "is_active": rule.is_active,
                "daily_limit": rule.daily_limit,
                "min_interval": rule.min_interval,
            }
            for rule in rules
        ]
        return APIResponse.success(data={"rules": data, "count": len(data)})

@ns_rules.route("/import")
class RuleImport(Resource):
    @ns_rules.doc("import_rules", description="批量导入规则", security="Bearer")
    @requires_permission("rule.manage")
    def post(self):
        """
        批量导入规则
        批量导入规则数据，需要管理员权限。
        请求体：
        - rules: 规则数据列表
        """
        data = request.get_json()
        rules_data = data.get("rules", [])
        if not rules_data:
            return APIResponse.error(message="没有导入数据", status_code=400)
        result = import_rules(rules_data)
        return APIResponse.success(
            data=result,
            message=f"导入完成: 成功{result['success_count']}条, 失败{result['failed_count']}条",
        )
