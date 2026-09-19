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

logger = logging.getLogger(__name__)

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

ns_records = Namespace("records", description="积分记录相关操作")

record_model = ns_records.model(
    "ScoreRecord",
    {
        "id": fields.Integer(readOnly=True, description="记录ID"),
        "user_id": fields.Integer(required=True, description="学生ID"),
        "rule_id": fields.Integer(description="规则ID"),
        "score_change": fields.Float(required=True, description="积分变化（正数加分，负数扣分）"),
        "description": fields.String(description="操作说明"),
        "operator": fields.String(description="操作人"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
    },
)

record_list_response = ns_records.model(
    "RecordListResponse",
    {
        "records": fields.List(fields.Nested(record_model), description="记录列表"),
        "total": fields.Integer(description="总记录数"),
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "pages": fields.Integer(description="总页数"),
    },
)

record_statistics_response = ns_records.model(
    "RecordStatistics",
    {
        "total_records": fields.Integer(description="总记录数"),
        "total_add": fields.Float(description="累计加分"),
        "total_subtract": fields.Float(description="累计扣分"),
        "net_change": fields.Float(description="净变化"),
        "today_count": fields.Integer(description="今日记录数"),
    },
)

import api.scores._records_part1
import api.scores._records_part2
