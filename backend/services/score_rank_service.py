"""排名规则（score-rank-rules）写入逻辑服务层。

F17 防腐层：仅收口原 rank_routes.py 中的 db.session 写入/事务路径，
读取/缓存/响应序列化仍留在路由层，行为与原实现逐字节一致。
"""

from datetime import datetime

from models import db, ScoreRankRule


def create_rank_rule(data):
    """创建排名规则，返回新建的 ScoreRankRule 实例。"""
    rule = ScoreRankRule(
        name=data.get("name"),
        min_score=data.get("min_score"),
        max_score=data.get("max_score"),
        color=data.get("color", "#0ea5e9"),
        icon=data.get("icon", "Award"),
        description=data.get("description"),
        is_active=data.get("is_active", True),
        unlock_min_score=data.get("unlock_min_score"),
        weekly_unlock_limit=data.get("weekly_unlock_limit"),
    )
    db.session.add(rule)
    db.session.commit()
    return rule


def update_rank_rule(rule, data):
    """更新给定排名规则实例的字段并提交。"""
    rule.name = data.get("name", rule.name)
    rule.min_score = data.get("min_score", rule.min_score)
    rule.max_score = data.get("max_score", rule.max_score)
    rule.color = data.get("color", rule.color)
    rule.icon = data.get("icon", rule.icon)
    rule.description = data.get("description", rule.description)
    rule.is_active = data.get("is_active", rule.is_active)
    if "unlock_min_score" in data:
        rule.unlock_min_score = data["unlock_min_score"]
    if "weekly_unlock_limit" in data:
        rule.weekly_unlock_limit = data["weekly_unlock_limit"]
    rule.updated_at = datetime.now()
    db.session.commit()
    return rule


def delete_rank_rule(rule):
    """删除给定排名规则实例。"""
    db.session.delete(rule)
    db.session.commit()
