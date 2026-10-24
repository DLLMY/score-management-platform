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


class _IntentMixin:
    """NLP 解析服务按领域拆分出的 mixin（组合进 EnhancedNLPParserService，行为不变）。"""
    def determine_intent(self, text, behavior_result):
        text_lower = text.lower()
        rule_hits = self._collect_intent_rule_hits(text_lower)
        if self._is_query_intent(text_lower, rule_hits):
            return "query"
        if "reset" in rule_hits:
            return "reset"
        resolved = self._resolve_add_deduct_intent(rule_hits, behavior_result)
        if resolved is not None:
            return resolved
        return self._resolve_intent_from_keywords_sentiment(behavior_result)


    def _collect_intent_rule_hits(self, text_lower):
        _NEG_PREFIXES = ("不要", "别", "请勿", "禁止", "不想", "别给", "别扣", "别加")
        rule_hits = {}
        for intent, keywords in self.intent_keywords.items():
            for kw in keywords:
                kw_pos = text_lower.find(kw)
                if kw_pos == -1:
                    continue
                prefix_ctx = text_lower[max(0, kw_pos - 5) : kw_pos]
                if any(prefix_ctx.endswith(neg) for neg in _NEG_PREFIXES):
                    continue
                if intent not in rule_hits:
                    rule_hits[intent] = (kw, kw_pos)
        return rule_hits


    def _is_query_intent(self, text_lower, rule_hits):
        _QUERY_MARKERS = ("?", "？", "多少", "怎么", "如何", "吗", "查询", "查看", "几分")
        _SCORING_HINTS = ("加", "扣", "分", "积分", "成绩", "得分", "点")
        is_query_question = any(m in text_lower for m in _QUERY_MARKERS)
        involves_scoring = any(h in text_lower for h in _SCORING_HINTS)
        return is_query_question and ("query" in rule_hits or involves_scoring)


    def _resolve_add_deduct_intent(self, rule_hits, behavior_result):
        if "add" not in rule_hits and "deduct" not in rule_hits:
            return None
        if "add" in rule_hits and "deduct" in rule_hits:
            keywords = behavior_result.get("keywords")
            if keywords:
                for kw in keywords:
                    if kw[2] == "deduct":
                        return "deduct"
                    if kw[2] == "add":
                        return "add"
            positive_count = behavior_result.get("positive_count", 0)
            negative_count = behavior_result.get("negative_count", 0)
            if negative_count > positive_count:
                return "deduct"
            if positive_count > negative_count:
                return "add"
            return "add"
        return "add" if "add" in rule_hits else "deduct"


    def _resolve_intent_from_keywords_sentiment(self, behavior_result):
        keywords = behavior_result.get("keywords")
        if keywords:
            for kw in keywords:
                if kw[2] == "deduct":
                    return "deduct"
                if kw[2] == "add":
                    return "add"
        positive_count = behavior_result.get("positive_count", 0)
        negative_count = behavior_result.get("negative_count", 0)
        if negative_count > positive_count:
            return "deduct"
        if positive_count > negative_count:
            return "add"
        return "unknown"



    def semantic_match(self, text, intent):
        if self.vectorizer is None:
            return []

        rules = NLPScoringRule.query.filter(
            NLPScoringRule.score_type == intent, NLPScoringRule.is_active
        ).all()

        if not rules:
            return []

        rule_texts, rule_ids = self._build_rule_texts(rules)

        X_rules = self.vectorizer.transform(rule_texts)

        expanded_texts = self._expand_synonyms(text)
        best_similarities = []

        for expanded_text in expanded_texts:
            X_text = self.vectorizer.transform([expanded_text])
            similarities = cosine_similarity(X_text, X_rules)[0]
            best_similarities.append(similarities)

        if best_similarities:
            final_similarities = np.max(best_similarities, axis=0)
        else:
            X_text = self.vectorizer.transform([text])
            final_similarities = cosine_similarity(X_text, X_rules)[0]

        matched_rules = self._collect_matched_rules(final_similarities, rule_ids, text)

        matched_rules.sort(key=lambda x: x[1], reverse=True)

        return matched_rules[:5]


    @staticmethod
    def _build_rule_texts(rules):
        rule_texts = []
        rule_ids = []

        for rule in rules:
            texts = []
            if rule.behavior_keyword:
                texts.append(rule.behavior_keyword)
            if rule.behavior_description:
                texts.append(rule.behavior_description)
            if rule.match_pattern:
                texts.append(rule.match_pattern)
            if rule.behavior_tags:
                texts.extend(rule.behavior_tags)
            rule_texts.append(" ".join(texts))
            rule_ids.append(rule.id)

        return rule_texts, rule_ids


    def _collect_matched_rules(self, final_similarities, rule_ids, text):
        matched_rules = []

        for i, similarity in enumerate(final_similarities):
            if similarity > 0.15:
                rule = get_by_id(NLPScoringRule, rule_ids[i])
                if rule and not self._has_antonym_conflict(text, rule):
                    matched_rules.append((rule, similarity))

        return matched_rules


    def _get_bert_service_safe(self):
        """获取可用的 BERT 服务；不可用/未初始化/异常一律返回 None（绝不抛出）。

        延迟 import + 函数内取单例，便于测试注入替身（patch
        services.bert_service.get_bert_service 即可）。
        """
        try:
            from services.bert_service import get_bert_service

            service = get_bert_service()
        except Exception:
            logging.getLogger(__name__).warning(
                "NLP best-effort operation failed; exception previously swallowed silently",
                exc_info=True,
            )
            return None
        try:
            if service is None or not service.is_available():
                return None
        except Exception:
            logging.getLogger(__name__).warning(
                "NLP best-effort operation failed; exception previously swallowed silently",
                exc_info=True,
            )
            return None
        return service


    def _bert_rule_vectors(self, service, rule_texts):
        """规则文本向量（按规则文本签名缓存，规则变更少，避免每次请求都过 BERT）。"""
        signature = "|".join(rule_texts)
        cache = self._bert_rule_embeddings
        if cache["signature"] == signature and len(cache["vectors"]) == len(rule_texts):
            return cache["vectors"]
        try:
            vectors = service.batch_get_embeddings(rule_texts)
        except Exception:
            logging.getLogger(__name__).warning(
                "NLP best-effort operation failed; exception previously swallowed silently",
                exc_info=True,
            )
            vectors = [None] * len(rule_texts)
        self._bert_rule_embeddings = {"signature": signature, "vectors": vectors}
        return vectors


    def _bert_query_vector(self, service, text):
        """查询文本向量（按文本缓存并限容；超限整体清空，避免维护 LRU 的复杂度）。"""
        cached = self._bert_text_cache.get(text)
        if cached is not None or text in self._bert_text_cache:
            return cached
        try:
            vector = service.get_embedding(text)
        except Exception:
            logging.getLogger(__name__).warning(
                "NLP best-effort operation failed; exception previously swallowed silently",
                exc_info=True,
            )
            vector = None
        if len(self._bert_text_cache) >= self._bert_text_cache_max_size:
            self._bert_text_cache.clear()
        self._bert_text_cache[text] = vector
        return vector


    def _compute_bert_similarities(self, text, rule_texts):
        """计算输入文本与各规则文本的 BERT 余弦相似度（0~1）。

        设计要点：
        - **降级安全**：BERT 不可用、向量缺失或形状不符 → 返回全 0，
          与接入前 `np.zeros` 的行为完全一致，不会引入新的失败模式。
        - **候选内相对归一**：余弦先取 `max(cos, 0)`，再除以候选集合中的最大值
          （与同一函数里 BM25 的 `s / max_bm25` 处理保持一致）。这样 BERT 表达的是
          "候选之间的相对语义贴近度"，避免中文句向量绝对余弦普遍偏高（0.5~0.7）
          导致几乎所有规则都被推过 0.15 门槛、丧失区分度。
        """
        count = len(rule_texts)
        if count == 0:
            return np.zeros(0)

        service = self._get_bert_service_safe()
        if service is None:
            return np.zeros(count)

        rule_vectors = self._bert_rule_vectors(service, rule_texts)
        query_vector = self._bert_query_vector(service, text)
        if query_vector is None:
            return np.zeros(count)

        query_norm = float(np.linalg.norm(query_vector))
        if query_norm <= 0:
            return np.zeros(count)

        similarities = []
        has_valid = False
        for vector in rule_vectors:
            if vector is None or getattr(vector, "shape", None) != query_vector.shape:
                similarities.append(0.0)
                continue
            rule_norm = float(np.linalg.norm(vector))
            if rule_norm <= 0:
                similarities.append(0.0)
                continue
            cosine = float(np.dot(vector, query_vector) / (rule_norm * query_norm))
            similarities.append(max(cosine, 0.0))
            has_valid = True

        if not has_valid:
            return np.zeros(count)

        max_similarity = max(similarities)
        if max_similarity <= 0:
            return np.zeros(count)

        return np.array([s / max_similarity for s in similarities], dtype=float)


    def deep_semantic_match(self, text, intent, top_n=5):
        rules = self._get_rules_by_intent(intent)
        if not rules:
            return []
        rule_texts = self._build_semantic_rule_texts(rules)
        bm25_index = self._build_bm25_index(rule_texts)
        tfidf_final = self._compute_tfidf_similarities(text, rule_texts)
        bm25_normalized = self._compute_bm25_normalized(text, rule_texts, bm25_index)
        bert_similarities = self._compute_bert_similarities(text, rule_texts)
        keyword_matches = self._compute_keyword_match_scores(text, rules)
        return self._combine_semantic_matches(
            text, rules, tfidf_final, bm25_normalized, bert_similarities, keyword_matches, top_n
        )


    def context_aware_match(self, text, intent, context_history=None):
        semantic_matches = self.deep_semantic_match(text, intent)

        if context_history:
            recent_intents = context_history.get("recent_intents", [])[-5:]
            recent_rules = context_history.get("recent_rules", [])[-5:]

            for i, (rule, similarity) in enumerate(semantic_matches):
                if rule.id in recent_rules:
                    semantic_matches[i] = (rule, similarity * 1.15)
                if rule.score_type in recent_intents:
                    semantic_matches[i] = (rule, similarity * 1.1)

            semantic_matches.sort(key=lambda x: x[1], reverse=True)

        return semantic_matches[:5]


    def multi_intent_detection(self, text, behavior_result):
        text_lower = text.lower()

        detected_intents = self._collect_intents_from_keywords(text_lower)
        self._add_behavior_result_intents(detected_intents, behavior_result)
        self._add_query_intent_to_set(detected_intents, text_lower)
        if not detected_intents:
            detected_intents.add("unknown")
        if "unknown" in detected_intents and len(detected_intents) > 1:
            detected_intents.remove("unknown")
        intent_confidences = self._compute_intent_confidences(detected_intents, behavior_result, text_lower)
        sorted_intents = sorted(intent_confidences.items(), key=lambda x: x[1], reverse=True)
        return [
            {
                "intent": intent,
                "confidence": round(confidence, 4),
            }
            for intent, confidence in sorted_intents
        ]



    def _build_semantic_rule_texts(self, rules):
        rule_texts = []
        for rule in rules:
            texts = []
            if rule.behavior_keyword:
                texts.append(rule.behavior_keyword)
            if rule.behavior_description:
                texts.append(rule.behavior_description)
            if rule.match_pattern:
                texts.append(rule.match_pattern)
            if rule.behavior_tags:
                texts.extend(rule.behavior_tags)
            rule_texts.append(" ".join(texts))
        return rule_texts


    def _compute_tfidf_similarities(self, text, rule_texts):
        tfidf_similarities = []
        if self.vectorizer is not None:
            X_rules = self.vectorizer.transform(rule_texts)
            expanded_texts = self._expand_synonyms(text)[:3]
            for expanded_text in expanded_texts:
                X_text = self.vectorizer.transform([expanded_text])
                similarities = cosine_similarity(X_text, X_rules)[0]
                tfidf_similarities.append(similarities)
            if tfidf_similarities:
                tfidf_final = np.max(tfidf_similarities, axis=0)
            else:
                X_text = self.vectorizer.transform([text])
                tfidf_final = cosine_similarity(X_text, X_rules)[0]
        else:
            tfidf_final = np.zeros(len(rule_texts))
        return tfidf_final


    def _compute_bm25_normalized(self, text, rule_texts, bm25_index):
        bm25_scores = []
        for i in range(len(rule_texts)):
            score = self._bm25_score(text, i, bm25_index)
            bm25_scores.append(score)
        max_bm25 = max(bm25_scores) if bm25_scores else 1.0
        if max_bm25 > 0:
            return [s / max_bm25 for s in bm25_scores]
        return bm25_scores


    def _compute_keyword_match_scores(self, text, rules):
        keyword_matches = []
        for _, rule in enumerate(rules):
            match_score = 0.0
            if rule.behavior_keyword:
                keywords = rule.behavior_keyword.split("|")
                for kw in keywords:
                    kw = kw.strip()
                    if kw in text:
                        match_score += 0.5
                    elif any(kw in t for t in self._expand_synonyms(text)):
                        match_score += 0.3
            if rule.behavior_tags:
                for tag in rule.behavior_tags:
                    if tag in text:
                        match_score += 0.1
            keyword_matches.append(min(match_score, 1.0))
        return keyword_matches


    def _combine_semantic_matches(self, text, rules, tfidf_final, bm25_normalized, bert_similarities, keyword_matches, top_n):
        combined_scores = []
        for i in range(len(rules)):
            combined = (
                0.2 * tfidf_final[i]
                + 0.2 * bm25_normalized[i]
                + 0.3 * bert_similarities[i]
                + 0.3 * keyword_matches[i]
            )
            combined_scores.append(combined)
        matched_rules = []
        for i, score in enumerate(combined_scores):
            if score > 0.15:
                rule = rules[i]
                if not self._has_antonym_conflict(text, rule):
                    matched_rules.append((rule, score))
        matched_rules.sort(key=lambda x: x[1], reverse=True)
        return matched_rules[:top_n]


    def _collect_intents_from_keywords(self, text_lower):
        _NEG_PREFIXES = ("不要", "别", "请勿", "禁止", "不想", "别给", "别扣", "别加")
        detected_intents = set()
        for intent, keywords in self.intent_keywords.items():
            for kw in keywords:
                kw_pos = text_lower.find(kw)
                if kw_pos == -1:
                    continue
                prefix_ctx = text_lower[max(0, kw_pos - 5) : kw_pos]
                if any(prefix_ctx.endswith(neg) for neg in _NEG_PREFIXES):
                    continue
                detected_intents.add(intent)
        return detected_intents


    def _add_behavior_result_intents(self, detected_intents, behavior_result):
        positive_count = behavior_result["positive_count"]
        negative_count = behavior_result["negative_count"]
        if positive_count > 0 and negative_count == 0:
            detected_intents.add("add")
        elif negative_count > 0 and positive_count == 0:
            detected_intents.add("deduct")
        elif positive_count > 0 and negative_count > 0:
            detected_intents.add("add")
            detected_intents.add("deduct")
        keywords = behavior_result["keywords"]
        for kw in keywords:
            detected_intents.add(kw[2])


    def _add_query_intent_to_set(self, detected_intents, text_lower):
        _QUERY_MARKERS = ("?", "？", "多少", "怎么", "如何", "吗", "查询", "查看", "几分")
        _SCORING_HINTS = ("加", "扣", "分", "积分", "成绩", "得分", "点")
        is_query_question = any(m in text_lower for m in _QUERY_MARKERS)
        involves_scoring = any(h in text_lower for h in _SCORING_HINTS)
        if is_query_question and involves_scoring:
            detected_intents.add("query")


    def _compute_intent_confidences(self, detected_intents, behavior_result, text_lower):
        positive_count = behavior_result["positive_count"]
        negative_count = behavior_result["negative_count"]
        _QUERY_MARKERS = ("?", "？", "多少", "怎么", "如何", "吗", "查询", "查看", "几分")
        _SCORING_HINTS = ("加", "扣", "分", "积分", "成绩", "得分", "点")
        is_query_question = any(m in text_lower for m in _QUERY_MARKERS)
        intent_confidences = {}
        for intent in detected_intents:
            if intent == "add":
                confidence = min(1.0, positive_count * 0.3 + 0.4)
            elif intent == "deduct":
                confidence = min(1.0, negative_count * 0.3 + 0.4)
            elif intent == "query":
                confidence = 0.85 if is_query_question else 0.7
            else:
                confidence = 0.7
            intent_confidences[intent] = confidence
        return intent_confidences


    def _get_ml_service(self):
        """T7: 懒加载 ML 训练服务，避免解析器初始化即导入 torch 重型链。

        仅在 ML 预测（ml_predict/ensemble_predict）被实际调用时才导入
        services.nlp_ml_service（其模块顶层 import torch），从而让 NLP 解析/
        评分热路径与启动预热均不加载 torch。
        """
        if self._ml_service is None:
            from services.nlp_ml_service import NLPMLTrainingService

            self._ml_service = NLPMLTrainingService()
        return self._ml_service


    def ml_predict(self, text):
        prediction = self._get_ml_service().predict(text)
        if prediction:
            rule = get_by_id(NLPScoringRule, prediction.get("rule_id"))
            if rule and rule.is_active:
                return rule, prediction["confidence"]
        return None, 0.0


    def ensemble_predict(self, text):
        prediction = self._get_ml_service().ensemble_predict(text)
        if prediction:
            rule = get_by_id(NLPScoringRule, prediction.get("rule_id"))
            if rule and rule.is_active:
                return (
                    rule,
                    prediction["confidence"],
                    prediction.get("ensemble_details", []),
                )
        return None, 0.0, []


    def soft_vote_confidence(self, predictions):
        if not predictions:
            return None, 0.0

        method_weights = {
            "keyword": 0.35,
            "semantic": 0.25,
            "ml": 0.2,
            "ensemble": 0.15,
            "dynamic_weighted": 0.15,
            "context": 0.1,
            "fallback": 0.05,
        }

        rule_scores = {}

        for rule, method, confidence in predictions:
            rule_id = rule.id if hasattr(rule, "id") else id(rule)

            if rule_id not in rule_scores:
                rule_scores[rule_id] = {
                    "rule": rule,
                    "total_score": 0.0,
                    "weight_sum": 0.0,
                    "methods": [],
                }

            weight = method_weights.get(method, 0.1)
            rule_scores[rule_id]["total_score"] += confidence * weight
            rule_scores[rule_id]["weight_sum"] += weight
            rule_scores[rule_id]["methods"].append(method)

        best_rule = None
        best_score = 0.0

        for _, data in rule_scores.items():
            if data["weight_sum"] > 0:
                normalized_score = data["total_score"] / data["weight_sum"]
                normalized_score *= 1 + len(data["methods"]) * 0.05

                if normalized_score > best_score:
                    best_score = normalized_score
                    best_rule = data["rule"]

        return best_rule, min(best_score, 1.0)
