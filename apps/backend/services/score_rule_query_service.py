"""积分规则只读查询视图（薄路由下沉）。

仅承载纯只读聚合/过滤/分页/序列化逻辑，返回裸 data dict（不含信封），
由 api/scores/rules_routes.py 负责参数解析、缓存与响应构造。
契约（返回结构、字段子集、缓存语义）与原路由内联实现逐字一致。
"""

from models import db, ScoreRule, ScoreRecord
from sqlalchemy import func

# B3 收敛 2026-09-05：ScoreRule.to_dict(fields) 子集常量（逐字对齐各端点既有响应契约）
RULE_LIST_FIELDS = [
    "id",
    "name",
    "description",
    "category_id",
    "category_name",
    "score",
    "is_active",
    "daily_limit",
    "min_interval",
    "created_at",
]
RULE_STAT_FIELDS = [
    "id",
    "name",
    "description",
    "score",
    "is_active",
    "category_id",
    "category_name",
]


def get_rule_list_view(page, per_page, category_id, is_active):
    """积分规则列表（分页 + 分类/状态筛选 + 序列化）。

    返回 {rules, total, page, per_page, pages}。is_active 为原始字符串，
    由本函数完成 (is_active.lower() == "true") 判定，与原路由逻辑一致。
    """
    query = ScoreRule.query
    if category_id:
        query = query.filter(ScoreRule.category_id == category_id)
    if is_active is not None:
        query = query.filter(ScoreRule.is_active == (is_active.lower() == "true"))
    pagination = query.order_by(ScoreRule.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return {
        "rules": [r.to_dict(RULE_LIST_FIELDS) for r in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }


def get_rule_statistics_view():
    """规则使用统计（按规则分组聚合 + 规则详情关联 + 使用排序 + 总计）。

    返回 {statistics, summary}。summary 含 total_rules/active_rules/
    total_usage_count/total_score_change/most_used_rule。
    """
    # 按规则分组统计使用次数
    stats = (
        db.session.query(
            ScoreRecord.rule_id,
            func.count(ScoreRecord.id).label("usage_count"),
            func.max(ScoreRecord.created_at).label("last_used_at"),
            func.sum(ScoreRecord.score_change).label("total_score_change"),
        )
        .filter(ScoreRecord.rule_id.isnot(None))
        .group_by(ScoreRecord.rule_id)
        .all()
    )
    # 构建规则ID到统计信息的映射
    rule_stats = {}
    for stat in stats:
        rule_stats[stat.rule_id] = {
            "usage_count": stat.usage_count,
            "last_used_at": stat.last_used_at.isoformat() if stat.last_used_at else None,
            "total_score_change": (
                float(stat.total_score_change) if stat.total_score_change else 0
            ),
        }
    # 获取规则详情并关联统计
    rules = ScoreRule.query.all()
    result = []
    for rule in rules:
        stat = rule_stats.get(
            rule.id, {"usage_count": 0, "last_used_at": None, "total_score_change": 0}
        )
        result.append(
            {
                **rule.to_dict(RULE_STAT_FIELDS),
                "usage_count": stat["usage_count"],
                "last_used_at": stat["last_used_at"],
                "total_score_change": stat["total_score_change"],
            }
        )
    # 按使用次数排序
    result.sort(key=lambda x: x["usage_count"], reverse=True)
    # 计算总计
    total_usage = sum(r["usage_count"] for r in result)
    total_score = sum(r["total_score_change"] for r in result)
    return {
        "statistics": result,
        "summary": {
            "total_rules": len(result),
            "active_rules": sum(1 for r in result if r["is_active"]),
            "total_usage_count": total_usage,
            "total_score_change": total_score,
            "most_used_rule": (
                result[0]["name"] if result and result[0]["usage_count"] > 0 else None
            ),
        },
    }
