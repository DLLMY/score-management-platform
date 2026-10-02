from .admin_notifications_routes import (
    create_admin_notification,
    ns_admin_notifications,
)
from .admins_routes import ns_admins
from .notification_config_routes import ns_notification_config
from .security_routes import ns_security
from .system_routes import ns_system

"""
系统管理模块
包含系统配置、管理员、安全设置、版本管理等路由
"""
__all__ = [
    "create_admin_notification",
    "ns_admin_notifications",
    "ns_admins",
    "ns_notification_config",
    "ns_security",
    "ns_system",
]
