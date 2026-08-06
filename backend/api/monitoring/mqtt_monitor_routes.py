from flask import Blueprint, request
from services.mqtt_manager import mqtt_manager
from utils.response import APIResponse
from utils.structured_logger import structured_logger, LogCategory, LogLevel

"""
MQTT监控路由
提供MQTT连接状态、消息统计、队列状态的查询接口
"""
mqtt_monitor_bp = Blueprint("mqtt_monitor", __name__)


@mqtt_monitor_bp.route("/status", methods=["GET"])
def get_mqtt_status():
    """
    获取MQTT连接状态
    返回：
    - connected: 是否已连接
    - state: 连接状态（disconnected/connecting/connected/error）
    - subscribed_topics: 已订阅的主题列表
    - config: MQTT配置信息
    """
    try:
        status = mqtt_manager.get_status()
        structured_logger.api(LogLevel.INFO, "查询MQTT状态", endpoint="/api/mqtt/status", status=status["state"])
        return APIResponse.success(data=status)
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "查询MQTT状态失败", e)
        return APIResponse.error(message=str(e), status_code=500)


@mqtt_monitor_bp.route("/stats", methods=["GET"])
def get_mqtt_stats():
    """
    获取MQTT消息统计
    返回：
    - total_received: 总接收消息数
    - total_processed: 总处理消息数
    - total_dropped: 总丢弃消息数
    - queue_peak_size: 队列峰值大小
    - processing_time_avg: 平均处理时间
    - last_message_time: 最后消息时间
    """
    try:
        stats = mqtt_manager.get_message_stats()
        structured_logger.api(LogLevel.INFO, "查询MQTT统计", endpoint="/api/mqtt/stats", stats=stats)
        return APIResponse.success(data=stats)
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "查询MQTT统计失败", e)
        return APIResponse.error(message=str(e), status_code=500)


@mqtt_monitor_bp.route("/queue", methods=["GET"])
def get_mqtt_queue_status():
    """
    获取MQTT队列状态
    返回：
    - normal_queue_size: 普通队列当前大小
    - normal_queue_max: 普通队列最大容量
    - priority_queue_size: 优先级队列当前大小
    - priority_queue_max: 优先级队列最大容量
    - retry_queue_size: 重试队列当前大小
    - retry_queue_max: 重试队列最大容量
    """
    try:
        queue_status = mqtt_manager.get_queue_status()
        structured_logger.api(LogLevel.INFO, "查询MQTT队列状态", endpoint="/api/mqtt/queue", queue_status=queue_status)
        return APIResponse.success(data=queue_status)
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "查询MQTT队列状态失败", e)
        return APIResponse.error(message=str(e), status_code=500)


@mqtt_monitor_bp.route("/dashboard", methods=["GET"])
def get_mqtt_dashboard():
    """
    获取MQTT仪表盘数据（综合信息）
    返回：
    - connection: 连接状态信息
    - statistics: 消息统计信息
    - queue: 队列状态信息
    """
    try:
        connection = mqtt_manager.get_status()
        statistics = mqtt_manager.get_message_stats()
        queue = mqtt_manager.get_queue_status()
        dashboard_data = {"connection": connection, "statistics": statistics, "queue": queue}
        structured_logger.api(
            LogLevel.INFO, "查询MQTT仪表盘", endpoint="/api/mqtt/dashboard", connected=connection["connected"]
        )
        return APIResponse.success(data=dashboard_data)
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "查询MQTT仪表盘失败", e)
        return APIResponse.error(message=str(e), status_code=500)


@mqtt_monitor_bp.route("/clear-queue", methods=["POST"])
def clear_mqtt_queue():
    """
    清空MQTT队列
    需要管理员权限
    """
    try:
        # 检查管理员权限
        admin_id = request.headers.get("X-Admin-Id")
        if not admin_id:
            return APIResponse.error(message="需要管理员权限", status_code=403)
        mqtt_manager.clear_all_queues()
        structured_logger.security(LogLevel.WARNING, "清空MQTT队列", admin_id=admin_id, action="clear_queue")
        return APIResponse.success(message="队列已清空")
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "清空MQTT队列失败", e)
        return APIResponse.error(message=str(e), status_code=500)


@mqtt_monitor_bp.route("/persist", methods=["POST"])
def persist_mqtt_messages():
    """
    强制持久化所有未处理的消息
    需要管理员权限
    """
    try:
        # 检查管理员权限
        admin_id = request.headers.get("X-Admin-Id")
        if not admin_id:
            return APIResponse.error(message="需要管理员权限", status_code=403)
        mqtt_manager.force_persist_all_messages()
        structured_logger.security(LogLevel.WARNING, "强制持久化MQTT消息", admin_id=admin_id, action="persist_messages")
        return APIResponse.success(message="消息已持久化")
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "持久化MQTT消息失败", e)
        return APIResponse.error(message=str(e), status_code=500)


@mqtt_monitor_bp.route("/reconnect", methods=["POST"])
def reconnect_mqtt():
    """
    手动触发MQTT重连
    需要管理员权限
    """
    try:
        # 检查管理员权限
        admin_id = request.headers.get("X-Admin-Id")
        if not admin_id:
            return APIResponse.error(message="需要管理员权限", status_code=403)
        # 断开当前连接
        mqtt_manager.disconnect()
        # 重新连接
        success = mqtt_manager.connect()
        structured_logger.security(
            LogLevel.WARNING, "手动触发MQTT重连", admin_id=admin_id, action="reconnect", success=success
        )
        if success:
            return APIResponse.success(message="重连已触发")
        else:
            return APIResponse.error(message="重连失败", status_code=500)
    except Exception as e:
        structured_logger.log_exception(LogCategory.API, "MQTT重连失败", e)
        return APIResponse.error(message=str(e), status_code=500)


def register_mqtt_monitor_routes(app):
    """注册MQTT监控路由"""
    app.register_blueprint(mqtt_monitor_bp, url_prefix="/api/mqtt")
    print("MQTT监控路由已注册")
