#!/usr/bin/env python3
"""
奖励服务测试模块
覆盖手机拿取、奖励兑换、积分调整等功能
"""

"""
"""

from unittest.mock import patch, MagicMock
from services.reward_service import PhoneAccessHandler, RewardSystem, RewardInteractionController


class TestPhoneAccessHandler:
    """手机拿取处理测试类"""

    def test_handle_phone_access_user_not_found(self, app):
        """测试手机拿取-用户不存在"""
        with app.app_context():
            handler = PhoneAccessHandler()

            with patch("services.reward_service.get_by_id", return_value=None):
                result = handler.handle_phone_access(999)

                assert result["success"] is False
                assert result["error"] == "用户不存在"

    def test_handle_phone_access_insufficient_score(self, app):
        """测试手机拿取-积分不足"""
        with app.app_context():
            handler = PhoneAccessHandler()

            mock_user = MagicMock()
            mock_user.current_score = 50

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                result = handler.handle_phone_access(1)

                assert result["success"] is False
                assert "积分不足" in result["error"]
                assert result["current_score"] == 50

    def test_handle_phone_access_success(self, app):
        """测试手机拿取-成功"""
        with app.app_context():
            handler = PhoneAccessHandler()

            mock_user = MagicMock()
            mock_user.current_score = 300

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.db_session_scope"):
                    with patch("services.reward_service.db.session.add"):
                        result = handler.handle_phone_access(1)

                        assert result["success"] is True
                        assert result["deducted_score"] == 30
                        assert result["remaining_score"] == 270

    def test_handle_phone_access_min_deduction_ratio(self, app):
        """测试手机拿取-最小扣除比例"""
        with app.app_context():
            handler = PhoneAccessHandler()
            handler.min_deduction_ratio = 0.1

            mock_user = MagicMock()
            mock_user.current_score = 1000

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.db_session_scope"):
                    with patch("services.reward_service.db.session.add"):
                        result = handler.handle_phone_access(1)

                        assert result["deducted_score"] == 100
                        assert result["deduction_ratio"] == 0.1

    def test_handle_phone_access_max_deduction_ratio(self, app):
        """测试手机拿取-最大扣除比例"""
        with app.app_context():
            handler = PhoneAccessHandler()

            mock_user = MagicMock()
            mock_user.current_score = 100

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.db_session_scope"):
                    with patch("services.reward_service.db.session.add"):
                        result = handler.handle_phone_access(1, access_count=5)

                        assert result["deducted_score"] == 15
                        assert result["deduction_ratio"] == 0.15

    def test_handle_phone_access_multiple(self, app):
        """测试手机拿取-多次拿取"""
        with app.app_context():
            handler = PhoneAccessHandler()

            mock_user = MagicMock()
            mock_user.current_score = 600

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.db_session_scope"):
                    with patch("services.reward_service.db.session.add"):
                        result = handler.handle_phone_access(1, access_count=2)

                        assert result["success"] is True
                        assert result["deducted_score"] == 60
                        assert result["remaining_score"] == 540


class TestRewardSystem:
    """奖励体系测试类"""

    def test_get_eligible_rewards(self, app):
        """测试获取可兑换奖励"""
        with app.app_context():
            system = RewardSystem()

            mock_user = MagicMock()
            mock_user.current_score = 80

            rewards = system.get_eligible_rewards(mock_user)

            assert len(rewards) == 5
            assert rewards[0]["type"] == "phone_access"
            assert rewards[0]["can_afford"] is True
            assert rewards[1]["can_afford"] is True
            assert rewards[2]["can_afford"] is False

    def test_get_user_eligible_rewards_user_not_found(self, app):
        """测试获取用户可兑换奖励-用户不存在"""
        with app.app_context():
            system = RewardSystem()

            with patch("services.reward_service.get_by_id", return_value=None):
                result = system.get_user_eligible_rewards(999)

                assert result["success"] is False
                assert result["error"] == "用户不存在"

    def test_get_user_eligible_rewards_success(self, app):
        """测试获取用户可兑换奖励-成功"""
        with app.app_context():
            system = RewardSystem()

            mock_user = MagicMock()
            mock_user.current_score = 150

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                result = system.get_user_eligible_rewards(1)

                assert result["success"] is True
                assert len(result["rewards"]) == 5
                assert result["current_score"] == 150

    def test_redeem_reward_invalid_type(self, app):
        """测试兑换奖励-无效类型"""
        with app.app_context():
            system = RewardSystem()

            mock_user = MagicMock()

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                result = system.redeem_reward(1, "invalid_type")

                assert result["success"] is False
                assert result["error"] == "奖励类型不存在"

    def test_redeem_reward_insufficient_score(self, app):
        """测试兑换奖励-积分不足"""
        with app.app_context():
            system = RewardSystem()

            mock_user = MagicMock()
            mock_user.current_score = 20

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                result = system.redeem_reward(1, "phone_access")

                assert result["success"] is False
                assert "积分不足" in result["error"]

    def test_redeem_reward_daily_limit_reached(self, app):
        """测试兑换奖励-达到每日限制"""
        with app.app_context():
            system = RewardSystem()

            mock_user = MagicMock()
            mock_user.current_score = 100

            mock_query = MagicMock()
            mock_query.filter.return_value.count.return_value = 1

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.ScoreRecord.query", mock_query):
                    result = system.redeem_reward(1, "phone_access")

                    assert result["success"] is False
                    assert "今日已使用" in result["error"]

    def test_redeem_reward_success(self, app):
        """测试兑换奖励-成功"""
        with app.app_context():
            system = RewardSystem()

            mock_user = MagicMock()
            mock_user.current_score = 100

            mock_query = MagicMock()
            mock_query.filter.return_value.count.return_value = 0

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.ScoreRecord.query", mock_query):
                    with patch("services.reward_service.db_session_scope"):
                        with patch("services.reward_service.db.session.add"):
                            result = system.redeem_reward(1, "phone_access")

                            assert result["success"] is True
                            assert result["reward_type"] == "phone_access"
                            assert result["cost"] == 30
                            assert result["remaining_score"] == 70

    def test_get_reward_types(self, app):
        """测试获取所有奖励类型"""
        with app.app_context():
            system = RewardSystem()

            reward_types = system.get_reward_types()

            assert len(reward_types) == 5
            assert reward_types[0]["type"] == "phone_access"
            assert reward_types[1]["type"] == "early_leave"


class TestRewardInteractionController:
    """奖励间关联控制测试类"""

    def test_calculate_adjusted_change_user_not_found(self, app):
        """测试计算调整后积分-用户不存在"""
        with app.app_context():
            controller = RewardInteractionController()

            with patch("services.reward_service.get_by_id", return_value=None):
                result = controller.calculate_adjusted_change(999, 10, "normal")

                assert result == 10

    def test_calculate_adjusted_change_positive_boost(self, app):
        """测试计算调整后积分-正向加成"""
        with app.app_context():
            controller = RewardInteractionController()

            mock_user = MagicMock()
            mock_user.current_score = 100

            mock_query = MagicMock()
            mock_query.filter.return_value.all.return_value = []

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.ScoreRecord.query", mock_query):
                    result = controller.calculate_adjusted_change(1, 10, "exam")

                    assert result == 12.0

    def test_calculate_adjusted_change_no_boost(self, app):
        """测试计算调整后积分-无加成"""
        with app.app_context():
            controller = RewardInteractionController()

            mock_user = MagicMock()
            mock_user.current_score = 100

            mock_query = MagicMock()
            mock_query.filter.return_value.all.return_value = []

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.ScoreRecord.query", mock_query):
                    result = controller.calculate_adjusted_change(1, 10, "normal")

                    assert result == 10.0

    def test_calculate_adjusted_change_daily_limit(self, app):
        """测试计算调整后积分-每日上限"""
        with app.app_context():
            controller = RewardInteractionController()
            controller.max_score_change_per_day = 20

            mock_user = MagicMock()
            mock_user.current_score = 100

            mock_record = MagicMock()
            mock_record.score_change = 15

            mock_query = MagicMock()
            mock_query.filter.return_value.all.return_value = [mock_record]

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.ScoreRecord.query", mock_query):
                    result = controller.calculate_adjusted_change(1, 10, "normal")

                    assert result == 5.0

    def test_calculate_adjusted_change_max_negative_ratio(self, app):
        """测试计算调整后积分-最大负向比例"""
        with app.app_context():
            controller = RewardInteractionController()

            mock_user = MagicMock()
            mock_user.current_score = 100

            mock_query = MagicMock()
            mock_query.filter.return_value.all.return_value = []

            with patch("services.reward_service.get_by_id", return_value=mock_user):
                with patch("services.reward_service.ScoreRecord.query", mock_query):
                    result = controller.calculate_adjusted_change(1, -50, "normal")

                    assert result == -20.0

    def test_validate_reward_combination_valid(self, app):
        """测试验证奖励组合-有效"""
        with app.app_context():
            controller = RewardInteractionController()

            result = controller.validate_reward_combination(1, ["phone_access", "gift_redemption"])

            assert result["valid"] is True

    def test_validate_reward_combination_invalid(self, app):
        """测试验证奖励组合-无效"""
        with app.app_context():
            controller = RewardInteractionController()

            result = controller.validate_reward_combination(1, ["phone_access", "early_leave"])

            assert result["valid"] is False
            assert "不能同时使用" in result["error"]

    def test_get_daily_usage(self, app):
        """测试获取今日奖励使用情况"""
        with app.app_context():
            controller = RewardInteractionController()

            mock_record1 = MagicMock()
            mock_record1.rule_id = "phone_access"
            mock_record1.description = "兑换奖励：手机拿取资格"

            mock_record2 = MagicMock()
            mock_record2.rule_id = "phone_access"
            mock_record2.description = "兑换奖励：手机拿取资格"

            mock_query = MagicMock()
            mock_query.filter.return_value.all.return_value = [mock_record1, mock_record2]

            with patch("services.reward_service.ScoreRecord.query", mock_query):
                result = controller.get_daily_usage(1)

                assert result["success"] is True
                assert result["daily_usage"]["phone_access"] == 2
