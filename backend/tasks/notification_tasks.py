from celery_app import celery_app
import json
import time
from utils.logger import log_info, log_warning, log_debug


@celery_app.task(
    bind=True, name="tasks.notification_tasks.send_remote_notify", queue="notification"
)
def send_remote_notify(self, device_id, message, urgent=False):
    """
    发送远程通知
    Args:
        device_id: 目标设备ID
        message: 通知消息内容
        urgent: 是否紧急通知

    Returns:
        dict: 发送结果（success 为发布结果）
    """
    try:
        from services.mqtt_service import publish_mqtt

        notify_data = {
            "type": "remote_notify",
            "device_id": device_id,
            "message": message,
            "urgent": urgent,
            "timestamp": time.time(),
        }
        topic = f"phonebox/notify/{device_id}" if device_id else "phonebox/notify/broadcast"
        success = publish_mqtt(topic, json.dumps(notify_data, ensure_ascii=False), qos=1)
        log_info(f"[Notification Task] 已发布通知到 {topic} (success={success})")
        return {"success": success, "device_id": device_id, "message": message, "topic": topic}
    except Exception as e:
        self.retry(exc=e, countdown=3, max_retries=3)
        return {"success": False, "error": str(e)}


@celery_app.task(bind=True, name="tasks.notification_tasks.broadcast_notify", queue="notification")
def broadcast_notify(self, message, device_ids=None, urgent=False):
    """
    广播通知到多个设备
    Args:
        message: 通知消息内容
        device_ids: 设备ID列表（可选），为空则广播到所有设备
        urgent: 是否紧急通知

    Returns:
        dict: 发送结果（device_count 为成功数量或 "all"）
    """
    try:
        from services.mqtt_service import publish_mqtt

        if device_ids:
            count = 0
            total = len(device_ids)
            for device_id in device_ids:
                notify_data = {
                    "type": "remote_notify",
                    "device_id": device_id,
                    "message": message,
                    "urgent": urgent,
                    "timestamp": time.time(),
                }
                ok = publish_mqtt(
                    f"phonebox/notify/{device_id}",
                    json.dumps(notify_data, ensure_ascii=False),
                    qos=1,
                )
                if ok:
                    count += 1
            log_info(f"[Notification Task] 定向广播通知完成: {count}/{total} 台设备")
            return {"success": count > 0, "message": message, "device_count": count, "total": total}
        else:
            notify_data = {
                "type": "broadcast_notify",
                "message": message,
                "urgent": urgent,
                "timestamp": time.time(),
            }
            topic = "phonebox/notify/broadcast"
            ok = publish_mqtt(topic, json.dumps(notify_data, ensure_ascii=False), qos=1)
            log_info(f"[Notification Task] 已发布广播通知到 {topic} (success={ok})")
            return {"success": ok, "message": message, "device_count": "all", "topic": topic}
    except Exception as e:
        self.retry(exc=e, countdown=3, max_retries=3)
        return {"success": False, "error": str(e)}
