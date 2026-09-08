from datetime import datetime
from models import (
    NLPScoringRule,
    NLPRuleUsage,
    NLPMatchResult,
    NLPModelTraining,
    NLPBehaviorKeyword,
    get_by_id,
    db,
)
from utils.db_session import db_session_scope


class NLPRuleManagementService:
    """规则管理服务"""

    def __init__(self):
        pass

    def get_rules(
        self,
        page=1,
        per_page=20,
        keyword=None,
        score_type=None,
        sort_by="created_at",
        sort_order="desc",
    ):
        """获取规则列表"""
        valid_sort_fields = [
            "id",
            "behavior_keyword",
            "behavior_description",
            "score_value",
            "score_type",
            "priority",
            "usage_count",
            "accuracy_rate",
            "created_at",
            "updated_at",
            "last_used_at",
        ]
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"

        query = NLPScoringRule.query.filter(NLPScoringRule.is_active)

        if keyword:
            query = query.filter(
                NLPScoringRule.behavior_keyword.like(f"%{keyword}%")
                | NLPScoringRule.behavior_description.like(f"%{keyword}%")
            )

        if score_type:
            query = query.filter(NLPScoringRule.score_type == score_type)

        sort_column = getattr(NLPScoringRule, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            "items": [self._rule_to_dict(rule) for rule in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }

    def get_rule(self, rule_id):
        """获取单个规则"""
        rule = get_by_id(NLPScoringRule, rule_id)
        if not rule:
            return None
        return self._rule_to_dict(rule)

    def create_rule(self, data):
        """创建规则"""
        existing_rule = NLPScoringRule.query.filter(
            NLPScoringRule.behavior_keyword == data["behavior_keyword"],
            NLPScoringRule.score_type == data["score_type"],
        ).first()

        if existing_rule:
            return {
                "success": False,
                "message": "规则已存在",
                "rule_id": existing_rule.id,
            }

        rule = NLPScoringRule(
            behavior_keyword=data["behavior_keyword"],
            behavior_description=data.get("behavior_description", ""),
            score_value=data["score_value"],
            score_type=data["score_type"],
            behavior_tags=data.get("behavior_tags", []),
            match_pattern=data.get("match_pattern", ""),
            priority=data.get("priority", 0),
            created_by=data.get("created_by"),
            # P1-4 修复：is_active 列无 DB 默认值，不显式赋值会落 NULL，而
            # get_rules/get_rule_statistics/suggest_similar_rules 全部
            # filter(is_active) → 新规则创建"成功"却在列表/统计/推荐中查不到。
            # 与 batch_import_rules（已显式 is_active=True）保持一致。
            is_active=True,
        )

        with db_session_scope(detach=False):
            from models import db

            db.session.add(rule)

        self._update_keyword(data["behavior_keyword"], data["score_type"], data["score_value"])

        return {
            "success": True,
            "message": "规则创建成功",
            "rule": self._rule_to_dict(rule),
        }

    def update_rule(self, rule_id, data):
        """更新规则"""
        rule = get_by_id(NLPScoringRule, rule_id)
        if not rule:
            return {"success": False, "message": "规则不存在"}

        if "behavior_keyword" in data:
            rule.behavior_keyword = data["behavior_keyword"]
        if "behavior_description" in data:
            rule.behavior_description = data["behavior_description"]
        if "score_value" in data:
            rule.score_value = data["score_value"]
        if "score_type" in data:
            rule.score_type = data["score_type"]
        if "behavior_tags" in data:
            rule.behavior_tags = data["behavior_tags"]
        if "match_pattern" in data:
            rule.match_pattern = data["match_pattern"]
        if "priority" in data:
            rule.priority = data["priority"]
        if "is_active" in data:
            rule.is_active = data["is_active"]

        rule.updated_at = datetime.now()
        with db_session_scope(detach=False):
            pass

        return {
            "success": True,
            "message": "规则更新成功",
            "rule": self._rule_to_dict(rule),
        }

    def delete_rule(self, rule_id):
        """删除规则"""
        rule = get_by_id(NLPScoringRule, rule_id)
        if not rule:
            return {"success": False, "message": "规则不存在"}

        rule.is_active = False
        rule.updated_at = datetime.now()
        with db_session_scope(detach=False):
            pass

        return {"success": True, "message": "规则已删除"}

    def get_rule_usage(self, rule_id, page=1, per_page=20):
        """获取规则使用记录"""
        query = NLPRuleUsage.query.filter(NLPRuleUsage.rule_id == rule_id)
        pagination = query.order_by(NLPRuleUsage.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            "items": [self._usage_to_dict(usage) for usage in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
        }

    def get_rule_statistics(self):
        """获取规则统计信息"""
        total_rules = NLPScoringRule.query.filter(NLPScoringRule.is_active).count()
        add_rules = NLPScoringRule.query.filter(
            NLPScoringRule.score_type == "add", NLPScoringRule.is_active
        ).count()
        deduct_rules = NLPScoringRule.query.filter(
            NLPScoringRule.score_type == "deduct", NLPScoringRule.is_active
        ).count()

        total_usage = NLPRuleUsage.query.count()
        manual_corrections = NLPRuleUsage.query.filter(NLPRuleUsage.is_manual_correction).count()

        # 使用数据库聚合查询，避免加载所有记录
        total_count = NLPMatchResult.query.count()
        if total_count > 0:
            correct_count = NLPMatchResult.query.filter(NLPMatchResult.is_manual_correction).count()
            accuracy_rate = correct_count / total_count
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

    def train_model(self, trained_by=None):
        """训练规则匹配模型"""
        with db_session_scope(detach=False):
            training_record = NLPModelTraining(
                model_name="rule_based",
                algorithm_type="rule_matching",
                status="running",
            )

            db.session.add(training_record)
        training_id = training_record.id  # commit 后 id 可用（对象随后被 detach）

        match_results = NLPMatchResult.query.all()
        total_count = len(match_results)

        if total_count > 0:

            usage_records = NLPRuleUsage.query.all()
            for usage in usage_records:
                rule = get_by_id(NLPScoringRule, usage.rule_id)
                if rule:
                    correct_usage = NLPMatchResult.query.filter(
                        NLPMatchResult.matched_rule_id == rule.id,
                        NLPMatchResult.is_manual_correction,
                    ).count()
                    total_usage = NLPMatchResult.query.filter(
                        NLPMatchResult.matched_rule_id == rule.id
                    ).count()
                    if total_usage > 0:
                        rule.accuracy_rate = correct_usage / total_usage
                    rule.usage_count = NLPRuleUsage.query.filter(
                        NLPRuleUsage.rule_id == rule.id
                    ).count()

            with db_session_scope(detach=False):
                pass

            new_correct_count = sum(1 for r in match_results if not r.is_manual_correction)
            accuracy_after = new_correct_count / total_count if total_count > 0 else 0.0

            precision = self._calculate_precision(match_results)
            recall = self._calculate_recall(match_results)
            f1_score = self._calculate_f1(precision, recall)

            training_data_size = total_count
            accuracy = round(accuracy_after, 4)
            f1 = round(f1_score, 4)
        else:
            # P2-2 修复: 无训练数据不再伪造 accuracy=0.85，指标归零并标记 untrained
            training_data_size = 0
            accuracy = 0.0
            f1 = 0.0

        # 此前直接改 training_record 字段（对象已 detached）→ DB 永远停留 running。
        # 必须重新查询记录再更新才能落库。
        with db_session_scope(detach=False):
            rec = db.session.get(NLPModelTraining, training_id)
            if rec is not None:
                rec.training_data_size = training_data_size
                rec.accuracy = accuracy
                rec.f1_score = f1
                rec.status = "completed" if training_data_size > 0 else "untrained"
                rec.trained_at = datetime.now()
            else:
                # 记录异常消失（不应发生）：仅返回内存数据，不静默
                rec = training_record

        return self._training_to_dict(rec)

    def get_training_history(self, page=1, per_page=10):
        """获取模型训练历史"""
        query = NLPModelTraining.query.order_by(NLPModelTraining.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            "items": [self._training_to_dict(record) for record in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
        }

    def batch_import_rules(self, rules_data):
        """批量导入规则"""
        imported_count = 0
        skipped_count = 0

        with db_session_scope(detach=False):
            for rule_data in rules_data:
                existing_rule = NLPScoringRule.query.filter(
                    NLPScoringRule.behavior_keyword == rule_data["behavior_keyword"],
                ).first()

                if existing_rule:
                    skipped_count += 1
                    continue

                rule = NLPScoringRule(
                    behavior_keyword=rule_data["behavior_keyword"],
                    behavior_description=rule_data.get("behavior_description", ""),
                    score_value=rule_data["score_value"],
                    score_type=rule_data["score_type"],
                    behavior_tags=rule_data.get("behavior_tags", []),
                    match_pattern=rule_data.get("match_pattern", ""),
                    priority=rule_data.get("priority", 0),
                    is_active=True,
                    usage_count=rule_data.get("usage_count", 0),
                    accuracy_rate=rule_data.get("accuracy_rate", 0.0),
                )

                db.session.add(rule)
                imported_count += 1

        return {
            "success": True,
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "message": f"成功导入 {imported_count} 条规则，跳过 {skipped_count} 条重复规则",
        }

    def _update_keyword(self, keyword, score_type, default_score):
        """更新关键词表"""
        with db_session_scope(detach=False):
            existing_keyword = NLPBehaviorKeyword.query.filter_by(keyword=keyword).first()

            if existing_keyword:
                if score_type:
                    existing_keyword.score_type = score_type
                if default_score:
                    existing_keyword.default_score = default_score
                existing_keyword.updated_at = datetime.now()
            else:
                keyword_type = "positive" if score_type == "add" else "negative"
                new_keyword = NLPBehaviorKeyword(
                    keyword=keyword,
                    keyword_type=keyword_type,
                    score_type=score_type,
                    default_score=default_score,
                    synonyms=self._find_synonyms(keyword),
                )

                db.session.add(new_keyword)

    def _find_synonyms(self, keyword):
        """查找同义词（简化实现）"""
        synonym_map = {
            "睡觉": ["打瞌睡", "打盹", "睡懒觉", "趴着睡"],
            "迟到": ["晚到", "迟到了"],
            "早退": ["提前走", "早走"],
            "积极": ["主动", "踊跃"],
            "优秀": ["出色", "杰出", "良好"],
            "认真": ["仔细", "用心", "专注"],
            "努力": ["勤奋", "刻苦"],
            "回答": ["发言", "提问", "回答问题"],
        }
        return synonym_map.get(keyword, [])

    def _calculate_precision(self, match_results):
        """计算精确率"""
        true_positive = sum(
            1 for r in match_results if not r.is_manual_correction and r.intent != "unknown"
        )
        false_positive = sum(
            1 for r in match_results if r.is_manual_correction and r.intent != "unknown"
        )
        return (
            true_positive / (true_positive + false_positive)
            if (true_positive + false_positive) > 0
            else 0.0
        )

    def _calculate_recall(self, match_results):
        """计算召回率"""
        true_positive = sum(
            1 for r in match_results if not r.is_manual_correction and r.intent != "unknown"
        )
        false_negative = sum(
            1 for r in match_results if r.is_manual_correction and r.intent == "unknown"
        )
        return (
            true_positive / (true_positive + false_negative)
            if (true_positive + false_negative) > 0
            else 0.0
        )

    def _calculate_f1(self, precision, recall):
        """计算F1分数"""
        return 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

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
