from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional
from dataclasses import dataclass, field
import time
import logging
import threading
import numpy as np

"""
NLP算法分析服务
提供性能监控、准确性分析和优化建议
"""
logger = logging.getLogger(__name__)


@dataclass
class IntentMetrics:
    """意图识别指标"""

    total_predictions: int = 0
    correct_predictions: int = 0
    intent_stats: Dict[str, Dict] = field(default_factory=dict)

    @property
    def accuracy(self) -> float:
        if self.total_predictions == 0:
            return 0.0
        return self.correct_predictions / self.total_predictions

    def to_dict(self) -> Dict:
        return {
            "total_predictions": self.total_predictions,
            "correct_predictions": self.correct_predictions,
            "accuracy": round(self.accuracy, 4),
            "intent_stats": self.intent_stats,
        }


@dataclass
class PerformanceMetrics:
    """性能指标"""

    total_requests: int = 0
    total_processing_time: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0
    slow_requests: List[Dict] = field(default_factory=list)

    @property
    def avg_processing_time(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.total_processing_time / self.total_requests

    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return self.cache_hits / total

    def to_dict(self) -> Dict:
        return {
            "total_requests": self.total_requests,
            "avg_processing_time": round(self.avg_processing_time, 4),
            "cache_hit_rate": round(self.cache_hit_rate, 4),
            "slow_requests_count": len(self.slow_requests),
        }


@dataclass
class ErrorAnalysis:
    """错误分析"""

    error_types: Dict[str, int] = field(default_factory=dict)
    error_examples: List[Dict] = field(default_factory=list)
    common_failures: List[Dict] = field(default_factory=list)

    def add_error(self, error_type: str, example: Dict):
        self.error_types[error_type] = self.error_types.get(error_type, 0) + 1
        if len(self.error_examples) < 100:
            self.error_examples.append(
                {
                    "timestamp": datetime.now().isoformat(),
                    "type": error_type,
                    "example": example,
                }
            )

    def to_dict(self) -> Dict:
        return {
            "error_types": self.error_types,
            "error_examples": self.error_examples[-10:],
            "common_failures": self.common_failures,
        }


class NLPAlgorithmAnalyzer:
    """NLP算法分析器"""

    _instance = None  # noqa: F841
    _lock = threading.Lock()  # noqa: F841

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.intent_metrics = IntentMetrics()
        self.performance_metrics = PerformanceMetrics()
        self.error_analysis = ErrorAnalysis()
        # 时间序列数据
        self.request_history: List[Dict] = []
        self.max_history_size = 10000
        # 算法组件统计
        self.component_stats = defaultdict(
            lambda: {
                "calls": 0,
                "total_time": 0.0,
                "errors": 0,
            }
        )
        # 并发锁
        self._lock = threading.Lock()

    def record_intent_prediction(
        self,
        predicted_intent: str,
        true_intent: Optional[str] = None,
        confidence: float = 0.0,
        features: Optional[Dict] = None,
    ):
        """记录意图预测"""
        with self._lock:
            self.intent_metrics.total_predictions += 1
            if true_intent is not None:
                if predicted_intent == true_intent:
                    self.intent_metrics.correct_predictions += 1
                # 记录每个意图的统计
                if true_intent not in self.intent_metrics.intent_stats:
                    self.intent_metrics.intent_stats[true_intent] = {
                        "total": 0,
                        "correct": 0,
                        "avg_confidence": 0.0,
                        "confidences": [],
                    }
                stats = self.intent_metrics.intent_stats[true_intent]
                stats["total"] += 1
                if predicted_intent == true_intent:
                    stats["correct"] += 1
                stats["confidences"].append(confidence)
                if len(stats["confidences"]) > 100:
                    stats["confidences"].pop(0)
                stats["avg_confidence"] = sum(stats["confidences"]) / len(stats["confidences"])

    def record_performance(
        self,
        processing_time: float,
        cache_hit: bool = False,
        components: Optional[Dict[str, float]] = None,
    ):
        """记录性能指标"""
        with self._lock:
            self.performance_metrics.total_requests += 1
            self.performance_metrics.total_processing_time += processing_time
            if cache_hit:
                self.performance_metrics.cache_hits += 1
            else:
                self.performance_metrics.cache_misses += 1
            # 记录慢请求
            if processing_time > 0.5:  # 超过500ms
                self.performance_metrics.slow_requests.append(
                    {
                        "timestamp": datetime.now().isoformat(),
                        "processing_time": processing_time,
                    }
                )
                if len(self.performance_metrics.slow_requests) > 100:
                    self.performance_metrics.slow_requests.pop(0)
            # 记录组件性能
            if components:
                for name, time_cost in components.items():
                    self.component_stats[name]["calls"] += 1
                    self.component_stats[name]["total_time"] += time_cost

    def record_error(
        self,
        error_type: str,
        input_text: str,
        expected: Optional[str] = None,
        predicted: Optional[str] = None,
        error_detail: Optional[str] = None,
    ):
        """记录错误"""
        with self._lock:
            self.error_analysis.add_error(
                error_type,
                {
                    "input": input_text,
                    "expected": expected,
                    "predicted": predicted,
                    "detail": error_detail,
                },
            )

    def record_component_call(self, component_name: str, duration: float, success: bool = True):
        """记录组件调用"""
        with self._lock:
            stats = self.component_stats[component_name]
            stats["calls"] += 1
            stats["total_time"] += duration
            if not success:
                stats["errors"] += 1

    def add_request_to_history(self, request_data: Dict):
        """添加请求到历史记录"""
        with self._lock:
            self.request_history.append({"timestamp": datetime.now().isoformat(), **request_data})
            if len(self.request_history) > self.max_history_size:
                self.request_history.pop(0)

    def get_intent_analysis(self) -> Dict:
        """获取意图分析报告"""
        with self._lock:
            report = {
                "summary": self.intent_metrics.to_dict(),
                "intent_breakdown": {},
            }
            for intent, stats in self.intent_metrics.intent_stats.items():
                total = stats["total"]
                correct = stats["correct"]
                report["intent_breakdown"][intent] = {
                    "total": total,
                    "correct": correct,
                    "accuracy": round(correct / total if total > 0 else 0, 4),
                    "avg_confidence": round(stats["avg_confidence"], 4),
                }
            return report

    def get_performance_analysis(self) -> Dict:
        """获取性能分析报告"""
        with self._lock:
            report = {
                "summary": self.performance_metrics.to_dict(),
                "components": {},
                "slow_requests": self.performance_metrics.slow_requests[-10:],
            }
            for name, stats in self.component_stats.items():
                calls = stats["calls"]
                total_time = stats["total_time"]
                report["components"][name] = {
                    "calls": calls,
                    "avg_time": round(total_time / calls if calls > 0 else 0, 4),
                    "total_time": round(total_time, 4),
                    "errors": stats["errors"],
                    "error_rate": round(stats["errors"] / calls if calls > 0 else 0, 4),
                }
            return report

    def get_error_analysis(self) -> Dict:
        """获取错误分析报告"""
        with self._lock:
            return self.error_analysis.to_dict()

    def get_optimization_suggestions(self) -> List[Dict]:
        """获取优化建议"""
        suggestions = []
        with self._lock:
            # 意图准确性分析
            if self.intent_metrics.accuracy < 0.85:
                suggestions.append(
                    {
                        "category": "accuracy",
                        "priority": "high",
                        "issue": (f"意图识别准确率较低 ({self.intent_metrics.accuracy:.2%})"),
                        "suggestions": [
                            "增加训练样本数量",
                            "调整TF-IDF参数以包含更多特征",
                            "考虑使用集成学习方法",
                            "分析低准确率意图类型，针对性优化",
                        ],
                    }
                )
            # 缓存命中率分析
            cache_hit_rate = self.performance_metrics.cache_hit_rate
            if cache_hit_rate < 0.5:
                suggestions.append(
                    {
                        "category": "performance",
                        "priority": "medium",
                        "issue": f"缓存命中率较低 ({cache_hit_rate:.2%})",
                        "suggestions": [
                            "增加缓存容量",
                            "延长缓存TTL时间",
                            "优化缓存键生成策略",
                            "考虑使用Redis等外部缓存",
                        ],
                    }
                )
            # 慢请求分析
            slow_count = len(self.performance_metrics.slow_requests)
            if slow_count > 20:
                suggestions.append(
                    {
                        "category": "performance",
                        "priority": "high",
                        "issue": f"存在较多慢请求 ({slow_count}条)",
                        "suggestions": [
                            "分析慢请求特征",
                            "优化BM25参数",
                            "考虑使用批处理",
                            "检查数据库查询性能",
                        ],
                    }
                )
            # 组件性能分析
            for name, stats in self.component_stats.items():
                if stats["calls"] > 0:
                    avg_time = stats["total_time"] / stats["calls"]
                    if avg_time > 0.1:  # 超过100ms
                        suggestions.append(
                            {
                                "category": "performance",
                                "priority": "medium",
                                "issue": (f"{name} 平均耗时较高 ({avg_time*1000:.1f}ms)"),
                                "suggestions": [
                                    "优化算法实现",
                                    "添加缓存",
                                    "考虑异步处理",
                                ],
                            }
                        )
            # 错误类型分析
            if self.error_analysis.error_types:
                top_errors = sorted(
                    self.error_analysis.error_types.items(),
                    key=lambda x: x[1],
                    reverse=True,
                )[:3]
                suggestions.append(
                    {
                        "category": "quality",
                        "priority": "medium",
                        "issue": (
                            "常见错误类型: " + ", ".join([f"{t}({c}次)" for t, c in top_errors])
                        ),
                        "suggestions": [
                            "分析错误样例",
                            "扩展训练数据",
                            "调整置信度阈值",
                        ],
                    }
                )
        return suggestions

    def get_comprehensive_report(self) -> Dict:
        """获取综合分析报告"""
        return {
            "timestamp": datetime.now().isoformat(),
            "intent_analysis": self.get_intent_analysis(),
            "performance_analysis": self.get_performance_analysis(),
            "error_analysis": self.get_error_analysis(),
            "optimization_suggestions": self.get_optimization_suggestions(),
            "recommendations": self._generate_recommendations(),
        }

    def _generate_recommendations(self) -> List[str]:
        """生成最终建议"""
        recommendations = []
        intent_accuracy = self.intent_metrics.accuracy
        cache_rate = self.performance_metrics.cache_hit_rate
        error_count = sum(self.error_analysis.error_types.values())
        if intent_accuracy >= 0.95 and cache_rate >= 0.7 and error_count < 10:
            recommendations.append("系统运行良好，所有指标均达标")
        if intent_accuracy < 0.9:
            recommendations.append("建议优先优化意图识别准确性，可考虑增加更多训练样本")
        if cache_rate < 0.6:
            recommendations.append("建议增加缓存命中率，减少重复计算")
        if error_count > 50:
            recommendations.append("错误率较高，建议进行详细错误分析")
        return recommendations

    def reset_metrics(self):
        """重置所有指标"""
        with self._lock:
            self.intent_metrics = IntentMetrics()
            self.performance_metrics = PerformanceMetrics()
            self.error_analysis = ErrorAnalysis()
            self.request_history = []
            self.component_stats = defaultdict(
                lambda: {
                    "calls": 0,
                    "total_time": 0.0,
                    "errors": 0,
                }
            )
            logger.info("[NLPAnalyzer] 指标已重置")

    def export_metrics(self) -> Dict:
        """导出所有指标数据"""
        with self._lock:
            return {
                "timestamp": datetime.now().isoformat(),
                "intent_metrics": self.intent_metrics.to_dict(),
                "performance_metrics": self.performance_metrics.to_dict(),
                "error_analysis": self.error_analysis.to_dict(),
                "component_stats": dict(self.component_stats),
                "request_history": self.request_history[-100:],
            }


class AlgorithmBenchmark:
    """算法基准测试工具"""

    @staticmethod
    def benchmark_intent_classifier(
        classifier, test_cases: List[Dict], iterations: int = 10
    ) -> Dict:
        """
        基准测试意图分类器
        :param classifier: 分类器实例
        :param test_cases: 测试用例列表
        :param iterations: 迭代次数
        :return: 基准测试结果
        """
        results = {
            "iterations": iterations,
            "test_cases_count": len(test_cases),
            "latencies": [],
            "accuracies": [],
            "throughput": 0.0,
        }
        for _ in range(iterations):
            start_time = time.time()
            correct = 0
            for case in test_cases:
                predicted, confidence = classifier.predict_intent(case["text"])
                if predicted == case["expected"]:
                    correct += 1
            elapsed = time.time() - start_time
            results["latencies"].append(elapsed * 1000)  # ms
            results["accuracies"].append(correct / len(test_cases))
        # 计算统计
        results["avg_latency"] = round(np.mean(results["latencies"]), 2)
        results["p95_latency"] = round(np.percentile(results["latencies"], 95), 2)
        results["p99_latency"] = round(np.percentile(results["latencies"], 99), 2)
        results["avg_accuracy"] = round(np.mean(results["accuracies"]), 4)
        results["throughput"] = round(len(test_cases) / np.mean(results["latencies"]) * 1000, 2)
        return results


nlp_analyzer = NLPAlgorithmAnalyzer()
