"""管理员通知中心API

F9-B 合并说明：
- 原 admin_notifications 表已物理合并进 notification 表。
- 本模块统一读写 notification 表，并以 recipient_type='admin' 区分管理员通知。
- 对外契约（路径、响应字段形状，尤其 message 字段）保持不变：Notification.content 对外仍称 message。
"""

from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Notification, Admin, get_by_id
from utils.permission import requires_permission
from utils.response import APIResponse
from services.admin_notifications_service import (
    create_notification,
    delete_notification,
    mark_notification_read,
    mark_all_read,
    create_admin_notification as _service_create_admin_notification,
)
from datetime import datetime

ns_admin_notifications = Namespace("admin_notifications", description="管理员通知中心")

admin_notification_model = ns_admin_notifications.model(
    "AdminNotification",
    {
        "id": fields.Integer(readOnly=True, description="通知ID"),
        "admin_id": fields.Integer(description="管理员ID"),
        "title": fields.String(required=True, description="通知标题"),
        "message": fields.String(required=True, description="通知内容"),
        "type": fields.String(
            description="类型: success/info/warning/error", enum=["success", "info", "warning", "error"]
        ),
        "priority": fields.String(description="优先级: high/medium/low", enum=["high", "medium", "low"]),
        "is_read": fields.Boolean(readOnly=True, description="是否已读"),
        "extra_data": fields.Raw(description="额外数据"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
        "read_at": fields.DateTime(readOnly=True, description="阅读时间"),
    },
)


def _serialize(n):
    """将 Notification(recipient_type='admin') 序列化为对外 AdminNotification 形状。"""
    return {
        "id": n.id,
        "admin_id": n.admin_id,
        "title": n.title,
        "message": n.content,  # content 对外仍称 message
        "type": n.type,
        "priority": n.priority,
        "is_read": n.is_read,
        "extra_data": n.extra_data,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "read_at": n.read_at.isoformat() if n.read_at else None,
    }


@ns_admin_notifications.route("/")
class AdminNotificationList(Resource):

    @ns_admin_notifications.doc("get_admin_notifications")
    @requires_permission("notification.view")
    def get(self):
        admin_id = request.args.get("admin_id", type=int)
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        is_read = request.args.get("is_read", type=str)
        notify_type = request.args.get("type", type=str)
        priority = request.args.get("priority", type=str)

        query = Notification.query.filter_by(recipient_type="admin")
        if admin_id:
            query = query.filter_by(admin_id=admin_id)
        if is_read is not None:
            query = query.filter_by(is_read=(is_read.lower() == "true"))
        if notify_type:
            query = query.filter_by(type=notify_type)
        if priority:
            query = query.filter_by(priority=priority)

        pagination = query.order_by(Notification.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        notifications = [_serialize(n) for n in pagination.items]

        return APIResponse.success(
            data={
                "notifications": notifications,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        )

    @ns_admin_notifications.doc("create_admin_notification")
    @ns_admin_notifications.expect(admin_notification_model)
    @requires_permission("notification.send")
    def post(self):
        data = ns_admin_notifications.payload

        notification = create_notification(data)

        return APIResponse.success(
            data={
                "notification": {
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.content,
                    "type": notification.type,
                    "priority": notification.priority,
                    "is_read": notification.is_read,
                    "created_at": notification.created_at.isoformat() if notification.created_at else None,
                }
            },
            message="通知创建成功",
            status_code=201,
        )


@ns_admin_notifications.route("/<int:id>")
@ns_admin_notifications.param("id", "通知ID")
class AdminNotificationResource(Resource):

    @ns_admin_notifications.doc("get_admin_notification")
    @ns_admin_notifications.marshal_with(admin_notification_model)
    @requires_permission("notification.view")
    def get(self, id):
        notification = Notification.query.filter_by(id=id, recipient_type="admin").first_or_404()
        return _serialize(notification)

    @ns_admin_notifications.doc("delete_admin_notification")
    @requires_permission("notification.send")
    def delete(self, id):
        notification = Notification.query.filter_by(id=id, recipient_type="admin").first_or_404()
        delete_notification(notification)
        return APIResponse.success(message="通知已删除")


@ns_admin_notifications.route("/<int:id>/read")
@ns_admin_notifications.param("id", "通知ID")
class AdminNotificationMarkRead(Resource):

    @ns_admin_notifications.doc("mark_admin_notification_read")
    @requires_permission("notification.send")
    def post(self, id):
        notification = Notification.query.filter_by(id=id, recipient_type="admin").first_or_404()
        mark_notification_read(notification)
        return APIResponse.success(message="通知已标记为已读")


@ns_admin_notifications.route("/read_all")
class AdminNotificationMarkAllRead(Resource):

    @ns_admin_notifications.doc("mark_all_admin_notifications_read")
    @requires_permission("notification.send")
    def post(self):
        admin_id = request.args.get("admin_id", type=int)

        count = mark_all_read(admin_id)

        return APIResponse.success(data={"count": count}, message=f"已标记{count}条通知为已读")


@ns_admin_notifications.route("/count")
class AdminNotificationCount(Resource):

    @ns_admin_notifications.doc("get_admin_notification_count")
    @requires_permission("notification.view")
    def get(self):
        admin_id = request.args.get("admin_id", type=int)

        if admin_id:
            unread_count = Notification.query.filter_by(
                admin_id=admin_id, recipient_type="admin", is_read=False
            ).count()
            total_count = Notification.query.filter_by(admin_id=admin_id, recipient_type="admin").count()
        else:
            unread_count = Notification.query.filter_by(recipient_type="admin", is_read=False).count()
            total_count = Notification.query.filter_by(recipient_type="admin").count()

        return APIResponse.success(data={"unread_count": unread_count, "total_count": total_count})


@ns_admin_notifications.route("/recent")
class AdminNotificationRecent(Resource):

    @ns_admin_notifications.doc("get_recent_admin_notifications")
    @requires_permission("notification.view")
    def get(self):
        admin_id = request.args.get("admin_id", type=int)
        limit = request.args.get("limit", 10, type=int)

        query = Notification.query.filter_by(recipient_type="admin")
        if admin_id:
            query = query.filter_by(admin_id=admin_id)

        notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

        return [_serialize(n) for n in notifications]


def create_admin_notification(title, message, notify_type="info", priority="medium", admin_id=None, extra_data=None):
    """
    创建管理员通知（写入 notification 表，recipient_type='admin'）

    F17：落库委托 services.admin_notifications_service（本函数保留以维持
    approvals/records 懒加载与 api/system/__init__ 再导出的导入契约）。

    Args:
        title: 通知标题
        message: 通知内容
        notify_type: 类型 (success/info/warning/error)
        priority: 优先级 (high/medium/low)
        admin_id: 目标管理员ID，None表示发送给所有管理员
        extra_data: 额外数据

    Returns:
        list: 创建的通知对象列表
    """
    return _service_create_admin_notification(
        title=title,
        message=message,
        notify_type=notify_type,
        priority=priority,
        admin_id=admin_id,
        extra_data=extra_data,
    )
