#!/usr/bin/env python3
"""
"""
# 评分分布服务测试模块
"""
"""

from unittest.mock import MagicMock, patch
try:
    from services.score_distribution_service import ScoreDistributionController
except ImportError:
    pass

try:
    from services.score_distribution_service import ScoreValidator
except ImportError:
    pass


class TestScoreDistributionController:
    """评分分布控制器测试类"""

    def test_calculate_adjusted_scores_empty(self):
        """测试计算调整后评分-空数据"""
        from services.score_distribution_service import ScoreDistributionController

        controller = ScoreDistributionController()
        result = controller.calculate_adjusted_scores([])
        assert result == []

    def test_calculate_adjusted_scores_with_data(self):
        """测试计算调整后评分-有数据"""

        controller = ScoreDistributionController()
        raw_scores = [85, 92, 78, 65, 72, 88, 95, 60, 75, 82]
        adjusted = controller.calculate_adjusted_scores(raw_scores)

        assert len(adjusted) == 10
        for score in adjusted:
            assert 0 <= score <= 100

    def test_calculate_adjusted_scores_single(self):
        """测试计算调整后评分-单个数据"""

        controller = ScoreDistributionController()
        adjusted = controller.calculate_adjusted_scores([80])

        assert len(adjusted) == 1
        assert 0 <= adjusted[0] <= 100

    def test_validate_distribution_empty(self):
        """测试验证分布-空数据"""

        controller = ScoreDistributionController()
        result = controller.validate_distribution([])

        assert not result["valid"]
        assert result["error"] == "无数据"

    def test_validate_distribution_with_data(self):
        """测试验证分布-有数据"""

        controller = ScoreDistributionController()
        scores = [95, 92, 88, 85, 82, 78, 75, 72, 65, 60]
        result = controller.validate_distribution(scores)

        assert "valid" in result
        assert "ratios" in result
        assert "targets" in result
        assert "counts" in result
        assert result["ratios"]["excellent"] >= 0
        assert result["ratios"]["good"] >= result["ratios"]["excellent"]
        assert result["ratios"]["medium"] >= result["ratios"]["good"]

    def test_adjust_class_scores(self, app):
        """测试调整班级评分"""
        with app.app_context():

            controller = ScoreDistributionController()

            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.name = "张三"
            mock_user1.class_name = "一班"
            mock_user1.current_score = 80

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.name = "李四"
            mock_user2.class_name = "一班"
            mock_user2.current_score = 90

            with patch("services.score_distribution_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2]

                with patch("services.score_distribution_service.db_session_scope"):
                    result = controller.adjust_class_scores("一班")

                    assert result["success"]
                    assert result["class_name"] == "一班"
                    assert result["total_students"] == 2
                    assert len(result["adjusted_scores"]) == 2

    def test_adjust_class_scores_all(self, app):
        """测试调整全校评分"""
        with app.app_context():

            controller = ScoreDistributionController()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 80

            with patch("services.score_distribution_service.User.query") as mock_query:
                mock_query.all.return_value = [mock_user]

                with patch("services.score_distribution_service.db_session_scope"):
                    result = controller.adjust_class_scores(None)

                    assert result["success"]
                    assert result["class_name"] == "全校"

    def test_get_distribution_statistics_empty(self, app):
        """测试获取分布统计-空数据"""
        with app.app_context():

            controller = ScoreDistributionController()

            with patch("services.score_distribution_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = controller.get_distribution_statistics("一班")

                assert not result["success"]
                assert result["error"] == "无数据"

    def test_get_distribution_statistics_with_data(self, app):
        """测试获取分布统计-有数据"""
        with app.app_context():

            controller = ScoreDistributionController()

            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.class_name = "一班"
            mock_user1.current_score = 95

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.class_name = "一班"
            mock_user2.current_score = 85

            mock_user3 = MagicMock()
            mock_user3.id = 3
            mock_user3.class_name = "一班"
            mock_user3.current_score = 75

            mock_user4 = MagicMock()
            mock_user4.id = 4
            mock_user4.class_name = "一班"
            mock_user4.current_score = 65

            with patch("services.score_distribution_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2, mock_user3, mock_user4]

                result = controller.get_distribution_statistics("一班")

                assert result["success"]
                assert result["total_students"] == 4
                assert "distribution" in result
                assert "counts" in result
                assert "statistics" in result
                assert "avg" in result["statistics"]
                assert "std" in result["statistics"]
                assert "min" in result["statistics"]
                assert "max" in result["statistics"]


class TestScoreValidator:
    """评分合理性校验器测试类"""

    def test_validate_score_normal(self):
        """测试校验分数-正常变化"""
        from services.score_distribution_service import ScoreValidator

        validator = ScoreValidator()
        result = validator.validate_score(1, 85, 80, "日常表现")

        assert result["valid"]

    def test_validate_score_excessive_change(self):
        """测试校验分数-变化过大"""

        validator = ScoreValidator()
        result = validator.validate_score(1, 100, 70, "异常变化")

        assert not result["valid"]
        assert result["error_type"] == "excessive_change"
        assert "suggested_score" in result

    def test_detect_outliers_empty(self):
        """测试检测离群值-空数据"""

        validator = ScoreValidator()
        result = validator.detect_outliers([])

        assert result["outliers"] == []
        assert result["valid"]

    def test_detect_outliers_short_data(self):
        """测试检测离群值-数据不足"""

        validator = ScoreValidator()
        result = validator.detect_outliers([80, 85])

        assert result["outliers"] == []
        assert result["valid"]

    def test_detect_outliers_no_outliers(self):
        """测试检测离群值-无离群值"""

        validator = ScoreValidator()
        result = validator.detect_outliers([80, 82, 85, 88, 90])

        assert result["outliers"] == []
        assert result["valid"]

    def test_detect_outliers_with_outliers(self):
        """测试检测离群值-有离群值"""

        validator = ScoreValidator()
        scores = [100] * 9 + [-100]
        result = validator.detect_outliers(scores)

        assert len(result["outliers"]) > 0
        assert not result["valid"]
        assert "mean" in result
        assert "std" in result

    def test_detect_outliers_all_same(self):
        """测试检测离群值-所有值相同"""

        validator = ScoreValidator()
        result = validator.detect_outliers([80, 80, 80, 80])

        assert result["outliers"] == []
        assert result["valid"]

    def test_auto_correct(self):
        """测试自动修正"""

        validator = ScoreValidator()
        scores = [80, 85, 150, 75]
        outliers = [{"index": 2, "score": 150, "z_score": 3.5, "suggested_value": 80}]

        corrected = validator.auto_correct(scores, outliers)

        assert len(corrected) == 4
        assert corrected[2] == 80
        assert corrected[0] == 80
        assert corrected[1] == 85
        assert corrected[3] == 75

    def test_validate_and_correct_no_correction(self):
        """测试校验并修正-无需修正"""

        validator = ScoreValidator()
        scores = [80, 82, 85, 88, 90]

        result = validator.validate_and_correct(scores)

        assert result["success"]
        assert not result["corrected"]
        assert result["outliers"] == []
        assert result["message"] == "分数正常，无需修正"

    def test_validate_and_correct_with_correction(self):
        """测试校验并修正-需要修正"""

        validator = ScoreValidator()
        scores = [100] * 9 + [-100]

        result = validator.validate_and_correct(scores)

        assert result["success"]
        assert result["corrected"]
        assert len(result["outliers"]) > 0
        assert "corrected_count" in result
