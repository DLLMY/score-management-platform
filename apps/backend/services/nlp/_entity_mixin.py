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


class _EntityMixin:
    """NLP 解析服务按领域拆分出的 mixin（组合进 EnhancedNLPParserService，行为不变）。"""
    def extract_name(self, text):
        text = text.strip()

        user_names = self._get_user_names()
        name_to_id = self._get_name_to_id()
        behavior_kw_list = [
            kw["keyword"] for kw in self._get_behavior_keywords() if isinstance(kw, dict)
        ]

        result = self._match_exact_user_name(text, user_names, name_to_id, behavior_kw_list)
        if result is not None:
            return result

        result = self._match_name_by_pattern(text, name_to_id)
        if result is not None:
            return result

        result = self._match_name_by_length_fallback(text, name_to_id)
        return result if result is not None else (None, None)


    def _match_exact_user_name(self, text, user_names, name_to_id, behavior_kw_list):
        for name in sorted(user_names, key=len, reverse=True):
            if name in text:
                name_pos = text.index(name)
                if self._check_name_validity(text, name, name_pos, behavior_kw_list):
                    return name, name_to_id.get(name)
        return None


    def _check_name_validity(self, text, name, name_pos, behavior_kw_list):
        if name_pos > 0:
            for prefix in self.name_prefix_words:
                if text.startswith(prefix, max(0, name_pos - len(prefix)), name_pos):
                    return False
        if name_pos + len(name) >= len(text):
            return True
        for suffix in self.name_suffix_words:
            if text.startswith(suffix, name_pos + len(name)):
                return True
        remaining_text = text[name_pos + len(name):]
        for kw in behavior_kw_list:
            if remaining_text.startswith(kw):
                return True
        return text[name_pos + len(name)] in "，。！？、 "


    def _match_name_by_pattern(self, text, name_to_id):
        invalid_chars = (
            "同学上课昨天今天刚才为给对让是表现作业发言迟到早退旷课"
            "学生积极主动认真努力优秀良好出色进步按时准时及时提前"
            "把因为奖励惩罚批评表扬处罚"
        )
        for pattern in self.name_patterns:
            match = pattern.search(text)
            if match:
                name = match.group(1)
                if 2 <= len(name) <= 4:
                    if name not in self.invalid_names and not any(
                        char in invalid_chars for char in name
                    ):
                        if name in name_to_id:
                            return name, name_to_id[name]
                        return name, None
        return None


    def _match_name_by_length_fallback(self, text, name_to_id):
        behavior_kw_list = [
            kw["keyword"] if isinstance(kw, dict) else str(kw)
            for kw in self._get_behavior_keywords()
        ]
        for i in range(min(len(text), 4), 1, -1):
            if i <= len(text):
                candidate = text[:i]
                if candidate in self.invalid_names:
                    continue
                remaining = text[i:]
                for kw in behavior_kw_list:
                    if remaining.startswith(kw):
                        if candidate in name_to_id:
                            return candidate, name_to_id[candidate]
                        return candidate, None
        return None



    def extract_entities(self, text, name=None):
        if name:
            text_no_name = text.replace(name, "").replace(name + "同学", "")
        else:
            text_no_name = text

        entities = {
            "names": [],
            "times": [],
            "numbers": [],
            "scores": [],
            "dates": [],
            "behaviors": [],
        }

        self._extract_entity_names(text, entities)

        self._extract_entity_times(text, entities)

        self._extract_entity_numbers(text, entities)

        self._extract_entity_dates(text, entities)

        self._extract_entity_behaviors(text_no_name, entities)

        return entities



    def _extract_entity_names(self, text, entities):
        user_names = self._get_user_names()
        for user_name in user_names:
            if user_name in text:
                entities["names"].append(
                    {
                        "text": user_name,
                        "type": "student",
                        "start": text.index(user_name),
                        "end": text.index(user_name) + len(user_name),
                    }
                )


    def _extract_entity_times(self, text, entities):
        time_patterns = [
            (r"(\d+)分钟", "minutes"),
            (r"(\d+)小时", "hours"),
            (r"(\d+)秒", "seconds"),
            (r"(\d+)点(\d+)?分?", "time"),
            (r"(\d+)时(\d+)?分?", "time"),
            (r"迟到(\d+)分钟", "late_minutes"),
            (r"早退(\d+)分钟", "early_minutes"),
        ]
        for pattern, entity_type in time_patterns:
            for match in re.finditer(pattern, text):
                entities["times"].append(
                    {
                        "text": match.group(0),
                        "type": entity_type,
                        "value": int(match.group(1)),
                        "start": match.start(),
                        "end": match.end(),
                    }
                )


    def _extract_entity_numbers(self, text, entities):
        number_patterns = [
            (r"(\d+\.?\d*)分", "score"),
            (r"加(\d+\.?\d*)", "add_value"),
            (r"扣(\d+\.?\d*)", "deduct_value"),
            (r"(\d+\.?\d*)分", "points"),
            (r"(\d+)次", "count"),
            (r"(\d+)个", "quantity"),
            (r"(\d+)人", "people"),
        ]
        for pattern, entity_type in number_patterns:
            for match in re.finditer(pattern, text):
                try:
                    value = float(match.group(1))
                    entities["numbers"].append(
                        {
                            "text": match.group(0),
                            "type": entity_type,
                            "value": value,
                            "start": match.start(),
                            "end": match.end(),
                        }
                    )
                    if entity_type in [
                        "score",
                        "add_value",
                        "deduct_value",
                        "points",
                    ]:
                        entities["scores"].append(
                            {
                                "text": match.group(0),
                                "type": entity_type,
                                "value": value,
                                "start": match.start(),
                                "end": match.end(),
                            }
                        )
                except ValueError as e:
                    logging.getLogger(__name__).warning("实体抽取单条匹配异常，跳过: %s", e)


    def _extract_entity_dates(self, text, entities):
        date_patterns = [
            (r"今天", "today"),
            (r"昨天", "yesterday"),
            (r"前天", "day_before_yesterday"),
            (r"明天", "tomorrow"),
            (r"(\d+)月(\d+)日", "date"),
            (r"(\d+)月(\d+)号", "date"),
            (r"(\d{4})年(\d+)月(\d+)日", "full_date"),
        ]
        for pattern, entity_type in date_patterns:
            for match in re.finditer(pattern, text):
                date_value = None
                if entity_type == "today":
                    date_value = datetime.now().strftime("%Y-%m-%d")
                elif entity_type == "yesterday":
                    date_value = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                elif entity_type == "day_before_yesterday":
                    date_value = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
                elif entity_type == "tomorrow":
                    date_value = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                entities["dates"].append(
                    {
                        "text": match.group(0),
                        "type": entity_type,
                        "value": date_value,
                        "start": match.start(),
                        "end": match.end(),
                    }
                )


    def _extract_entity_behaviors(self, text_no_name, entities):
        behavior_keywords = self._get_behavior_keywords()
        for kw in behavior_keywords:
            if not isinstance(kw, dict):
                continue
            _kw_text = kw["keyword"]
            if _kw_text in text_no_name:
                entities["behaviors"].append(
                    {
                        "text": _kw_text,
                        "type": kw["keyword_type"],
                        "score_type": kw["score_type"],
                        "default_score": kw["default_score"],
                        "start": text_no_name.index(_kw_text),
                        "end": text_no_name.index(_kw_text) + len(_kw_text),
                    }
                )


    def extract_behavior(self, text, name=None):
        text = text.strip()

        if name:
            text_no_name = text.replace(name, "").replace(name + "同学", "")
        else:
            text_no_name = text

        behavior_keywords = self._get_behavior_keywords()
        matched_keywords = []
        matched_patterns = []

        expanded_texts = self._expand_synonyms(text_no_name)

        self._match_behavior_patterns(text_no_name, expanded_texts, behavior_keywords, matched_patterns, matched_keywords)

        self._match_behavior_keywords(text_no_name, expanded_texts, behavior_keywords, matched_keywords)

        if self.jieba_initialized:
            self._match_behavior_jieba(text_no_name, behavior_keywords, matched_keywords)

        positive_count, negative_count = self._count_behavior_sentiment(text_no_name)

        return {
            "keywords": matched_keywords,
            "patterns": matched_patterns,
            "positive_count": positive_count,
            "negative_count": negative_count,
            "text": text_no_name.strip(),
            "expanded_texts": expanded_texts,
        }



    def _match_behavior_patterns(self, text_no_name, expanded_texts, behavior_keywords, matched_patterns, matched_keywords):
        for pattern_name, patterns in self.behavior_patterns.items():
            for pattern in patterns:
                for expanded_text in expanded_texts:
                    match = re.search(pattern, expanded_text)
                    if match:
                        matched_patterns.append((pattern_name, match.group(0)))
                        kw = next(
                            (
                                k
                                for k in behavior_keywords
                                if isinstance(k, dict) and k["keyword"] == pattern_name
                            ),
                            None,
                        )
                        if kw:
                            matched_keywords.append(
                                (
                                    kw["keyword"],
                                    kw["keyword_type"],
                                    kw["score_type"],
                                    kw["default_score"],
                                )
                            )
                        break


    def _match_behavior_keywords(self, text_no_name, expanded_texts, behavior_keywords, matched_keywords):
        for kw in behavior_keywords:
            if not isinstance(kw, dict):
                continue
            for expanded_text in expanded_texts:
                if kw["keyword"] in expanded_text:
                    if kw["keyword"] not in [k[0] for k in matched_keywords]:
                        matched_keywords.append(
                            (
                                kw["keyword"],
                                kw["keyword_type"],
                                kw["score_type"],
                                kw["default_score"],
                            )
                        )
                    for synonym in kw["synonyms"]:
                        if synonym in expanded_text and synonym not in [
                            k[0] for k in matched_keywords
                        ]:
                            matched_keywords.append(
                                (
                                    synonym,
                                    kw["keyword_type"],
                                    kw["score_type"],
                                    kw["default_score"],
                                )
                            )


    def _match_behavior_jieba(self, text_no_name, behavior_keywords, matched_keywords):
        words = jieba.lcut(text_no_name)
        for word in words:
            if len(word) >= 2:
                kw = next(
                    (
                        k
                        for k in behavior_keywords
                        if isinstance(k, dict) and k["keyword"] == word
                    ),
                    None,
                )
                if kw and word not in [k[0] for k in matched_keywords]:
                    matched_keywords.append(
                        (
                            word,
                            kw["keyword_type"],
                            kw["score_type"],
                            kw["default_score"],
                        )
                    )
                for base_word, synonyms in self.synonym_expansion.items():
                    if word == base_word or word in synonyms:
                        kw = next(
                            (
                                k
                                for k in behavior_keywords
                                if isinstance(k, dict) and k["keyword"] == base_word
                            ),
                            None,
                        )
                        if kw and base_word not in [k[0] for k in matched_keywords]:
                            matched_keywords.append(
                                (
                                    base_word,
                                    kw["keyword_type"],
                                    kw["score_type"],
                                    kw["default_score"],
                                )
                            )
