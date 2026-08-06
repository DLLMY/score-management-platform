#!/usr/bin/env python3
"""
"""
# 风险预警服务测试模块
"""
"""

from services.warning_service import WarningService


class TestWarningService:
    """风险预警服务测试"""

    def test_evaluate_risk_empty(self, app):
        """测试评估风险 - 无学生数据"""

        with app.app_context():
            result = WarningService.evaluate_risk(class_name="不存在的班级")

            assert "risk_students" in result
            assert "warning_reasons" in result

    def test_evaluate_risk_with_student(self, app, sample_user):
        """测试评估风险 - 有学生数据"""

        with app.app_context():
            result = WarningService.evaluate_risk(class_name="测试班级")

            assert "risk_threshold" in result
            assert "risk_students" in result

    def test_get_no_positive_days(self, app, sample_user, db_session):
        """测试获取连续无正向积分天数"""

        with app.app_context():
            days = WarningService._get_no_positive_days(sample_user.id)

            assert isinstance(days, int)
            assert days >= 0

    def test_get_today_unlock_count(self, app, sample_user):
        """测试获取今日开锁次数"""

        with app.app_context():
            count = WarningService._get_today_unlock_count(sample_user.id)

            assert isinstance(count, int)
            assert count >= 0

    def test_get_student_avg_score(self, app, sample_user):
        """测试获取学生平均成绩"""

        with app.app_context():
            avg_score = WarningService._get_student_avg_score(sample_user.id)

            assert avg_score is None or isinstance(avg_score, float)

    def test_calculate_risk_score(self, app, sample_user):
        """测试计算风险评分"""

        with app.app_context():
            risk_score = WarningService._calculate_risk_score(
                sample_user, ["测试原因"]
            )

            assert isinstance(risk_score, float)
            assert 0 <= risk_score <= 1.0

    def test_get_config(self, app):
        """测试获取预警配置"""

        with app.app_context():
            config = WarningService.get_config()

            assert isinstance(config, dict)
            assert "score_threshold" in config
            assert "unlock_daily_limit" in config

    def test_get_warnings(self, app):
        """测试获取风险预警列表"""

        with app.app_context():
            result = WarningService.get_warnings()

            assert "risk_students" in result
            assert "warning_reasons" in result
            assert "total_risk_count" in result

    def test_get_warnings_with_class(self, app):
        """测试获取指定班级风险预警"""

        with app.app_context():
            result = WarningService.get_warnings(class_name="测试班级")

            assert "risk_students" in result

    def test_resolve_warning(self, app):
        """测试解决预警"""

        with app.app_context():
            result = WarningService.resolve_warning(99999)

            assert result is False

    def test_update_config(self, app):
        """测试更新预警配置"""

        with app.app_context():
            result = WarningService.update_config(
                "score_threshold", "40", "测试更新"
            )

            assert result is True

    def test_update_config_invalid(self, app):
        """测试更新无效配置"""

        with app.app_context():
            result = WarningService.update_config("invalid_key", "value")

            assert result is False


class TestEscalateRiskLevel:
    """风险等级升级逻辑测试

    背景：原实现用 max(risk_level, "medium") 合并风险等级，
    但那是字符串字典序比较（high < low < medium），与真实严重度
    （low < medium < high）不符，会出现两类错误：
      1. max("medium", "high") == "medium"  ->  该升不升
      2. max("high", "medium") == "medium"  ->  高危被反向降级
    本类锁定 escalate_risk_level 的正确语义。
    """

    def test_escalates_to_more_severe(self):
        """低等级遇到高等级时应升级"""
        assert WarningService.escalate_risk_level("low", "medium") == "medium"
        assert WarningService.escalate_risk_level("low", "high") == "high"
        assert WarningService.escalate_risk_level("medium", "high") == "high"

    def test_never_downgrades(self):
        """已有更高等级时不得被低等级覆盖"""
        assert WarningService.escalate_risk_level("high", "medium") == "high"
        assert WarningService.escalate_risk_level("high", "low") == "high"
        assert WarningService.escalate_risk_level("medium", "low") == "medium"

    def test_idempotent_on_same_level(self):
        """同等级合并结果不变"""
        for level in ("low", "medium", "high"):
            assert WarningService.escalate_risk_level(level, level) == level

    def test_differs_from_string_max(self):
        """回归锚点：结果必须与字典序 max 不同，防止改回 max()"""
        # 这两组正是原实现出错的场景
        assert max("medium", "high") == "medium"
        assert WarningService.escalate_risk_level("medium", "high") == "high"

        assert max("high", "medium") == "medium"
        assert WarningService.escalate_risk_level("high", "medium") == "high"

    def test_unknown_level_treated_as_lowest(self):
        """未知等级按最低严重度处理，不得意外升级"""
        assert WarningService.escalate_risk_level("high", "unknown") == "high"
        assert WarningService.escalate_risk_level("unknown", "medium") == "medium"
