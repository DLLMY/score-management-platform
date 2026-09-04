from celery_app import celery_app
import json
from datetime import datetime
from utils.logger import log_info, log_warning, log_debug


@celery_app.task(bind=True, name="tasks.mqtt_tasks.process_message", queue="mqtt")
def process_message(self, topic, payload):
    """
    异步处理MQTT消息
    Args:
        topic: MQTT主题
        payload: 消息负载（JSON字符串）
    """
    try:
        # 解析消息负载
        data = json.loads(payload) if isinstance(payload, str) else payload
        # 在 Flask 应用上下文中执行：db_session_scope / db.session 依赖 current_app，
        # celery worker 无上下文，必须显式包一层，否则任何 DB 访问都会 500。
        from app import app as flask_app

        with flask_app.app_context():
            # 根据主题路由处理
            if topic.startswith("device/"):
                handle_device_message(topic, data)
            elif topic.startswith("score/"):
                handle_score_message(topic, data)
            elif topic.startswith("command/"):
                handle_command_message(topic, data)
        return {"success": True, "topic": topic}
    except Exception as e:
        # 重试机制
        self.retry(exc=e, countdown=2, max_retries=3)
        return {"success": False, "error": str(e)}


def handle_device_message(topic, data):
    """处理设备消息：复用 mqtt_message_service 的心跳处理逻辑（更新 Device 状态 + 写 DeviceHeartbeat）。

    说明：真正的设备消息处理在同步路径 services/mqtt_message_service.handle_mqtt_message
    （处理 phonebox/heartbeat 等主题）已实现。此处作为异步兜底，把 device/* 主题
    归一化到同一套业务逻辑，避免两处实现漂移。
    """
    from services.mqtt_message_service import mqtt_message_service

    sub_topic = topic.split("/", 1)[1] if "/" in topic else ""
    # device/heartbeat 或携带设备状态的消息 → 走心跳落库；其余仅记录
    if sub_topic in ("heartbeat", "status") or ("status" in data or "device_id" in data):
        mqtt_message_service.handle_heartbeat_message(data)
    else:
        log_debug(f"[MQTT Task] 设备消息(未匹配处理): {topic} -> {data}")


def handle_score_message(topic, data):
    """处理积分消息：复用 mqtt_message_service 的积分业务（幂等 + 限流 + 审批），
    与同步路径 score/add、score/undo、phonebox/points/query 保持一致。
    """
    from services.mqtt_message_service import mqtt_message_service

    sub_topic = topic.split("/", 1)[1] if "/" in topic else ""
    if sub_topic in ("add",) or data.get("score_change") is not None:
        mqtt_message_service.handle_score_add(data)
    elif sub_topic == "undo":
        mqtt_message_service.handle_score_undo(data)
    elif sub_topic in ("query", "points/query"):
        mqtt_message_service.handle_points_query(data)
    else:
        log_debug(f"[MQTT Task] 积分消息(未匹配处理): {topic} -> {data}")


@celery_app.task(bind=True, name="tasks.mqtt_tasks.process_phonebox_telemetry", queue="mqtt")
def process_phonebox_telemetry(self, topic, payload):
    """异步处理 phonebox/# 遥测消息：写 MQTTLog 接收日志（审计）+ 处理心跳落库。

    由 MQTTManager 遥测连接（独立 phonebox/# 订阅）异步派发，确保高频遥测洪流
    不阻塞控制连接（score/# 等）。心跳的 WebSocket 实时推送由后端线程同步完成，
    此处仅负责 DB 落库，与同步路径 services/mqtt_message_service.handle_heartbeat_message 一致。
    """
    try:
        from app import app as flask_app
        from models import db, MQTTLog
        from services.mqtt_message_service import mqtt_message_service

        with flask_app.app_context():
            try:
                db.session.add(
                    MQTTLog(
                        topic=topic, message=payload, direction="receive", timestamp=datetime.now()
                    )
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
            try:
                data = json.loads(payload) if isinstance(payload, str) else payload
            except Exception:
                data = None
            if topic == "phonebox/heartbeat" and isinstance(data, dict):
                try:
                    mqtt_message_service.handle_heartbeat_message(data)
                except Exception as e:
                    log_warning(f"[MQTT Task] 心跳处理失败: {e}", exception=e)
        return {"success": True, "topic": topic}
    except Exception as e:
        log_warning(f"[MQTT Task] 遥测处理异常: {e}", exception=e)
        self.retry(exc=e, countdown=2, max_retries=3)
        return {"success": False, "error": str(e)}


def handle_command_message(topic, data):
    """处理命令消息：写入命令日志并发布回执确认（{topic}/ack），设备端据此确认指令已送达。"""
    from datetime import datetime
    from models import db, MQTTLog
    from services.mqtt_service import publish_mqtt

    try:
        log = MQTTLog(
            topic=topic,
            message=json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data),
            direction="receive",
            timestamp=datetime.now(),
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        log_warning(f"[MQTT Task] 命令日志记录失败: {e}", exception=e)
        db.session.rollback()

    try:
        ack = {
            "type": "command_ack",
            "command_id": data.get("command_id") if isinstance(data, dict) else None,
            "action": data.get("action") if isinstance(data, dict) else None,
            "status": "received",
            "timestamp": datetime.now().isoformat(),
        }
        publish_mqtt(f"{topic}/ack", json.dumps(ack, ensure_ascii=False), qos=1)
    except Exception as e:
        log_warning(f"[MQTT Task] 命令回执发布失败: {e}", exception=e)
