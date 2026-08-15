from flask_restx import Namespace, Resource, fields
from models import db, ScoreRankRule
from utils.permission import requires_permission
from utils.response import APIResponse
from datetime import datetime
from services.redis_cache_service import get_cache_service

ns_rank = Namespace("rank-rules", description="排名规则相关操作")

rank_rule_model = ns_rank.model(
    "ScoreRankRule",
    {
        "id": fields.Integer(readOnly=True, description="规则ID"),
        "name": fields.String(required=True, description="规则名称"),
        "min_score": fields.Integer(required=True, description="最低分数"),
        "max_score": fields.Integer(description="最高分数"),
        "color": fields.String(description="颜色"),
        "icon": fields.String(description="图标"),
        "description": fields.String(description="描述"),
        "is_active": fields.Boolean(description="是否启用"),
        "unlock_min_score": fields.Integer(description="开门最低分数要求（NULL使用全局默认值）"),
        "weekly_unlock_limit": fields.Integer(description="每周开门次数限制（NULL使用全局默认值）"),
    },
)


@ns_rank.route("/")
class RankRuleList(Resource):

    @ns_rank.doc("list_rank_rules", security="Bearer")
    @requires_permission("rule.view")
    def get(self):
        cached = get_cache_service().get("rank_rules_list")
        if cached:
            return APIResponse.success(data=cached)

        rules = ScoreRankRule.query.all()
        result = {  # noqa: F841
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "min_score": r.min_score,
                    "max_score": r.max_score,
                    "color": r.color,
                    "icon": r.icon,
                    "description": r.description,
                    "is_active": r.is_active,
                    "unlock_min_score": r.unlock_min_score,
                    "weekly_unlock_limit": r.weekly_unlock_limit,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rules
            ],
            "cached": False,
        }

        get_cache_service().set("rank_rules_list", result, ttl=300, tags=["rank_rules"])
        return APIResponse.success(data=result)

    @ns_rank.doc("create_rank_rule")
    @ns_rank.expect(rank_rule_model)
    @requires_permission("undefined")
    def post(self):
        data = ns_rank.payload
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

        # 清除排名规则缓存
        get_cache_service().invalidate_by_tag("rank_rules")

        return APIResponse.success(data={"rule_id": rule.id}, message="排名规则创建成功", status_code=201)


@ns_rank.route("/<int:id>")
@ns_rank.param("id", "规则ID")
class RankRuleResource(Resource):

    @ns_rank.doc("get_rank_rule", security="Bearer")
    @requires_permission("rule.view")
    def get(self, id):
        cache_key = f"rank_rule_{id}"
        cached = get_cache_service().get(cache_key)
        if cached:
            return APIResponse.success(data=cached)

        rule = ScoreRankRule.query.get_or_404(id)
        result = {  # noqa: F841
            "id": rule.id,
            "name": rule.name,
            "min_score": rule.min_score,
            "max_score": rule.max_score,
            "color": rule.color,
            "icon": rule.icon,
            "description": rule.description,
            "is_active": rule.is_active,
            "unlock_min_score": rule.unlock_min_score,
            "weekly_unlock_limit": rule.weekly_unlock_limit,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
            "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
            "cached": False,
        }

        get_cache_service().set(cache_key, result, ttl=300, tags=["rank_rules"])
        return APIResponse.success(data=result)

    @ns_rank.doc("update_rank_rule")
    @ns_rank.expect(rank_rule_model)
    @requires_permission("undefined")
    def put(self, id):
        rule = ScoreRankRule.query.get_or_404(id)
        data = ns_rank.payload
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

        # 清除排名规则缓存
        get_cache_service().invalidate_by_tag("rank_rules")

        return APIResponse.success(message="排名规则更新成功")

    @ns_rank.doc("delete_rank_rule")
    @requires_permission("undefined")
    def delete(self, id):
        rule = ScoreRankRule.query.get_or_404(id)
        db.session.delete(rule)
        db.session.commit()

        # 清除排名规则缓存
        get_cache_service().invalidate_by_tag("rank_rules")

        return APIResponse.success(message="排名规则删除成功")


def _get_active_rank_rules_cached():
    """
    获取活跃排名规则列表（带缓存）

    Returns:
        list: 按min_score降序排列的规则列表
    """
    cache_key = "rank_rules:active"
    cached_rules = get_cache_service().get(cache_key)

    if cached_rules is not None:
        return cached_rules

    rules = ScoreRankRule.query.filter_by(is_active=True).order_by(ScoreRankRule.min_score.desc()).all()

    # 转换为字典列表便于缓存
    rules_data = [
        {
            "id": r.id,
            "name": r.name,
            "min_score": r.min_score,
            "max_score": r.max_score,
            "color": r.color,
            "icon": r.icon,
            "description": r.description,
            "unlock_min_score": r.unlock_min_score,
            "weekly_unlock_limit": r.weekly_unlock_limit,
        }
        for r in rules
    ]

    # 缓存5分钟
    get_cache_service().set(cache_key, rules_data, ttl=300, tags=["rank_rules"])

    return rules_data


def _find_rank_by_score_binary_search(rules, score):
    """
    使用二分查找优化排名查询

    Args:
        rules: 已按min_score降序排列的规则列表（支持对象或字典）
        score: 要查询的分数

    Returns:
        匹配的规则或None
    """
    left, right = 0, len(rules) - 1

    while left <= right:
        mid = (left + right) // 2
        rule = rules[mid]

        # 支持对象属性和字典键名两种访问方式
        min_score = rule.get("min_score") if isinstance(rule, dict) else rule.min_score
        max_score = rule.get("max_score") if isinstance(rule, dict) else rule.max_score

        if score >= min_score:
            if max_score is None or score <= max_score:
                return rule

            if score > max_score:
                right = mid - 1
            else:
                return rule
        else:
            left = mid + 1

    return None


@ns_rank.route("/get-rank/<int:score>")
@ns_rank.param("score", "分数")
class RankByScore(Resource):

    @ns_rank.doc("get_rank_by_score", security="Bearer")
    @requires_permission("rule.view")
    def get(self, score):
        # 使用缓存获取活跃规则
        rules = _get_active_rank_rules_cached()

        if not rules:
            return {
                "rank": {
                    "name": "无等级",
                    "min_score": 0,
                    "max_score": 0,
                    "color": "#9CA3AF",
                    "icon": "Minus",
                    "description": "暂无等级",
                }
            }

        rule = _find_rank_by_score_binary_search(rules, score)

        if rule:
            return {"rank": rule}

        return {
            "rank": {
                "name": "无等级",
                "min_score": 0,
                "max_score": 0,
                "color": "#9CA3AF",
                "icon": "Minus",
                "description": "暂无等级",
            }
        }
