"""模型训练与评分助手：训练/历史 + 关键词更新/同义词/精确率/召回率/F1。"""

from datetime import datetime

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
from utils.db_session import db_session_scope


class _TrainingMixin:
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
            # R30: 循环内逐条 get_by_id(rule) + 3 个 .count()（约 3U+ 查）批处理为
            # 单次 rule_ids IN 预取 + 两条 group_by 条件聚合（match 的 total/correct、
            # usage 计数），查询数恒为 3 与 U（usage 数）无关。
            # 改为遍历「唯一 rule_id」设置 accuracy_rate/usage_count，与原多写同值幂等
            # （同一 rule 被多条 usage 引用时原逻辑也反复写相同值）。
            rule_ids = {u.rule_id for u in usage_records if u.rule_id is not None}
            if rule_ids:
                rules_by_id = {
                    r.id: r
                    for r in NLPScoringRule.query.filter(
                        NLPScoringRule.id.in_(rule_ids)
                    ).all()
                }
                match_stats = (
                    db.session.query(
                        NLPMatchResult.matched_rule_id,
                        func.count(NLPMatchResult.id).label("total"),
                        func.count(
                            case((NLPMatchResult.is_manual_correction, NLPMatchResult.id))
                        ).label("correct"),
                    )
                    .filter(NLPMatchResult.matched_rule_id.in_(rule_ids))
                    .group_by(NLPMatchResult.matched_rule_id)
                    .all()
                )
                match_by_rule = {
                    m.matched_rule_id: (m.total or 0, m.correct or 0) for m in match_stats
                }
                usage_stats = (
                    db.session.query(
                        NLPRuleUsage.rule_id,
                        func.count(NLPRuleUsage.id).label("cnt"),
                    )
                    .filter(NLPRuleUsage.rule_id.in_(rule_ids))
                    .group_by(NLPRuleUsage.rule_id)
                    .all()
                )
                usage_by_rule = {u.rule_id: u.cnt or 0 for u in usage_stats}

                for rule_id in rule_ids:
                    rule = rules_by_id.get(rule_id)
                    if rule is None:
                        continue
                    total_usage, correct_usage = match_by_rule.get(rule_id, (0, 0))
                    if total_usage > 0:
                        rule.accuracy_rate = correct_usage / total_usage
                    rule.usage_count = usage_by_rule.get(rule_id, 0)
            else:
                rules_by_id = {}

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
        query = NLPModelTraining.query.order_by(NLPModelTraining.created_at.desc(), NLPModelTraining.id.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            "items": [self._training_to_dict(record) for record in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
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
