"""通知模板写入/事务路径的薄封装（F17 防腐层）。

仅承载 routes 中内联的 db.session 写入逻辑，逐字节复刻原响应体/状态码所依赖的落库行为；
跨切面副作用（MQTT 下发、上课时间拦截、审计日志、管理员通知、响应构造）仍留在路由层。
"""

import json
from datetime import datetime

from models import db, NotifyTemplate, NotifyHistory
from utils.logger import log_operation


def create_template(data, admin_id=None):
    """创建通知模板并写操作审计。返回持久化后的 NotifyTemplate 实例。"""
    tags_val = data.get("tags", [])
    if isinstance(tags_val, list):
        tags_val = json.dumps(tags_val, ensure_ascii=False)
    template = NotifyTemplate(
        name=data.get("name"),
        text=data.get("text"),
        volume=data.get("volume", 0.7),
        speak=data.get("speak", True),
        popup=data.get("popup", True),
        timeout_sec=data.get("timeout_sec", 8),
        urgent=data.get("urgent", False),
        bg_color=data.get("bg_color", "#000000"),
        text_color=data.get("text_color", "#FF0000"),
        font_size=data.get("font_size", 48),
        language=data.get("language", "zh"),
        category=data.get("category"),
        tags=tags_val,
        created_by=admin_id or 1,
    )
    db.session.add(template)
    db.session.commit()
    log_operation(
        "notify_template.create",
        "notify_template",
        template.id,
        f"创建通知模板: {template.name}",
        after_data=data,
    )
    return template


def update_template(template, data):
    """按 payload 更新模板字段并落库。返回更新后的实例。"""
    template.name = data.get("name", template.name)
    template.text = data.get("text", template.text)
    template.volume = data.get("volume", template.volume)
    template.speak = data.get("speak", template.speak)
    template.popup = data.get("popup", template.popup)
    template.timeout_sec = data.get("timeout_sec", template.timeout_sec)
    template.urgent = data.get("urgent", template.urgent)
    template.bg_color = data.get("bg_color", template.bg_color)
    template.text_color = data.get("text_color", template.text_color)
    template.font_size = data.get("font_size", template.font_size)
    template.language = data.get("language", template.language)
    template.category = data.get("category", template.category)
    if "tags" in data:
        tags_val = data.get("tags")
        if isinstance(tags_val, list):
            tags_val = json.dumps(tags_val, ensure_ascii=False)
        template.tags = tags_val
    template.updated_at = datetime.now()
    db.session.commit()
    return template


def delete_template(template):
    """软删除模板（is_active=False）并落库。返回实例。"""
    template.is_active = False
    template.updated_at = datetime.now()
    db.session.commit()
    return template


def record_template_usage(template, send_mode, device_id, topics):
    """use 端点落库：递增 usage_count 并写入 NotifyHistory 记录。"""
    template.usage_count += 1
    template.updated_at = datetime.now()
    history = NotifyHistory(
        text=template.text,
        volume=template.volume,
        speak=template.speak,
        popup=template.popup,
        timeout_sec=template.timeout_sec,
        urgent=template.urgent,
        send_mode=send_mode,
        device_id=device_id,
        topic=",".join(topics),
        template_id=template.id,
        status="sent",
        sent_by=1,
    )
    try:
        db.session.add(history)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return history
