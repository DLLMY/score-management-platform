#!/usr/bin/env python3
from datetime import datetime, timedelta
from celery import Celery
from services.redis_cache_service import get_cache
import os
import sys

# -*- coding: utf-8 -*-
import tempfile
import pandas as pd

"""
异步任务定义文件
包含MQTT消息处理、数据导出、通知推送等任务
"""


# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# 初始化Celery应用
app = Celery("tasks")
app.config_from_object("celery_config")

# 获取缓存实例
cache = get_cache()


@app.task(bind=True, retry_backoff=3, retry_backoff_max=30)
def process_mqtt_message(self, message_data):
    """
    处理MQTT消息
    :param message_data: MQTT消息数据字典
    """
    try:
        # 解析消息数据
        topic = message_data.get("topic", "")
        payload = message_data.get("payload", {})
        message_data.get("timestamp", datetime.now().isoformat())

        # 根据topic类型处理消息
        if topic.startswith("device/heartbeat"):
            process_heartbeat_message(payload)
        elif topic.startswith("device/alert"):
            process_alert_message(payload)
        elif topic.startswith("score/update"):
            process_score_update(payload)
        else:
            # 未知消息类型，记录到缓存
            cache.set(f"mqtt:unknown:{topic}", payload, ttl=3600)

        return {"status": "success", "processed_at": datetime.now().isoformat()}

    except Exception as e:
        # 重试任务
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"status": "failed", "error": str(e)}


def process_heartbeat_message(payload):
    """处理心跳消息"""
    device_id = payload.get("device_id")
    status = payload.get("status", "online")

    if device_id:
        # 更新设备在线状态缓存
        cache.set(
            f"device:{device_id}:status", {"status": status, "last_heartbeat": datetime.now().isoformat()}, ttl=120
        )

        # 更新在线设备计数
        update_device_count(1 if status == "online" else -1)


def process_alert_message(payload):
    """处理告警消息"""
    device_id = payload.get("device_id")
    alert_level = payload.get("level", "info")
    message = payload.get("message", "")

    if device_id:
        # 缓存告警信息
        cache.set(
            f"alert:{device_id}:latest",
            {"level": alert_level, "message": message, "created_at": datetime.now().isoformat()},
            ttl=3600,
        )


def process_score_update(payload):
    """处理积分更新消息"""
    user_id = payload.get("user_id")
    score = payload.get("score", 0)

    if user_id:
        # 更新用户积分缓存（短时间内可能多次更新，使用较短TTL）
        cache.set(f"user:{user_id}:score", score, ttl=180)


def update_device_count(delta):
    """更新在线设备计数"""
    try:
        current = cache.get("cache:stats:online_devices") or 0
        new_count = max(0, current + delta)
        cache.set("cache:stats:online_devices", new_count, ttl=60)
    except Exception:
        pass


@app.task(bind=True, retry_backoff=3)
def export_data(self, export_type, filters=None):
    """
    导出数据任务
    :param export_type: 导出类型 (excel, csv, json)
    :param filters: 过滤条件
    """
    try:

        # 模拟数据导出
        data = {
            "id": [1, 2, 3, 4, 5],
            "name": ["张三", "李四", "王五", "赵六", "钱七"],
            "score": [95, 88, 92, 85, 90],
            "created_at": [datetime.now().isoformat()] * 5,
        }

        df = pd.DataFrame(data)

        if export_type == "excel":
            temp_file = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
            df.to_excel(temp_file.name, index=False)
        elif export_type == "csv":
            temp_file = tempfile.NamedTemporaryFile(suffix=".csv", delete=False)
            df.to_csv(temp_file.name, index=False, encoding="utf-8-sig")
        else:
            temp_file = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
            df.to_json(temp_file.name, orient="records", force_ascii=False)

        # 记录导出任务状态
        cache.set(
            f"export:{self.request.id}",
            {
                "status": "completed",
                "file_path": temp_file.name,
                "record_count": len(df),
                "completed_at": datetime.now().isoformat(),
            },
            ttl=3600,
        )

        return {"status": "success", "file_path": temp_file.name}

    except Exception as e:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"status": "failed", "error": str(e)}


@app.task(bind=True, retry_backoff=3)
def send_notification(self, user_id, message, notification_type="info"):
    """
    发送通知任务
    :param user_id: 用户ID
    :param message: 通知消息
    :param notification_type: 通知类型 (info, warning, error, success)
    """
    try:
        # 记录通知到缓存
        notification_id = f"notif:{user_id}:{datetime.now().timestamp()}"
        cache.set(
            notification_id,
            {
                "user_id": user_id,
                "message": message,
                "type": notification_type,
                "created_at": datetime.now().isoformat(),
                "read": False,
            },
            ttl=86400,
        )  # 24小时

        # 更新未读通知计数
        unread_count = cache.get(f"user:{user_id}:unread_count") or 0
        cache.set(f"user:{user_id}:unread_count", unread_count + 1, ttl=86400)

        return {"status": "success", "notification_id": notification_id}

    except Exception as e:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"status": "failed", "error": str(e)}


@app.task(bind=True)
def send_email(self, to_email, subject, body):
    """
    发送邮件任务
    :param to_email: 收件人邮箱
    :param subject: 邮件主题
    :param body: 邮件内容
    """
    try:
        # 模拟邮件发送（实际应用中需要配置SMTP）
        email_log = {
            "to": to_email,
            "subject": subject,
            "body": body,
            "status": "sent",
            "sent_at": datetime.now().isoformat(),
        }

        # 记录邮件日志到缓存
        cache.set(f"email:{to_email}:{datetime.now().timestamp()}", email_log, ttl=86400)

        return {"status": "success", "message": "Email sent successfully"}

    except Exception as e:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"status": "failed", "error": str(e)}


@app.task
def cleanup_old_data(retention_days=7):
    """
    清理过期数据任务
    :param retention_days: 保留天数
    """
    try:
        # 计算过期时间
        datetime.now() - timedelta(days=retention_days)

        # 清理过期的MQTT日志缓存
        keys = cache.get_keys("mqtt:*")
        deleted_count = 0
        for key in keys:
            cache.delete(key)
            deleted_count += 1

        # 清理过期的导出文件记录
        keys = cache.get_keys("export:*")
        for key in keys:
            cache.delete(key)
            deleted_count += 1

        return {"status": "success", "deleted_count": deleted_count}

    except Exception as e:
        return {"status": "failed", "error": str(e)}


@app.task
def generate_report(report_type="daily"):
    """
    生成报告任务
    :param report_type: 报告类型 (daily, weekly, monthly)
    """
    try:
        report = {
            "type": report_type,
            "generated_at": datetime.now().isoformat(),
            "data": {
                "total_users": cache.get("cache:stats:active_users") or 0,
                "online_devices": cache.get("cache:stats:online_devices") or 0,
                "report_period": report_type,
            },
        }

        # 缓存报告
        cache.set(f"report:{report_type}:latest", report, ttl=86400)

        return {"status": "success", "report": report}

    except Exception as e:
        return {"status": "failed", "error": str(e)}


@app.task
def check_offline_devices():
    """检查离线设备任务"""
    try:
        offline_devices = []
        # 获取所有设备状态缓存
        keys = cache.get_keys("device:*:status")

        for key in keys:
            status = cache.get(key)
            if status:
                last_heartbeat = datetime.fromisoformat(status.get("last_heartbeat", ""))
                if datetime.now() - last_heartbeat > timedelta(minutes=5):
                    device_id = key.split(":")[1]
                    offline_devices.append(device_id)
                    # 发送离线告警
                    send_notification.delay(device_id, f"设备 {device_id} 离线超过5分钟", "warning")

        return {"status": "success", "offline_count": len(offline_devices), "offline_devices": offline_devices}

    except Exception as e:
        return {"status": "failed", "error": str(e)}


@app.task
def sync_cache_stats():
    """同步缓存统计数据任务"""
    try:
        stats = cache.get_stats()
        cache.set("cache:stats:cache_stats", stats, ttl=60)
        return {"status": "success", "stats": stats}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


if __name__ == "__main__":
    app.start()
