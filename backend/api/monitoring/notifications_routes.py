from flask import request, g
from flask_restx import Namespace, Resource, fields
from models import Notification, User
from utils.permission import (
    requires_permission,
    has_permission,
    get_current_admin,
    get_allowed_classes,
)

from utils.response import APIResponse
from utils.pagination import get_pagination
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.notification_service import (
    create_user_notification,
    update_notification,
    delete_notification,
    mark_notification_read,
    send_notification,
    batch_send_notifications,
)

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
    @cached_api(ttl=30)
    def get(self):
        page, per_page = get_pagination(default=50)

        # F9-B: 仅列出用户通知（管理员通知已合并进本表，需按 recipient_type 区分）
        query = Notification.query.filter_by(recipient_type="user")
        # R6 修复: 非超管按班级隔离（join User 取 class_name）
        admin = get_current_admin()
        allowed = get_allowed_classes(admin.id) if admin else None
        if allowed is not None:
            query = query.join(User, Notification.student_id == User.id).filter(
                User.class_name.in_(allowed)
            )
        pagination = query.order_by(Notification.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            "notifications": [
                {
                    "id": n.id,
                    "user_id": n.student_id,
                    "student_id": n.student_id,
                    "user_name": n.user.name if n.user else None,
                    "title": n.title,
                    "content": n.content,
                    "type": n.type,
                    "status": n.status,
                    "phone": n.phone,
                    # F9-B 收尾：补齐合并后其余列出参，消除前后端字段错位
                    "recipient_type": n.recipient_type,
                    "priority": n.priority,
                    "is_read": n.is_read,
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                    "extra_data": n.extra_data,
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
        notification = create_user_notification(data)
        invalidate_cache("api:/api/notifications/*")
        return APIResponse.success(
            data={"notification_id": notification.id}, message="通知创建成功", status_code=201
        )


@ns_notifications.route("/<int:id>")
@ns_notifications.param("id", "通知ID")
class NotificationResource(Resource):

    @ns_notifications.doc("get_notification")
    @requires_permission("notification.view")
    def get(self, id):
        notification = Notification.query.filter_by(recipient_type="user", id=id).first_or_404()
        return {
            "id": notification.id,
            "user_id": notification.student_id,
            "student_id": notification.student_id,
            "user_name": notification.user.name if notification.user else None,
            "title": notification.title,
            "content": notification.content,
            "type": notification.type,
            "status": notification.status,
            "phone": notification.phone,
            "recipient_type": notification.recipient_type,
            "priority": notification.priority,
            "is_read": notification.is_read,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
            "extra_data": notification.extra_data,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
            "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
        }

    @ns_notifications.doc("update_notification")
    @ns_notifications.expect(notification_model)
    @requires_permission("notification.send")
    def put(self, id):
        notification = Notification.query.filter_by(recipient_type="user", id=id).first_or_404()
        data = ns_notifications.payload
        update_notification(notification, data)
        invalidate_cache("api:/api/notifications/*")
        return APIResponse.success(message="通知更新成功")

    @ns_notifications.doc("delete_notification")
    @requires_permission("notification.send")
    def delete(self, id):
        notification = Notification.query.filter_by(recipient_type="user", id=id).first_or_404()
        delete_notification(notification)
        invalidate_cache("api:/api/notifications/*")
        return APIResponse.success(message="通知删除成功")


@ns_notifications.route("/<int:id>/read")
@ns_notifications.param("id", "通知ID")
class NotificationMarkRead(Resource):

    @ns_notifications.doc("mark_notification_read")
    @requires_permission("notification.send")
    def post(self, id):
        notification = Notification.query.filter_by(recipient_type="user", id=id).first_or_404()
        mark_notification_read(notification)
        invalidate_cache("api:/api/notifications/*")
        return APIResponse.success(message="通知已标记为已读")


@ns_notifications.route("/send")
class NotificationSend(Resource):

    @ns_notifications.doc("send_notification")
    @requires_permission("notification.send")
    def post(self):
        data = request.get_json()
        notification = send_notification(data)
        invalidate_cache("api:/api/notifications/*")
        return APIResponse.success(
            data={"notification_id": notification.id}, message="通知发送成功"
        )


@ns_notifications.route("/batch")
class NotificationBatch(Resource):
    @ns_notifications.doc(
        "batch_send_notifications", description="群发通知（按学生列表 user_ids 或班级 class_id）"
    )
    @requires_permission("notification.send")
    def post(self):
        data = request.get_json() or {}
        title = data.get("title")
        content = data.get("content")
        notify_type = data.get("type", "info")
        user_ids = data.get("user_ids") or []
        class_id = data.get("class_id")
        force_send = bool(data.get("force_send", False))
        if not title or not content:
            return APIResponse.bad_request(message="标题和内容不能为空")
        if not user_ids and not class_id:
            return APIResponse.bad_request(message="请指定 user_ids 或 class_id")

        # 上课时间全局时段拦截（群发按广播处理）；force_send 需 notification.force_send 权限
        if force_send and not has_permission(g.current_user, "notification.force_send"):
            return APIResponse.error(
                message="无强制发送权限（需 notification.force_send）", status_code=403
            )
        from services.class_time_checker import ClassTimeChecker

        blocked, message, reason_code = ClassTimeChecker.is_broadcast_blocked(force_send=force_send)
        if blocked:
            admin_id = (
                getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
            )
            ClassTimeChecker.log_notify_audit(
                "BATCH_NOTIFY",
                class_id,
                admin_id,
                {"title": title},
                reason_code or "GLOBAL_TIME_RULE",
                message,
                force_send=False,
            )
            return APIResponse.error(
                message=f"上课时间，群发通知已暂停: {message}", status_code=403
            )

        target_ids = list(user_ids) if user_ids else []
        if class_id:
            students = User.query.filter_by(class_info_id=class_id, is_active=True).all()
            target_ids.extend([s.id for s in students])
        target_ids = [uid for uid in dict.fromkeys(target_ids) if uid]  # 去重保序
        if not target_ids:
            return APIResponse.bad_request(message="未找到接收通知的学生")

        sent, errors, total = batch_send_notifications(title, content, notify_type, target_ids)
        if not sent:
            # 全部失败：返回业务失败（success:False），避免前端误判"成功发送 0 条"
            return APIResponse.error(
                message=f"群发通知全部失败，共{len(errors)}条",
                data={"sent": 0, "errors": errors, "total": total},
                status_code=400,
            )
        invalidate_cache("api:/api/notifications/*")
        return APIResponse.success(
            data={"sent": sent, "errors": errors, "total": total},
            message=f"成功发送 {sent} 条，{len(errors)} 条失败",
        )


@ns_notifications.route("/user/<int:user_id>")
@ns_notifications.param("user_id", "用户ID")
class UserNotifications(Resource):

    @ns_notifications.doc("get_user_notifications")
    @requires_permission("system.logs")
    @cached_api(ttl=30)
    def get(self, user_id):
        page, per_page = get_pagination(default=50)

        pagination = (
            Notification.query.filter_by(student_id=user_id, recipient_type="user")
            .order_by(Notification.created_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return {
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "content": n.content,
                    "type": n.type,
                    "status": n.status,
                    "recipient_type": n.recipient_type,
                    "priority": n.priority,
                    "is_read": n.is_read,
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                    "extra_data": n.extra_data,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }
