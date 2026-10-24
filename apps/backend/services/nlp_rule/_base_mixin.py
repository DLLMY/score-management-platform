"""规则管理服务基础：__init__ + 规则/用量/训练记录的序列化助手。"""


class _BaseMixin:
    def __init__(self):
        pass

    def _rule_to_dict(self, rule):
        """规则转字典"""
        return {
            "id": rule.id,
            "behavior_keyword": rule.behavior_keyword,
            "behavior_description": rule.behavior_description,
            "score_value": rule.score_value,
            "score_type": rule.score_type,
            "behavior_tags": rule.behavior_tags,
            "match_pattern": rule.match_pattern,
            "priority": rule.priority,
            "is_active": rule.is_active,
            "usage_count": rule.usage_count,
            "accuracy_rate": rule.accuracy_rate,
            "created_by": rule.created_by,
            "created_at": (rule.created_at.isoformat() if rule.created_at else None),
            "updated_at": (rule.updated_at.isoformat() if rule.updated_at else None),
        }

    def _usage_to_dict(self, usage):
        """使用记录转字典"""
        return {
            "id": usage.id,
            "rule_id": usage.rule_id,
            "user_id": usage.student_id,
            "input_text": usage.input_text,
            "matched_keyword": usage.matched_keyword,
            "score_change": usage.score_change,
            "is_manual_correction": usage.is_manual_correction,
            # P1-4 修复：NLPRuleUsage 模型并无 corrected_rule_id 列（该字段全系统
            # 仅此一处引用），原直接属性访问必抛 AttributeError，导致
            # GET /api/nlp/rules/<id>/usage 只要有使用记录就恒 500。
            # 安全取值：保住响应键（值为 null），将来若补列也自动生效。
            "corrected_rule_id": getattr(usage, "corrected_rule_id", None),
            "created_at": (usage.created_at.isoformat() if usage.created_at else None),
        }

    def _training_to_dict(self, training):
        """训练记录转字典"""
        return {
            "id": training.id,
            "model_name": training.model_name,
            "algorithm_type": training.algorithm_type,
            "training_data_size": training.training_data_size,
            "accuracy": training.accuracy,
            "f1_score": training.f1_score,
            "status": training.status,
            # 前端按 training_status 读取；保留 status 兼容（历史前端字段不匹配导致永远显示"进行中"）
            "training_status": training.status,
            "error_message": training.error_message,
            "trained_at": (training.trained_at.isoformat() if training.trained_at else None),
            "created_at": (training.created_at.isoformat() if training.created_at else None),
        }
