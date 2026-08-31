"""管理员通知（recipient_type='admin'）写入/事务路径薄封装（F17 防腐层：从 api/system/admin_notifications_routes 收口）。

逐字节复刻原路由内联落库行为；路由保留 first_or_404 / 请求校验 / 响应构造。
create_admin_notification 被 approvals/records 懒加载及 api/system/__init__ 再导出，
路由模块保留同名委托函数以维持导入契约。
"""

from datetime import datetime

from models import db, Notification, Admin, get_by_id


def create_notification(data):
    """复刻 AdminNotificationList.post 内联建模 + add + commit（message -> content）。"""
    notification = Notification(
        recipient_type="admin",
        admin_id=data.get("admin_id"),
        title=data.get("title"),
        content=data.get("message"),
        type=data.get("type", "info"),
        priority=data.get("priority", "medium"),
        status="sent",
        extra_data=data.get("extra_data", {}),
    )
    db.session.add(notification)
    db.session.commit()
    return notification


def delete_notification(notification):
    """复刻 AdminNotificationResource.delete 内联 delete + commit。"""
    db.session.delete(notification)
    db.session.commit()


def mark_notification_read(notification):
    """复刻 AdminNotificationMarkRead.post 条件置读 + commit。"""
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now()
        db.session.commit()


def mark_all_read(admin_id=None):
    """复刻 AdminNotificationMarkAllRead.post 批量 update + commit。返回更新条数。"""
    if admin_id:
        count = Notification.query.filter_by(
            admin_id=admin_id, recipient_type="admin", is_read=False
        ).update({"is_read": True, "read_at": datetime.now()})
    else:
        count = Notification.query.filter_by(recipient_type="admin", is_read=False).update(
            {"is_read": True, "read_at": datetime.now()}
        )
    db.session.commit()
    return count


def create_admin_notification(
    title, message, notify_type="info", priority="medium", admin_id=None, extra_data=None
):
    """复刻路由模块 create_admin_notification 帮助函数（供 approvals/records 跨模块调用）。

    向指定管理员（或全部管理员）写入通知并统一提交，返回创建的通知对象列表。
    """
    notifications = []

    if admin_id:
        admin = get_by_id(Admin, admin_id)
        if admin:
            notification = Notification(
                recipient_type="admin",
                admin_id=admin_id,
                title=title,
                content=message,
                type=notify_type,
                priority=priority,
                status="sent",
                extra_data=extra_data or {},
            )
            db.session.add(notification)
            notifications.append(notification)
    else:
        admins = Admin.query.all()
        for admin in admins:
            notification = Notification(
                recipient_type="admin",
                admin_id=admin.id,
                title=title,
                content=message,
                type=notify_type,
                priority=priority,
                status="sent",
                extra_data=extra_data or {},
            )
            db.session.add(notification)
            notifications.append(notification)

    db.session.commit()
    return notifications
