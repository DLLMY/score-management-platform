from .alerts_routes import ns_alerts
from .mqtt_routes import ns_mqtt
from .notifications_routes import ns_notifications
from .operation_logs_routes import ns_operation_logs

"""
监控运维模块
包含通知、告警、日志、MQTT、WebSocket等路由
"""
__all__ = [
    "ns_alerts",
    "ns_mqtt",
    "ns_notifications",
    "ns_operation_logs",
]
