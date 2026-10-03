import logging

from flask_restx import Namespace, fields

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
