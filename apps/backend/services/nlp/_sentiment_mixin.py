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


class _SentimentMixin:
    """NLP 解析服务按领域拆分出的 mixin（组合进 EnhancedNLPParserService，行为不变）。"""
    def _analyze_sentiment(self, text):
        # #2 深化：在原有词频加权基础上加入「否定翻转」与「程度副词加权」，
        # 使"不认真 / 没有迟到 / 非常优秀 / 很差"等语义被正确识别。
        # 仅做纯增量增强：不改变方法签名，返回区间仍为 [-1, 1]，零契约风险。
        # 否定词仅当紧贴关键词左侧窗口末端时才翻转极性（endswith 判定），
        # 避免"不断进步"类文本被误判为否定。
        _DEGREE_WEIGHTS = {
            "非常": 1.5,
            "十分": 1.5,
            "极其": 1.8,
            "极为": 1.8,
            "特别": 1.4,
            "很": 1.3,
            "挺": 1.2,
            "比较": 1.2,
            "较": 1.2,
            "格外": 1.5,
            "太": 1.3,
            "超级": 2.0,
            "超": 1.6,
            "有点": 0.8,
            "稍微": 0.8,
            "略微": 0.8,
            "不太": 0.6,
            "不够": 0.7,
        }
        _NEG_WORDS = (
            "不",
            "没",
            "没有",
            "无",
            "未",
            "别",
            "莫",
            "非",
            "不是",
            "并不",
            "不太",
            "不够",
        )
        _CTX = 3  # 关键词左侧上下文窗口长度（字符）

        positive_score = 0.0
        negative_score = 0.0
        positive_score, negative_score = self._accumulate_keyword_scores(
            text,
            self.positive_keywords,
            _DEGREE_WEIGHTS,
            _NEG_WORDS,
            _CTX,
            positive_score,
            negative_score,
            True,
        )
        positive_score, negative_score = self._accumulate_keyword_scores(
            text,
            self.negative_keywords,
            _DEGREE_WEIGHTS,
            _NEG_WORDS,
            _CTX,
            positive_score,
            negative_score,
            False,
        )

        total_score = positive_score + negative_score

        if total_score == 0:
            return 0.0

        return (positive_score - negative_score) / total_score


    @staticmethod
    def _occurrence_weights(word, text, degree_weights, neg_words, ctx):
        # 返回每个命中词的局部权重（含程度副词加权 / 否定翻转）
        results = []
        for m in re.finditer(re.escape(word), text):
            left = text[max(0, m.start() - ctx) : m.start()]
            deg = 1.0
            for _d, _w in degree_weights.items():
                if left.endswith(_d):
                    deg = max(deg, _w)
            negated = any(left.endswith(_n) for _n in neg_words)
            base = len(word) * 0.5
            results.append(base * deg * (-1 if negated else 1))
        return results


    def _accumulate_keyword_scores(
        self,
        text,
        keywords,
        degree_weights,
        neg_words,
        ctx,
        positive_score,
        negative_score,
        to_positive,
    ):
        # 原位累加（保持与原实现的浮点累加顺序完全一致）。
        for word in keywords:
            if word in text:
                for v in self._occurrence_weights(word, text, degree_weights, neg_words, ctx):
                    if v >= 0:
                        if to_positive:
                            positive_score += v
                        else:
                            negative_score += v
                    else:
                        if to_positive:
                            negative_score += -v
                        else:
                            positive_score += -v
        return positive_score, negative_score



    def _count_behavior_sentiment(self, text_no_name):
        positive_count = 0
        negative_count = 0
        if self.jieba_initialized:
            words = jieba.lcut(text_no_name)
            for word in words:
                if word in self.positive_keywords:
                    positive_count += 1
                if word in self.negative_keywords:
                    negative_count += 1
        else:
            for kw in self.positive_keywords:
                if kw in text_no_name:
                    positive_count += 1
            for kw in self.negative_keywords:
                if kw in text_no_name:
                    negative_count += 1
        return positive_count, negative_count


    def _has_antonym_conflict(self, text, rule):
        rule_text = ""
        if rule.behavior_keyword:
            rule_text += rule.behavior_keyword + " "
        if rule.behavior_description:
            rule_text += rule.behavior_description + " "
        if rule.match_pattern:
            rule_text += rule.match_pattern

        for negative_word, antonyms in self.antonym_pairs.items():
            if negative_word in rule_text:
                for antonym in antonyms:
                    if antonym in text:
                        return True
        return False


    def analyze_sentiment(self, text):
        words = jieba.lcut(text) if self.jieba_initialized else [text]

        # positive_count / negative_count 保持原始词频统计语义（前端透出原始命中数）
        positive_count = sum(1 for word in words if word in self.positive_keywords)
        negative_count = sum(1 for word in words if word in self.negative_keywords)

        total = positive_count + negative_count
        if total == 0:
            return {
                "sentiment": "neutral",
                "score": 0.0,
                "positive_count": 0,
                "negative_count": 0,
            }

        # #2 深化：score / sentiment 标签改用带否定与程度副词的细粒度打分，
        # 使"不认真 / 没有迟到 / 非常优秀"等语义正确；返回契约（字段与区间）不变。
        score = self._analyze_sentiment(text)

        if score > 0.2:
            sentiment = "positive"
        elif score < -0.2:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        return {
            "sentiment": sentiment,
            "score": round(score, 4),
            "positive_count": positive_count,
            "negative_count": negative_count,
        }
