#!/usr/bin/env python3
"""
"""
# 成绩预测服务测试模块
"""
"""

from models import ScoreRecord
from services.score_predict_service import ScorePredictService


class TestScorePredictService:
    """成绩预测服务测试"""

    def test_get_student_features_not_found(self, app):
        """测试获取学生特征 - 学生不存在"""

        with app.app_context():
            result = ScorePredictService.get_student_features(99999)

            assert result is None

    def test_get_student_features_empty_records(self, app, sample_user):
        """测试获取学生特征 - 无积分记录"""

        with app.app_context():
            result = ScorePredictService.get_student_features(sample_user.id)

            assert result is not None
            assert result["user_id"] == sample_user.id
            assert result["total_records"] == 0
            assert result["avg_daily_change"] == 0.0

    def test_get_student_features_with_records(self, app, sample_user, db_session):
        """测试获取学生特征 - 有积分记录"""

        with app.app_context():
            for i in range(10):
                record = ScoreRecord(
                    student_id=sample_user.id,
                    rule_id=1,
                    score_change=5 if i % 2 == 0 else -3,
                    description="测试记录"
                )
                db_session.add(record)
            db_session.commit()

            result = ScorePredictService.get_student_features(sample_user.id)

            assert result is not None
            assert result["total_records"] == 10
            assert "avg_daily_change" in result
            assert "score_trend" in result
            assert "class_rank" in result

    def test_max_consecutive_positive(self):
        """测试计算最大连续正积分"""

        changes = [5, 3, -2, 4, 6, 7, -1]
        result = ScorePredictService._max_consecutive_positive(changes)

        assert result == 3

    def test_max_consecutive_positive_none(self):
        """测试计算最大连续正积分 - 无连续"""

        changes = [-5, -3, -2]
        result = ScorePredictService._max_consecutive_positive(changes)

        assert result == 0

    def test_max_consecutive_negative(self):
        """测试计算最大连续负积分"""

        changes = [5, -3, -2, -4, 6, -1]
        result = ScorePredictService._max_consecutive_negative(changes)

        assert result == 3

    def test_max_consecutive_negative_none(self):
        """测试计算最大连续负积分 - 无连续"""

        changes = [5, 3, 2]
        result = ScorePredictService._max_consecutive_negative(changes)

        assert result == 0

    def test_predict_exam_score_not_found(self, app):
        """测试预测考试成绩 - 学生不存在"""

        with app.app_context():
            result = ScorePredictService.predict_exam_score(99999)

            assert "error" in result

    def test_predict_exam_score(self, app, sample_user, db_session):
        """测试预测考试成绩"""

        with app.app_context():
            for i in range(10):
                record = ScoreRecord(
                    student_id=sample_user.id,
                    rule_id=1,
                    score_change=5,
                    description="测试记录"
                )
                db_session.add(record)
            db_session.commit()

            result = ScorePredictService.predict_exam_score(sample_user.id)

            assert result["user_id"] == sample_user.id
            assert "predicted_score" in result
            assert "confidence_interval" in result
            assert "confidence" in result
            assert 0 <= result["predicted_score"] <= 100

    def test_predict_batch(self, app, sample_user, db_session):
        """测试批量预测考试成绩"""

        with app.app_context():
            result = ScorePredictService.predict_batch()

            assert "class_name" in result
            assert "summary" in result
            assert "predictions" in result

    def test_predict_batch_with_class(self, app, sample_user):
        """测试批量预测指定班级"""

        with app.app_context():
            result = ScorePredictService.predict_batch(class_name="测试班级")

            assert result["class_name"] == "测试班级"

    def test_get_score_distribution(self, app):
        """测试获取成绩分布预测"""

        with app.app_context():
            result = ScorePredictService.get_score_distribution()

            assert "distributions" in result
            assert "summary" in result

    def test_get_score_distribution_with_class(self, app):
        """测试获取指定班级成绩分布"""

        with app.app_context():
            result = ScorePredictService.get_score_distribution(
                class_name="测试班级"
            )

            assert result["class_name"] == "测试班级"

    def test_train_score_model_empty(self, app):
        """测试训练成绩预测模型 - 无数据"""

        with app.app_context():
            result = ScorePredictService.train_score_model()

            assert "status" in result

    def test_evaluate_score_model_empty(self, app):
        """测试评估成绩预测模型 - 无数据"""

        with app.app_context():
            result = ScorePredictService.evaluate_score_model()

            assert "status" in result
