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

logger = logging.getLogger(__name__)
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

# B3 收敛 2026-09-05：ScoreRule.to_dict(fields) 子集常量。
# 列表/统计字段子集已下沉至 services/score_rule_query_service.py；
# 此处仅保留 create/update 响应用的子集。详情端点直接 rule.to_dict()。
RULE_CREATE_FIELDS = [
    "id",
    "name",
    "description",
    "category_id",
    "score",
    "is_active",
    "daily_limit",
    "min_interval",
]

ns_rules = Namespace("rules", description="积分规则相关操作")
rule_model = ns_rules.model(
    "ScoreRule",
    {
        "id": fields.Integer(readOnly=True, description="规则ID"),
        "name": fields.String(required=True, description="规则名称"),
        "description": fields.String(description="规则描述"),
        "category_id": fields.Integer(description="分类ID"),
        "score": fields.Float(required=True, description="分数（正数加分，负数扣分）"),
        "is_active": fields.Boolean(description="是否启用"),
        "daily_limit": fields.Integer(description="每日上限（0表示无限制）"),
        "min_interval": fields.Integer(description="最小间隔（秒，0表示无限制）"),
    },
)
rule_list_response = ns_rules.model(
    "RuleListResponse",
    {
        "rules": fields.List(fields.Nested(rule_model), description="规则列表"),
        "total": fields.Integer(description="总记录数"),
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "pages": fields.Integer(description="总页数"),
    },
)

def _validate_rule_create_payload(data):
    """校验创建积分规则的请求体（含分类存在性），返回错误信息列表。"""
    errors = []
    _validate_rule_name(data, errors)
    _validate_rule_score(data, errors)
    _validate_rule_category(data, errors)
    _validate_rule_limits(data, errors)
    return errors

def _validate_rule_name(data, errors):
    # 规则名称必填校验
    if not data.get("name") or not data.get("name").strip():
        errors.append("规则名称不能为空")
    # 规则名称长度校验
    if data.get("name") and len(data.get("name")) > ValidationRules.NAME_MAX_LEN:
        errors.append(f"规则名称长度不能超过{ValidationRules.NAME_MAX_LEN}个字符")
    # 描述长度校验
    description = data.get("description")
    if description and len(description) > ValidationRules.DESCRIPTION_MAX_LEN:
        errors.append(f"规则描述长度不能超过{ValidationRules.DESCRIPTION_MAX_LEN}个字符")

def _validate_rule_score(data, errors):
    # 分数校验
    score = data.get("score")
    if score is None:
        errors.append("分数不能为空")
    else:
        is_valid, error_msg = validate_score(score)
        if not is_valid:
            errors.append(f"分数: {error_msg}")

def _validate_rule_category(data, errors):
    # 分类ID校验
    category_id = data.get("category_id")
    if category_id is not None:
        is_valid, error_msg = validate_id(category_id)
        if not is_valid:
            errors.append(f"分类ID: {error_msg}")
        else:
            # 检查分类是否存在
            category = get_by_id(ScoreCategory, category_id)
            if not category:
                errors.append(f"分类ID {category_id} 不存在")

def _validate_rule_limits(data, errors):
    # 每日上限校验（兼容旧字段 max_per_day）
    daily_limit = data.get("daily_limit", data.get("max_per_day", 0))
    if daily_limit is not None:
        is_valid, _error_msg = validate_positive_int(daily_limit)
        if not is_valid and daily_limit != 0:
            errors.append("每日上限必须为正整数或0")
    # 最小间隔校验
    min_interval = data.get("min_interval", 0)
    if min_interval is not None:
        is_valid, _error_msg = validate_positive_int(min_interval)
        if not is_valid and min_interval != 0:
            errors.append("最小间隔必须为正整数或0")

RULE_TEMPLATES = [
    {
        "id": "classroom_positive",
        "name": "课堂表现（加分）",
        "description": "课堂上表现优秀的加分规则",
        "rules": [
            {
                "name": "积极回答问题",
                "description": "课堂上主动举手并正确回答问题",
                "score": 2,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "课堂纪律好",
                "description": "整节课保持良好纪律，无违纪行为",
                "score": 3,
                "daily_limit": 3,
                "min_interval": 0,
            },
            {
                "name": "认真听讲",
                "description": "上课专注听讲，不做小动作",
                "score": 1,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "帮助同学",
                "description": "主动帮助同学解答学习问题",
                "score": 3,
                "daily_limit": 3,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "homework",
        "name": "作业管理",
        "description": "与家庭作业相关的积分规则",
        "rules": [
            {
                "name": "按时完成作业",
                "description": "在规定时间前完成并提交作业",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "作业优秀",
                "description": "作业完成质量高，获得优秀评价",
                "score": 3,
                "daily_limit": 3,
                "min_interval": 0,
            },
            {
                "name": "未完成作业",
                "description": "未在规定时间内完成作业",
                "score": -5,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "作业抄袭",
                "description": "抄袭他人作业或答案",
                "score": -10,
                "daily_limit": 0,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "discipline",
        "name": "纪律管理",
        "description": "日常纪律和行为规范相关规则",
        "rules": [
            {
                "name": "迟到",
                "description": "上课或集会迟到",
                "score": -2,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "早退",
                "description": "未经允许提前离开",
                "score": -3,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "旷课",
                "description": "无故缺课或逃课",
                "score": -10,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "打架斗殴",
                "description": "与同学发生肢体冲突",
                "score": -20,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "说脏话",
                "description": "使用不文明语言",
                "score": -3,
                "daily_limit": 0,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "hygiene",
        "name": "卫生管理",
        "description": "班级和个人卫生相关规则",
        "rules": [
            {
                "name": "值日认真",
                "description": "认真完成值日工作，保持教室整洁",
                "score": 2,
                "daily_limit": 1,
                "min_interval": 0,
            },
            {
                "name": "乱扔垃圾",
                "description": "在教室或校园内乱扔垃圾",
                "score": -3,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "个人卫生差",
                "description": "个人卫生不达标",
                "score": -2,
                "daily_limit": 0,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "activity",
        "name": "活动参与",
        "description": "课外活动和比赛相关规则",
        "rules": [
            {
                "name": "参加活动",
                "description": "积极参加学校组织的各类活动",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "比赛获奖",
                "description": "在各类比赛中获得奖项",
                "score": 10,
                "daily_limit": 10,
                "min_interval": 0,
            },
            {
                "name": "好人好事",
                "description": "主动做好事，帮助他人",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "exam",
        "name": "考试评价",
        "description": "考试成绩和进步相关规则",
        "rules": [
            {
                "name": "考试进步",
                "description": "考试成绩比上次有明显进步",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "考试满分",
                "description": "考试获得满分",
                "score": 10,
                "daily_limit": 10,
                "min_interval": 0,
            },
            {
                "name": "考试作弊",
                "description": "在考试中作弊",
                "score": -20,
                "daily_limit": 0,
                "min_interval": 0,
            },
        ],
    },
]

apply_template_model = ns_rules.model(
    "ApplyTemplate",
    {
        "template_id": fields.String(required=True, description="模板ID"),
        "category_id": fields.Integer(description="分类ID（可选，默认创建新分类）"),
    },
)

import api.scores._rules_part1
import api.scores._rules_part2
