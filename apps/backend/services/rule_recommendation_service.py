from collections import defaultdict
from datetime import datetime, timedelta

from models import ScoreRecord, ScoreRule, ScoreCategory, User
import numpy as np
import re


class RuleRecommendationService:
    RECOMMENDATION_TYPES = {
        "new_rule": {
            "name": "新规则推荐",
            "description": "发现新的行为模式，建议创建新规则",
        },
        "optimization": {
            "name": "规则优化建议",
            "description": "调整现有规则参数，提升规则效果",
        },
        "combination": {
            "name": "规则组合建议",
            "description": "推荐规则组合使用，增强管理效果",
        },
    }

    @staticmethod
    def get_rule_effectiveness(rule_id, days=30):
        """
        获取规则的有效性统计

        Args:
            rule_id: 规则ID
            days: 统计天数

        Returns:
            dict: 规则有效性统计
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        records = ScoreRecord.query.filter(
            ScoreRecord.rule_id == rule_id,
            ScoreRecord.created_at >= start_date,
        ).all()

        if not records:
            return {
                "rule_id": rule_id,
                "usage_count": 0,
                "avg_score_change": 0,
                "total_score_change": 0,
                "unique_users": 0,
                "effectiveness": 0.0,
                "trend": "stable",
            }

        score_changes = [r.score_change for r in records]
        unique_users = len(set(r.student_id for r in records))

        avg_change = np.mean(score_changes)
        total_change = sum(score_changes)

        # 计算有效性评分（考虑使用频率、分数变化幅度、覆盖用户数）
        usage_score = min(len(records) / 100, 1.0)
        impact_score = min(abs(total_change) / 100, 1.0)
        coverage_score = min(unique_users / 50, 1.0)

        effectiveness = usage_score * 0.3 + impact_score * 0.4 + coverage_score * 0.3

        # 判断趋势
        if len(score_changes) >= 7:
            recent_changes = score_changes[-7:]
            avg_recent = np.mean(recent_changes)
            avg_earlier = np.mean(score_changes[:-7]) if len(score_changes) > 7 else avg_recent

            if avg_recent > avg_earlier * 1.2:
                trend = "increasing"
            elif avg_recent < avg_earlier * 0.8:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "stable"

        return {
            "rule_id": rule_id,
            "usage_count": len(records),
            "avg_score_change": round(avg_change, 2),
            "total_score_change": total_change,
            "unique_users": unique_users,
            "effectiveness": round(effectiveness, 2),
            "trend": trend,
        }

    @staticmethod
    def analyze_behavior_patterns(class_name=None, days=30):
        """
        分析行为模式，发现潜在的规则关联

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            list: 行为模式分析结果
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = ScoreRecord.query.filter(ScoreRecord.created_at >= start_date)
        if class_name:
            query = query.join(User).filter(User.class_name == class_name)

        records = query.all()

        if not records:
            return []

        # 统计各分类的使用情况
        category_stats = defaultdict(lambda: {"count": 0, "total_score": 0, "users": set()})

        for record in records:
            # 提取分类字符串：record.category 是 SQLAlchemy 关系（ScoreCategory 对象 / None），
            # 历史上被直接当 dict key，导致 Flask jsonify 在 500「Object of type ScoreCategory is not JSON serializable」。
            # 统一规整成字符串名（取 name），回退到 description，再回退到 "未分类"。
            cat_obj = getattr(record, "category", None)
            if isinstance(cat_obj, ScoreCategory):
                category_name = cat_obj.name
            elif isinstance(cat_obj, str) and cat_obj:
                category_name = cat_obj
            else:
                category_name = record.description or "未分类"
            category_stats[category_name]["count"] += 1
            category_stats[category_name]["total_score"] += record.score_change
            category_stats[category_name]["users"].add(record.student_id)

        # 转换为列表并排序
        patterns = []
        for category, stats in category_stats.items():
            patterns.append(
                {
                    "category": category,
                    "usage_count": stats["count"],
                    "total_score_change": stats["total_score"],
                    "avg_score_change": round(stats["total_score"] / stats["count"], 2),
                    "unique_users": len(stats["users"]),
                    "frequency": round(stats["count"] / len(records), 2),
                }
            )

        # 按使用频率排序
        patterns.sort(key=lambda x: x["frequency"], reverse=True)

        return patterns

    @staticmethod
    def find_new_rule_opportunities(class_name=None, days=30):
        """
        发现新规则机会

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            list: 新规则推荐列表
        """
        patterns = RuleRecommendationService.analyze_behavior_patterns(class_name, days)

        # 获取已有规则的分类（统一提取为字符串名，避免关系对象直接入 set 导致后续比较错位）
        existing_rules = ScoreRule.query.all()
        existing_categories = set()
        for r in existing_rules:
            cat = r.category
            if isinstance(cat, ScoreCategory):
                existing_categories.add(cat.name)
            elif isinstance(cat, str) and cat:
                existing_categories.add(cat)

        # 发现未被规则覆盖的行为模式
        opportunities = []

        for pattern in patterns:
            category = pattern["category"]

            # 检查该分类是否已有规则
            has_rule = category in existing_categories

            if not has_rule:
                # 建议创建新规则
                suggested_score = 0
                if pattern["avg_score_change"] > 0:
                    suggested_score = max(1, round(pattern["avg_score_change"]))
                elif pattern["avg_score_change"] < 0:
                    suggested_score = min(-1, round(pattern["avg_score_change"]))

                opportunities.append(
                    {
                        "type": "new_rule",
                        "category": category,
                        "usage_count": pattern["usage_count"],
                        "avg_score_change": pattern["avg_score_change"],
                        "unique_users": pattern["unique_users"],
                        "suggested_score": suggested_score,
                        "confidence": min(0.9, pattern["frequency"] * 2),
                        "description": f"发现'{category}'行为频繁出现，但尚未创建对应规则",
                        "suggestion": (
                            f"建议创建'{category}'规则，"
                            f"{'奖励' if suggested_score > 0 else '扣'}"
                            f"{abs(suggested_score)}分"
                        ),
                    }
                )

        # 按置信度排序
        opportunities.sort(key=lambda x: x["confidence"], reverse=True)

        return opportunities[:10]

    @staticmethod
    def suggest_rule_optimizations(class_name=None, days=30):
        """
        建议规则优化

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            list: 规则优化建议列表
        """
        rules = ScoreRule.query.all()

        optimizations = []

        for rule in rules:
            effectiveness = RuleRecommendationService.get_rule_effectiveness(rule.id, days)

            # 分析优化机会
            suggestions = []

            # 使用频率低的规则
            if effectiveness["usage_count"] < 5:
                suggestions.append(
                    {
                        "type": "low_usage",
                        "message": f"规则'{rule.name}'使用频率低，建议评估是否需要保留或调整触发条件",
                    }
                )

            # 效果不明显的规则
            if abs(effectiveness["avg_score_change"]) < 1 and effectiveness["usage_count"] > 10:
                suggested_score = rule.score * 1.5
                suggestions.append(
                    {
                        "type": "low_impact",
                        "message": f"规则'{rule.name}'效果不明显，建议调整分值",
                        "current_score": rule.score,
                        "suggested_score": round(suggested_score, 0),
                    }
                )

            # 效果显著的规则
            if effectiveness["effectiveness"] > 0.7 and abs(rule.score) < 10:
                suggested_score = rule.score * 1.3
                suggestions.append(
                    {
                        "type": "high_effectiveness",
                        "message": f"规则'{rule.name}'效果显著，建议提高分值以增强激励",
                        "current_score": rule.score,
                        "suggested_score": round(suggested_score, 0),
                    }
                )

            # 趋势下降的规则
            if effectiveness["trend"] == "decreasing":
                suggestions.append(
                    {
                        "type": "declining",
                        "message": f"规则'{rule.name}'效果呈下降趋势，建议评估规则适用性",
                    }
                )

            if suggestions:
                # 规整 category 为字符串，避免 SQLAlchemy 关系对象被 jsonify
                _cat = rule.category
                if isinstance(_cat, ScoreCategory):
                    rule_category_name = _cat.name
                elif isinstance(_cat, str):
                    rule_category_name = _cat
                else:
                    rule_category_name = None
                optimizations.append(
                    {
                        "type": "optimization",
                        "rule_id": rule.id,
                        "rule_name": rule.name,
                        "rule_category": rule_category_name,
                        "current_score": rule.score,
                        "effectiveness": effectiveness["effectiveness"],
                        "usage_count": effectiveness["usage_count"],
                        "trend": effectiveness["trend"],
                        "suggestions": suggestions,
                    }
                )

        # 按有效性排序
        optimizations.sort(key=lambda x: x["effectiveness"], reverse=True)

        return optimizations

    @staticmethod
    def suggest_rule_combinations(class_name=None, days=30):
        """
        建议规则组合

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            list: 规则组合建议列表
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = ScoreRecord.query.filter(ScoreRecord.created_at >= start_date)
        if class_name:
            query = query.join(User).filter(User.class_name == class_name)

        records = query.all()

        if not records:
            return []

        # 统计用户的规则使用组合
        user_rule_combinations = defaultdict(lambda: defaultdict(int))

        for record in records:
            if record.rule_id:
                user_rule_combinations[record.student_id][record.rule_id] += 1

        # 找出频繁组合
        combinations = defaultdict(int)

        for user_id, rule_counts in user_rule_combinations.items():
            rules = sorted(rule_counts.keys())
            # 找出使用次数超过3次的规则对
            for i in range(len(rules)):
                for j in range(i + 1, len(rules)):
                    min_count = min(rule_counts[rules[i]], rule_counts[rules[j]])
                    if min_count >= 3:
                        combinations[(rules[i], rules[j])] += 1

        # 获取规则名称
        rule_names = {}
        for rule in ScoreRule.query.all():
            rule_names[rule.id] = rule.name

        # 生成组合建议
        suggestions = []
        for (rule1_id, rule2_id), count in combinations.items():
            rule1_name = rule_names.get(rule1_id, f"规则{rule1_id}")
            rule2_name = rule_names.get(rule2_id, f"规则{rule2_id}")

            suggestions.append(
                {
                    "type": "combination",
                    "rules": [
                        {"id": rule1_id, "name": rule1_name},
                        {"id": rule2_id, "name": rule2_name},
                    ],
                    "frequency": count,
                    "confidence": min(count / len(user_rule_combinations), 0.95),
                    "description": f"发现'{rule1_name}'和'{rule2_name}'经常被同一学生触发",
                    "suggestion": "建议将这两个规则组合使用，可能存在行为关联",
                }
            )

        # 按频率排序
        suggestions.sort(key=lambda x: x["frequency"], reverse=True)

        return suggestions[:10]

    @staticmethod
    def get_all_recommendations(class_name=None, days=30):
        """
        获取所有推荐规则

        Args:
            class_name: 班级名称（可选）
            days: 统计天数

        Returns:
            dict: 综合推荐结果
        """
        new_rules = RuleRecommendationService.find_new_rule_opportunities(class_name, days)
        optimizations = RuleRecommendationService.suggest_rule_optimizations(class_name, days)
        combinations = RuleRecommendationService.suggest_rule_combinations(class_name, days)

        # 统一展平为前端的 recommendations[] 形状，避免前端按扁平字段读取时崩
        unified_recommendations: list = []

        for r in new_rules or []:
            suggested = float(r.get("suggested_score") or 0)
            confidence = float(r.get("confidence") or 0)
            unified_recommendations.append(
                {
                    "rule_id": None,
                    "rule_name": r.get("category") or "未分类",
                    "category": r.get("category") or "未分类",
                    "description": r.get("description") or r.get("suggestion") or "",
                    "confidence": confidence,
                    "estimated_impact": suggested,
                    "source_type": "new_rule",
                }
            )

        for r in optimizations or []:
            suggestions = r.get("suggestions") or []
            # 取第一条 suggestion 的 suggested_score（或 message）作 impact 估计
            estimated_impact = 0
            for s in suggestions:
                if s.get("type") == "low_impact":
                    try:
                        cur = float(s.get("current_score") or 0)
                        sug = float(s.get("suggested_score") or 0)
                        estimated_impact = round(sug - cur, 2)
                    except (TypeError, ValueError):
                        estimated_impact = 0
                    break
                if s.get("type") == "high_effectiveness":
                    try:
                        cur = float(s.get("current_score") or 0)
                        sug = float(s.get("suggested_score") or 0)
                        estimated_impact = round(sug - cur, 2)
                    except (TypeError, ValueError):
                        estimated_impact = 0
                    break
            unified_recommendations.append(
                {
                    "rule_id": r.get("rule_id"),
                    "rule_name": r.get("rule_name") or f"规则{r.get('rule_id')}",
                    "category": r.get("rule_category") or "未分类",
                    "description": (
                        (suggestions[0]["message"] if suggestions else "") if suggestions else ""
                    ),
                    "confidence": float(r.get("effectiveness") or 0),
                    "estimated_impact": estimated_impact,
                    "source_type": "optimization",
                }
            )

        for r in combinations or []:
            rules = r.get("rules") or []
            rules_text = " + ".join([str(rt.get("name") or f"规则{rt.get('id')}") for rt in rules])
            unified_recommendations.append(
                {
                    "rule_id": None,
                    "rule_name": f"组合:{rules_text}" if rules_text else "组合推荐",
                    "category": "规则组合",
                    "description": r.get("description") or r.get("suggestion") or "",
                    "confidence": float(r.get("confidence") or 0),
                    "estimated_impact": 0,
                    "source_type": "combination",
                }
            )

        total = len(unified_recommendations)
        avg_confidence = (
            round(sum(x["confidence"] for x in unified_recommendations) / total, 2)
            if total
            else 0.0
        )
        estimated_total_impact = round(
            sum(x["estimated_impact"] for x in unified_recommendations), 2
        )

        return {
            "class_name": class_name,
            "period_days": days,
            "summary": {
                "new_rule_count": len(new_rules),
                "optimization_count": len(optimizations),
                "combination_count": len(combinations),
                "total_recommendations": total,
                "avg_confidence": avg_confidence,
                "estimated_total_impact": estimated_total_impact,
            },
            "new_rules": new_rules,
            "optimizations": optimizations,
            "combinations": combinations,
            "recommendations": unified_recommendations,
        }

    @staticmethod
    def get_rule_statistics(days=30):
        """
        获取规则统计信息

        Args:
            days: 统计天数

        Returns:
            dict: 规则统计信息
        """
        rules = ScoreRule.query.all()

        stats = {
            "total_rules": len(rules),
            "active_rules": 0,
            "inactive_rules": 0,
            "high_effectiveness": [],
            "low_effectiveness": [],
            "avg_effectiveness": 0.0,
        }

        effectiveness_scores = []

        for rule in rules:
            eff = RuleRecommendationService.get_rule_effectiveness(rule.id, days)
            effectiveness_scores.append(eff["effectiveness"])

            if eff["usage_count"] > 0:
                stats["active_rules"] += 1
                if eff["effectiveness"] > 0.6:
                    stats["high_effectiveness"].append(
                        {
                            "rule_id": rule.id,
                            "rule_name": rule.name,
                            "effectiveness": eff["effectiveness"],
                            "usage_count": eff["usage_count"],
                        }
                    )
                elif eff["effectiveness"] < 0.2:
                    stats["low_effectiveness"].append(
                        {
                            "rule_id": rule.id,
                            "rule_name": rule.name,
                            "effectiveness": eff["effectiveness"],
                            "usage_count": eff["usage_count"],
                        }
                    )
            else:
                stats["inactive_rules"] += 1

        if effectiveness_scores:
            stats["avg_effectiveness"] = round(np.mean(effectiveness_scores), 2)

        stats["high_effectiveness"].sort(key=lambda x: x["effectiveness"], reverse=True)
        stats["low_effectiveness"].sort(key=lambda x: x["effectiveness"])

        return stats

    @staticmethod
    def train_recommendation_model(days=90):
        """
        训练规则推荐模型

        Args:
            days: 训练数据天数

        Returns:
            dict: 训练结果
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        records = ScoreRecord.query.filter(ScoreRecord.created_at >= start_date).all()

        if not records:
            return {
                "status": "error",
                "message": "没有足够的训练数据",
                "model_info": {},
            }

        # 统计各分类的使用模式
        category_usage = defaultdict(lambda: {"count": 0, "users": set(), "score_sum": 0})
        user_category_usage = defaultdict(set)

        for record in records:
            category = (
                getattr(record, "category", None) or record.description or "未分类" or "未分类"
            )
            category_usage[category]["count"] += 1
            category_usage[category]["users"].add(record.student_id)
            category_usage[category]["score_sum"] += record.score_change
            user_category_usage[record.student_id].add(category)

        # 计算支持度和置信度（简化版Apriori）
        total_users = len(user_category_usage)
        frequent_itemsets = []

        for category, stats in category_usage.items():
            support = len(stats["users"]) / total_users if total_users > 0 else 0
            if support > 0.1:
                frequent_itemsets.append(
                    {
                        "category": category,
                        "support": round(support, 4),
                        "usage_count": stats["count"],
                        "unique_users": len(stats["users"]),
                        "avg_score_change": (
                            round(stats["score_sum"] / stats["count"], 2)
                            if stats["count"] > 0
                            else 0
                        ),
                    }
                )

        # 生成关联规则
        association_rules = []
        categories = list(category_usage.keys())

        for i in range(len(categories)):
            for j in range(i + 1, len(categories)):
                cat1, cat2 = categories[i], categories[j]

                # 计算共同用户数
                users1 = category_usage[cat1]["users"]
                users2 = category_usage[cat2]["users"]
                common_users = users1 & users2

                if len(common_users) >= 3:
                    confidence = len(common_users) / len(users1)
                    lift = confidence / (len(users2) / total_users if total_users > 0 else 1)

                    if confidence > 0.3:
                        association_rules.append(
                            {
                                "antecedent": cat1,
                                "consequent": cat2,
                                "support": round(len(common_users) / total_users, 4),
                                "confidence": round(confidence, 4),
                                "lift": round(lift, 4),
                                "common_users": len(common_users),
                            }
                        )

        association_rules.sort(key=lambda x: x["lift"], reverse=True)
        frequent_itemsets.sort(key=lambda x: x["support"], reverse=True)

        return {
            "status": "success",
            "message": f"模型训练完成，使用{len(records)}条记录，{total_users}个用户",
            "model_info": {
                "training_data_days": days,
                "total_records": len(records),
                "total_users": total_users,
                "total_categories": len(categories),
                "frequent_itemsets_count": len(frequent_itemsets),
                "association_rules_count": len(association_rules),
                "top_itemsets": frequent_itemsets[:5],
                "top_rules": association_rules[:5],
            },
        }

    @staticmethod
    def evaluate_model(days=30):
        """
        评估规则推荐模型效果

        Args:
            days: 评估数据天数

        Returns:
            dict: 评估结果
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        records = ScoreRecord.query.filter(ScoreRecord.created_at >= start_date).all()

        if not records:
            return {
                "status": "error",
                "message": "没有足够的评估数据",
                "metrics": {},
            }

        # 获取已有规则
        existing_rules = ScoreRule.query.all()

        # 统计规则覆盖情况
        category_stats = defaultdict(lambda: {"record_count": 0, "user_count": 0})

        for record in records:
            category = (
                getattr(record, "category", None) or record.description or "未分类" or "未分类"
            )
            category_stats[category]["record_count"] += 1
            category_stats[category]["user_count"] += 1

        # 计算覆盖度：原实现中 existing_categories（ScoreCategory 对象集合）与
        # category_stats（字符串集合）类型不匹配，交集恒为空，导致 coverage_rate 恒为 0。
        # 改为统计描述命中任一现有规则关键词的记录比例作为覆盖度估计。
        rule_keywords = set()
        for r in existing_rules:
            for field in (r.name, r.description):
                if field:
                    for term in re.findall(r"[\u4e00-\u9fa5]{2,}", field):
                        rule_keywords.add(term)
        covered = 0
        for rec in records:
            desc = getattr(rec, "description", None) or ""
            if any(kw in desc for kw in rule_keywords):
                covered += 1
        coverage_rate = round(covered / len(records), 4) if records else 0.0

        # 计算规则有效性
        effectiveness_scores = []
        for rule in existing_rules:
            eff = RuleRecommendationService.get_rule_effectiveness(rule.id, days)
            effectiveness_scores.append(eff["effectiveness"])

        avg_effectiveness = np.mean(effectiveness_scores) if effectiveness_scores else 0

        # 计算推荐质量指标
        recommendations = RuleRecommendationService.get_all_recommendations(days=days)

        return {
            "status": "success",
            "message": "模型评估完成",
            "metrics": {
                "evaluation_data_days": days,
                "total_records": len(records),
                "total_categories": len(category_stats),
                "covered_records": covered,
                "coverage_rate": round(coverage_rate, 4),
                "avg_effectiveness": round(avg_effectiveness, 4),
                "total_recommendations": recommendations["summary"]["total_recommendations"],
                "new_rule_recommendations": recommendations["summary"]["new_rule_count"],
                "optimization_recommendations": recommendations["summary"]["optimization_count"],
                "combination_recommendations": recommendations["summary"]["combination_count"],
            },
        }
