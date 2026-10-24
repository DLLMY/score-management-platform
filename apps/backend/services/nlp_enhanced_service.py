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
from services.nlp._base_mixin import _BaseMixin
from services.nlp._entity_mixin import _EntityMixin
from services.nlp._intent_mixin import _IntentMixin
from services.nlp._rule_mixin import _RuleMixin
from services.nlp._scoring_mixin import _ScoringMixin
from services.nlp._sentiment_mixin import _SentimentMixin
from services.nlp._shared import (
    _DEFAULT_INVALID_NAMES,
    _DEFAULT_NAME_PREFIX_WORDS,
    _DEFAULT_NEGATIVE_KEYWORDS,
    _DEFAULT_POSITIVE_KEYWORDS,
    _INTENT_TRAINING_SAMPLES,
    _coerce_dt,
)
from services.nlp.ml_intent_classifier import MLIntentClassifier
from utils.logger import log_debug, log_warning


class EnhancedNLPParserService(
    _BaseMixin, _SentimentMixin, _EntityMixin,
    _IntentMixin, _RuleMixin, _ScoringMixin,
):
    """增强型 NLP 解析服务。

    原单体类（约 2700 行）按领域拆分为 services/nlp/ 下的 mixin 子模块
    （基础/情感/实体/意图/规则/评分），本类仅作多继承组合，行为与拆分前完全一致。
    """
    pass

_nlp_parser_instance = None

def get_nlp_parser():
    global _nlp_parser_instance
    if _nlp_parser_instance is None:
        _nlp_parser_instance = EnhancedNLPParserService()
    return _nlp_parser_instance
