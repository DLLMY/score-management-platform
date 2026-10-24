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


class MLIntentClassifier:
    def __init__(self):
        self.intent_vectorizer = None
        self.intent_model = None
        self.intent_labels = {
            "add": 0,
            "deduct": 1,
            "query": 2,
            "reset": 3,
            "unknown": 4,
        }
        self.intent_labels_reverse = {v: k for k, v in self.intent_labels.items()}

        intent_words = config_loader.get_intent_words()
        self.positive_intent_words = set(intent_words.get("positive", [])) or {
            "加",
            "奖励",
            "表扬",
            "优秀",
            "好",
            "棒",
            "赞",
            "积极",
            "认真",
            "努力",
            "勤奋",
            "出色",
            "进步",
            "良好",
            "贡献",
            "助人为乐",
            "团结",
            "主动",
            "热心",
            "诚实",
            "守信",
            "负责",
            "专注",
            "耐心",
            "细心",
            "友善",
            "感恩",
            "自律",
            "自信",
            "乐观",
            "尊师重道",
            "整洁",
            "守纪",
            "礼貌",
            "尊敬",
            "友爱",
            "创新",
            "钻研",
            "坚持",
            "勇敢",
            "正直",
            "准时",
            "完成",
            "合作",
            "参与",
            "帮助",
            "提问",
            "发言",
            "回答",
            "擦黑板",
            "值日",
            "整理",
            "劳动",
            "打扫",
            "听讲",
            "作业",
            "提交",
            "遵守",
            "配合",
            "积极向上",
            "认真负责",
            "专心致志",
            "一丝不苟",
            "精益求精",
            "团结协作",
            "乐于助人",
            "诚实守信",
        }
        self.negative_intent_words = set(intent_words.get("negative", [])) or {
            "扣",
            "处罚",
            "批评",
            "差",
            "罚",
            "违纪",
            "违规",
            "迟到",
            "早退",
            "旷课",
            "睡觉",
            "玩手机",
            "说话",
            "走神",
            "抄袭",
            "作弊",
            "打架",
            "顶嘴",
            "破坏",
            "偷懒",
            "马虎",
            "撒谎",
            "不尊重",
            "粗心",
            "懒惰",
            "散漫",
            "冷漠",
            "自私",
            "急躁",
            "无理",
            "傲慢",
            "侮辱",
            "威胁",
            "欺凌",
            "损坏",
            "浪费",
            "逃避",
            "屡教不改",
            "态度恶劣",
            "扰乱课堂",
            "拒不配合",
            "恶意破坏",
            "故意捣乱",
            "消极怠工",
            "敷衍了事",
            "心不在焉",
            "东张西望",
            "喧哗",
            "骂人",
            "争吵",
            "捣乱",
            "调皮",
            "未完成",
            "不交",
            "顶撞",
            "反驳",
            "不服从",
            "偷窃",
            "逃避责任",
        }
        self.query_intent_words = set(intent_words.get("query", [])) or {
            "查",
            "查询",
            "多少分",
            "积分",
            "分数",
            "查看",
            "统计",
            "排名",
            "得分",
            "剩余",
            "总分数",
            "积分明细",
            "得分情况",
            "成绩",
            "个人分数",
        }
        self.reset_intent_words = set(intent_words.get("reset", [])) or {
            "重置",
            "清零",
            "归零",
            "重新计算",
            "清空",
            "重新开始",
            "初始化",
        }
        self._train_intent_classifier()

    def _prepare_intent_data(self):
        intent_samples = _INTENT_TRAINING_SAMPLES

        texts = []
        labels = []

        for intent, samples in intent_samples.items():
            for sample in samples:
                texts.append(sample)
                labels.append(self.intent_labels[intent])

        for _ in range(50):
            texts.append("")
            labels.append(self.intent_labels["unknown"])

        for _ in range(30):
            texts.append("这是一段无关的文本")
            labels.append(self.intent_labels["unknown"])

        for _ in range(20):
            texts.append("测试数据")
            labels.append(self.intent_labels["unknown"])

        return texts, labels

    def _extract_intent_features(self, text):
        features = []

        text_lower = text.lower()

        positive_count = sum(1 for w in self.positive_intent_words if w in text_lower)
        negative_count = sum(1 for w in self.negative_intent_words if w in text_lower)
        query_count = sum(1 for w in self.query_intent_words if w in text_lower)
        reset_count = sum(1 for w in self.reset_intent_words if w in text_lower)

        features.append(positive_count)
        features.append(negative_count)
        features.append(query_count)
        features.append(reset_count)

        features.append(len(text))

        if positive_count > 0 and negative_count == 0:
            features.append(1)
        else:
            features.append(0)

        if negative_count > 0 and positive_count == 0:
            features.append(1)
        else:
            features.append(0)

        if query_count > 0:
            features.append(1)
        else:
            features.append(0)

        if reset_count > 0:
            features.append(1)
        else:
            features.append(0)

        return features

    def _train_intent_classifier(self):
        texts, labels = self._prepare_intent_data()

        if not texts:
            return

        self.intent_vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 4),
            analyzer="char_wb",
            lowercase=False,
            min_df=2,
        )

        X_tfidf = self.intent_vectorizer.fit_transform(texts)

        feature_matrix = []
        for text in texts:
            features = self._extract_intent_features(text)
            feature_matrix.append(features)

        from scipy.sparse import hstack

        X_features = np.array(feature_matrix)
        X = hstack([X_tfidf, X_features])
        y = np.array(labels)

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        from sklearn.linear_model import LogisticRegression

        model = LogisticRegression(
            max_iter=2000,
            random_state=42,
            class_weight="balanced",
            C=15,
            solver="lbfgs",
        )

        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        from sklearn.metrics import f1_score

        _ = f1_score(y_test, y_pred, average="weighted")

        self.intent_model = model

        # 预测结果缓存
        self._prediction_cache = {}
        self._cache_max_size = 1000

    def predict_intent(self, text, use_cache: bool = True):
        # 检查缓存
        if use_cache and text in self._prediction_cache:
            return self._prediction_cache[text]

        if not self.intent_model or not self.intent_vectorizer:
            return None, 0.0

        try:
            X_tfidf = self.intent_vectorizer.transform([text])
            features = self._extract_intent_features(text)
            X_features = np.array([features])

            X = hstack([X_tfidf, X_features])

            intent_idx = self.intent_model.predict(X)[0]
            confidence = self.intent_model.predict_proba(X)[0][intent_idx]

            result = (
                self.intent_labels_reverse[intent_idx],
                round(confidence, 4),
            )

            # 缓存结果
            if use_cache:
                if len(self._prediction_cache) >= self._cache_max_size:
                    # 简单的FIFO策略，删除最早的缓存
                    oldest_key = next(iter(self._prediction_cache))
                    del self._prediction_cache[oldest_key]
                self._prediction_cache[text] = result

            return result
        except Exception as e:
            log_debug("意图预测失败（降级返回 None）", exception=e)
            return None, 0.0
