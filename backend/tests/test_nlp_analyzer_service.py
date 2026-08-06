"""
NLP Analyzer Service Test Cases
"""
try:
    from services.nlp_analyzer_service import IntentMetrics
except ImportError:
    pass

try:
    from services.nlp_analyzer_service import PerformanceMetrics
except ImportError:
    pass

try:
    from services.nlp_analyzer_service import ErrorAnalysis
except ImportError:
    pass

try:
    from services.nlp_analyzer_service import NLPAlgorithmAnalyzer
except ImportError:
    pass

try:
    from services.nlp_analyzer_service import AlgorithmBenchmark
except ImportError:
    pass
# 测试NLP算法分析服务的核心功能
"""
"""


class TestIntentMetrics:
    """测试意图识别指标"""

    def test_intent_metrics_initialization(self):
        """测试意图指标初始化"""
        from services.nlp_analyzer_service import IntentMetrics

        metrics = IntentMetrics()

        assert metrics.total_predictions == 0
        assert metrics.correct_predictions == 0
        assert metrics.intent_stats == {}
        assert metrics.accuracy == 0.0

    def test_intent_metrics_accuracy(self):
        """测试准确率计算"""

        metrics = IntentMetrics()
        metrics.total_predictions = 100
        metrics.correct_predictions = 85

        assert metrics.accuracy == 0.85

    def test_intent_metrics_zero_accuracy(self):
        """测试零预测时准确率"""

        metrics = IntentMetrics()
        assert metrics.accuracy == 0.0

    def test_intent_metrics_to_dict(self):
        """测试转换为字典"""

        metrics = IntentMetrics()
        metrics.total_predictions = 100
        metrics.correct_predictions = 85

        result = metrics.to_dict()

        assert isinstance(result, dict)
        assert result["total_predictions"] == 100
        assert result["correct_predictions"] == 85
        assert result["accuracy"] == 0.85
        assert "intent_stats" in result


class TestPerformanceMetrics:
    """测试性能指标"""

    def test_performance_metrics_initialization(self):
        """测试性能指标初始化"""
        from services.nlp_analyzer_service import PerformanceMetrics

        metrics = PerformanceMetrics()

        assert metrics.total_requests == 0
        assert metrics.total_processing_time == 0.0
        assert metrics.cache_hits == 0
        assert metrics.cache_misses == 0
        assert metrics.slow_requests == []

    def test_performance_metrics_avg_time(self):
        """测试平均处理时间"""

        metrics = PerformanceMetrics()
        metrics.total_requests = 10
        metrics.total_processing_time = 5.0

        assert metrics.avg_processing_time == 0.5

    def test_performance_metrics_cache_hit_rate(self):
        """测试缓存命中率"""

        metrics = PerformanceMetrics()
        metrics.cache_hits = 80
        metrics.cache_misses = 20

        assert metrics.cache_hit_rate == 0.8

    def test_performance_metrics_zero_hit_rate(self):
        """测试零请求时命中率"""

        metrics = PerformanceMetrics()
        assert metrics.cache_hit_rate == 0.0

    def test_performance_metrics_to_dict(self):
        """测试转换为字典"""

        metrics = PerformanceMetrics()
        metrics.total_requests = 100
        metrics.total_processing_time = 50.0
        metrics.cache_hits = 80
        metrics.cache_misses = 20

        result = metrics.to_dict()

        assert isinstance(result, dict)
        assert result["total_requests"] == 100
        assert result["avg_processing_time"] == 0.5
        assert result["cache_hit_rate"] == 0.8
        assert result["slow_requests_count"] == 0


class TestErrorAnalysis:
    """测试错误分析"""

    def test_error_analysis_initialization(self):
        """测试错误分析初始化"""
        from services.nlp_analyzer_service import ErrorAnalysis

        analysis = ErrorAnalysis()

        assert analysis.error_types == {}
        assert analysis.error_examples == []
        assert analysis.common_failures == []

    def test_add_error(self):
        """测试添加错误"""

        analysis = ErrorAnalysis()

        analysis.add_error("parse_error", {"input": "test", "expected": "A", "predicted": "B"})
        analysis.add_error("parse_error", {"input": "test2", "expected": "C", "predicted": "D"})
        analysis.add_error("intent_error", {"input": "test3", "expected": "E", "predicted": "F"})

        assert analysis.error_types["parse_error"] == 2
        assert analysis.error_types["intent_error"] == 1
        assert len(analysis.error_examples) == 3

    def test_to_dict(self):
        """测试转换为字典"""

        analysis = ErrorAnalysis()
        analysis.add_error("parse_error", {"input": "test"})

        result = analysis.to_dict()

        assert isinstance(result, dict)
        assert "error_types" in result
        assert "error_examples" in result
        assert "common_failures" in result


class TestNLPAlgorithmAnalyzer:
    """测试NLP算法分析器"""

    def test_analyzer_initialization(self):
        """测试分析器初始化"""
        from services.nlp_analyzer_service import NLPAlgorithmAnalyzer

        analyzer = NLPAlgorithmAnalyzer()

        assert analyzer is not None
        assert analyzer.intent_metrics is not None
        assert analyzer.performance_metrics is not None
        assert analyzer.error_analysis is not None

    def test_record_intent_prediction(self):
        """测试记录意图预测"""

        analyzer = NLPAlgorithmAnalyzer()

        analyzer.record_intent_prediction("intent_a", "intent_a", 0.9)
        analyzer.record_intent_prediction("intent_a", "intent_b", 0.8)
        analyzer.record_intent_prediction("intent_b", "intent_b", 0.95)

        assert analyzer.intent_metrics.total_predictions == 3
        assert analyzer.intent_metrics.correct_predictions == 2

    def test_record_performance(self):
        """测试记录性能指标"""

        analyzer = NLPAlgorithmAnalyzer()

        analyzer.record_performance(0.1, cache_hit=True)
        analyzer.record_performance(0.2, cache_hit=False)
        analyzer.record_performance(0.6, cache_hit=False)

        assert analyzer.performance_metrics.total_requests == 3
        assert analyzer.performance_metrics.cache_hits == 1
        assert analyzer.performance_metrics.cache_misses == 2
        assert len(analyzer.performance_metrics.slow_requests) == 1

    def test_record_error(self):
        """测试记录错误"""

        analyzer = NLPAlgorithmAnalyzer()

        analyzer.record_error("parse_error", "test input", "expected", "predicted", "detail")

        assert "parse_error" in analyzer.error_analysis.error_types
        assert analyzer.error_analysis.error_types["parse_error"] == 1

    def test_record_component_call(self):
        """测试记录组件调用"""

        analyzer = NLPAlgorithmAnalyzer()

        analyzer.record_component_call("parser", 0.1, success=True)
        analyzer.record_component_call("parser", 0.15, success=False)
        analyzer.record_component_call("classifier", 0.2)

        assert analyzer.component_stats["parser"]["calls"] == 2
        assert analyzer.component_stats["parser"]["errors"] == 1
        assert analyzer.component_stats["classifier"]["calls"] == 1

    def test_add_request_to_history(self):
        """测试添加请求到历史"""

        analyzer = NLPAlgorithmAnalyzer()

        analyzer.add_request_to_history({"text": "test", "intent": "test_intent"})

        assert len(analyzer.request_history) == 1
        assert analyzer.request_history[0]["text"] == "test"

    def test_get_intent_analysis(self):
        """测试获取意图分析报告"""

        analyzer = NLPAlgorithmAnalyzer()
        analyzer.record_intent_prediction("intent_a", "intent_a", 0.9)

        result = analyzer.get_intent_analysis()

        assert isinstance(result, dict)
        assert "summary" in result
        assert "intent_breakdown" in result

    def test_get_performance_analysis(self):
        """测试获取性能分析报告"""

        analyzer = NLPAlgorithmAnalyzer()
        analyzer.record_performance(0.1)

        result = analyzer.get_performance_analysis()

        assert isinstance(result, dict)
        assert "summary" in result
        assert "components" in result
        assert "slow_requests" in result

    def test_get_error_analysis(self):
        """测试获取错误分析报告"""

        analyzer = NLPAlgorithmAnalyzer()
        analyzer.record_error("test_error", "test")

        result = analyzer.get_error_analysis()

        assert isinstance(result, dict)
        assert "error_types" in result

    def test_get_optimization_suggestions_high_accuracy(self):
        """测试高准确率时优化建议"""

        analyzer = NLPAlgorithmAnalyzer()

        for i in range(100):
            analyzer.record_intent_prediction("intent_a", "intent_a", 0.95)

        analyzer.performance_metrics.cache_hits = 70
        analyzer.performance_metrics.cache_misses = 30

        suggestions = analyzer.get_optimization_suggestions()

        assert isinstance(suggestions, list)

    def test_get_optimization_suggestions_low_accuracy(self):
        """测试低准确率时优化建议"""

        analyzer = NLPAlgorithmAnalyzer()

        for i in range(100):
            if i < 50:
                analyzer.record_intent_prediction("intent_a", "intent_a", 0.9)
            else:
                analyzer.record_intent_prediction("intent_a", "intent_b", 0.8)

        suggestions = analyzer.get_optimization_suggestions()

        accuracy_suggestions = [s for s in suggestions if s["category"] == "accuracy"]
        assert len(accuracy_suggestions) >= 1

    def test_get_optimization_suggestions_low_cache_hit(self):
        """测试低缓存命中率时优化建议"""

        analyzer = NLPAlgorithmAnalyzer()

        analyzer.performance_metrics.cache_hits = 30
        analyzer.performance_metrics.cache_misses = 70

        suggestions = analyzer.get_optimization_suggestions()

        perf_suggestions = [s for s in suggestions if s["category"] == "performance"]
        assert len(perf_suggestions) >= 1

    def test_get_optimization_suggestions_slow_requests(self):
        """测试慢请求时优化建议"""

        analyzer = NLPAlgorithmAnalyzer()

        for i in range(25):
            analyzer.record_performance(0.6)

        suggestions = analyzer.get_optimization_suggestions()

        slow_suggestions = [s for s in suggestions if "慢请求" in s.get("issue", "")]
        assert len(slow_suggestions) >= 1

    def test_get_comprehensive_report(self):
        """测试获取综合分析报告"""

        analyzer = NLPAlgorithmAnalyzer()

        report = analyzer.get_comprehensive_report()

        assert isinstance(report, dict)
        assert "timestamp" in report
        assert "intent_analysis" in report
        assert "performance_analysis" in report
        assert "error_analysis" in report
        assert "optimization_suggestions" in report
        assert "recommendations" in report

    def test_reset_metrics(self):
        """测试重置指标"""

        analyzer = NLPAlgorithmAnalyzer()
        analyzer.record_intent_prediction("intent_a", "intent_a", 0.9)
        analyzer.record_performance(0.1)

        analyzer.reset_metrics()

        assert analyzer.intent_metrics.total_predictions == 0
        assert analyzer.performance_metrics.total_requests == 0
        assert analyzer.error_analysis.error_types == {}

    def test_export_metrics(self):
        """测试导出指标"""

        analyzer = NLPAlgorithmAnalyzer()
        analyzer.record_intent_prediction("intent_a", "intent_a", 0.9)

        result = analyzer.export_metrics()

        assert isinstance(result, dict)
        assert "timestamp" in result
        assert "intent_metrics" in result
        assert "performance_metrics" in result


class TestAlgorithmBenchmark:
    """测试算法基准测试工具"""

    def test_benchmark_intent_classifier(self):
        """测试基准测试意图分类器"""
        from services.nlp_analyzer_service import AlgorithmBenchmark

        mock_classifier = type('MockClassifier', (), {})()
        mock_classifier.predict_intent = lambda text: ("intent_a", 0.9)

        test_cases = [
            {"text": "text1", "expected": "intent_a"},
            {"text": "text2", "expected": "intent_a"},
            {"text": "text3", "expected": "intent_b"},
        ]

        result = AlgorithmBenchmark.benchmark_intent_classifier(mock_classifier, test_cases, iterations=3)

        assert isinstance(result, dict)
        assert result["iterations"] == 3
        assert result["test_cases_count"] == 3
        assert "avg_latency" in result
        assert "avg_accuracy" in result
        assert "throughput" in result
