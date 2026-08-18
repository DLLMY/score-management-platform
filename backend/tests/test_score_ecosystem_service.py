#!/usr/bin/env python3
""" """

# 积分生态系统服务测试模块
"""
"""

from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

try:
    from services.score_ecosystem_service import ScoreEcosystem
except ImportError:
    pass


class TestScoreEcosystem:
    """积分生态系统测试类"""

    def test_calculate_earning_valid(self):
        """测试计算积分获取-有效行为类型"""
        from services.score_ecosystem_service import ScoreEcosystem

        ecosystem = ScoreEcosystem()
        result = ecosystem.calculate_earning("attendance")

        assert result == 5

    def test_calculate_earning_invalid(self):
        """测试计算积分获取-无效行为类型"""

        ecosystem = ScoreEcosystem()
        result = ecosystem.calculate_earning("invalid_type")

        assert result == 0

    def test_calculate_earning_with_context(self):
        """测试计算积分获取-带上下文"""

        ecosystem = ScoreEcosystem()
        context = {"multiplier": 1.5, "random_factor": 0.5}
        result = ecosystem.calculate_earning("attendance", context)

        assert result > 0

    def test_calculate_spending_valid(self):
        """测试计算积分消费-有效类型"""

        ecosystem = ScoreEcosystem()
        result = ecosystem.calculate_spending("phone_access", 100)

        assert result["success"]
        assert result["cost"] == 30
        assert result["remaining_score"] == 70

    def test_calculate_spending_invalid(self):
        """测试计算积分消费-无效类型"""

        ecosystem = ScoreEcosystem()
        result = ecosystem.calculate_spending("invalid_type", 100)

        assert not result["success"]
        assert result["error"] == "消费类型不存在"

    def test_calculate_spending_insufficient_score(self):
        """测试计算积分消费-积分不足"""

        ecosystem = ScoreEcosystem()
        result = ecosystem.calculate_spending("reward_redemption", 50)

        assert not result["success"]
        assert "积分不足" in result["error"]

    def test_check_score_validity_valid(self):
        """测试检查积分有效期-有效"""

        ecosystem = ScoreEcosystem()
        last_earned = datetime.now() - timedelta(days=100)
        result = ecosystem.check_score_validity(last_earned)

        assert result["valid"]
        assert result["days_remaining"] > 0

    def test_check_score_validity_expired(self):
        """测试检查积分有效期-已过期"""

        ecosystem = ScoreEcosystem()
        last_earned = datetime.now() - timedelta(days=400)
        result = ecosystem.check_score_validity(last_earned)

        assert not result["valid"]
        assert result["days_expired"] > 0

    def test_apply_bounds(self):
        """测试应用分数边界限制"""

        ecosystem = ScoreEcosystem()

        assert ecosystem.apply_bounds(1500) == 1000
        assert ecosystem.apply_bounds(-50) == 0
        assert ecosystem.apply_bounds(500) == 500

    def test_earn_score(self, app):
        """测试获取积分"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 80

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                with patch("services.score_ecosystem_service.db_session_scope"):
                    with patch("services.score_ecosystem_service.db.session.add"):
                        result = ecosystem.earn_score(1, "attendance")

                        assert result["success"]
                        assert result["score_change"] == 5
                        assert result["new_score"] == 85

    def test_earn_score_user_not_found(self, app):
        """测试获取积分-用户不存在"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = None

                result = ecosystem.earn_score(999, "attendance")

                assert not result["success"]
                assert result["error"] == "用户不存在"

    def test_earn_score_invalid_behavior(self, app):
        """测试获取积分-无效行为类型"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 80

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                result = ecosystem.earn_score(1, "invalid_type")

                assert not result["success"]
                assert result["error"] == "无效的行为类型"

    def test_spend_score(self, app):
        """测试消费积分"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 100

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                with patch("services.score_ecosystem_service.db_session_scope"):
                    with patch("services.score_ecosystem_service.db.session.add"):
                        result = ecosystem.spend_score(1, "phone_access")

                        assert result["success"]
                        assert result["cost"] == 30
                        assert result["new_score"] == 70

    def test_spend_score_user_not_found(self, app):
        """测试消费积分-用户不存在"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = None

                result = ecosystem.spend_score(999, "phone_access")

                assert not result["success"]
                assert result["error"] == "用户不存在"

    def test_spend_score_insufficient(self, app):
        """测试消费积分-积分不足"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 20

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                result = ecosystem.spend_score(1, "phone_access")

                assert not result["success"]
                assert "积分不足" in result["error"]

    def test_spend_score_invalid_type(self, app):
        """测试消费积分-无效类型"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 100

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                result = ecosystem.spend_score(1, "invalid_type")

                assert not result["success"]
                assert result["error"] == "消费类型不存在"

    def test_get_earning_rules(self):
        """测试获取积分获取规则"""

        ecosystem = ScoreEcosystem()
        rules = ecosystem.get_earning_rules()

        assert len(rules) == 5
        for rule in rules:
            assert "behavior_type" in rule
            assert "base_score" in rule
            assert "variance" in rule
            assert "description" in rule

    def test_get_spending_rules(self):
        """测试获取积分消费规则"""

        ecosystem = ScoreEcosystem()
        rules = ecosystem.get_spending_rules()

        assert len(rules) == 3
        for rule in rules:
            assert "spending_type" in rule
            assert "base_cost" in rule
            assert "min_score" in rule
            assert "description" in rule

    def test_get_user_balance(self, app):
        """测试获取用户积分余额"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            mock_user = MagicMock()
            mock_user.id = 1
            mock_user.current_score = 80

            mock_record = MagicMock()
            mock_record.created_at = datetime.now() - timedelta(days=100)

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = mock_user

                with patch("services.score_ecosystem_service.ScoreRecord.query") as mock_query:
                    mock_query.filter.return_value.order_by.return_value.first.return_value = (
                        mock_record
                    )

                    result = ecosystem.get_user_balance(1)

                    assert result["success"]
                    assert result["user_id"] == 1
                    assert result["current_score"] == 80
                    assert result["score_validity"]["valid"]

    def test_get_user_balance_not_found(self, app):
        """测试获取用户积分余额-用户不存在"""
        with app.app_context():

            ecosystem = ScoreEcosystem()

            with patch("services.score_ecosystem_service.get_by_id") as mock_get_by_id:
                mock_get_by_id.return_value = None

                result = ecosystem.get_user_balance(999)

                assert not result["success"]
                assert result["error"] == "用户不存在"
