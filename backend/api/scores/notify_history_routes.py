from flask_restx import Namespace, Resource, fields
from flask import request
from models import NotifyHistory
from utils.permission import requires_permission
from datetime import datetime, timedelta

ns_notify_history = Namespace("notify_history", description="通知历史记录")
history_response = ns_notify_history.model(
    "NotifyHistory",
    {
        "id": fields.Integer(readOnly=True, description="记录ID"),
        "text": fields.String(description="通知内容"),
        "volume": fields.Float(description="音量"),
        "speak": fields.Boolean(description="语音播报"),
        "popup": fields.Boolean(description="弹窗显示"),
        "timeout_sec": fields.Integer(description="弹窗超时时间"),
        "urgent": fields.Boolean(description="紧急通知"),
        "send_mode": fields.String(description="发送模式"),
        "device_id": fields.String(description="设备ID"),
        "topic": fields.String(description="MQTT主题"),
        "status": fields.String(description="发送状态"),
        "sent_by": fields.Integer(description="发送人"),
        "created_at": fields.String(description="发送时间"),
    },
)


@ns_notify_history.route("/")
class HistoryList(Resource):
    @ns_notify_history.doc("list_history")
    @ns_notify_history.param("page", "页码", _in="query", default=1)
    @ns_notify_history.param("per_page", "每页数量", _in="query", default=20)
    @ns_notify_history.param("status", "状态筛选", _in="query")
    @ns_notify_history.param("days", "最近天数", _in="query")
    @requires_permission("notification.view")
    def get(self):
        """获取通知历史记录列表"""
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 20))
        status = request.args.get("status")
        days = request.args.get("days")
        query = NotifyHistory.query.order_by(NotifyHistory.created_at.desc())
        if status:
            query = query.filter(NotifyHistory.status == status)
        if days:
            cutoff_time = datetime.now() - timedelta(days=int(days))
            query = query.filter(NotifyHistory.created_at >= cutoff_time)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            "data": [
                {
                    "id": h.id,
                    "text": h.text,
                    "volume": h.volume,
                    "speak": h.speak,
                    "popup": h.popup,
                    "timeout_sec": h.timeout_sec,
                    "urgent": h.urgent,
                    "send_mode": h.send_mode,
                    "device_id": h.device_id,
                    "topic": h.topic,
                    "status": h.status,
                    "sent_by": h.sent_by,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
                for h in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }


@ns_notify_history.route("/<int:id>")
@ns_notify_history.doc(params={"id": "记录ID"})
class HistoryDetail(Resource):
    @ns_notify_history.doc("get_history")
    @requires_permission("notification.view")
    def get(self, id):
        """获取单个通知历史记录详情"""
        history = NotifyHistory.query.get_or_404(id)
        return {
            "id": history.id,
            "text": history.text,
            "volume": history.volume,
            "speak": history.speak,
            "popup": history.popup,
            "timeout_sec": history.timeout_sec,
            "urgent": history.urgent,
            "send_mode": history.send_mode,
            "device_id": history.device_id,
            "topic": history.topic,
            "status": history.status,
            "sent_by": history.sent_by,
            "created_at": history.created_at.isoformat() if history.created_at else None,
        }


@ns_notify_history.route("/stats")
class HistoryStats(Resource):
    @ns_notify_history.doc("get_history_stats")
    @requires_permission("notification.view")
    def get(self):
        """获取通知统计数据"""
        today = datetime.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        total_count = NotifyHistory.query.count()
        today_count = NotifyHistory.query.filter(
            NotifyHistory.created_at >= datetime.combine(today, datetime.min.time())
        ).count()
        week_count = NotifyHistory.query.filter(
            NotifyHistory.created_at >= datetime.combine(week_ago, datetime.min.time())
        ).count()
        month_count = NotifyHistory.query.filter(
            NotifyHistory.created_at >= datetime.combine(month_ago, datetime.min.time())
        ).count()
        success_count = NotifyHistory.query.filter_by(status="sent").count()
        fail_count = NotifyHistory.query.filter_by(status="failed").count()
        return {
            "total_count": total_count,
            "today_count": today_count,
            "week_count": week_count,
            "month_count": month_count,
            "success_count": success_count,
            "fail_count": fail_count,
            "success_rate": round(success_count / total_count * 100, 2) if total_count > 0 else 0,
        }


@ns_notify_history.route("/clean")
class HistoryClean(Resource):
    @ns_notify_history.doc("clean_history")
    @ns_notify_history.param("days", "保留天数", _in="query", default=30)
    @requires_permission("notification.view")
    def delete(self):
        """清理历史记录"""
        days = int(request.args.get("days", 30))
        # 写入路径收口至 notify_history_service（F17 防腐层）：原路由内 delete + commit 已迁出
        from services.notify_history_service import clean_notify_history
        deleted_count = clean_notify_history(days)
        return {
            "success": True,
            "message": f"已清理 {deleted_count} 条历史记录",
            "deleted_count": deleted_count,
        }
