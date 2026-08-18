"""数据导入（Excel/CSV）单行建模 + add 薄封装（F17 防腐层：从 api/data/import_export_routes 收口）。

逐字节复刻原路由行级建模（add 不提交）；提交/回滚事务边界保留在路由
（与 scheduled_notify 后台任务 commit 边界、import 回滚兜底先例一致）：
- ImportUsers._do_import_users：retry.execute(db.session.commit) / rollback / except rollback
- ImportRules / ImportCategories：db.session.commit() / except rollback
"""

from models import db, User, ScoreRule, ScoreCategory


def create_user_row(name, gender, class_name, phone, card_id):
    """复刻 ImportUsers 行级 User 建模 + add（不提交，由路由统一提交/回滚）。"""
    new_user = User(
        name=name,
        gender=gender,
        class_name=class_name,
        phone=phone,
        card_id=card_id,
        current_score=0,
    )
    db.session.add(new_user)
    return new_user


def create_score_rule_row(
    name, description, category_id, score, is_active, daily_limit, min_interval
):
    """复刻 ImportRules 行级 ScoreRule 建模 + add（不提交）。"""
    new_rule = ScoreRule(
        name=name,
        description=description,
        category_id=category_id,
        score=score,
        is_active=is_active,
        daily_limit=daily_limit,
        min_interval=min_interval,
    )
    db.session.add(new_rule)
    return new_rule


def create_score_category_row(name, description, color):
    """复刻 ImportCategories 行级 ScoreCategory 建模 + add（不提交）。"""
    new_category = ScoreCategory(name=name, description=description, color=color)
    db.session.add(new_category)
    return new_category
