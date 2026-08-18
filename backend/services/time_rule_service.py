"""时间规则（time-rules）写入逻辑服务层。

F17 防腐层：仅收口原 time_rules_routes.py 中的 db.session 写入/事务路径，
读取/格式化/响应序列化仍留在路由层，行为与原实现逐字节一致。
"""

from datetime import datetime

from models import db, TimeRule


def create_time_rule(data):
    """创建时间规则，返回新建的 TimeRule 实例。"""
    rule = TimeRule(
        name=data.get("name"),
        description=data.get("description"),
        day_of_week=data.get("day_of_week", -1),
        start_hour=data.get("start_hour"),
        start_minute=data.get("start_minute"),
        end_hour=data.get("end_hour"),
        end_minute=data.get("end_minute"),
        is_active=data.get("is_active", True),
        allow_unlock=data.get("allow_unlock", False),
    )
    db.session.add(rule)
    db.session.commit()
    return rule


def update_time_rule(rule, data):
    """更新给定时间规则实例的字段并提交。"""
    rule.name = data.get("name", rule.name)
    rule.description = data.get("description", rule.description)
    rule.day_of_week = data.get("day_of_week", rule.day_of_week)
    rule.start_hour = data.get("start_hour", rule.start_hour)
    rule.start_minute = data.get("start_minute", rule.start_minute)
    rule.end_hour = data.get("end_hour", rule.end_hour)
    rule.end_minute = data.get("end_minute", rule.end_minute)
    rule.is_active = data.get("is_active", rule.is_active)
    rule.allow_unlock = data.get("allow_unlock", rule.allow_unlock)
    rule.updated_at = datetime.now()
    db.session.commit()
    return rule


def delete_time_rule(rule):
    """删除给定时间规则实例。"""
    db.session.delete(rule)
    db.session.commit()
