from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum

# \nNLP智能评分算法优化配置\n
# 整合所有算法优化参数和策略
# (空行)


class OptimizationStrategy(Enum):
    """优化策略枚举"""

    ACCURACY_FIRST = "accuracy_first"
    SPEED_FIRST = "speed_first"
    BALANCED = "balanced"


@dataclass
class IntentClassifierConfig:
    """意图分类器配置"""

    tfidf_max_features: int = 1000
    tfidf_ngram_range: Tuple[int, int] = (1, 4)
    tfidf_analyzer: str = "char_wb"
    tfidf_min_df: int = 2
    tfidf_max_df: float = 0.95
    lr_max_iter: int = 2000
    lr_random_state: int = 42
    lr_class_weight: str = "balanced"
    lr_C: float = 15.0
    lr_solver: str = "lbfgs"
    positive_weight: float = 1.2
    negative_weight: float = 1.2
    query_weight: float = 1.1
    reset_weight: float = 1.3
    confidence_threshold: float = 0.7
    min_confidence: float = 0.3


@dataclass
class BM25Config:
    """BM25算法配置"""

    k1: float = 1.5
    b: float = 0.75
    epsilon: float = 0.25
    delta: float = 1.0
    use_avg_doc_len: bool = True
    length_normalization: str = "BM25"

    @property
    def params(self) -> Dict[str, float]:
        return {"k1": self.k1, "b": self.b, "epsilon": self.epsilon, "delta": self.delta}


@dataclass
class PositionWeightConfig:
    """位置权重配置"""

    start: float = 1.5
    middle: float = 1.0
    end: float = 1.3
    adaptive_weights: bool = True
    decay_factor: float = 0.1


@dataclass
class KeywordImportanceConfig:
    """关键词重要性配置"""

    strong: float = 1.3
    medium: float = 1.0
    weak: float = 0.7
    positive_boost: float = 1.15
    negative_boost: float = 1.15
    frequency_decay: float = 0.95
    max_frequency_boost: float = 2.0


@dataclass
class SynonymExpansionConfig:
    """同义词扩展配置"""

    enabled: bool = True
    max_expansion: int = 5
    expansion_depth: int = 2
    similarity_threshold: float = 0.8
    bidirectional: bool = True
    preserve_order: bool = True


@dataclass
class ContextUnderstandingConfig:
    """上下文理解配置"""

    enabled: bool = True
    memory_size: int = 10
    pronoun_resolution: bool = True
    pronoun_window: int = 5
    context_window: int = 3
    context_decay: float = 0.9
    recent_weight: float = 1.5
    distant_weight: float = 0.8


@dataclass
class PerformanceConfig:
    """性能优化配置"""

    cache_enabled: bool = True
    cache_ttl: int = 300
    cache_max_size: int = 1000
    batch_enabled: bool = True
    batch_size: int = 100
    batch_timeout: float = 1.0
    async_enabled: bool = True
    max_workers: int = 4
    queue_size: int = 1000
    preload_models: bool = True
    preload_threshold: int = 50


@dataclass
class AccuracyConfig:
    """准确性优化配置"""

    feedback_learning_enabled: bool = True
    feedback_weight: float = 0.3
    min_feedback_count: int = 10
    error_analysis_enabled: bool = True
    error_threshold: float = 0.1
    ensemble_enabled: bool = True
    ensemble_methods: List[str] = field(
        default_factory=lambda: ["logistic", "svm", "random_forest"]
    )
    ensemble_voting: str = "soft"
    adaptive_threshold_enabled: bool = True
    threshold_adjustment_rate: float = 0.05


class NLPAlgorithmOptimizer:
    """NLP算法优化器"""

    def __init__(self, strategy: OptimizationStrategy = OptimizationStrategy.BALANCED):
        self.strategy = strategy
        self._apply_strategy()

    def _apply_strategy(self):
        """根据策略应用优化配置"""
        if self.strategy == OptimizationStrategy.ACCURACY_FIRST:
            self.intent_classifier = IntentClassifierConfig(
                tfidf_max_features=1500,
                tfidf_ngram_range=(1, 5),
                lr_max_iter=3000,
                confidence_threshold=0.8,
            )
            self.bm25 = BM25Config(k1=1.5, b=0.75)
            self.performance = PerformanceConfig(cache_ttl=600, batch_size=50)
        elif self.strategy == OptimizationStrategy.SPEED_FIRST:
            self.intent_classifier = IntentClassifierConfig(
                tfidf_max_features=500,
                tfidf_ngram_range=(1, 3),
                lr_max_iter=1000,
                confidence_threshold=0.6,
            )
            self.bm25 = BM25Config(k1=2.0, b=0.5)
            self.performance = PerformanceConfig(cache_ttl=180, batch_size=200)
        else:
            self.intent_classifier = IntentClassifierConfig()
            self.bm25 = BM25Config()
            self.performance = PerformanceConfig()

    def get_config_summary(self) -> Dict:
        """获取配置摘要"""
        return {
            "strategy": self.strategy.value,
            "intent_classifier": {
                "tfidf_max_features": self.intent_classifier.tfidf_max_features,
                "tfidf_ngram_range": self.intent_classifier.tfidf_ngram_range,
                "tfidf_analyzer": self.intent_classifier.tfidf_analyzer,
                "tfidf_min_df": self.intent_classifier.tfidf_min_df,
                "tfidf_max_df": self.intent_classifier.tfidf_max_df,
                "lr_max_iter": self.intent_classifier.lr_max_iter,
                "lr_random_state": self.intent_classifier.lr_random_state,
                "lr_class_weight": self.intent_classifier.lr_class_weight,
                "lr_C": self.intent_classifier.lr_C,
            },
        }  # noqa: E501

    def optimize_parameters(
        self, current_params: Dict, performance_metrics: Dict, target_metric: str = "accuracy"
    ) -> Dict:
        """
        根据性能指标自动优化参数
        :param current_params: 当前参数
        :param performance_metrics: 性能指标
        :param target_metric: 目标指标
        :return: 优化后的参数
        """
        optimized_params = current_params.copy()
        if target_metric == "accuracy":
            if performance_metrics.get("accuracy", 0) < 0.9:
                optimized_params["tfidf_max_features"] = min(
                    optimized_params.get("tfidf_max_features", 1000) + 200, 2000
                )
                optimized_params["lr_C"] = min(optimized_params.get("lr_C", 15) + 2, 30)
        elif target_metric == "speed":
            if performance_metrics.get("latency", 0) > 100:
                optimized_params["tfidf_max_features"] = max(
                    optimized_params.get("tfidf_max_features", 1000) - 100, 300
                )
                optimized_params["cache_ttl"] = min(
                    optimized_params.get("cache_ttl", 300) + 60, 600
                )
        return optimized_params


nlp_optimizer = NLPAlgorithmOptimizer(OptimizationStrategy.BALANCED)
OPTIMIZATION_PRESETS = {
    "high_accuracy": NLPAlgorithmOptimizer(OptimizationStrategy.ACCURACY_FIRST),
    "high_speed": NLPAlgorithmOptimizer(OptimizationStrategy.SPEED_FIRST),
    "balanced": NLPAlgorithmOptimizer(OptimizationStrategy.BALANCED),
}


def get_optimizer(preset: Optional[str] = None) -> NLPAlgorithmOptimizer:
    """获取优化器实例"""
    if preset and preset in OPTIMIZATION_PRESETS:
        return OPTIMIZATION_PRESETS[preset]
    return nlp_optimizer


def create_custom_optimizer(
    strategy: OptimizationStrategy, custom_config: Optional[Dict] = None
) -> NLPAlgorithmOptimizer:
    """创建自定义优化器"""
    optimizer = NLPAlgorithmOptimizer(strategy)
    if custom_config:
        for key, value in custom_config.items():
            if hasattr(optimizer, key):
                setattr(optimizer, key, value)
    return optimizer
