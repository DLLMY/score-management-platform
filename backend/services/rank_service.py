"""排名辅助函数（从 api/scores/rank_routes 下沉，消除 services → api 反向依赖）。"""

from models import ScoreRankRule
from services.redis_cache_service import get_cache_service


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

    rules = (
        ScoreRankRule.query.filter_by(is_active=True).order_by(ScoreRankRule.min_score.desc()).all()
    )

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
