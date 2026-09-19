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

@ns_rules.route("/template/download")
class RuleTemplate(Resource):
    @ns_rules.doc("download_rule_template", security="Bearer")
    @requires_permission("rule.view")
    def get(self):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["规则名称", "描述", "分类ID", "分数", "是否启用", "每日上限", "最小间隔"])
        writer.writerow(["作业完成", "完成家庭作业", "1", "5", "是", "3", "60"])
        writer.writerow(["迟到", "上学迟到", "2", "-2", "是", "0", "0"])
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name="rule_import_template.csv",
        )

@ns_rules.route("/templates")
class RuleTemplates(Resource):
    @ns_rules.doc("list_rule_templates", description="获取预设规则模板列表", security="Bearer")
    @ns_rules.response(200, "成功")
    @requires_permission("rule.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取预设规则模板列表
        返回系统预设的积分规则模板，包含课堂表现、作业管理、纪律管理等多个类别。
        """
        return APIResponse.success(data={"templates": RULE_TEMPLATES})

@ns_rules.route("/templates/apply")
class ApplyRuleTemplate(Resource):
    @ns_rules.doc("apply_rule_template", description="应用预设规则模板")
    @ns_rules.expect(apply_template_model)
    @ns_rules.response(200, "成功")
    @requires_permission("rule.manage")
    @safe_handle(message="应用模板失败", default_status=500)
    def post(self):
        """
        应用预设规则模板
        根据模板ID批量创建积分规则。如果指定了分类ID，则将所有规则归入该分类；
        否则会自动创建一个与模板同名的新分类。
        """
        data = request.get_json()
        template_id = data.get("template_id")
        category_id = data.get("category_id")
        if not template_id:
            return APIResponse.error(message="模板ID不能为空", status_code=400)
        template = next((t for t in RULE_TEMPLATES if t["id"] == template_id), None)
        if not template:
            return APIResponse.error(message="模板不存在", status_code=404)
        result, err = apply_rule_template(template, category_id)
        if err:
            return APIResponse.error(message=err, status_code=400)
        # 清除所有rules相关缓存
        invalidated_count = get_cache_service().invalidate_by_tag("rules")
        log_info(f"[Cache] 模板应用后失效了 {invalidated_count} 个rules标签缓存")
        invalidate_cache("api:/api/rules/*")
        return APIResponse.success(
            data=result,
            message=f"成功应用模板，创建了 {result['created_count']} 条规则",
        )

@ns_rules.route("/statistics")
class RuleStatistics(Resource):
    @ns_rules.doc("rule_statistics", description="获取规则使用统计", security="Bearer")
    @ns_rules.response(200, "成功")
    @requires_permission("rule.view")
    @cached_api(ttl=60)
    def get(self):
        """
        获取规则使用统计
        返回各规则的被使用次数、最近使用时间等信息，帮助了解规则的使用情况。
        """
        return APIResponse.success(data=get_rule_statistics_view())
