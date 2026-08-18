"""定时通知写入/事务路径薄封装（F17 防腐层：从 scores/scheduled_notify_routes 收口）。

逐字节复刻原路由内联落库行为，供路由调用；路由保留 get_or_404 / 请求校验 /
跨切面副作用（publish_mqtt、ClassTimeChecker 上课时间拦截）/ 响应构造。
只读 query（列表、详情序列化）与后台任务 process_scheduled_notifications 的读取循环、
MQTT 下发循环、最终批量 commit 仍留在路由/任务层。
"""

import json
from datetime import datetime, timedelta

from models import db, ScheduledNotify, NotifyHistory
from utils.logger import log_operation


def calculate_next_send(notify):
    """计算下次发送时间（与原路由 _calculate_next_send 逐字节一致）。"""
    now = datetime.now()
    if notify.repeat_type == "daily":
        next_time = notify.scheduled_at + timedelta(days=notify.repeat_interval)
    elif notify.repeat_type == "weekly":
        if notify.repeat_day_of_week:
            try:
                day_of_week_list = json.loads(notify.repeat_day_of_week)
            except Exception:
                day_of_week_list = []
            if day_of_week_list:
                current_weekday = now.weekday()
                hours = notify.scheduled_at.hour
                minutes = notify.scheduled_at.minute
                days_ahead = []
                for day in day_of_week_list:
                    if day > current_weekday:
                        days_ahead.append(day - current_weekday)
                    else:
                        days_ahead.append(day - current_weekday + 7)
                days_ahead = sorted(days_ahead)
                next_day_offset = days_ahead[0]
                next_time = now.replace(
                    hour=hours, minute=minutes, second=0, microsecond=0
                ) + timedelta(days=next_day_offset)
            else:
                next_time = notify.scheduled_at + timedelta(weeks=notify.repeat_interval)
        else:
            next_time = notify.scheduled_at + timedelta(weeks=notify.repeat_interval)
    elif notify.repeat_type == "monthly":
        next_time = notify.scheduled_at + timedelta(days=30 * notify.repeat_interval)
    else:
        return None
    if notify.repeat_end_at and next_time > notify.repeat_end_at:
        return None
    return next_time


def _build_history(notify, topics):
    return NotifyHistory(
        text=notify.text,
        volume=notify.volume,
        speak=notify.speak,
        popup=notify.popup,
        timeout_sec=notify.timeout_sec,
        urgent=notify.urgent,
        send_mode=notify.send_mode,
        device_id=notify.device_id,
        topic=",".join(topics),
        status="sent",
        sent_by=1,
    )


def create_scheduled_notify(data, admin_id=None):
    """创建定时通知并审计（复刻 ScheduledList.post 内联建模 + log_operation）。"""
    scheduled_at = datetime.fromisoformat(data.get("scheduled_at"))
    notify = ScheduledNotify(
        text=data.get("text"),
        volume=data.get("volume", 0.7),
        speak=data.get("speak", True),
        popup=data.get("popup", True),
        timeout_sec=data.get("timeout_sec", 8),
        urgent=data.get("urgent", False),
        send_mode=data.get("send_mode", "broadcast"),
        device_id=data.get("device_id"),
        scheduled_at=scheduled_at,
        repeat_type=data.get("repeat_type", "once"),
        repeat_interval=data.get("repeat_interval", 1),
        repeat_day_of_week=(
            json.dumps(data.get("repeat_day_of_week", []))
            if data.get("repeat_day_of_week")
            else None
        ),
        repeat_end_at=(
            datetime.fromisoformat(data.get("repeat_end_at")) if data.get("repeat_end_at") else None
        ),
        next_send_at=scheduled_at,
        status="pending",
        created_by=admin_id or 1,
    )
    db.session.add(notify)
    db.session.commit()
    log_operation(
        "scheduled_notify.create",
        "scheduled_notify",
        notify.id,
        f"创建定时通知: {notify.text[:30]}",
        after_data=data,
    )
    return notify


def update_scheduled_notify(notify, data):
    """更新定时通知（复刻 ScheduledDetail.put 内联字段赋值）。"""
    notify.text = data.get("text", notify.text)
    notify.volume = data.get("volume", notify.volume)
    notify.speak = data.get("speak", notify.speak)
    notify.popup = data.get("popup", notify.popup)
    notify.timeout_sec = data.get("timeout_sec", notify.timeout_sec)
    notify.urgent = data.get("urgent", notify.urgent)
    notify.send_mode = data.get("send_mode", notify.send_mode)
    notify.device_id = data.get("device_id", notify.device_id)
    notify.scheduled_at = (
        datetime.fromisoformat(data.get("scheduled_at"))
        if data.get("scheduled_at")
        else notify.scheduled_at
    )
    notify.repeat_type = data.get("repeat_type", notify.repeat_type)
    notify.repeat_interval = data.get("repeat_interval", notify.repeat_interval)
    notify.repeat_end_at = (
        datetime.fromisoformat(data.get("repeat_end_at"))
        if data.get("repeat_end_at")
        else notify.repeat_end_at
    )
    notify.next_send_at = notify.scheduled_at
    notify.status = "pending"
    notify.updated_at = datetime.now()
    db.session.commit()
    return notify


def delete_scheduled_notify(notify):
    """硬删除定时通知（复刻 ScheduledDetail.delete）。"""
    db.session.delete(notify)
    db.session.commit()


def cancel_scheduled_notify(notify):
    """取消定时通知（复刻 ScheduledCancel.post）。"""
    notify.status = "cancelled"
    db.session.commit()


def record_scheduled_notify_sent(notify, topics):
    """trigger 端点 MQTT 发送成功后落库（复刻 ScheduledTrigger 成功分支；自带提交与回滚）。"""
    try:
        notify.last_sent_at = datetime.now()
        if notify.repeat_type == "once":
            notify.status = "sent"
        else:
            notify.next_send_at = calculate_next_send(notify)
        history = _build_history(notify, topics)
        db.session.add(history)
        db.session.commit()
        return notify, history
    except Exception:
        db.session.rollback()
        raise


def record_scheduled_history(notify, topics):
    """后台任务 process_scheduled_notifications 的单条落库（不提交，由任务最终统一 commit）。"""
    notify.last_sent_at = datetime.now()
    if notify.repeat_type == "once":
        notify.status = "sent"
    else:
        next_time = calculate_next_send(notify)
        if next_time:
            notify.next_send_at = next_time
        else:
            notify.status = "sent"
    history = _build_history(notify, topics)
    db.session.add(history)
    return notify, history
