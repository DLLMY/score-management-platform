from .system_routes import ns_system
from .admins_routes import ns_admins
from .security_routes import ns_security
from .notification_config_routes import ns_notification_config
from .admin_notifications_routes import ns_admin_notifications, create_admin_notification

"""
系统管理模块
包含系统配置、管理员、安全设置、版本管理等路由
"""
__all__ = [
    "ns_system",
    "ns_admins",
    "ns_security",
    "ns_notification_config",
    "ns_admin_notifications",
    "create_admin_notification",
]
