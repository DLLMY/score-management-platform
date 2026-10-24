"""统计与推荐：规则使用统计聚合 + 相似规则推荐。"""

from sqlalchemy import case, func

from models import (
    NLPBehaviorKeyword,
    NLPMatchResult,
    NLPModelTraining,
    NLPRuleUsage,
    NLPScoringRule,
    db,
    get_by_id,
)


class _StatsMixin:
    def get_rule_statistics(self):
        """获取规则统计信息"""
        # R24-2：规则/用量/匹配三类计数各自合并为单条条件聚合（每类省 2 查）
        rule_stats = (
            db.session.query(
                func.count(NLPScoringRule.id).label("total"),
                func.count(case((NLPScoringRule.score_type == "add", NLPScoringRule.id))).label("add"),
                func.count(case((NLPScoringRule.score_type == "deduct", NLPScoringRule.id))).label(
                    "deduct"
                ),
            )
            .filter(NLPScoringRule.is_active)
            .first()
        )
        total_rules = rule_stats.total or 0
        add_rules = rule_stats.add or 0
        deduct_rules = rule_stats.deduct or 0

        usage_stats = (
            db.session.query(
                func.count(NLPRuleUsage.id).label("total"),
                func.count(case((NLPRuleUsage.is_manual_correction == True, NLPRuleUsage.id))).label(
                    "manual"
                ),
            )
            .first()
        )
        total_usage = usage_stats.total or 0
        manual_corrections = usage_stats.manual or 0

        # 使用数据库聚合查询，避免加载所有记录
        match_stats = (
            db.session.query(
                func.count(NLPMatchResult.id).label("total"),
                func.count(case((NLPMatchResult.is_manual_correction == True, NLPMatchResult.id))).label(
                    "correct"
                ),
            )
            .first()
        )
        total_count = match_stats.total or 0
        if total_count > 0:
            accuracy_rate = round((match_stats.correct or 0) / total_count, 4)
        else:
            accuracy_rate = 0.0

        high_usage_rules = (
            NLPScoringRule.query.filter(NLPScoringRule.is_active)
            .order_by(NLPScoringRule.usage_count.desc())
            .order_by(NLPScoringRule.usage_count.desc())
            .all()
        )

        return {
            "total_rules": total_rules,
            "add_rules": add_rules,
            "deduct_rules": deduct_rules,
            "total_usage": total_usage,
            "manual_corrections": manual_corrections,
            "accuracy_rate": round(accuracy_rate, 4),
            "high_usage_rules": [self._rule_to_dict(rule) for rule in high_usage_rules],
        }

    def suggest_similar_rules(self, behavior_keyword):
        """推荐相似规则"""
        similar_rules = (
            NLPScoringRule.query.filter(
                NLPScoringRule.is_active,
                NLPScoringRule.behavior_keyword.like(f"%{behavior_keyword}%")
                | NLPScoringRule.behavior_description.like(f"%{behavior_keyword}%"),
            )
            .order_by(NLPScoringRule.usage_count.desc())
            .limit(5)
            .all()
        )

        return [self._rule_to_dict(rule) for rule in similar_rules]
