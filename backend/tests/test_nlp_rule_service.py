#!/usr/bin/env python3
""" """

# NLP规则服务测试模块
"""
"""

import pytest
from unittest.mock import MagicMock

try:
    from services.nlp_rule_service import NLPRuleManagementService
except ImportError:
    pass

try:
    from models import NLPScoringRule, db
except ImportError:
    pass

try:
    from models import NLPMatchResult
except ImportError:
    pass


class TestNLPRuleManagementService:
    """NLP规则管理服务测试类"""

    def test_service_initialization(self):
        """测试服务初始化"""
        from services.nlp_rule_service import NLPRuleManagementService

        service = NLPRuleManagementService()
        assert service is not None

    def test_get_rules_empty(self, app):
        """测试获取空规则列表"""
        from models import NLPScoringRule, db

        with app.app_context():
            NLPScoringRule.query.delete()
            db.session.commit()

            service = NLPRuleManagementService()
            result = service.get_rules(page=1, per_page=20)

            assert isinstance(result, dict)
            assert "items" in result
            assert "total" in result
            assert result["total"] == 0
            assert result["page"] == 1

    def test_get_rules_with_keyword(self, app):
        """测试按关键词搜索规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_rules(keyword="测试")

            assert isinstance(result, dict)
            assert "items" in result

    def test_get_rules_with_score_type(self, app):
        """测试按类型筛选规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_rules(score_type="add")

            assert isinstance(result, dict)
            assert "items" in result

    def test_get_rules_invalid_sort_by(self, app):
        """测试无效排序字段"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_rules(sort_by="invalid_field")

            assert isinstance(result, dict)
            assert "items" in result

    def test_get_rule_not_found(self, app):
        """测试获取不存在的规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_rule(99999)

            assert result is None

    def test_create_rule_success(self, app):
        """测试创建规则成功"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.create_rule(
                {
                    "behavior_keyword": "测试关键词",
                    "behavior_description": "测试描述",
                    "score_value": 10,
                    "score_type": "add",
                }
            )

            assert isinstance(result, dict)
            assert result["success"] is True
            assert "rule" in result

    def test_create_rule_duplicate(self, app):
        """测试创建重复规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            service.create_rule(
                {
                    "behavior_keyword": "重复关键词",
                    "behavior_description": "测试描述",
                    "score_value": 10,
                    "score_type": "add",
                }
            )

            result = service.create_rule(
                {
                    "behavior_keyword": "重复关键词",
                    "behavior_description": "测试描述",
                    "score_value": 10,
                    "score_type": "add",
                }
            )

            assert isinstance(result, dict)
            assert result["success"] is False
            assert "规则已存在" in result["message"]

    def test_update_rule_success(self, app):
        """测试更新规则成功"""

        with app.app_context():
            rule = NLPScoringRule(
                behavior_keyword="原始关键词",
                behavior_description="原始描述",
                score_value=5,
                score_type="add",
                is_active=True,
            )
            db.session.add(rule)
            db.session.commit()

            service = NLPRuleManagementService()
            result = service.update_rule(
                rule.id, {"behavior_description": "更新描述", "score_value": 15}
            )

            assert isinstance(result, dict)
            assert result["success"] is True
            assert "rule" in result

    def test_update_rule_not_found(self, app):
        """测试更新不存在的规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.update_rule(99999, {"behavior_description": "更新描述"})

            assert isinstance(result, dict)
            assert result["success"] is False
            assert "规则不存在" in result["message"]

    def test_delete_rule_success(self, app):
        """测试删除规则成功"""

        with app.app_context():
            rule = NLPScoringRule(
                behavior_keyword="待删除关键词",
                behavior_description="测试描述",
                score_value=5,
                score_type="add",
                is_active=True,
            )
            db.session.add(rule)
            db.session.commit()

            service = NLPRuleManagementService()
            result = service.delete_rule(rule.id)

            assert isinstance(result, dict)
            assert result["success"] is True
            assert "规则已删除" in result["message"]

    def test_delete_rule_not_found(self, app):
        """测试删除不存在的规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.delete_rule(99999)

            assert isinstance(result, dict)
            assert result["success"] is False
            assert "规则不存在" in result["message"]

    def test_get_rule_usage_empty(self, app):
        """测试获取空规则使用记录"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_rule_usage(rule_id=1)

            assert isinstance(result, dict)
            assert "items" in result
            assert result["total"] == 0

    def test_get_rule_statistics(self, app):
        """测试获取规则统计信息"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_rule_statistics()

            assert isinstance(result, dict)
            assert "total_rules" in result
            assert "add_rules" in result
            assert "deduct_rules" in result
            assert "total_usage" in result
            assert "accuracy_rate" in result

    def test_suggest_similar_rules(self, app):
        """测试推荐相似规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.suggest_similar_rules("迟到")

            assert isinstance(result, list)

    def test_train_model_empty_data(self, app):
        """测试训练模型-空数据"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.train_model(trained_by="test_user")

            assert isinstance(result, dict)
            assert "status" in result
            # P2-2: 空数据不再伪造 completed，标记 untrained
            assert result["status"] == "untrained"
            assert result["training_data_size"] == 0

    def test_train_model_with_data(self, app):
        """测试训练模型-有数据"""
        from models import NLPMatchResult

        with app.app_context():
            rule = NLPScoringRule(
                behavior_keyword="测试关键词",
                behavior_description="测试描述",
                score_value=5,
                score_type="add",
                is_active=True,
            )
            db.session.add(rule)
            db.session.commit()

            match_result = NLPMatchResult(
                input_text="测试输入",
                matched_rule_id=rule.id,
                intent="add",
                is_manual_correction=False,
            )
            db.session.add(match_result)
            db.session.commit()

            service = NLPRuleManagementService()
            result = service.train_model(trained_by="test_user")

            assert isinstance(result, dict)
            assert "status" in result
            assert result["status"] == "completed"
            assert result["training_data_size"] > 0

    def test_get_training_history(self, app):
        """测试获取模型训练历史"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.get_training_history(page=1, per_page=10)

            assert isinstance(result, dict)
            assert "items" in result
            assert "total" in result

    def test_batch_import_rules_empty(self, app):
        """测试批量导入空规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            result = service.batch_import_rules([])

            assert isinstance(result, dict)
            assert result["success"] is True
            assert result["imported_count"] == 0
            assert result["skipped_count"] == 0

    def test_batch_import_rules_with_data(self, app):
        """测试批量导入规则"""

        with app.app_context():
            service = NLPRuleManagementService()
            rules_data = [
                {
                    "behavior_keyword": "导入关键词1",
                    "behavior_description": "描述1",
                    "score_value": 5,
                    "score_type": "add",
                },
                {
                    "behavior_keyword": "导入关键词2",
                    "behavior_description": "描述2",
                    "score_value": -5,
                    "score_type": "deduct",
                },
            ]
            result = service.batch_import_rules(rules_data)

            assert isinstance(result, dict)
            assert result["success"] is True
            assert result["imported_count"] == 2

    def test_batch_import_rules_with_duplicates(self, app):
        """测试批量导入包含重复规则"""

        with app.app_context():
            rule = NLPScoringRule(
                behavior_keyword="重复关键词",
                behavior_description="原始描述",
                score_value=5,
                score_type="add",
                is_active=True,
            )
            db.session.add(rule)
            db.session.commit()

            service = NLPRuleManagementService()
            rules_data = [
                {
                    "behavior_keyword": "重复关键词",
                    "behavior_description": "重复描述",
                    "score_value": 10,
                    "score_type": "add",
                },
                {
                    "behavior_keyword": "新关键词",
                    "behavior_description": "新描述",
                    "score_value": 5,
                    "score_type": "add",
                },
            ]
            result = service.batch_import_rules(rules_data)

            assert isinstance(result, dict)
            assert result["success"] is True
            assert result["imported_count"] == 1
            assert result["skipped_count"] == 1

    def test_find_synonyms(self, app):
        """测试查找同义词"""

        service = NLPRuleManagementService()

        synonyms = service._find_synonyms("睡觉")
        assert isinstance(synonyms, list)
        assert "打瞌睡" in synonyms

        synonyms = service._find_synonyms("迟到")
        assert isinstance(synonyms, list)
        assert "晚到" in synonyms

        synonyms = service._find_synonyms("未知关键词")
        assert synonyms == []

    def test_calculate_precision(self, app):
        """测试计算精确率"""

        service = NLPRuleManagementService()

        match_results = [
            MagicMock(is_manual_correction=False, intent="add"),
            MagicMock(is_manual_correction=True, intent="add"),
            MagicMock(is_manual_correction=False, intent="deduct"),
            MagicMock(is_manual_correction=False, intent="unknown"),
        ]

        precision = service._calculate_precision(match_results)
        assert isinstance(precision, float)
        assert precision == pytest.approx(2 / 3)

        match_results_empty = []
        precision = service._calculate_precision(match_results_empty)
        assert precision == 0.0

    def test_calculate_recall(self, app):
        """测试计算召回率"""

        service = NLPRuleManagementService()

        match_results = [
            MagicMock(is_manual_correction=False, intent="add"),
            MagicMock(is_manual_correction=True, intent="unknown"),
            MagicMock(is_manual_correction=False, intent="deduct"),
            MagicMock(is_manual_correction=True, intent="add"),
        ]

        recall = service._calculate_recall(match_results)
        assert isinstance(recall, float)
        assert recall == pytest.approx(2 / 3)

        match_results_empty = []
        recall = service._calculate_recall(match_results_empty)
        assert recall == 0.0

    def test_calculate_f1(self, app):
        """测试计算F1分数"""

        service = NLPRuleManagementService()

        f1 = service._calculate_f1(0.8, 0.8)
        assert f1 == pytest.approx(0.8)

        f1 = service._calculate_f1(0.5, 0.5)
        assert f1 == pytest.approx(0.5)

        f1 = service._calculate_f1(0.0, 0.0)
        assert f1 == 0.0

        f1 = service._calculate_f1(0.8, 0.4)
        assert f1 == pytest.approx(0.5333, rel=1e-3)
