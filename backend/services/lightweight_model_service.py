import os
import time
import re
import threading
import numpy as np
from typing import List, Dict, Tuple
import pickle

"\n"
"\n轻量化算法模型服务\n"
"-模型蒸馏与压缩"
"-快速推理引擎"
"-模型选择策略"
"-内存优化"
"\n"
try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.feature_extraction.text import TfidfVectorizer

    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "trained")
LIGHT_MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "lightweight")
os.makedirs(LIGHT_MODEL_DIR, exist_ok=True)


class LightweightModelConfig:
    """轻量化模型配置"""

    MODEL_PRIORITY = ["rule_based", "logistic_light", "svm_light", "textcnn_light", "bert_distilled", "bert_full"]
    MAX_FEATURES = 500
    INFERENCE_TIMEOUT = 100
    CACHE_SIZE = 1000
    MAX_CONCURRENT = 4


class RuleBasedIntentClassifier:
    """基于规则的意图分类器（最快）"""

    def __init__(self):
        self.rules = {
            "add": [
                "加分",
                "表扬",
                "奖励",
                "发言",
                "回答",
                "帮助",
                "优秀",
                "主动",
                "积极",
                "认真",
                "努力",
                "进步",
                "表现好",
            ],
            "deduct": ["扣分", "批评", "惩罚", "迟到", "早退", "旷课", "睡觉", "说话", "打架", "顶嘴", "破坏", "偷懒"],
            "reset": ["重置", "清零", "恢复", "初始化"],
            "query": ["查询", "查看", "多少", "如何", "怎么", "分数", "排名", "成绩"],
        }  # noqa: E501
        self.name_patterns = [
            "给(\\w+)加",
            "(\\w+)加(\\d+)分",
            "(\\w+)扣(\\d+)分",
            "查询(\\w+)",
            "表扬(\\w+)",
            "批评(\\w+)",
        ]

    def predict(self, text: str) -> Tuple[str, float, Dict]:
        """快速规则预测"""
        intent = "unknown"
        confidence = 0.0
        extras = {}
        for intent_type, keywords in self.rules.items():
            match_count = sum((1 for kw in keywords if kw in text))
            if match_count > 0:
                intent = intent_type
                confidence = min(0.9, match_count * 0.3)
                break
        score_match = re.search("(\\d+)分", text)
        if score_match:
            extras["score"] = int(score_match.group(1))
        name_match = re.search("[\\u4e00-\\u9fa5]{2,3}", text)
        if name_match:
            name = name_match.group()
            if name not in ["加分", "扣分", "查询", "表扬", "批评", "迟到"]:
                extras["name"] = name
        return (intent, confidence, extras)

    def batch_predict(self, texts: List[str]) -> List[Tuple[str, float, Dict]]:
        """批量预测"""
        return [self.predict(t) for t in texts]


class LightweightTFIDFClassifier:
    """轻量化TF-IDF分类器"""

    def __init__(self, max_features=500):
        self.max_features = max_features
        self.vectorizer = None
        self.classifier = None
        self._loaded = False

    def load(self):
        """加载模型"""
        if self._loaded:
            return True
        try:
            vectorizer_path = os.path.join(LIGHT_MODEL_DIR, "light_vectorizer.pkl")
            classifier_path = os.path.join(LIGHT_MODEL_DIR, "light_classifier.pkl")
            if os.path.exists(vectorizer_path) and os.path.exists(classifier_path):
                with open(vectorizer_path, "rb") as f:
                    self.vectorizer = pickle.load(f)  # nosec B301 - trusted local model
                with open(classifier_path, "rb") as f:
                    self.classifier = pickle.load(f)  # nosec B301 - trusted local model
                self._loaded = True
                return True
        except Exception as e:
            print(f"[轻量化模型] 加载失败: {e}")
        return False

    def train_light_model(self, texts: List[str], labels: List[str]):
        """训练轻量化模型"""
        try:
            self.vectorizer = TfidfVectorizer(max_features=self.max_features, analyzer="char_wb", ngram_range=(1, 3))
            X = self.vectorizer.fit_transform(texts)
            self.classifier = LogisticRegression(max_iter=100, solver="lbfgs")
            self.classifier.fit(X, labels)
            with open(os.path.join(LIGHT_MODEL_DIR, "light_vectorizer.pkl"), "wb") as f:
                pickle.dump(self.vectorizer, f)
            with open(os.path.join(LIGHT_MODEL_DIR, "light_classifier.pkl"), "wb") as f:
                pickle.dump(self.classifier, f)
            self._loaded = True
            print("[轻量化模型] 训练完成")
            return True
        except Exception as e:
            print(f"[轻量化模型] 训练失败: {e}")
            return False

    def predict(self, text: str) -> Tuple[str, float]:
        """预测意图"""
        if not self._loaded:
            return ("unknown", 0.0)
        try:
            X = self.vectorizer.transform([text])
            proba = self.classifier.predict_proba(X)[0]
            intent_idx = np.argmax(proba)
            intent = self.classifier.classes_[intent_idx]
            confidence = proba[intent_idx]
            return (intent, confidence)
        except Exception:
            return ("unknown", 0.0)


class LightweightEngine:
    """轻量化推理引擎"""

    def __init__(self):
        self.rule_classifier = RuleBasedIntentClassifier()
        self.tfidf_classifier = LightweightTFIDFClassifier()
        self._cache = {}
        self._lock = threading.Lock()
        self._initialized = False

    def initialize(self):
        """初始化引擎"""
        self.tfidf_classifier.load()
        self._initialized = True
        print("[轻量化引擎] 初始化完成")

    def predict(self, text: str, strategy="auto") -> Dict:
        """
        智能预测

        Args:
            text: 输入文本
            strategy: 预测策略
                - 'auto': 自动选择（先规则，再轻量模型）
                - 'rule': 仅规则
                - 'model': 仅模型
                - 'hybrid': 混合（加权平均）

        Returns:
            预测结果字典
        """
        start_time = time.time()
        cache_key = f"predict:{text}"
        with self._lock:
            if cache_key in self._cache:
                cached = self._cache[cache_key]
                cached["cached"] = True
                return cached
        result = {"text": text, "cached": False, "strategy": strategy, "predictions": [], "final": {}}
        rule_intent, rule_conf, extras = self.rule_classifier.predict(text)
        result["predictions"].append(
            {
                "model": "rule_based",
                "intent": rule_intent,
                "confidence": rule_conf,
                "extras": extras,
                "time_ms": (time.time() - start_time) * 1000,
            }
        )
        if strategy in ["auto", "hybrid"]:
            model_intent, model_conf = self.tfidf_classifier.predict(text)
            result["predictions"].append(
                {
                    "model": "tfidf_light",
                    "intent": model_intent,
                    "confidence": model_conf,
                    "time_ms": (time.time() - start_time) * 1000,
                }
            )
        if strategy == "auto":
            if rule_conf >= 0.6:
                result["final"] = {"intent": rule_intent, "confidence": rule_conf, "extras": extras}
            else:
                result["final"] = {"intent": model_intent, "confidence": model_conf, "extras": extras}
        elif strategy == "hybrid":
            rule_weight = 0.4
            model_weight = 0.6
            if rule_conf > model_conf:
                final_intent = rule_intent
                final_conf = rule_conf * rule_weight + model_conf * model_weight
            else:
                final_intent = model_intent
                final_conf = model_conf * model_weight + rule_conf * rule_weight
            result["final"] = {"intent": final_intent, "confidence": final_conf, "extras": extras}
        elif strategy == "rule":
            result["final"] = {"intent": rule_intent, "confidence": rule_conf, "extras": extras}
        elif strategy == "model":
            model_intent, model_conf = self.tfidf_classifier.predict(text)
            result["final"] = {"intent": model_intent, "confidence": model_conf, "extras": extras}
        result["total_time_ms"] = (time.time() - start_time) * 1000
        with self._lock:
            if len(self._cache) < LightweightModelConfig.CACHE_SIZE:
                self._cache[cache_key] = result
        return result

    def batch_predict(self, texts: List[str], strategy="auto") -> List[Dict]:
        """批量预测"""
        return [self.predict(t, strategy) for t in texts]

    def get_stats(self) -> Dict:
        """获取引擎统计"""
        return {
            "initialized": self._initialized,
            "cache_size": len(self._cache),
            "models_loaded": {"rule_based": True, "tfidf_light": self.tfidf_classifier._loaded},
        }

    def clear_cache(self):
        """清空缓存"""
        with self._lock:
            self._cache.clear()


_light_engine = None


def get_light_engine() -> LightweightEngine:
    """获取轻量化引擎"""
    global _light_engine
    if _light_engine is None:
        _light_engine = LightweightEngine()
        _light_engine.initialize()
    return _light_engine


def train_lightweight_model(texts: List[str], labels: List[str]) -> bool:
    """训练轻量化模型"""
    engine = get_light_engine()
    return engine.tfidf_classifier.train_light_model(texts, labels)
