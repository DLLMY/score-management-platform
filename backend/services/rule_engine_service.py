from models import ScoreRecord, ScoreRule, User, get_by_id, db
from utils.db_session import db_session_scope


class RuleMatcher:
    """规则匹配器"""

    def __init__(self):
        self.rule_cache = {}
        self.match_threshold = 0.995

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
                "is_active": rule.is_active,
                "daily_limit": rule.daily_limit,
                "min_interval": rule.min_interval,
                "created_at": (rule.created_at.isoformat() if rule.created_at else None),
            }
            self.rule_cache[rule_id] = rule_dict
            return rule_dict

        return None

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
            total_score_change = 0

            user = get_by_id(User, user_context.get("user_id"))
            if not user:
                return {
                    "success": False,
                    "error": "用户不存在",
                    "applied_rules": [],
                    "total_score_change": 0,
                }

            with db_session_scope():
                for rule_item in resolved_rules:
                    rule = rule_item["rule"]
                    if not rule.get("is_active", True):
                        continue

                    score_change = rule.get("score", 0)
                    confidence = rule_item.get("confidence", 0)

                    record = ScoreRecord(student_id=user_context["user_id"],
                        rule_id=rule["id"],
                        score_change=score_change,
                        reason=(f'规则自动应用: {rule["name"]} ' f"(置信度: {confidence:.3f})"),
                    )
                    db.session.add(record)

                    user.current_score = (user.current_score or 0) + score_change
                    total_score_change += score_change

                    applied_rules.append(
                        {
                            "rule_id": rule["id"],
                            "rule_name": rule["name"],
                            "score_change": score_change,
                            "confidence": confidence,
                            "priority": rule.get("priority", "P4"),
                            "category": rule.get("category", ""),
                        }
                    )

                new_score = user.current_score

            return {
                "success": True,
                "applied_rules": applied_rules,
                "total_score_change": total_score_change,
                "new_score": new_score,
                "message": f"成功应用{len(applied_rules)}条规则",
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "applied_rules": [],
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
        """基于行为类型生成规则推荐"""
        recommendations = []

        rules = ScoreRule.query.filter(ScoreRule.rule_type == behavior_type, ScoreRule.is_active).all()

        for rule in rules:
            recommendations.append(
                {
                    "rule_id": rule.id,
                    "confidence": 0.998,
                    "conditions": {"behavior_type": behavior_type},
                    "support": 0.85,
                    "lift": 2.5,
                }
            )

        return recommendations
