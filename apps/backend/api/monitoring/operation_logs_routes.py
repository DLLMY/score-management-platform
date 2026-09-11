from flask import request
from flask_restx import Namespace, Resource
from utils.pagination import get_pagination
from models import OperationLog
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api
from datetime import datetime, timedelta
from services.operation_log_service import get_stats

ns_operation_logs = Namespace("operation-logs", description="操作日志相关操作")


@ns_operation_logs.route("/")
class OperationLogList(Resource):

    @ns_operation_logs.doc("list_operation_logs")
    @requires_permission("system.settings")
    @cached_api(ttl=30)
    def get(self):
        operation_type = request.args.get("operation_type")
        target_type = request.args.get("target_type")
        start_time = request.args.get("start_time")
        end_time = request.args.get("end_time")
        operator = request.args.get("operator")
        device_id = request.args.get("device_id")
        event_type = request.args.get("event_type")
        result = request.args.get("result")
        page, per_page = get_pagination(default=20)

        query = OperationLog.query.order_by(OperationLog.created_at.desc())

        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if target_type:
            query = query.filter(OperationLog.target_type == target_type)
        if start_time:
            query = query.filter(OperationLog.created_at >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(OperationLog.created_at <= datetime.fromisoformat(end_time))
        if operator:
            query = query.filter(OperationLog.operator.ilike(f"%{operator}%"))
        if device_id:
            query = query.filter(OperationLog.description.ilike(f"%{device_id}%"))
        if event_type:
            query = query.filter(OperationLog.description.ilike(f"%{event_type}%"))
        if result:
            if result == "success":
                query = query.filter(OperationLog.description.ilike("%成功%"))
            elif result == "failure":
                query = query.filter(OperationLog.description.ilike("%失败%"))

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            "data": [
                {
                    "id": log.id,
                    "operation_type": log.operation_type,
                    "target_type": log.target_type,
                    "target_id": log.target_id,
                    "operator": log.operator,
                    "description": log.description,
                    "before_data": log.before_data,
                    "after_data": log.after_data,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }


@ns_operation_logs.route("/stats")
class OperationLogStats(Resource):

    @ns_operation_logs.doc("get_operation_log_stats")
    @requires_permission("system.settings")
    @cached_api(ttl=60)
    def get(self):
        start_time = request.args.get("start_time")
        end_time = request.args.get("end_time")
        return get_stats(start_time, end_time)


@ns_operation_logs.route("/summary")
class OperationLogSummary(Resource):

    @ns_operation_logs.doc("get_operation_log_summary")
    @requires_permission("system.settings")
    @cached_api(ttl=60)
    def get(self):
        today = datetime.now().date()
        week_ago = today - timedelta(days=7)

        today_logs = OperationLog.query.filter(
            OperationLog.created_at >= datetime.combine(today, datetime.min.time())
        ).count()

        today_success = OperationLog.query.filter(
            OperationLog.created_at >= datetime.combine(today, datetime.min.time()),
            OperationLog.description.ilike("%成功%"),
        ).count()

        today_failure = OperationLog.query.filter(
            OperationLog.created_at >= datetime.combine(today, datetime.min.time()),
            OperationLog.description.ilike("%失败%"),
        ).count()

        week_logs = OperationLog.query.filter(
            OperationLog.created_at >= datetime.combine(week_ago, datetime.min.time())
        ).count()

        return {
            "today": {
                "total": today_logs,
                "success": today_success,
                "failure": today_failure,
                "success_rate": round(today_success / today_logs * 100, 1) if today_logs > 0 else 0,
            },
            "week": {"total": week_logs},
        }
