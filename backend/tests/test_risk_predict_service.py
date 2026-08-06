#!/usr/bin/env python3
"""
风险预测服务测试模块
覆盖风险特征提取、各类型风险检测、综合风险预测等功能
"""
"""
"""

from unittest.mock import patch, MagicMock
from services.risk_predict_service import RiskPredictService


class TestRiskPredictService:
    """风险预测服务测试类"""

    def test_get_risk_features_user_not_found(self, app):
        """测试获取风险特征-用户不存在"""
        with app.app_context():
            with patch("services.risk_predict_service.get_by_id", return_value=None):
                features = RiskPredictService.get_risk_features(999)

                assert features is None

    def test_get_risk_features_empty_records(self, app):
        """测试获取风险特征-无记录"""
        with app.app_context():
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.name = "张三"
            mock_user.class_name = "一班"
            mock_user.current_score = 80
            mock_user.role = "student"

            with patch("services.risk_predict_service.get_by_id", return_value=mock_user):
                with patch("services.risk_predict_service.ScoreRecord.query") as mock_query, \
                     patch("services.risk_predict_service.User.query") as mock_user_query:

                    mock_query.filter.return_value.order_by.return_value.all.return_value = []
                    mock_user_query.filter.return_value.all.return_value = [mock_user]

                    features = RiskPredictService.get_risk_features(1)

                    assert features["user_id"] == 1
                    assert features["total_records"] == 0
                    assert features["no_positive_days"] == 30

    def test_get_risk_features_with_records(self, app):
        """测试获取风险特征-有记录"""
        with app.app_context():
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.name = "张三"
            mock_user.class_name = "一班"
            mock_user.current_score = 100
            mock_user.role = "student"

            mock_record1 = MagicMock()
            mock_record1.score_change = 5
            mock_record1.created_at = MagicMock()

            mock_record2 = MagicMock()
            mock_record2.score_change = -3
            mock_record2.created_at = MagicMock()

            mock_record3 = MagicMock()
            mock_record3.score_change = 2
            mock_record3.created_at = MagicMock()

            with patch("services.risk_predict_service.get_by_id", return_value=mock_user):
                with patch("services.risk_predict_service.ScoreRecord.query") as mock_query, \
                     patch("services.risk_predict_service.User.query") as mock_user_query:

                    mock_query.filter.return_value.order_by.return_value.all.return_value = [
                        mock_record1, mock_record2, mock_record3
                    ]
                    mock_user_query.filter.return_value.all.return_value = [mock_user]

                    features = RiskPredictService.get_risk_features(1)

                    assert features["user_id"] == 1
                    assert features["total_records"] == 3
                    assert features["positive_rate"] > 0
                    assert features["negative_rate"] > 0

    def test_count_consecutive_no_positive(self):
        """测试计算连续无正向积分天数"""
        changes = [-1, -2, -3, 5, -1, -2]
        result = RiskPredictService._count_consecutive_no_positive(changes)
        assert result == 3

        changes = [5, -1, -2, -3, -4]
        result = RiskPredictService._count_consecutive_no_positive(changes)
        assert result == 4

        changes = [1, 2, 3]
        result = RiskPredictService._count_consecutive_no_positive(changes)
        assert result == 0

    def test_detect_academic_risk_high(self):
        """测试检测学业风险-高风险"""
        features = {
            "score_trend_30d": -2.0,
            "score_trend_7d": -2.0,
            "class_percentile": 10.0,
            "score_decline_rate": -0.2,
        }

        result = RiskPredictService.detect_academic_risk(features)

        assert result["type"] == "academic"
        assert result["risk_level"] == "high"
        assert result["risk_score"] >= 0.7
        assert len(result["factors"]) >= 3

    def test_detect_academic_risk_medium(self):
        """测试检测学业风险-中风险"""
        features = {
            "score_trend_30d": -1.0,
            "score_trend_7d": 0.5,
            "class_percentile": 25.0,
            "score_decline_rate": 0.0,
        }

        result = RiskPredictService.detect_academic_risk(features)

        assert result["type"] == "academic"
        assert result["risk_level"] == "medium"
        assert 0.4 <= result["risk_score"] < 0.7

    def test_detect_academic_risk_low(self):
        """测试检测学业风险-低风险"""
        features = {
            "score_trend_30d": 1.0,
            "score_trend_7d": 0.5,
            "class_percentile": 80.0,
            "score_decline_rate": 0.1,
        }

        result = RiskPredictService.detect_academic_risk(features)

        assert result["type"] == "academic"
        assert result["risk_level"] == "low"
        assert result["risk_score"] < 0.4

    def test_detect_behavior_risk_high(self):
        """测试检测行为风险-高风险"""
        features = {
            "no_positive_days": 10,
            "negative_rate": 0.8,
            "positive_rate": 0.1,
            "daily_record_count": 0.2,
        }

        result = RiskPredictService.detect_behavior_risk(features)

        assert result["type"] == "behavior"
        assert result["risk_level"] == "high"
        assert result["risk_score"] >= 0.7

    def test_detect_behavior_risk_medium(self):
        """测试检测行为风险-中风险"""
        features = {
            "no_positive_days": 5,
            "negative_rate": 0.4,
            "positive_rate": 0.15,
            "daily_record_count": 0.4,
        }

        result = RiskPredictService.detect_behavior_risk(features)

        assert result["type"] == "behavior"
        assert result["risk_level"] == "medium"
        assert 0.4 <= result["risk_score"] < 0.7

    def test_detect_behavior_risk_low(self):
        """测试检测行为风险-低风险"""
        features = {
            "no_positive_days": 1,
            "negative_rate": 0.2,
            "positive_rate": 0.6,
            "daily_record_count": 1.0,
        }

        result = RiskPredictService.detect_behavior_risk(features)

        assert result["type"] == "behavior"
        assert result["risk_level"] == "low"
        assert result["risk_score"] < 0.4

    def test_detect_attendance_risk_high(self):
        """测试检测出勤风险-高风险"""
        features = {
            "daily_record_count": 0.1,
            "score_volatility": 10.0,
            "total_records": 0,
        }

        result = RiskPredictService.detect_attendance_risk(features)

        assert result["type"] == "attendance"
        assert result["risk_level"] == "high"
        assert result["risk_score"] >= 0.7

    def test_detect_attendance_risk_medium(self):
        """测试检测出勤风险-中风险"""
        features = {
            "daily_record_count": 0.3,
            "score_volatility": 6.0,
            "total_records": 10,
        }

        result = RiskPredictService.detect_attendance_risk(features)

        assert result["type"] == "attendance"
        assert result["risk_level"] == "medium"
        assert 0.4 <= result["risk_score"] < 0.7

    def test_detect_attendance_risk_low(self):
        """测试检测出勤风险-低风险"""
        features = {
            "daily_record_count": 1.0,
            "score_volatility": 2.0,
            "total_records": 30,
        }

        result = RiskPredictService.detect_attendance_risk(features)

        assert result["type"] == "attendance"
        assert result["risk_level"] == "low"
        assert result["risk_score"] < 0.4

    def test_attendance_real_data_drives_risk(self, app):
        """真实考勤数据应被读取并反映到出勤风险，且优先级高于活跃度代理。"""
        with app.app_context():
            import uuid
            from datetime import date, timedelta
            from models import User, Attendance, ClassInfo, db

            suffix = uuid.uuid4().hex[:10]
            cls = ClassInfo(name="ATTEND_CLASS_" + suffix)
            db.session.add(cls)
            db.session.commit()

            user = User(
                name="考勤测试生",
                card_id="ATTEND_CARD_" + suffix,
                class_name="考勤测试班",
                current_score=100,
                role="student",
            )
            db.session.add(user)
            db.session.commit()

            # 10 天：3 天缺勤 + 7 天出勤（迟到视为已到）→ 出勤率 0.7
            today = date.today()
            for i in range(10):
                status = "absent" if i < 3 else "present"
                db.session.add(
                    Attendance(
                        class_id=cls.id,
                        student_id=user.id,
                        date=today - timedelta(days=i),
                        status=status,
                    )
                )
            db.session.commit()

            features = RiskPredictService.get_risk_features(user.id)
            assert features is not None
            assert features["attendance_rate"] is not None
            assert features["attendance_rate"] == 0.7
            assert features["attendance_absent_count"] == 3

            att_result = RiskPredictService.detect_attendance_risk(features)
            # 出勤率 0.7 < 0.8 → 至少中风险，且因素来自真实考勤
            assert att_result["risk_level"] in ("medium", "high")
            assert any(f["factor"] == "attendance_rate" for f in att_result["factors"])

    def test_predict_risk_user_not_found(self, app):
        """测试预测风险-用户不存在"""
        with app.app_context():
            with patch("services.risk_predict_service.RiskPredictService.get_risk_features", return_value=None):
                result = RiskPredictService.predict_risk(999)

                assert "error" in result
                assert result["error"] == "学生不存在"

    def test_predict_risk_high(self, app):
        """测试预测风险-高风险"""
        with app.app_context():
            features = {
                "user_id": 1,
                "name": "张三",
                "class_name": "一班",
                "current_score": 30,
                "total_records": 10,
                "score_trend_30d": -2.0,
                "score_trend_7d": -2.0,
                "class_percentile": 10.0,
                "score_decline_rate": -0.2,
                "no_positive_days": 10,
                "negative_rate": 0.8,
                "positive_rate": 0.1,
                "daily_record_count": 0.2,
                "score_volatility": 10.0,
            }

            with patch("services.risk_predict_service.RiskPredictService.get_risk_features", return_value=features):
                result = RiskPredictService.predict_risk(1)

                assert result["user_id"] == 1
                assert result["name"] == "张三"
                assert result["overall_risk_level"] == "high"
                assert "risk_details" in result
                assert "intervention_suggestions" in result
                assert "recommended_actions" in result

    def test_predict_risk_low(self, app):
        """测试预测风险-低风险"""
        with app.app_context():
            features = {
                "user_id": 1,
                "name": "张三",
                "class_name": "一班",
                "current_score": 90,
                "total_records": 30,
                "score_trend_30d": 1.0,
                "score_trend_7d": 0.5,
                "class_percentile": 80.0,
                "score_decline_rate": 0.1,
                "no_positive_days": 1,
                "negative_rate": 0.2,
                "positive_rate": 0.6,
                "daily_record_count": 1.0,
                "score_volatility": 2.0,
            }

            with patch("services.risk_predict_service.RiskPredictService.get_risk_features", return_value=features):
                result = RiskPredictService.predict_risk(1)

                assert result["overall_risk_level"] == "low"
                assert "当前表现正常" in result["intervention_suggestions"][0]

    def test_predict_batch_empty(self, app):
        """测试批量预测风险-空数据"""
        with app.app_context():
            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = RiskPredictService.predict_batch()

                assert result["summary"]["total_students"] == 0
                assert len(result["results"]) == 0

    def test_predict_batch_with_data(self, app):
        """测试批量预测风险-有数据"""
        with app.app_context():
            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.name = "张三"
            mock_user1.role = "student"

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.name = "李四"
            mock_user2.role = "student"

            mock_result1 = {
                "user_id": 1,
                "overall_risk_level": "high",
                "overall_risk_score": 0.8,
            }

            mock_result2 = {
                "user_id": 2,
                "overall_risk_level": "low",
                "overall_risk_score": 0.2,
            }

            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2]

                with patch("services.risk_predict_service.RiskPredictService.predict_risk") as mock_predict:
                    mock_predict.side_effect = [mock_result1, mock_result2]

                    result = RiskPredictService.predict_batch()

                    assert result["summary"]["total_students"] == 2
                    assert result["summary"]["high_risk"] == 1
                    assert result["summary"]["low_risk"] == 1
                    assert len(result["results"]) == 2

    def test_train_risk_model_no_students(self, app):
        """测试训练风险模型-无学生数据"""
        with app.app_context():
            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = RiskPredictService.train_risk_model(days=30)

                assert result["status"] == "error"
                assert "没有学生数据" in result["message"]
                assert result["model_info"] == {}

    def test_train_risk_model_no_valid_data(self, app):
        """测试训练风险模型-无有效训练数据"""
        with app.app_context():
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.role = "student"

            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user]

                with patch("services.risk_predict_service.RiskPredictService.get_risk_features", return_value=None):
                    result = RiskPredictService.train_risk_model(days=30)

                    assert result["status"] == "error"
                    assert "没有足够的有效训练数据" in result["message"]

    def test_train_risk_model_with_data(self, app):
        """测试训练风险模型-有数据"""
        with app.app_context():
            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.role = "student"

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.role = "student"

            mock_features1 = {
                "score_trend_30d": -1.0,
                "score_trend_7d": -0.5,
                "positive_rate": 0.3,
                "negative_rate": 0.4,
                "class_percentile": 40.0,
                "score_volatility": 3.0,
                "daily_record_count": 0.6,
            }

            mock_features2 = {
                "score_trend_30d": 0.5,
                "score_trend_7d": 0.3,
                "positive_rate": 0.6,
                "negative_rate": 0.2,
                "class_percentile": 70.0,
                "score_volatility": 2.0,
                "daily_record_count": 1.0,
            }

            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2]

                with patch("services.risk_predict_service.RiskPredictService.get_risk_features") as mock_get_features:
                    mock_get_features.side_effect = [mock_features1, mock_features2]

                    result = RiskPredictService.train_risk_model(days=30)

                    assert result["status"] == "success"
                    assert "模型训练完成" in result["message"]
                    assert "model_info" in result
                    assert result["model_info"]["valid_students"] == 2
                    assert "feature_distributions" in result["model_info"]
                    assert "optimal_thresholds" in result["model_info"]
                    assert "risk_type_weights" in result["model_info"]

    def test_evaluate_risk_model_no_students(self, app):
        """测试评估风险模型-无学生数据"""
        with app.app_context():
            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = []

                result = RiskPredictService.evaluate_risk_model(days=30)

                assert result["status"] == "error"
                assert "没有学生数据" in result["message"]
                assert result["metrics"] == {}

    def test_evaluate_risk_model_insufficient_data(self, app):
        """测试评估风险模型-数据不足"""
        with app.app_context():
            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.role = "student"

            mock_result = {
                "overall_risk_score": 0.8,
                "overall_risk_level": "high",
                "risk_details": {
                    "academic": {"risk_level": "high"},
                    "behavior": {"risk_level": "low"},
                    "attendance": {"risk_level": "low"},
                },
                "risk_factors": [],
            }

            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user]

                with patch("services.risk_predict_service.RiskPredictService.predict_risk", return_value=mock_result):
                    result = RiskPredictService.evaluate_risk_model(days=30)

                    assert result["status"] == "error"
                    assert "没有足够的评估数据" in result["message"]

    def test_evaluate_risk_model_with_data(self, app):
        """测试评估风险模型-有数据"""
        with app.app_context():
            mock_user1 = MagicMock()
            mock_user1.id = 1
            mock_user1.role = "student"

            mock_user2 = MagicMock()
            mock_user2.id = 2
            mock_user2.role = "student"

            mock_user3 = MagicMock()
            mock_user3.id = 3
            mock_user3.role = "student"

            mock_result1 = {
                "overall_risk_score": 0.85,
                "overall_risk_level": "high",
                "risk_details": {
                    "academic": {"risk_level": "high"},
                    "behavior": {"risk_level": "medium"},
                    "attendance": {"risk_level": "low"},
                },
                "risk_factors": [{"factor": "score_decline"}, {"factor": "low_percentile"}],
            }

            mock_result2 = {
                "overall_risk_score": 0.55,
                "overall_risk_level": "medium",
                "risk_details": {
                    "academic": {"risk_level": "medium"},
                    "behavior": {"risk_level": "medium"},
                    "attendance": {"risk_level": "low"},
                },
                "risk_factors": [{"factor": "high_negative_rate"}],
            }

            mock_result3 = {
                "overall_risk_score": 0.2,
                "overall_risk_level": "low",
                "risk_details": {
                    "academic": {"risk_level": "low"},
                    "behavior": {"risk_level": "low"},
                    "attendance": {"risk_level": "low"},
                },
                "risk_factors": [],
            }

            with patch("services.risk_predict_service.User.query") as mock_query:
                mock_query.filter.return_value.all.return_value = [mock_user1, mock_user2, mock_user3]

                with patch("services.risk_predict_service.RiskPredictService.predict_risk") as mock_predict:
                    mock_predict.side_effect = [mock_result1, mock_result2, mock_result3]

                    result = RiskPredictService.evaluate_risk_model(days=30)

                    assert result["status"] == "success"
                    assert "模型评估完成" in result["message"]
                    assert "metrics" in result
                    assert result["metrics"]["evaluated_students"] == 3
                    assert "risk_distribution" in result["metrics"]
                    assert "risk_score_stats" in result["metrics"]
                    assert "detection_rates" in result["metrics"]
