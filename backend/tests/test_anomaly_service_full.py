#!/usr/bin/env python3
"""
"""
# 异常检测服务完整测试模块
"""
"""

from services.anomaly_service import AnomalyDetector, AnomalyService, ANOMALY_TYPES


class TestAnomalyDetectorFull:
    """异常检测器完整测试类"""

    def test_fit_with_single_value(self):
        detector = AnomalyDetector()
        scores = [5]
        detector.fit(scores)

        assert detector.mean == 5.0
        assert detector.std == 0.0

    def test_detect_zscore_negative_values(self):
        detector = AnomalyDetector()
        scores = [-10, -20, -30, -40, -50]
        detector.fit(scores)

        result = detector.detect_zscore(-30)
        assert isinstance(result, tuple)
        assert isinstance(result[1], (int, float))

    def test_detect_zscore_boundary_value(self):
        detector = AnomalyDetector()
        scores = [10, 20, 30, 40, 50]
        detector.fit(scores)

        mean = detector.mean
        std = detector.std
        boundary_value = mean + 3 * std
        result = detector.detect_zscore(boundary_value)

        assert isinstance(result, tuple)

    def test_detect_batch_empty(self):
        detector = AnomalyDetector()
        result = detector.detect_batch([])

        assert isinstance(result, list)

    def test_detect_batch_with_anomaly(self):
        detector = AnomalyDetector()
        scores = [10, 20, 30, 40, 50, 200]
        detector.fit(scores[:-1])

        results = detector.detect_batch(scores)

        assert isinstance(results, list)

    def test_anomaly_types_thresholds(self):
        assert ANOMALY_TYPES["sudden_change"]["threshold"] == 3
        assert ANOMALY_TYPES["group_anomaly"]["threshold"] == 5


class TestAnomalyServiceBasic:
    """异常服务基础测试类"""

    def test_anomaly_service_exists(self):
        assert hasattr(AnomalyService, 'get_student_score_changes')

    def test_anomaly_types_definition_complete(self):
        for key in ANOMALY_TYPES:
            assert 'name' in ANOMALY_TYPES[key]
            assert 'description' in ANOMALY_TYPES[key]
