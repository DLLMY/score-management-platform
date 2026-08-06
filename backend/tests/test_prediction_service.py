#!/usr/bin/env python3
"""
"""
# 预测服务测试模块
"""
"""

from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from services.prediction_service import PredictionService


class TestPredictionService:
    """预测服务测试类"""

    def test_calculate_trend_empty_scores(self):
        result = PredictionService.calculate_trend([])

        assert result["direction"] == "stable"
        assert result["slope"] == 0.0
        assert result["change_rate"] == 0.0

    def test_calculate_trend_single_score(self):
        result = PredictionService.calculate_trend([10])

        assert result["direction"] == "stable"
        assert result["slope"] == 0.0
        assert result["change_rate"] == 0.0

    def test_calculate_trend_increasing_trend(self):
        scores = [10, 20, 30, 40, 50]
        result = PredictionService.calculate_trend(scores)

        assert result["direction"] == "rising"
        assert result["slope"] > 0
        assert result["change_rate"] > 0

    def test_calculate_trend_decreasing_trend(self):
        scores = [50, 40, 30, 20, 10]
        result = PredictionService.calculate_trend(scores)

        assert result["direction"] == "falling"
        assert result["slope"] < 0
        assert result["change_rate"] < 0

    def test_calculate_trend_stable_trend(self):
        scores = [30, 30, 30, 30, 30]
        result = PredictionService.calculate_trend(scores)

        assert result["direction"] == "stable"
        assert abs(result["slope"]) < 0.1
        assert abs(result["change_rate"]) < 0.1

    def test_calculate_trend_with_two_points(self):
        scores = [10, 20]
        result = PredictionService.calculate_trend(scores)

        assert "direction" in result
        assert "slope" in result
        assert "change_rate" in result

    def test_get_student_score_history_empty(self, app):
        """测试获取学生积分历史-无记录"""
        with app.app_context():
            with patch("services.prediction_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = []

                history = PredictionService.get_student_score_history(1)

                assert history == []

    def test_get_student_score_history_with_records(self, app):
        """测试获取学生积分历史-有记录"""
        with app.app_context():

            class MockRecord:
                score_change = 10
                created_at = datetime.now()
                rule_name = "奖励"
                category = "positive"

            mock_record1 = MockRecord()
            mock_record1.score_change = 10
            mock_record2 = MockRecord()
            mock_record2.score_change = -5

            with patch("services.prediction_service.ScoreRecord.query") as mock_query:
                mock_query.filter.return_value.order_by.return_value.all.return_value = [mock_record1, mock_record2]

                history = PredictionService.get_student_score_history(1)

                assert len(history) == 2
                assert history[0]["score_change"] == 10
                assert history[1]["score_change"] == -5
                assert history[1]["cumulative_score"] == 5

    def test_predict_future_scores_insufficient_data(self, app):
        """测试预测未来积分-数据不足"""
        with app.app_context():
            with patch("services.prediction_service.PredictionService.get_student_score_history", return_value=[]):
                result = PredictionService.predict_future_scores(1)

                assert result["trend"] == "insufficient_data"
                assert result["confidence"] == 0.0
                assert result["predicted_scores"] == []

    def test_predict_future_scores_with_data(self, app):
        """测试预测未来积分-有数据"""
        with app.app_context():
            history = []
            current_time = datetime.now()
            cumulative = 0
            for i in range(14):
                change = 2 + i * 0.5
                cumulative += change
                history.append({
                    "date": (current_time - timedelta(days=13-i)).isoformat(),
                    "score_change": change,
                    "cumulative_score": cumulative,
                    "rule_name": None,
                    "category": None,
                })

            with patch("services.prediction_service.PredictionService.get_student_score_history", return_value=history):
                result = PredictionService.predict_future_scores(1, days=7)

                assert result["user_id"] == 1
                assert len(result["predicted_scores"]) == 7
                assert result["trend"] == "rising"
                assert result["confidence"] == 0.75
                assert "confidence_interval" in result

    def test_predict_batch_empty(self, app):
        """测试批量预测-无学生"""
        with app.app_context():
            with patch("services.prediction_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = PredictionService.predict_batch()

                assert result["total_students"] == 0
                assert len(result["predictions"]) == 0
                assert result["summary"]["rising_count"] == 0
                assert result["summary"]["stable_count"] == 0
                assert result["summary"]["falling_count"] == 0

    def test_predict_batch_with_students(self, app):
        """测试批量预测-有学生"""
        with app.app_context():
            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.name = "张三"
            mock_user1.class_name = "一班"
            mock_user1.is_active = True

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.name = "李四"
            mock_user2.class_name = "一班"
            mock_user2.is_active = True

            mock_prediction1 = {
                "trend": "rising",
                "slope": 1.0,
                "current_score": 80,
                "predicted_scores": [82, 84, 86],
                "confidence": 0.75,
            }

            mock_prediction2 = {
                "trend": "falling",
                "slope": -1.0,
                "current_score": 60,
                "predicted_scores": [58, 56, 54],
                "confidence": 0.75,
            }

            with patch("services.prediction_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2]

                with patch("services.prediction_service.PredictionService.predict_future_scores") as mock_predict:
                    mock_predict.side_effect = [mock_prediction1, mock_prediction2]

                    result = PredictionService.predict_batch()

                    assert result["total_students"] == 2
                    assert len(result["predictions"]) == 2
                    assert result["summary"]["rising_count"] == 1
                    assert result["summary"]["falling_count"] == 1

    def test_get_risk_students_no_risk(self, app):
        """测试获取风险学生-无风险"""
        with app.app_context():
            mock_batch_result = {
                "predictions": [
                    {
                        "user_id": 1,
                        "name": "张三",
                        "class_name": "一班",
                        "prediction": {
                            "trend": "rising",
                            "slope": 1.0,
                            "current_score": 80,
                            "predicted_scores": [82, 84],
                        },
                    }
                ]
            }

            with patch("services.prediction_service.PredictionService.predict_batch", return_value=mock_batch_result):
                risk_students = PredictionService.get_risk_students()

                assert len(risk_students) == 0

    def test_get_risk_students_with_risk(self, app):
        """测试获取风险学生-有风险"""
        with app.app_context():
            mock_batch_result = {
                "predictions": [
                    {
                        "user_id": 1,
                        "name": "张三",
                        "class_name": "一班",
                        "prediction": {
                            "trend": "falling",
                            "slope": -6.0,
                            "current_score": 60,
                            "predicted_scores": [55, 50, 45],
                            "confidence": 0.75,
                        },
                    },
                    {
                        "user_id": 2,
                        "name": "李四",
                        "class_name": "一班",
                        "prediction": {
                            "trend": "falling",
                            "slope": -3.0,
                            "current_score": 70,
                            "predicted_scores": [68, 66, 64],
                            "confidence": 0.75,
                        },
                    },
                ]
            }

            with patch("services.prediction_service.PredictionService.predict_batch", return_value=mock_batch_result):
                risk_students = PredictionService.get_risk_students(threshold=-5)

                assert len(risk_students) == 1
                assert risk_students[0]["user_id"] == 1
                assert risk_students[0]["risk_level"] == "high"

    def test_get_prediction_cache_no_cache(self, app):
        """测试获取预测缓存-无缓存"""
        with app.app_context():
            with patch("services.prediction_service.get_cache_service", return_value=None):
                result = PredictionService.get_prediction_cache(1)

                assert result is None

    def test_get_prediction_cache_with_cache(self, app):
        """测试获取预测缓存-有缓存"""
        with app.app_context():
            mock_cache = MagicMock()
            mock_cache.get.return_value = {"user_id": 1, "predicted_scores": [80, 85]}

            with patch("services.prediction_service.get_cache_service", return_value=mock_cache):
                result = PredictionService.get_prediction_cache(1)

                assert result is not None
                assert result["user_id"] == 1

    def test_cache_prediction_no_cache(self, app):
        """测试缓存预测结果-无缓存服务"""
        with app.app_context():
            with patch("services.prediction_service.get_cache_service", return_value=None):
                PredictionService.cache_prediction(1, 7, {"user_id": 1})

    def test_cache_prediction_success(self, app):
        """测试缓存预测结果-成功"""
        with app.app_context():
            mock_cache = MagicMock()

            with patch("services.prediction_service.get_cache_service", return_value=mock_cache):
                PredictionService.cache_prediction(1, 7, {"user_id": 1})

                mock_cache.set.assert_called_once()

    def test_invalidate_prediction_cache_no_cache(self, app):
        """测试清除预测缓存-无缓存服务"""
        with app.app_context():
            with patch("services.prediction_service.get_cache_service", return_value=None):
                PredictionService.invalidate_prediction_cache(1)

    def test_invalidate_prediction_cache_success(self, app):
        """测试清除预测缓存-成功"""
        with app.app_context():
            mock_cache = MagicMock()

            with patch("services.prediction_service.get_cache_service", return_value=mock_cache):
                PredictionService.invalidate_prediction_cache(1)

                assert mock_cache.delete.call_count == 3


def _mock_batch(slope, current_score=60, predicted_scores=None, trend="falling", user_id=1):
    """构造 predict_batch 的返回体，用于隔离测试 get_risk_students 的分档逻辑"""
    if predicted_scores is None:
        predicted_scores = [55, 50, 45]
    return {
        "predictions": [
            {
                "user_id": user_id,
                "name": "张三",
                "class_name": "一班",
                "prediction": {
                    "trend": trend,
                    "slope": slope,
                    "current_score": current_score,
                    "predicted_scores": predicted_scores,
                    "confidence": 0.75,
                },
            }
        ]
    }


class TestGetRiskStudentsGrading:
    """get_risk_students 风险分档与契约字段测试

    背景：该方法曾缺失 risk_score / risk_level / warning_count 三个字段，
    而前端 RiskStudent 接口（types/index.ts）强依赖它们，
    AlgorithmAnalysis.tsx 对 risk_score 直接调用 .toFixed(1) 会导致运行时崩溃。
    本类锁定分档公式与契约字段，防止回归。

    分档公式：
        severity   = |slope| / |threshold|
        risk_score = round(min(1.0, 0.7 * severity / 1.2), 2)
        risk_score >= 0.7 -> high；>= 0.4 -> medium；否则 low
    """

    def test_contract_fields_present(self, app):
        """契约字段完整性-前端 RiskStudent 依赖的字段必须齐全"""
        with app.app_context():
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(slope=-6.0),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert len(students) == 1
                for field in (
                    "user_id",
                    "name",
                    "class_name",
                    "current_score",
                    "predicted_change",
                    "risk_score",
                    "risk_level",
                    "warning_count",
                    "confidence",
                ):
                    assert field in students[0], f"缺少契约字段: {field}"

                # 前端会对 risk_score 调用 .toFixed()，必须是数值而非 None
                assert isinstance(students[0]["risk_score"], (int, float))
                assert students[0]["risk_level"] in ("low", "medium", "high")
                assert isinstance(students[0]["warning_count"], int)

    def test_grade_high_at_boundary(self, app):
        """分档临界-slope=-6.0 时 risk_score 恰为 0.7，判定 high"""
        with app.app_context():
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(slope=-6.0),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert students[0]["risk_score"] == 0.7
                assert students[0]["risk_level"] == "high"

    def test_grade_medium_just_below_boundary(self, app):
        """分档临界-slope=-5.9 时 risk_score=0.69，落回 medium"""
        with app.app_context():
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(slope=-5.9),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert students[0]["risk_score"] == 0.69
                assert students[0]["risk_level"] == "medium"

    def test_risk_score_saturates_at_one(self, app):
        """severity 饱和-极端下滑时 risk_score 封顶 1.0，不得越界"""
        with app.app_context():
            for slope in (-9.0, -20.0, -50.0, -1000.0):
                with patch(
                    "services.prediction_service.PredictionService.predict_batch",
                    return_value=_mock_batch(slope=slope),
                ):
                    students = PredictionService.get_risk_students(threshold=-5)

                    assert students[0]["risk_score"] == 1.0, f"slope={slope} 未正确饱和"
                    assert students[0]["risk_level"] == "high"

    def test_grading_scales_with_threshold(self, app):
        """分档相对阈值缩放-threshold=-10 时 slope=-12 等价于 threshold=-5 时 slope=-6"""
        with app.app_context():
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(slope=-12.0),
            ):
                students = PredictionService.get_risk_students(threshold=-10)

                assert students[0]["risk_score"] == 0.7
                assert students[0]["risk_level"] == "high"

    def test_low_level_unreachable_by_filter(self, app):
        """已知性质-过滤条件保证 severity>1，故 risk_score 恒 >0.58，low 分支不可达

        get_risk_students 仅保留 slope < threshold 的学生，
        因此 severity = |slope|/|threshold| 必然 > 1，
        risk_score 下界为 0.7/1.2 = 0.583 > 0.4，永远不会落到 low。
        low 分支属防御性代码。若未来放宽过滤条件，本用例应随之调整。
        """
        with app.app_context():
            # 取一个无限接近阈值的 slope，此时 risk_score 最接近理论下界
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(slope=-5.0001),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert students[0]["risk_score"] >= 0.58
                assert students[0]["risk_level"] != "low"

    def test_warning_count_counts_days_below_current(self, app):
        """warning_count-统计预测窗口内低于当前积分的天数"""
        with app.app_context():
            # current_score=60，预测 [58, 62, 55, 61, 50] 中有 3 天低于 60
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(
                    slope=-6.0, current_score=60, predicted_scores=[58, 62, 55, 61, 50]
                ),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert students[0]["warning_count"] == 3

    def test_predicted_change_is_last_minus_current(self, app):
        """predicted_change-末日预测值与当前积分之差"""
        with app.app_context():
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(
                    slope=-6.0, current_score=60, predicted_scores=[55, 50, 42]
                ),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert students[0]["predicted_change"] == 42 - 60

    def test_rising_trend_excluded_even_if_slope_negative(self, app):
        """过滤条件-trend 非 falling 时不计入风险名单"""
        with app.app_context():
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=_mock_batch(slope=-20.0, trend="stable"),
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert students == []

    def test_sorted_by_predicted_change_ascending(self, app):
        """排序-按 predicted_change 升序，下滑最严重者排在最前"""
        with app.app_context():
            batch = {
                "predictions": [
                    {
                        "user_id": 1,
                        "name": "轻微",
                        "class_name": "一班",
                        "prediction": {
                            "trend": "falling",
                            "slope": -6.0,
                            "current_score": 60,
                            "predicted_scores": [55, 52],
                            "confidence": 0.75,
                        },
                    },
                    {
                        "user_id": 2,
                        "name": "严重",
                        "class_name": "一班",
                        "prediction": {
                            "trend": "falling",
                            "slope": -20.0,
                            "current_score": 60,
                            "predicted_scores": [40, 10],
                            "confidence": 0.75,
                        },
                    },
                ]
            }
            with patch(
                "services.prediction_service.PredictionService.predict_batch",
                return_value=batch,
            ):
                students = PredictionService.get_risk_students(threshold=-5)

                assert [s["user_id"] for s in students] == [2, 1]
                assert students[0]["predicted_change"] < students[1]["predicted_change"]
