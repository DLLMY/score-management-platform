from datetime import datetime

from models import ScoreRecord, ScoreRule, User, get_by_id, db
from utils.db_session import db_session_scope


class RuleMatcher:
    """规则匹配器"""

    def __init__(self):
        self.rule_cache = {}
        # 规则为确定性匹配（无概率模型），匹配即应用；阈值置 0 表示不做概率门控
        self.match_threshold = 0.0

    def match_rules(self, model_output, user_context):
        """基于模型输出匹配规则"""
        matched_rules = []

        for rule_recommendation in model_output.get("recommendations", []):
            rule_id = rule_recommendation.get("rule_id")
            confidence = rule_recommendation.get("confidence", 0)

            if confidence >= self.match_threshold:
                rule = self._load_rule(rule_id)
                if rule:
                    matched_rules.append(
                        {
                            "rule": rule,
                            "confidence": confidence,
                            "priority": rule.get("priority", "P4"),
                            "conditions": rule_recommendation.get("conditions", {}),
                            "rule_recommendation": rule_recommendation,
                        }
                    )

        return matched_rules

    def _load_rule(self, rule_id):
        """加载规则"""
        if rule_id in self.rule_cache:
            return self.rule_cache[rule_id]

        rule = get_by_id(ScoreRule, rule_id)
        if rule:
            rule_dict = {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "score": rule.score,
                "category_id": rule.category_id,
                "category": rule.category_id,
                "priority": self._priority_from_score(rule.score),
                "is_active": rule.is_active,
                "daily_limit": rule.daily_limit,
                "min_interval": rule.min_interval,
                "created_at": (rule.created_at.isoformat() if rule.created_at else None),
            }
            self.rule_cache[rule_id] = rule_dict
            return rule_dict

        return None

    @staticmethod
    def _priority_from_score(score):
        """将规则分值量级映射为优先级（P1-P4，ScoreRule 模型无 priority 列）。

        用分值绝对值做启发式派生，使 RulePriorityEngine 的冲突解决具备真实区分度
        （原先恒为 P4，冲突解析退化为「全保留」）。
        """
        try:
            magnitude = abs(float(score or 0))
        except (TypeError, ValueError):
            return "P4"
        if magnitude >= 20:
            return "P1"
        if magnitude >= 10:
            return "P2"
        if magnitude >= 5:
            return "P3"
        return "P4"

    def clear_cache(self):
        """清除规则缓存"""
        self.rule_cache.clear()


class ParameterMapper:
    """规则参数映射器"""

    def __init__(self):
        self.mapping_rules = {
            "confidence": {"target": "match_threshold", "transform": "direct"},
            "support": {"target": "min_usage_rate", "transform": "scale_0_1"},
            "lift": {
                "target": "effectiveness_weight",
                "transform": "normalize",
            },
            "score_change": {
                "target": "base_score",
                "transform": "dynamic_calculate",
            },
        }

    def map_parameters(self, model_output, rule_template):
        """将模型输出映射到规则参数"""
        mapped_params = rule_template.copy()

        for param_name, mapping in self.mapping_rules.items():
            if param_name in model_output:
                value = model_output[param_name]
                target_param = mapping["target"]
                transform = mapping["transform"]

                mapped_params[target_param] = self._transform(value, transform)

        return mapped_params

    def _transform(self, value, transform_type):
        """参数转换"""
        if transform_type == "direct":
            return value
        elif transform_type == "scale_0_1":
            return min(max(value, 0), 1)
        elif transform_type == "normalize":
            return (value - 1) / 10 if value > 1 else 0
        elif transform_type == "dynamic_calculate":
            return round(value * 1.2)
        return value


class RulePriorityEngine:
    """规则优先级处理引擎"""

    def __init__(self, conflict_strategy="highest_priority"):
        self.conflict_strategy = conflict_strategy
        self.priority_weights = {
            "P0": 100,
            "P1": 80,
            "P2": 60,
            "P3": 40,
            "P4": 20,
        }

    def resolve_conflicts(self, matched_rules):
        """解决规则冲突"""
        if not matched_rules:
            return []

        groups = {}
        for rule in matched_rules:
            priority = rule.get("priority", "P4")
            if priority not in groups:
                groups[priority] = []
            groups[priority].append(rule)

        if self.conflict_strategy == "highest_priority":
            return self._resolve_by_highest_priority(groups)
        elif self.conflict_strategy == "merge":
            return self._resolve_by_merge(groups)
        elif self.conflict_strategy == "latest":
            return self._resolve_by_latest(groups)

        return matched_rules

    def _resolve_by_highest_priority(self, groups):
        """按最高优先级解决"""
        sorted_priorities = sorted(
            groups.keys(),
            key=lambda p: self.priority_weights.get(p, 0),
            reverse=True,
        )

        highest_priority = sorted_priorities[0]
        return groups[highest_priority]

    def _resolve_by_merge(self, groups):
        """合并规则"""
        merged_rules = []
        for priority in sorted(
            groups.keys(),
            key=lambda p: self.priority_weights.get(p, 0),
            reverse=True,
        ):
            merged_rules.extend(groups[priority])

        return merged_rules

    def _resolve_by_latest(self, groups):
        """按最新规则解决"""
        all_rules = []
        for rules in groups.values():
            all_rules.extend(rules)

        all_rules.sort(key=lambda r: r["rule"].get("created_at", ""), reverse=True)
        return [all_rules[0]] if all_rules else []


class RuleExecutionEngine:
    """规则执行引擎"""

    def __init__(self):
        self.matcher = RuleMatcher()
        self.mapper = ParameterMapper()
        self.priority_engine = RulePriorityEngine()

    def execute_rules(self, model_output, user_context):
        """执行规则"""
        try:
            matched_rules = self.matcher.match_rules(model_output, user_context)

            resolved_rules = self.priority_engine.resolve_conflicts(matched_rules)

            applied_rules = []
            skipped_rules = []
            total_score_change = 0

            user = get_by_id(User, user_context.get("user_id"))
            if not user:
                return {
                    "success": False,
                    "error": "用户不存在",
                    "applied_rules": [],
                    "skipped_rules": [],
                    "total_score_change": 0,
                }

            today_start = datetime.combine(datetime.now().date(), datetime.min.time())
            batch_counts = {}

            with db_session_scope():
                for rule_item in resolved_rules:
                    rule = rule_item["rule"]
                    if not rule.get("is_active", True):
                        continue

                    rule_id = rule["id"]
                    daily_limit = rule.get("daily_limit")
                    min_interval = rule.get("min_interval")

                    # RE3：执行每日上限 / 最小间隔约束（此前已加载却从不执行，
                    # 行为触发会无限制累加积分）
                    if daily_limit:
                        already = (
                            ScoreRecord.query.filter(
                                ScoreRecord.student_id == user_context["user_id"],
                                ScoreRecord.rule_id == rule_id,
                                ScoreRecord.created_at >= today_start,
                            ).count()
                            + batch_counts.get(rule_id, 0)
                        )
                        if already >= daily_limit:
                            skipped_rules.append({"rule_id": rule_id, "reason": "daily_limit"})
                            continue

                    if min_interval:
                        last = (
                            ScoreRecord.query.filter(
                                ScoreRecord.student_id == user_context["user_id"],
                                ScoreRecord.rule_id == rule_id,
                            )
                            .order_by(ScoreRecord.created_at.desc())
                            .first()
                        )
                        if last and last.created_at:
                            elapsed = (datetime.now() - last.created_at).total_seconds()
                            if elapsed < min_interval:
                                skipped_rules.append(
                                    {"rule_id": rule_id, "reason": "min_interval"}
                                )
                                continue

                    score_change = rule.get("score", 0)
                    confidence = rule_item.get("confidence", 0)

                    record = ScoreRecord(
                        student_id=user_context["user_id"],
                        rule_id=rule_id,
                        score_change=score_change,
                        reason=f'规则自动应用: {rule["name"]}',
                    )
                    db.session.add(record)

                    user.current_score = (user.current_score or 0) + score_change
                    total_score_change += score_change
                    batch_counts[rule_id] = batch_counts.get(rule_id, 0) + 1

                    applied_rules.append(
                        {
                            "rule_id": rule_id,
                            "rule_name": rule["name"],
                            "score_change": score_change,
                            "confidence": confidence,
                            "priority": rule.get("priority", "P4"),
                            "category": rule.get("category", ""),
                        }
                    )

                new_score = user.current_score

            msg = f"成功应用{len(applied_rules)}条规则"
            if skipped_rules:
                msg += f"，跳过{len(skipped_rules)}条（命中每日上限/最小间隔）"

            return {
                "success": True,
                "applied_rules": applied_rules,
                "skipped_rules": skipped_rules,
                "total_score_change": total_score_change,
                "new_score": new_score,
                "message": msg,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "applied_rules": [],
                "skipped_rules": [],
                "total_score_change": 0,
            }

    def apply_rule_by_behavior(self, user_id, behavior_type, context=None):
        """根据行为类型应用规则"""
        context = context or {}
        context["user_id"] = user_id
        context["behavior_type"] = behavior_type

        model_output = {"recommendations": self._generate_recommendations(user_id, behavior_type)}

        return self.execute_rules(model_output, context)

    def _generate_recommendations(self, user_id, behavior_type):
        """基于行为类型生成规则推荐。

        说明：本系统无独立评分模型，规则匹配是确定性的（规则存在且启用即匹配），
        故 confidence 记为 1.0 表示「已匹配」，不再伪造 0.998/0.85/2.5 等模型指标，
        也不将这些假指标写入 ScoreRecord.reason（数据诚信）。
        """
        recommendations = []

        rules = ScoreRule.query.filter(
            ScoreRule.score_type == behavior_type, ScoreRule.is_active
        ).all()

        for rule in rules:
            recommendations.append(
                {
                    "rule_id": rule.id,
                    "confidence": 1.0,
                    "conditions": {"behavior_type": behavior_type},
                }
            )

        return recommendations
