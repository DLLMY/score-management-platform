import logging
import math
import os
import pickle
import re
import threading
from datetime import date, datetime, timedelta

import jieba
import numpy as np
from numpy import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split

from config.config_loader import config_loader
from models import (
    NLPBehaviorKeyword,
    NLPMatchResult,
    NLPRuleUsage,
    NLPScoringRule,
    User,
    db,
    get_by_id,
)
from services.nlp._shared import (
    _DEFAULT_INVALID_NAMES,
    _DEFAULT_NAME_PREFIX_WORDS,
    _DEFAULT_NEGATIVE_KEYWORDS,
    _DEFAULT_POSITIVE_KEYWORDS,
    _INTENT_TRAINING_SAMPLES,
    _coerce_dt,
)
from utils.logger import log_debug, log_warning


class _RuleMixin:
    """NLP 解析服务按领域拆分出的 mixin（组合进 EnhancedNLPParserService，行为不变）。"""
    def match_rule(self, text, intent, name=None):
        behavior_result = self.extract_behavior(text, name)
        matched_rules = self._collect_keyword_rule_matches(behavior_result, intent)

        semantic_matches = self.semantic_match(text, intent)
        self._append_semantic_matches(matched_rules, semantic_matches)

        ml_rule, ml_confidence = self.ml_predict(text)
        self._append_rule_if_new(matched_rules, ml_rule, "ml", ml_confidence)

        ensemble_rule, ensemble_confidence, ensemble_details = self.ensemble_predict(text)
        self._append_rule_if_new(matched_rules, ensemble_rule, "ensemble", ensemble_confidence)

        matched_rules.sort(key=lambda x: x[2], reverse=True)

        if not matched_rules and intent != "unknown":
            matched_rules.extend(self._build_fallback_matches(behavior_result, intent))

        return [(rule, score) for rule, method, score in matched_rules[:5]]


    def _collect_keyword_rule_matches(self, behavior_result, intent):
        matched_rules = []

        for kw, kw_type, _, _ in behavior_result["keywords"]:
            rules = (
                NLPScoringRule.query.filter(
                    NLPScoringRule.behavior_keyword.like(f"%{kw}%"),
                    NLPScoringRule.score_type == intent,
                    NLPScoringRule.is_active,
                )
                .order_by(
                    NLPScoringRule.priority.desc(),
                    NLPScoringRule.usage_count.desc(),
                )
                .all()
            )

            for rule in rules:
                if rule not in matched_rules:
                    keyword_score = 0.7 + len(kw) * 0.1
                    if kw_type == "strong":
                        keyword_score += 0.15
                    matched_rules.append((rule, "keyword", min(keyword_score, 0.95)))

        return matched_rules


    @staticmethod
    def _append_semantic_matches(matched_rules, semantic_matches):
        for rule, similarity in semantic_matches:
            if rule not in [r[0] for r in matched_rules]:
                matched_rules.append((rule, "semantic", similarity))


    @staticmethod
    def _append_rule_if_new(matched_rules, rule, method, score):
        if rule and rule not in [r[0] for r in matched_rules]:
            matched_rules.append((rule, method, score))


    def _build_fallback_matches(self, behavior_result, intent):
        matched_rules = []
        keywords = behavior_result["keywords"]
        if keywords:
            for kw, kw_type, kw_score_type, default_score in keywords:
                if kw_score_type == intent:
                    rule = NLPScoringRule(
                        behavior_keyword=kw,
                        behavior_description=f"{kw}行为",
                        score_value=default_score or (5 if intent == "add" else -5),
                        score_type=intent,
                        behavior_tags=[kw_type],
                        match_pattern=kw,
                        priority=0,
                    )
                    matched_rules.append((rule, "fallback", 0.5))
        return matched_rules


    def _check_corrections(self, text):
        text_lower = text.lower().strip()

        corrections = self._load_approved_corrections(text, text_lower)
        if not corrections:
            return None

        # 提取所有需要的属性，避免 DetachedInstanceError
        correction_data = self._extract_correction_data(corrections)
        correction_map = self._build_correction_map(correction_data)

        if not correction_map:
            return None

        base_result = self.parse_without_correction(text)

        self._apply_correction_map(base_result, correction_map)

        # 修复：原 `with db_session_scope(): pass` 空提交——finally 的 session.remove()
        # 既没提交上面的学习/修正状态修改（corr.status="learned" 等全部回滚），又销毁请求级
        # session。改为显式 commit 持久化修改。
        db.session.commit()

        self._trigger_inductive_learning([c["obj"] for c in correction_data])

        cache_key = text.lower().strip()
        if len(self._parse_cache) >= self._parse_cache_max_size:
            oldest_key = next(iter(self._parse_cache))
            del self._parse_cache[oldest_key]
        self._parse_cache[cache_key] = base_result

        return base_result


    def _load_approved_corrections(self, text, text_lower):
        """按原文精确 / 小写两种形式依次查询已确认纠错；异常降级为空列表。"""
        from models import NLPCorrection

        try:
            corrections = (
                NLPCorrection.query.filter(
                    NLPCorrection.original_text == text,
                    NLPCorrection.status == "approved",
                )
                .order_by(NLPCorrection.learn_count.desc())
                .all()
            )

            if not corrections:
                corrections = (
                    NLPCorrection.query.filter(
                        NLPCorrection.original_text == text_lower,
                        NLPCorrection.status == "approved",
                    )
                    .order_by(NLPCorrection.learn_count.desc())
                    .all()
                )
            return corrections
        except Exception:
            logging.getLogger(__name__).warning(
                "NLP best-effort operation failed; exception previously swallowed silently",
                exc_info=True,
            )
            return []


    @staticmethod
    def _extract_correction_data(corrections):
        """提取纠错记录属性快照，避免 DetachedInstanceError。"""
        correction_data = []
        for corr in corrections:
            correction_data.append(
                {
                    "field_type": corr.field_type,
                    "original_value": corr.original_value,
                    "corrected_value": corr.corrected_value,
                    "learn_count": corr.learn_count or 0,
                    "id": corr.id,
                    "obj": corr,
                }
            )
        return correction_data


    @staticmethod
    def _build_correction_map(correction_data):
        """按 field_type 取首条（列表已按 learn_count 降序，重复类型首条优先）。"""
        correction_map = {}
        for corr_data in correction_data:
            if corr_data["field_type"] not in correction_map:
                correction_map[corr_data["field_type"]] = corr_data
        return correction_map


    def _apply_correction_map(self, base_result, correction_map):
        """按 name / intent / score 应用纠正结果并累加学习计数。"""
        if "name" in correction_map:
            corr_data = correction_map["name"]
            name_to_id = self._get_name_to_id()
            base_result["extracted_name"] = corr_data["corrected_value"]
            base_result["user_id"] = name_to_id.get(corr_data["corrected_value"])
            corr_data["obj"].learn_count = corr_data["learn_count"] + 1
            corr_data["obj"].last_learned_at = datetime.now()

        if "intent" in correction_map:
            corr_data = correction_map["intent"]
            base_result["intent"] = corr_data["corrected_value"]
            corr_data["obj"].learn_count = corr_data["learn_count"] + 1
            corr_data["obj"].last_learned_at = datetime.now()

        if "score" in correction_map:
            corr_data = correction_map["score"]
            base_result["score"] = float(corr_data["corrected_value"])
            corr_data["obj"].learn_count = corr_data["learn_count"] + 1
            corr_data["obj"].last_learned_at = datetime.now()


    def parse_without_correction(self, text):
        name, user_id = self.extract_name(text)
        behavior_result = self.extract_behavior(text, name)
        entities = self.extract_entities(text, name)
        primary_intent = self.determine_intent(text, behavior_result)
        all_intents = self.multi_intent_detection(text, behavior_result)

        matched_rules = self._assemble_matched_rules(behavior_result, primary_intent, all_intents)

        result = {
            "success": True,
            "input_text": text,
            "extracted_name": name,
            "user_id": user_id,
            "behavior": behavior_result["text"],
            "intent": primary_intent,
            "all_intents": all_intents,
            "confidence": self._calculate_confidence(
                behavior_result, primary_intent, matched_rules
            ),
            "matched_rules": [],
            "suggestions": [],
            "matched_patterns": behavior_result["patterns"],
            "positive_count": behavior_result["positive_count"],
            "negative_count": behavior_result["negative_count"],
            "expanded_texts_count": len(behavior_result.get("expanded_texts", [])),
            "context_used": False,
            "entities": entities,
        }

        result["score"] = self._extract_parse_score(entities, primary_intent, matched_rules)
        self._populate_matched_rules(result, matched_rules)

        if primary_intent == "unknown" or not matched_rules:
            result["success"] = False
            result["suggestions"] = self._generate_suggestions(text, behavior_result)

        return result


    def _append_keyword_rule(
        self, keyword_rules, rule, kw, kw_type, base, multi, cap, behavior_text
    ):
        position_weight = self._get_position_weight(behavior_text, kw)
        importance_weight = self._get_keyword_importance(kw_type)
        keyword_score = base + len(kw) * multi
        keyword_score *= position_weight
        keyword_score *= importance_weight
        if kw_type == "strong":
            keyword_score += 0.05
        keyword_rules.append((rule, "keyword", min(keyword_score, cap)))


    def _is_exact_keyword_match(self, rule, kw, behavior_text):
        return (
            kw == rule.behavior_keyword
            or rule.behavior_description and kw in rule.behavior_description
            or rule.behavior_keyword in behavior_text
        )


    def _is_fallback_keyword_match(self, rule, kw, behavior_text):
        return kw in rule.behavior_keyword or rule.behavior_keyword in behavior_text


    def _collect_fallback_keyword_rules(
        self, intent, behavior_result, behavior_text, rules_cache, keyword_rules
    ):
        if keyword_rules:
            return keyword_rules
        for kw, kw_type, kw_score_type, _ in behavior_result["keywords"]:
            if kw_score_type != intent:
                continue
            for rule in rules_cache:
                if rule in [r[0] for r in keyword_rules]:
                    continue
                if self._is_fallback_keyword_match(rule, kw, behavior_text):
                    self._append_keyword_rule(
                        keyword_rules, rule, kw, kw_type, 0.55, 0.05, 0.85, behavior_text
                    )
        return keyword_rules


    def _collect_intent_keyword_rules(self, intent, behavior_result, behavior_text):
        keyword_rules = []
        rules_cache = self._get_rules_by_intent(intent)
        rules_cache = self._sort_rules_by_dynamic_priority(rules_cache)
        for kw, kw_type, kw_score_type, _ in behavior_result["keywords"]:
            if kw_score_type != intent:
                continue
            for rule in rules_cache:
                if rule in [r[0] for r in keyword_rules]:
                    continue
                if self._is_exact_keyword_match(rule, kw, behavior_text):
                    self._append_keyword_rule(
                        keyword_rules, rule, kw, kw_type, 0.85, 0.03, 0.98, behavior_text
                    )
                elif kw in rule.behavior_keyword:
                    self._append_keyword_rule(
                        keyword_rules, rule, kw, kw_type, 0.65, 0.05, 0.90, behavior_text
                    )
        return self._collect_fallback_keyword_rules(
            intent, behavior_result, behavior_text, rules_cache, keyword_rules
        )


    def _build_fallback_rules(self, primary_intent, behavior_result):
        if primary_intent == "unknown":
            return []
        keywords = behavior_result["keywords"]
        if not keywords:
            return []
        fallback = []
        for kw, kw_type, kw_score_type, default_score in keywords:
            if kw_score_type == primary_intent:
                rule = NLPScoringRule(
                    behavior_keyword=kw,
                    behavior_description=f"{kw}行为",
                    score_value=default_score or (5 if primary_intent == "add" else -5),
                    score_type=primary_intent,
                    behavior_tags=[kw_type],
                    match_pattern=kw,
                    priority=0,
                )
                fallback.append((rule, "fallback", 0.5))
        return fallback


    def _assemble_matched_rules(self, behavior_result, primary_intent, all_intents):
        matched_rules = []
        behavior_text = behavior_result["text"]
        for intent_info in all_intents[:2]:
            intent = intent_info["intent"]
            if intent == "unknown":
                continue
            keyword_rules = self._collect_intent_keyword_rules(
                intent, behavior_result, behavior_text
            )
            matched_rules.extend(keyword_rules)
        matched_rules.sort(key=lambda x: x[2], reverse=True)
        best_rule, best_confidence = self.soft_vote_confidence(matched_rules)
        if not matched_rules:
            matched_rules.extend(self._build_fallback_rules(primary_intent, behavior_result))
        if best_rule and best_rule not in [r[0] for r in matched_rules]:
            matched_rules.insert(0, (best_rule, "soft_vote", best_confidence))
        return matched_rules


    def _extract_parse_score(self, entities, primary_intent, matched_rules):
        extracted_scores = entities.get("scores", [])
        if extracted_scores:
            add_scores = [
                s["value"] for s in extracted_scores if s["type"] in ("add_value", "deduct_value")
            ]
            if add_scores:
                return add_scores[0] if primary_intent == "add" else -add_scores[0]
            first_score = extracted_scores[0]["value"]
            return first_score if primary_intent == "add" else -first_score
        if matched_rules:
            return matched_rules[0][0].score_value or 0
        return 0


    def _populate_matched_rules(self, result, matched_rules):
        for rule, method, confidence in matched_rules[:5]:
            result["matched_rules"].append(
                {
                    "rule_id": rule.id if hasattr(rule, "id") else None,
                    "behavior_keyword": rule.behavior_keyword,
                    "behavior_description": rule.behavior_description,
                    "score_value": rule.score_value,
                    "score_type": rule.score_type,
                    "behavior_tags": rule.behavior_tags,
                    "match_pattern": rule.match_pattern,
                    "priority": rule.priority,
                    "usage_count": (rule.usage_count if hasattr(rule, "usage_count") else 0),
                    "accuracy_rate": (
                        rule.accuracy_rate if hasattr(rule, "accuracy_rate") else 0.0
                    ),
                    "match_confidence": round(confidence, 2),
                    "match_method": method,
                }
            )



    def _trigger_inductive_learning(self, corrections):
        LEARN_THRESHOLD = 3

        for corr in corrections:
            if corr.learn_count >= LEARN_THRESHOLD and corr.status == "approved":
                if corr.field_type == "name":
                    self._learn_name_pattern(corr)

                elif corr.field_type == "intent":
                    self._learn_intent_keywords(corr)

                elif corr.field_type == "score":
                    pass

                corr.status = "learned"
                corr.verified_at = datetime.now()

        # 修复：同 2417 行——原空 scope 既不提交又销毁请求级 session，改为显式 commit
        db.session.commit()


    def _learn_name_pattern(self, corr):
        """从姓名纠错推导「前缀 + 2 个汉字」的人名模式并登记到匹配表。"""
        if corr.original_value and corr.original_value not in self.invalid_names:
            self.invalid_names.add(corr.original_value)

        text = corr.original_text
        corrected_name = corr.corrected_value
        original_name = corr.original_value
        if not (corrected_name and original_name):
            return

        original_pos = text.find(original_name)
        corrected_pos = text.find(corrected_name)
        if not (original_pos != -1 and corrected_pos != -1 and original_pos < corrected_pos):
            return

        prefix = text[:original_pos]
        if len(prefix) < 2:
            return

        prefix_pattern = re.escape(prefix) + r"[\u4e00-\u9fa5]{2}"
        self._register_name_pattern(prefix_pattern, len(prefix))


    def _register_name_pattern(self, prefix_pattern, prefix_len):
        """模式不存在且前缀不超过 8 字时，插入到匹配表第 2 位。"""
        for pattern in self.name_patterns:
            if prefix_pattern in pattern.pattern:
                return

        if prefix_len <= 8:
            new_pattern = re.compile(prefix_pattern + r"(?:的)?")
            self.name_patterns.insert(1, new_pattern)


    def _learn_intent_keywords(self, corr):
        """从意图纠错补充「XX的」形式的动词关键词。"""
        if corr.corrected_value not in self.intent_keywords:
            return

        text = corr.original_text
        verbs = re.findall(r"([\u4e00-\u9fa5]{2})的", text)
        for verb in verbs:
            if verb not in self.intent_keywords[corr.corrected_value]:
                self.intent_keywords[corr.corrected_value].append(verb)
