from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Notification
from utils.permission import requires_permission
from datetime import datetime

from utils.response import APIResponse

ns_notifications = Namespace("notifications", description="通知相关操作")

notification_model = ns_notifications.model(
    "Notification",
    {
        "id": fields.Integer(readOnly=True, description="通知ID"),
        "user_id": fields.Integer(description="用户ID"),
        "title": fields.String(description="标题"),
        "content": fields.String(description="内容"),
        "type": fields.String(description="类型"),
        "status": fields.String(readOnly=True, description="状态"),
        "phone": fields.String(description="联系电话"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
    },
)


@ns_notifications.route("/")
class NotificationList(Resource):

    @ns_notifications.doc("list_notifications")
    @requires_permission("notification.view")
    def get(self):
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        pagination = Notification.query.order_by(Notification.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            "notifications": [
                {
                    "id": n.id,
                    "user_id": n.user_id,
                    "user_name": n.user.name if n.user else None,
                    "title": n.title,
                    "content": n.content,
                    "type": n.type,
                    "status": n.status,
                    "phone": n.phone,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "sent_at": n.sent_at.isoformat() if n.sent_at else None,
                }
                for n in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }

    @ns_notifications.doc("create_notification")
    @ns_notifications.expect(notification_model)
    @requires_permission("notification.send")
    def post(self):
        data = ns_notifications.payload
        notification = Notification(
            user_id=data.get("user_id"),
            title=data.get("title"),
            content=data.get("content"),
            type=data.get("type", "info"),
            phone=data.get("phone"),
        )
        db.session.add(notification)
        db.session.commit()
        return APIResponse.success(data={"notification_id": notification.id}, message="通知创建成功", status_code=201)


@ns_notifications.route("/<int:id>")
@ns_notifications.param("id", "通知ID")
class NotificationResource(Resource):

    @ns_notifications.doc("get_notification")
    @requires_permission("notification.view")
    def get(self, id):
        notification = Notification.query.get_or_404(id)
        return {
            "id": notification.id,
            "user_id": notification.user_id,
            "user_name": notification.user.name if notification.user else None,
            "title": notification.title,
            "content": notification.content,
            "type": notification.type,
            "status": notification.status,
            "phone": notification.phone,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
            "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
        }

    @ns_notifications.doc("update_notification")
    @ns_notifications.expect(notification_model)
    @requires_permission("notification.send")
    def put(self, id):
        notification = Notification.query.get_or_404(id)
        data = ns_notifications.payload
        notification.title = data.get("title", notification.title)
        notification.content = data.get("content", notification.content)
        notification.type = data.get("type", notification.type)
        notification.status = data.get("status", notification.status)
        if notification.status == "sent" and not notification.sent_at:
            notification.sent_at = datetime.now()
        db.session.commit()
        return APIResponse.success(message="通知更新成功")

    @ns_notifications.doc("delete_notification")
    @requires_permission("notification.send")
    def delete(self, id):
        notification = Notification.query.get_or_404(id)
        db.session.delete(notification)
        db.session.commit()
        return APIResponse.success(message="通知删除成功")


@ns_notifications.route("/<int:id>/read")
@ns_notifications.param("id", "通知ID")
class NotificationMarkRead(Resource):

    @ns_notifications.doc("mark_notification_read")
    @requires_permission("notification.send")
    def post(self, id):
        notification = Notification.query.get_or_404(id)
        notification.status = "read"
        db.session.commit()
        return APIResponse.success(message="通知已标记为已读")


@ns_notifications.route("/send")
class NotificationSend(Resource):

    @ns_notifications.doc("send_notification")
    @requires_permission("notification.send")
    def post(self):
        data = request.get_json()
        user_id = data.get("user_id")
        title = data.get("title")
        content = data.get("content")
        notification_type = data.get("type", "info")
        phone = data.get("phone")

        notification = Notification(
            user_id=user_id,
            title=title,
            content=content,
            type=notification_type,
            status="sent",
            phone=phone,
            sent_at=datetime.now(),
        )
        db.session.add(notification)
        db.session.commit()

        return APIResponse.success(data={"notification_id": notification.id}, message="通知发送成功")


@ns_notifications.route("/user/<int:user_id>")
@ns_notifications.param("user_id", "用户ID")
class UserNotifications(Resource):

    @ns_notifications.doc("get_user_notifications")
    @requires_permission("system.logs")
    def get(self, user_id):
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        pagination = (
            Notification.query.filter_by(user_id=user_id)
            .order_by(Notification.created_at.desc())
            .order_by(Notification.created_at.desc())
        )

        return {
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "content": n.content,
                    "type": n.type,
                    "status": n.status,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }
