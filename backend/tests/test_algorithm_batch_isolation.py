"""算法 service 边界单测：批量单生异常隔离 + 极端输入 + 权重敏感性

覆盖三个此前无隔离的 predict_batch（risk/score_predict/prediction），
以及 composite_score 的权重敏感性与熵权法极端输入。

设计对齐 attribution/engagement 批量标准模式：
单生异常隔离进 failed_students，不影响其余学生与整体响应。
"""

from unittest import mock

import numpy as np

from models import db, User, ScoreRecord
from datetime import datetime, timedelta, date

from services.risk_predict_service import RiskPredictService
from services.score_predict_service import ScorePredictService
from services.prediction_service import PredictionService
from services.composite_score_service import CompositeScoreService
from services.algorithm_service import AlgorithmService


def _seed_users(app, users=((1, "A"), (2, "B"))):
    """seed 一批学生（role=student）。"""
    with app.app_context():
        for sid, name in users:
            db.session.add(
                User(
                    id=sid,
                    name=name,
                    card_id="CARD_%d" % sid,
                    class_name="边界班",
                    role="student",
                )
            )
        db.session.commit()


def _seed_all_negative_scores(app, sid):
    """全负积分流水：构造风险极端输入。"""
    with app.app_context():
        for k in range(6):
            db.session.add(
                ScoreRecord(
                    user_id=sid,
                    score_change=-2,
                    created_at=datetime.combine(date.today(), datetime.min.time())
                    - timedelta(days=k),
                )
            )
        db.session.commit()


class TestRiskBatchIsolation:
    """风险批量：单生异常隔离 + 空班级 + 极端数据"""

    def test_predict_batch_isolates_single_failure(self, app):
        _seed_users(app)
        fake = {
            1: {"overall_risk_level": "low", "overall_risk_score": 0.1},
            2: {"overall_risk_level": "high", "overall_risk_score": 0.9},
        }

        def side_effect(user_id, days=30):
            if user_id == 2:
                raise RuntimeError("boom")
            return fake[user_id]

        with app.app_context():
            with mock.patch.object(RiskPredictService, "predict_risk", side_effect=side_effect):
                res = RiskPredictService.predict_batch("边界班", 30)
        # 单生失败不中断整体
        assert res["failed"] == 1
        assert len(res["failed_students"]) == 1
        assert res["failed_students"][0]["user_id"] == 2
        assert "boom" in res["failed_students"][0]["error"]
        assert len(res["results"]) == 1
        assert res["results"][0]["overall_risk_level"] == "low"
        assert res["summary"]["total_students"] == 2
        assert res["summary"]["low_risk"] == 1

    def test_predict_batch_empty_class_no_crash(self, app):
        _seed_users(app)
        with app.app_context():
            res = RiskPredictService.predict_batch("不存在的班", 30)
        assert res["failed"] == 0
        assert res["failed_students"] == []
        assert res["results"] == []
        assert res["summary"]["total_students"] == 0
        assert res["summary"]["avg_risk_score"] == 0.0

    def test_predict_risk_all_abnormal_data_is_high_or_medium(self, app):
        _seed_users(app, users=((1, "A"),))
        _seed_all_negative_scores(app, 1)
        with app.app_context():
            res = RiskPredictService.predict_risk(1, 30)
        # 连续负分 + 无正向分 → 至少 medium，不应误判 low
        assert res["overall_risk_level"] in ("high", "medium")
        assert res["overall_risk_score"] > 0


class TestScorePredictBatchIsolation:
    """成绩预测批量：单生异常隔离"""

    def test_predict_batch_isolates_single_failure(self, app):
        _seed_users(app)
        fake = {
            1: {"predicted_score": 88, "name": "A"},
            2: {"predicted_score": 72, "name": "B"},
        }

        def side_effect(user_id, days=30):
            if user_id == 1:
                raise RuntimeError("boom")
            return fake[user_id]

        with app.app_context():
            with mock.patch.object(
                ScorePredictService, "predict_exam_score", side_effect=side_effect
            ):
                res = ScorePredictService.predict_batch("边界班", 30)
        assert res["failed"] == 1
        assert len(res["failed_students"]) == 1
        assert res["failed_students"][0]["user_id"] == 1
        assert len(res["predictions"]) == 1
        assert res["predictions"][0]["predicted_score"] == 72
        # summary 仅统计成功学生
        assert res["summary"]["total_students"] == 2
        assert res["summary"]["avg_predicted_score"] == 72.0


class TestPredictionBatchIsolation:
    """积分预测批量：单生异常隔离"""

    def test_predict_batch_isolates_single_failure(self, app):
        _seed_users(app)
        fake = {
            1: {"trend": "rising", "slope": 0.5, "predicted_scores": [80, 85], "current_score": 80},
            2: {
                "trend": "falling",
                "slope": -2.0,
                "predicted_scores": [80, 70],
                "current_score": 80,
            },
        }

        def side_effect(user_id, days=7):
            if user_id == 2:
                raise RuntimeError("boom")
            return fake[user_id]

        with app.app_context():
            with mock.patch.object(
                PredictionService, "predict_future_scores", side_effect=side_effect
            ):
                res = PredictionService.predict_batch("边界班", 7)
        assert res["failed"] == 1
        assert len(res["failed_students"]) == 1
        assert res["failed_students"][0]["user_id"] == 2
        assert len(res["predictions"]) == 1
        assert res["predictions"][0]["prediction"]["trend"] == "rising"
        assert res["summary"]["rising_count"] == 1
        assert res["summary"]["falling_count"] == 0


class TestCompositeWeightSensitivity:
    """综合评分：权重敏感性 + 熵权法极端输入"""

    @staticmethod
    def _two_students_data():
        """A 行为高学术低；B 行为低学术高。"""
        return [
            {
                "user_id": 1,
                "name": "A",
                "class_name": "边界班",
                "behavior": 90,
                "academic": 50,
                "unlock_count": 0,
                "behavior_norm": 0.9,
                "academic_norm": 0.1,
                "compliance_norm": 0.5,
            },
            {
                "user_id": 2,
                "name": "B",
                "class_name": "边界班",
                "behavior": 50,
                "academic": 90,
                "unlock_count": 1,
                "behavior_norm": 0.1,
                "academic_norm": 0.9,
                "compliance_norm": 0.5,
            },
        ]

    def test_calculate_scores_weight_sensitivity(self):
        data = self._two_students_data()
        w_behavior = np.array([0.8, 0.1, 0.1])
        w_academic = np.array([0.1, 0.8, 0.1])
        res_behavior = CompositeScoreService._calculate_scores(data, w_behavior)
        res_academic = CompositeScoreService._calculate_scores(data, w_academic)
        ranking_behavior = {r["user_id"]: r["ranking"] for r in res_behavior}
        ranking_academic = {r["user_id"]: r["ranking"] for r in res_academic}
        # 权重偏行为 → A 第一；权重偏学术 → B 第一：排名随权重翻转
        assert ranking_behavior[1] == 1 and ranking_behavior[2] == 2
        assert ranking_academic[2] == 1 and ranking_academic[1] == 2

    def test_entropy_weight_normalized(self):
        data = np.array([[90, 80, 70], [60, 75, 85], [30, 90, 60]])
        weights = AlgorithmService.entropy_weight(data)
        assert len(weights) == 3
        assert np.isclose(weights.sum(), 1.0)
        assert np.all(weights >= 0)

    def test_entropy_weight_zero_variance_column_no_crash(self):
        # 其中一列全同值（零方差）→ 不炸且归一化
        data = np.array([[80, 50, 90], [80, 60, 80], [80, 90, 70]])
        weights = AlgorithmService.entropy_weight(data)
        assert len(weights) == 3
        assert np.isclose(weights.sum(), 1.0)
        assert np.all(np.isfinite(weights))

    def test_entropy_weight_all_zero_fallback_equal(self):
        data = np.zeros((3, 3))
        weights = AlgorithmService.entropy_weight(data)
        assert np.isclose(weights.sum(), 1.0)
        assert np.allclose(weights, 1.0 / 3)

    def test_calculate_scores_ranking_sequence(self):
        data = self._two_students_data()
        res = CompositeScoreService._calculate_scores(data, np.array([1.0 / 3, 1.0 / 3, 1.0 / 3]))
        assert [r["ranking"] for r in res] == [1, 2]
        # 按综合分降序
        scores = [r["composite_score"] for r in res]
        assert scores == sorted(scores, reverse=True)
