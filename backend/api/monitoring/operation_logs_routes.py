from flask import request
from flask_restx import Namespace, Resource
from models import db, OperationLog
from utils.permission import requires_permission
from datetime import datetime, timedelta
from sqlalchemy import func

ns_operation_logs = Namespace("operation-logs", description="操作日志相关操作")


@ns_operation_logs.route("/")
class OperationLogList(Resource):

    @ns_operation_logs.doc("list_operation_logs")
    @requires_permission("system.settings")
    def get(self):
        operation_type = request.args.get("operation_type")
        target_type = request.args.get("target_type")
        start_time = request.args.get("start_time")
        end_time = request.args.get("end_time")
        operator = request.args.get("operator")
        device_id = request.args.get("device_id")
        event_type = request.args.get("event_type")
        result = request.args.get("result")  # noqa: F841
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

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
    def get(self):
        start_time = request.args.get("start_time")
        end_time = request.args.get("end_time")

        query = OperationLog.query
        if start_time:
            query = query.filter(OperationLog.created_at >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(OperationLog.created_at <= datetime.fromisoformat(end_time))

        total_count = query.count()

        success_count = query.filter(OperationLog.description.ilike("%成功%")).count()

        failure_count = query.filter(OperationLog.description.ilike("%失败%")).count()

        unlock_a_count = query.filter(OperationLog.description.ilike("%开A箱%")).count()

        unlock_b_count = query.filter(OperationLog.description.ilike("%开B箱%")).count()

        by_type = (
            db.session.query(OperationLog.operation_type, func.count(OperationLog.id).label("count"))
            .filter(
                OperationLog.created_at <= datetime.fromisoformat(end_time) if end_time else True,
            )
            .group_by(OperationLog.operation_type)
            .all()
        )

        by_day = (
            db.session.query(
                func.date(OperationLog.created_at).label("date"),
                func.count(OperationLog.id).label("count"),
                func.sum(db.case((OperationLog.description.ilike("%成功%"), 1), else_=0)).label("success"),
                func.sum(db.case((OperationLog.description.ilike("%失败%"), 1), else_=0)).label("failure"),
            )
            .filter(
                OperationLog.created_at >= datetime.fromisoformat(start_time) if start_time else True,
                OperationLog.created_at <= datetime.fromisoformat(end_time) if end_time else True,
            )
            .group_by(func.date(OperationLog.created_at))
            .order_by(func.date(OperationLog.created_at).desc())
            .limit(30)
            .all()
        )

        return {
            "total_count": total_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "unlock_a_count": unlock_a_count,
            "unlock_b_count": unlock_b_count,
            "success_rate": round(success_count / total_count * 100, 1) if total_count > 0 else 0,
            "by_type": [{"type": t[0], "count": t[1]} for t in by_type],
            "by_day": [
                {
                    "date": str(t[0]),
                    "total": t[1],
                    "success": int(t[2]) if t[2] else 0,
                    "failure": int(t[3]) if t[3] else 0,
                }
                for t in by_day
            ],
        }


@ns_operation_logs.route("/summary")
class OperationLogSummary(Resource):

    @ns_operation_logs.doc("get_operation_log_summary")
    @requires_permission("system.settings")
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
