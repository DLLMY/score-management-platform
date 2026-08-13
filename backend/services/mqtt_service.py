from services.mqtt_manager import MQTTManager
import json
from datetime import datetime
import threading

# 使用TCP实例作为默认连接（优先使用更稳定的TCP连接）
mqtt_manager = MQTTManager("tcp")
mqtt_client = mqtt_manager
mqtt_logs = []


# 动态属性访问
def __getattr__(name):
    if name == "mqtt_connected":
        return mqtt_manager.is_connected
    if name == "subscribed_topics":
        return mqtt_manager.subscribed_topics
    raise AttributeError(f"module {__name__} has no attribute {name}")


DEFAULT_CONFIG = mqtt_manager.DEFAULT_CONFIG


def log_mqtt_message_async(client, topic, data, qos=1):
    """异步记录MQTT发送消息日志（不阻塞主流程）"""

    def log_task():
        try:
            from app import app
            from models import db, MQTTLog

            with app.app_context():
                log = MQTTLog(
                    topic=topic,
                    message=json.dumps(data) if isinstance(data, dict) else str(data),
                    direction="send",
                    timestamp=datetime.now(),
                )
                db.session.add(log)
                db.session.commit()

            mqtt_logs.append(
                {
                    "topic": topic,
                    "message": json.dumps(data) if isinstance(data, dict) else str(data),
                    "direction": "send",
                    "qos": qos,
                    "timestamp": datetime.now().isoformat(),
                }
            )
        except Exception as e:
            print(f"记录MQTT消息失败: {e}")
            try:
                db.session.rollback()  # 防 add/commit 失败遗留 pending 对象
            except Exception:
                pass

    # 启动后台线程执行日志记录，不阻塞主流程
    thread = threading.Thread(target=log_task, daemon=True)
    thread.start()


def log_operation_detail(operation_type, details, success=True):
    """记录操作详情日志"""
    try:
        from app import app
        from models import db, OperationLog

        with app.app_context():
            log = OperationLog(
                operation_type=f"mqtt_{operation_type}",
                target_type="mqtt",
                description=details.get("message", ""),
                before_data=json.dumps(details.get("before", {})),
                after_data=json.dumps(details.get("after", {})),
                operator=details.get("operator", "MQTT系统"),
            )
            db.session.add(log)
            db.session.commit()
    except Exception as e:
        print(f"记录操作日志失败: {e}")
        try:
            db.session.rollback()  # 防 add/commit 失败遗留 pending 对象
        except Exception:
            pass


def get_mqtt_config_from_db():
    """从数据库获取MQTT配置"""
    return mqtt_manager.load_config_from_db()


def connect_mqtt(config=None):
    """连接MQTT"""
    if config:
        mqtt_manager.set_config(config)
    return mqtt_manager.connect()


def reconnect_mqtt():
    """重新连接MQTT"""
    return mqtt_manager.connect()


def publish_mqtt(topic, payload, qos=0):
    """发布MQTT消息 - 使用QoS 0以匹配设备端订阅配置（优化版）"""
    if isinstance(payload, dict):
        payload = json.dumps(payload)

    # 直接发布，不等待日志记录
    result = mqtt_manager.publish(topic, payload, qos)

    if result:
        # 异步记录日志，不阻塞发布流程
        log_mqtt_message_async(None, topic, payload, qos)

    return result


def clear_mqtt_logs():
    """清理内存中的MQTT日志"""
    global mqtt_logs
    mqtt_logs = []


def get_mqtt_status():
    """获取MQTT状态"""
    return mqtt_manager.get_status()


OTA_TOPIC = "phonebox/ota"
OTA_STATUS_TOPIC = "phonebox/ota/status"


def publish_ota_command(device_id, payload):
    """发布OTA固件升级指令

    Args:
        device_id: 目标设备ID（可选，用于定向升级）
        payload: OTA指令内容，包含:
            - url: 固件下载URL
            - version: 目标版本
            - md5: MD5校验值（可选）
            - force: 是否强制升级（可选）

    Returns:
        bool: 发布是否成功
    """
    import time

    if device_id:
        topic = f"phonebox/ota/{device_id}"
    else:
        topic = OTA_TOPIC

    ota_payload = {"action": "update", "timestamp": int(time.time())}
    ota_payload.update(payload)

    print(f"[OTA] 发送OTA指令到 {topic}: {json.dumps(ota_payload)}")
    return publish_mqtt(topic, json.dumps(ota_payload), qos=1)


def get_ota_status(device_id=None):
    """获取OTA升级状态

    Args:
        device_id: 设备ID（可选）

    Returns:
        dict: OTA状态信息
    """
    try:
        from app import app
        from models import DeviceFirmwareUpdate

        with app.app_context():
            query = DeviceFirmwareUpdate.query

            if device_id:
                query = query.filter_by(device_id=device_id)

            records = query.order_by(DeviceFirmwareUpdate.created_at.desc()).limit(10).all()

            return {
                "records": [
                    {
                        "id": r.id,
                        "device_id": r.device_id,
                        "device_name": r.device_name,
                        "from_version": r.from_version,
                        "to_version": r.to_version,
                        "status": r.status,
                        "started_at": r.started_at.isoformat() if r.started_at else None,
                        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                        "error_message": r.error_message,
                    }
                    for r in records
                ]
            }
    except Exception as e:
        print(f"[OTA] 获取OTA状态失败: {e}")
        return {"records": []}
