from .notifications_routes import ns_notifications
from .alerts_routes import ns_alerts
from .operation_logs_routes import ns_operation_logs
from .mqtt_routes import ns_mqtt

"""
监控运维模块
包含通知、告警、日志、MQTT、WebSocket等路由
"""
__all__ = [
    "ns_notifications",
    "ns_alerts",
    "logs_bp",
    "ns_operation_logs",
    "ns_mqtt",
    "mqtt_monitor_bp",
    "ws_bp",
]
