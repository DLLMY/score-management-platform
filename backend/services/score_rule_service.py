from utils.db_session import db_session_scope, db_readonly_scope
from models import ScoreRule, get_by_id


class ScoreRuleService:

    @staticmethod
    def get_rules(page=1, per_page=100, category_id=None, is_active=None):
        with db_readonly_scope() as session:
            query = session.query(ScoreRule)
            if category_id:
                query = query.filter(ScoreRule.category_id == category_id)
            if is_active is not None:
                query = query.filter(ScoreRule.is_active == is_active)

            pagination = query.order_by(ScoreRule.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            rules = []
            for r in pagination.items:
                rules.append(
                    {
                        "id": r.id,
                        "name": r.name,
                        "description": r.description,
                        "category_id": r.category_id,
                        "category_name": (r.category.name if r.category else None),
                        "score": r.score,
                        "is_active": r.is_active,
                        "daily_limit": r.daily_limit,
                        "min_interval": r.min_interval,
                        "created_at": (r.created_at.isoformat() if r.created_at else None),
                        "updated_at": (r.updated_at.isoformat() if r.updated_at else None),
                    }
                )

            return {
                "rules": rules,
                "total": pagination.total,
                "page": pagination.page,
                "per_page": pagination.per_page,
                "pages": pagination.pages,
            }

    @staticmethod
    def get_rule(rule_id):
        with db_readonly_scope() as session:
            rule = get_by_id(session, ScoreRule, rule_id)
            if not rule:
                return None

            return {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "category_id": rule.category_id,
                "category_name": rule.category.name if rule.category else None,
                "score": rule.score,
                "is_active": rule.is_active,
                "daily_limit": rule.daily_limit,
                "min_interval": rule.min_interval,
                "created_at": (rule.created_at.isoformat() if rule.created_at else None),
                "updated_at": (rule.updated_at.isoformat() if rule.updated_at else None),
            }

    @staticmethod
    def create_rule(data):
        with db_session_scope() as session:
            rule = ScoreRule(
                name=data["name"],
                description=data.get("description", ""),
                category_id=data.get("category_id"),
                score=data["score"],
                is_active=data.get("is_active", True),
                daily_limit=data.get("daily_limit", 0),
                min_interval=data.get("min_interval", 0),
            )
            session.add(rule)
            session.commit()

            return ScoreRuleService.get_rule(rule.id)

    @staticmethod
    def update_rule(rule_id, data):
        with db_session_scope() as session:
            rule = get_by_id(session, ScoreRule, rule_id)
            if not rule:
                return None

            if "name" in data:
                rule.name = data["name"]
            if "description" in data:
                rule.description = data["description"]
            if "category_id" in data:
                rule.category_id = data["category_id"]
            if "score" in data:
                rule.score = data["score"]
            if "is_active" in data:
                rule.is_active = data["is_active"]
            if "daily_limit" in data:
                rule.daily_limit = data["daily_limit"]
            if "min_interval" in data:
                rule.min_interval = data["min_interval"]

            session.commit()
            return ScoreRuleService.get_rule(rule.id)

    @staticmethod
    def delete_rule(rule_id):
        with db_session_scope() as session:
            rule = get_by_id(session, ScoreRule, rule_id)
            if not rule:
                return False

            session.delete(rule)
            session.commit()
            return True

    @staticmethod
    def get_active_rules():
        with db_readonly_scope() as session:
            rules = session.query(ScoreRule).filter(ScoreRule.is_active).all()
            result = []  # noqa: F841
            for r in rules:
                result.append(
                    {
                        "id": r.id,
                        "name": r.name,
                        "score": r.score,
                        "category_id": r.category_id,
                        "daily_limit": r.daily_limit,
                        "min_interval": r.min_interval,
                    }
                )
            return result

    @staticmethod
    def get_rules_by_category(category_id):
        with db_readonly_scope() as session:
            rules = session.query(ScoreRule).filter(ScoreRule.category_id == category_id, ScoreRule.is_active).all()
            result = []  # noqa: F841
            for r in rules:
                result.append({"id": r.id, "name": r.name, "score": r.score})
            return result
