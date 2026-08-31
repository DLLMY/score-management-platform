import pytest
from unittest.mock import Mock, patch

from services.rule_engine_service import (
    RuleMatcher,
    ParameterMapper,
    RulePriorityEngine,
    RuleExecutionEngine,
)

try:
    from app import app
except ImportError:
    pass


@pytest.fixture(autouse=True)
def app_context():
    from app import app

    with app.app_context():
        yield


class TestRuleMatcher:
    """测试规则匹配器"""

    def test_match_rules_empty_output(self):
        """测试空模型输出"""
        matcher = RuleMatcher()
        result = matcher.match_rules({}, {})
        assert result == []

    def test_match_rules_below_threshold(self):
        """测试置信度低于阈值"""
        matcher = RuleMatcher()
        model_output = {"recommendations": [{"rule_id": 1, "confidence": 0.5}]}
        result = matcher.match_rules(model_output, {})
        assert result == []

    def test_match_rules_above_threshold(self):
        """测试置信度高于阈值"""
        matcher = RuleMatcher()
        mock_rule = Mock()
        mock_rule.id = 1
        mock_rule.name = "测试规则"
        mock_rule.rule_type = "add"
        mock_rule.score_change = 5
        mock_rule.category = "test"
        mock_rule.priority = "P2"
        mock_rule.enabled = True
        mock_rule.match_condition = ""
        mock_rule.created_at = None

        with patch("services.rule_engine_service.get_by_id", return_value=mock_rule):
            model_output = {
                "recommendations": [{"rule_id": 1, "confidence": 0.998, "conditions": {}}]
            }
            result = matcher.match_rules(model_output, {})
            assert len(result) == 1
            assert result[0]["rule"]["id"] == 1
            assert result[0]["confidence"] == 0.998

    def test_match_rules_cache(self):
        """测试规则缓存"""
        matcher = RuleMatcher()
        mock_rule = Mock()
        mock_rule.id = 1
        mock_rule.name = "缓存测试规则"
        mock_rule.rule_type = "add"
        mock_rule.score_change = 5
        mock_rule.category = "test"
        mock_rule.priority = "P2"
        mock_rule.enabled = True
        mock_rule.match_condition = ""
        mock_rule.created_at = None

        with patch("services.rule_engine_service.get_by_id", return_value=mock_rule) as mock_get:
            model_output = {"recommendations": [{"rule_id": 1, "confidence": 0.998}]}

            matcher.match_rules(model_output, {})
            matcher.match_rules(model_output, {})

            assert mock_get.call_count == 1

    def test_clear_cache(self):
        """测试清除缓存"""
        matcher = RuleMatcher()
        matcher.rule_cache = {1: {"id": 1}}
        matcher.clear_cache()
        assert matcher.rule_cache == {}


class TestParameterMapper:
    """测试参数映射器"""

    def test_map_parameters_empty(self):
        """测试空模型输出"""
        mapper = ParameterMapper()
        result = mapper.map_parameters({}, {"base": "value"})
        assert result == {"base": "value"}

    def test_map_parameters_direct_transform(self):
        """测试直接转换"""
        mapper = ParameterMapper()
        model_output = {"confidence": 0.95}
        result = mapper.map_parameters(model_output, {})
        assert result["match_threshold"] == 0.95

    def test_map_parameters_scale_0_1(self):
        """测试0-1缩放转换"""
        mapper = ParameterMapper()
        model_output = {"support": 1.5}
        result = mapper.map_parameters(model_output, {})
        assert result["min_usage_rate"] == 1.0

        model_output = {"support": -0.5}
        result = mapper.map_parameters(model_output, {})
        assert result["min_usage_rate"] == 0.0

        model_output = {"support": 0.5}
        result = mapper.map_parameters(model_output, {})
        assert result["min_usage_rate"] == 0.5

    def test_map_parameters_normalize(self):
        """测试归一化转换"""
        mapper = ParameterMapper()
        model_output = {"lift": 11}
        result = mapper.map_parameters(model_output, {})
        assert result["effectiveness_weight"] == 1.0

        model_output = {"lift": 1}
        result = mapper.map_parameters(model_output, {})
        assert result["effectiveness_weight"] == 0

        model_output = {"lift": 6}
        result = mapper.map_parameters(model_output, {})
        assert result["effectiveness_weight"] == 0.5

    def test_map_parameters_dynamic_calculate(self):
        """测试动态计算转换"""
        mapper = ParameterMapper()
        model_output = {"score_change": 10}
        result = mapper.map_parameters(model_output, {})
        assert result["base_score"] == 12


class TestRulePriorityEngine:
    """测试规则优先级引擎"""

    def test_resolve_conflicts_empty(self):
        """测试空规则列表"""
        engine = RulePriorityEngine()
        result = engine.resolve_conflicts([])
        assert result == []

    def test_resolve_by_highest_priority(self):
        """测试按最高优先级解决"""
        engine = RulePriorityEngine(conflict_strategy="highest_priority")
        rules = [
            {"priority": "P2", "rule": {"created_at": "2024-01-01"}},
            {"priority": "P1", "rule": {"created_at": "2024-01-02"}},
            {"priority": "P1", "rule": {"created_at": "2024-01-03"}},
            {"priority": "P3", "rule": {"created_at": "2024-01-04"}},
        ]
        result = engine.resolve_conflicts(rules)
        assert len(result) == 2
        assert all(r["priority"] == "P1" for r in result)

    def test_resolve_by_merge(self):
        """测试合并策略"""
        engine = RulePriorityEngine(conflict_strategy="merge")
        rules = [
            {"priority": "P2", "rule": {"created_at": "2024-01-01"}},
            {"priority": "P1", "rule": {"created_at": "2024-01-02"}},
        ]
        result = engine.resolve_conflicts(rules)
        assert len(result) == 2
        assert result[0]["priority"] == "P1"
        assert result[1]["priority"] == "P2"

    def test_resolve_by_latest(self):
        """测试按最新规则解决"""
        engine = RulePriorityEngine(conflict_strategy="latest")
        rules = [
            {"priority": "P2", "rule": {"created_at": "2024-01-01"}},
            {"priority": "P1", "rule": {"created_at": "2024-01-03"}},
            {"priority": "P1", "rule": {"created_at": "2024-01-02"}},
        ]
        result = engine.resolve_conflicts(rules)
        assert len(result) == 1
        assert result[0]["rule"]["created_at"] == "2024-01-03"


class TestRuleExecutionEngine:
    """测试规则执行引擎"""

    def test_execute_rules_user_not_found(self):
        """测试用户不存在"""
        engine = RuleExecutionEngine()
        with patch("services.rule_engine_service.get_by_id", return_value=None):
            result = engine.execute_rules({}, {"user_id": 1})
            assert not result["success"]
            assert result["error"] == "用户不存在"

    def test_execute_rules_no_matched_rules(self):
        """测试无匹配规则"""
        engine = RuleExecutionEngine()
        mock_user = Mock()
        mock_user.id = 1
        mock_user.current_score = 100

        with patch("services.rule_engine_service.get_by_id", return_value=mock_user):
            result = engine.execute_rules({}, {"user_id": 1})
            assert result["success"]
            assert result["total_score_change"] == 0
            assert len(result["applied_rules"]) == 0

    def test_execute_rules_disabled_rule(self):
        """测试禁用规则不执行"""
        engine = RuleExecutionEngine()
        mock_user = Mock()
        mock_user.id = 1
        mock_user.current_score = 100

        with patch("services.rule_engine_service.get_by_id", return_value=mock_user):
            model_output = {
                "recommendations": [{"rule_id": 1, "confidence": 0.998, "conditions": {}}]
            }
            with patch.object(
                engine.matcher,
                "_load_rule",
                return_value={
                    "id": 1,
                    "name": "禁用规则",
                    "score": 5,
                    "priority": "P2",
                    "is_active": False,
                },
            ):
                result = engine.execute_rules(model_output, {"user_id": 1})
                assert result["success"]
                assert len(result["applied_rules"]) == 0
