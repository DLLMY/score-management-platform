"""管理员通知中心API"""

from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, AdminNotification, Admin, get_by_id
from utils.permission import requires_permission
from utils.response import APIResponse
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

notification_count_response = ns_admin_notifications.model(
    "NotificationCount",
    {"unread_count": fields.Integer(description="未读通知数量"), "total_count": fields.Integer(description="通知总数")},
)


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

        query = AdminNotification.query
        if admin_id:
            query = query.filter_by(admin_id=admin_id)
        if is_read is not None:
            query = query.filter_by(is_read=(is_read.lower() == "true"))
        if notify_type:
            query = query.filter_by(type=notify_type)
        if priority:
            query = query.filter_by(priority=priority)

        pagination = query.order_by(AdminNotification.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        notifications = []
        for n in pagination.items:
            notifications.append(
                {
                    "id": n.id,
                    "admin_id": n.admin_id,
                    "title": n.title,
                    "message": n.message,
                    "type": n.type,
                    "priority": n.priority,
                    "is_read": n.is_read,
                    "extra_data": n.extra_data,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                }
            )

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

        notification = AdminNotification(
            admin_id=data.get("admin_id"),
            title=data.get("title"),
            message=data.get("message"),
            type=data.get("type", "info"),
            priority=data.get("priority", "medium"),
            extra_data=data.get("extra_data", {}),
        )

        db.session.add(notification)
        db.session.commit()

        return APIResponse.success(
            data={
                "notification": {
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
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
        notification = AdminNotification.query.get_or_404(id)
        return {
            "id": notification.id,
            "admin_id": notification.admin_id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "priority": notification.priority,
            "is_read": notification.is_read,
            "extra_data": notification.extra_data,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
        }

    @ns_admin_notifications.doc("delete_admin_notification")
    @requires_permission("notification.send")
    def delete(self, id):
        notification = AdminNotification.query.get_or_404(id)
        db.session.delete(notification)
        db.session.commit()
        return APIResponse.success(message="通知已删除")


@ns_admin_notifications.route("/<int:id>/read")
@ns_admin_notifications.param("id", "通知ID")
class AdminNotificationMarkRead(Resource):

    @ns_admin_notifications.doc("mark_admin_notification_read")
    @requires_permission("notification.send")
    def post(self, id):
        notification = AdminNotification.query.get_or_404(id)
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now()
            db.session.commit()
        return APIResponse.success(message="通知已标记为已读")


@ns_admin_notifications.route("/read_all")
class AdminNotificationMarkAllRead(Resource):

    @ns_admin_notifications.doc("mark_all_admin_notifications_read")
    @requires_permission("notification.send")
    def post(self):
        admin_id = request.args.get("admin_id", type=int)

        if admin_id:
            count = AdminNotification.query.filter_by(admin_id=admin_id, is_read=False).update(
                {"is_read": True, "read_at": datetime.now()}
            )
        else:
            count = AdminNotification.query.filter_by(is_read=False).update(
                {"is_read": True, "read_at": datetime.now()}
            )

        db.session.commit()
        return APIResponse.success(data={"count": count}, message=f"已标记{count}条通知为已读")


@ns_admin_notifications.route("/count")
class AdminNotificationCount(Resource):

    @ns_admin_notifications.doc("get_admin_notification_count")
    @ns_admin_notifications.marshal_with(notification_count_response)
    @requires_permission("notification.view")
    def get(self):
        admin_id = request.args.get("admin_id", type=int)

        if admin_id:
            unread_count = AdminNotification.query.filter_by(admin_id=admin_id, is_read=False).count()
            total_count = AdminNotification.query.filter_by(admin_id=admin_id).count()
        else:
            unread_count = AdminNotification.query.filter_by(is_read=False).count()
            total_count = AdminNotification.query.count()

        return APIResponse.success(data={"unread_count": unread_count, "total_count": total_count})


@ns_admin_notifications.route("/recent")
class AdminNotificationRecent(Resource):

    @ns_admin_notifications.doc("get_recent_admin_notifications")
    @requires_permission("notification.view")
    def get(self):
        admin_id = request.args.get("admin_id", type=int)
        limit = request.args.get("limit", 10, type=int)

        query = AdminNotification.query
        if admin_id:
            query = query.filter_by(admin_id=admin_id)

        notifications = query.order_by(AdminNotification.created_at.desc()).limit(limit).all()

        result = []
        for n in notifications:
            result.append(
                {
                    "id": n.id,
                    "admin_id": n.admin_id,
                    "title": n.title,
                    "message": n.message,
                    "type": n.type,
                    "priority": n.priority,
                    "is_read": n.is_read,
                    "extra_data": n.extra_data,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                }
            )

        return result


def create_admin_notification(title, message, notify_type="info", priority="medium", admin_id=None, extra_data=None):
    """
    创建管理员通知

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
    notifications = []

    if admin_id:
        admin = get_by_id(Admin, admin_id)
        if admin:
            notification = AdminNotification(
                admin_id=admin_id,
                title=title,
                message=message,
                type=notify_type,
                priority=priority,
                extra_data=extra_data or {},
            )
            db.session.add(notification)
            notifications.append(notification)
    else:
        admins = Admin.query.all()
        for admin in admins:
            notification = AdminNotification(
                admin_id=admin.id,
                title=title,
                message=message,
                type=notify_type,
                priority=priority,
                extra_data=extra_data or {},
            )
            db.session.add(notification)
            notifications.append(notification)

    db.session.commit()
    return notifications
