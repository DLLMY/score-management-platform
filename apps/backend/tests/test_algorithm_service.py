#!/usr/bin/env python3
"""
算法服务测试模块
覆盖核心算法功能：相关性分析、数据标准化、熵权法、聚类等
"""

"""
"""

import numpy as np
from unittest.mock import patch, MagicMock
from services.algorithm_service import AlgorithmService

try:
    import pandas as pd
except ImportError:
    pass


class TestAlgorithmService:
    """算法服务测试类"""

    def test_calculate_correlation_positive(self):
        """测试计算正相关系数"""
        x = [1, 2, 3, 4, 5]
        y = [2, 4, 6, 8, 10]

        corr, p_value = AlgorithmService.calculate_correlation(x, y)

        assert corr > 0.99
        assert p_value < 0.01

    def test_calculate_correlation_negative(self):
        """测试计算负相关系数"""
        x = [1, 2, 3, 4, 5]
        y = [10, 8, 6, 4, 2]

        corr, p_value = AlgorithmService.calculate_correlation(x, y)

        assert corr < -0.99
        assert p_value < 0.01

    def test_calculate_correlation_no_correlation(self):
        """测试无相关性"""
        x = [1, 2, 3, 4, 5]
        y = [2, 3, 2, 3, 2]

        corr, _ = AlgorithmService.calculate_correlation(x, y)

        assert abs(corr) < 0.3

    def test_calculate_correlation_insufficient_data(self):
        """测试数据不足时的处理"""
        x = [1]
        y = [2]

        corr, p_value = AlgorithmService.calculate_correlation(x, y)

        assert corr == 0.0
        assert p_value == 1.0

    def test_calculate_correlation_with_nan(self):
        """测试含NaN值的数据"""
        x = [1, 2, np.nan, 4, 5]
        y = [2, np.nan, 6, 8, 10]

        corr, _ = AlgorithmService.calculate_correlation(x, y)

        assert corr > 0.9

    def test_standardize_data(self):
        """测试数据标准化"""
        data = [1, 2, 3, 4, 5]

        standardized = AlgorithmService.standardize_data(data)

        assert np.isclose(standardized.mean(), 0, atol=1e-10)
        assert np.isclose(standardized.std(), 1, atol=1e-10)
        assert len(standardized) == 5

    def test_normalize_data(self):
        """测试数据归一化"""
        data = [1, 2, 3, 4, 5]

        normalized = AlgorithmService.normalize_data(data)

        assert np.min(normalized) == 0.0
        assert np.max(normalized) == 1.0
        assert len(normalized) == 5

    def test_normalize_data_constant(self):
        """测试常数数据归一化"""
        data = [3, 3, 3, 3]

        normalized = AlgorithmService.normalize_data(data)

        assert np.all(normalized == 0)

    def test_entropy_weight(self):
        """测试熵权法"""
        data = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])

        weights = AlgorithmService.entropy_weight(data)

        assert len(weights) == 3
        assert np.isclose(weights.sum(), 1.0)
        assert all(w > 0 for w in weights)

    def test_entropy_weight_single_column(self):
        """测试单列数据熵权法"""
        data = np.array([[1], [2], [3], [4]])

        weights = AlgorithmService.entropy_weight(data)

        assert len(weights) == 1
        assert np.isclose(weights[0], 1.0)

    def test_kmeans_cluster(self):
        """测试K-Means聚类"""
        data = np.array([[1, 1], [1, 2], [4, 4], [4, 5]])

        labels, centroids = AlgorithmService.kmeans_cluster(data, n_clusters=2)

        assert len(labels) == 4
        assert centroids.shape == (2, 2)

    def test_get_cluster_label_name(self):
        """测试获取聚类标签名称"""
        assert AlgorithmService.get_cluster_label_name(0) == "全面优秀型"
        assert AlgorithmService.get_cluster_label_name(1) == "遵纪但学业吃力型"
        assert AlgorithmService.get_cluster_label_name(2) == "聪明但散漫型"
        assert AlgorithmService.get_cluster_label_name(3) == "双困型"
        assert AlgorithmService.get_cluster_label_name(99) == "未知类型_99"

    def test_determine_cluster_names(self):
        """测试确定聚类名称"""
        centroids = np.array([[0.8, 0.8], [0.8, 0.2], [0.2, 0.8], [0.2, 0.2]])

        names = AlgorithmService.determine_cluster_names(centroids)

        assert names[0] == "全面优秀型"
        assert names[1] == "遵纪但学业吃力型"
        assert names[2] == "聪明但散漫型"
        assert names[3] == "双困型"

    def test_get_student_data_for_analysis_empty(self, app):
        """测试获取学生数据-空数据"""
        with app.app_context():
            with patch("services.algorithm_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                df = AlgorithmService.get_student_data_for_analysis()

                assert df.empty

    def test_get_student_data_for_analysis_with_data(self, app):
        """测试获取学生数据-有数据"""
        with app.app_context():
            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.name = "张三"
            mock_user1.class_name = "一班"
            mock_user1.current_score = 80
            mock_user1.is_active = True

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.name = "李四"
            mock_user2.class_name = "一班"
            mock_user2.current_score = 60
            mock_user2.is_active = True

            with patch("services.algorithm_service.User.query") as mock_user_query:
                mock_user_query.filter.return_value.all.return_value = [mock_user1, mock_user2]

                # M4: 改为一次性聚合查询 db.session.query(Score.student_id, func.avg(...))
                # .group_by(Score.student_id)，返回 [(student_id, avg_score), ...]
                with patch("services.algorithm_service.db.session") as mock_session:
                    mock_session.query.return_value.filter.return_value.group_by.return_value.all.return_value = [
                        (1, 90.0),
                        (2, 70.0),
                    ]

                    df = AlgorithmService.get_student_data_for_analysis()

                    assert len(df) == 2
                    assert "behavior_score" in df.columns
                    assert "academic_score" in df.columns

    def test_calculate_statistics_empty(self, app):
        """测试计算统计指标-空数据"""
        with app.app_context():
            with patch.object(
                AlgorithmService,
                "get_student_data_for_analysis",
                return_value=MagicMock(empty=True),
            ):
                stats = AlgorithmService.calculate_statistics()

                assert stats["student_count"] == 0
                assert stats["avg_behavior_score"] == 0.0
                assert stats["avg_academic_score"] == 0.0

    def test_calculate_statistics_with_data(self, app):
        """测试计算统计指标-有数据"""
        with app.app_context():
            import pandas as pd

            df = pd.DataFrame(
                {
                    "user_id": [1, 2, 3],
                    "name": ["张三", "李四", "王五"],
                    "class_name": ["一班", "一班", "一班"],
                    "behavior_score": [80, 60, 40],
                    "academic_score": [90, 70, 50],
                }
            )

            with patch.object(AlgorithmService, "get_student_data_for_analysis", return_value=df):
                stats = AlgorithmService.calculate_statistics()

                assert stats["student_count"] == 3
                assert stats["avg_behavior_score"] == 60.0
                assert stats["avg_academic_score"] == 70.0
                assert stats["correlation"] > 0.9
                assert len(stats["group_comparison"]) == 3
