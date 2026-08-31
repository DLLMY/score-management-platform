"""积分规则分类薄服务层（F17 防腐层迁移：把路由内的 db.session 写入/事务收口到 service）。

仅迁移写入/事务路径（create/update/delete）。只读查询（GET）仍留在路由内，
按评估排期"只读 db.session.query 可暂缓"。事务边界统一在此收口；
方法返回结构保持与原路由一致（(对象, 错误串) / 错误串），便于路由原样映射为
APIResponse，不改变对外契约。
"""

from datetime import datetime

from models import db, ScoreCategory, ScoreRule


def create_category(data):
    """创建分类。重复名称返回 (None, '分类名称已存在')，否则 (category, None)。"""
    name = data.get("name")
    if ScoreCategory.query.filter_by(name=name).first():
        return None, "分类名称已存在"
    category = ScoreCategory(
        name=name,
        description=data.get("description"),
        color=data.get("color", "#3B82F6"),
        is_active=data.get("is_active", True),
    )
    db.session.add(category)
    db.session.commit()
    return category, None


def update_category(category, data):
    """更新已有分类（category 由路由经 get_or_404 取得，保留 404 语义）。

    重复名称（排除自身）返回 '分类名称已存在'，否则 None。
    """
    existing = ScoreCategory.query.filter(
        ScoreCategory.name == data.get("name"), ScoreCategory.id != category.id
    ).first()
    if existing:
        return "分类名称已存在"
    category.name = data.get("name", category.name)
    category.description = data.get("description", category.description)
    category.color = data.get("color", category.color)
    if "is_active" in data:
        category.is_active = data["is_active"]
    category.updated_at = datetime.now()
    db.session.commit()
    return None


def delete_category(category):
    """删除分类；其下仍有规则时返回 '该分类下还有{N}条规则，无法删除'，否则 None。"""
    rule_count = ScoreRule.query.filter_by(category_id=category.id).count()
    if rule_count > 0:
        return f"该分类下还有{rule_count}条规则，无法删除"
    db.session.delete(category)
    db.session.commit()
    return None
