"""
Score Rule Service Test Cases
"""
# 测试积分规则服务的核心功能
"""
"""
from unittest.mock import patch, MagicMock
try:
    from services.score_rule_service import ScoreRuleService
except ImportError:
    pass


class TestScoreRuleService:
    """测试积分规则服务"""

    def test_get_rules_empty(self, app):
        """测试获取规则列表-空列表"""
        with app.app_context():
            from services.score_rule_service import ScoreRuleService

            mock_query = MagicMock()
            mock_pagination = MagicMock()
            mock_pagination.items = []
            mock_pagination.total = 0
            mock_pagination.page = 1
            mock_pagination.per_page = 10
            mock_pagination.pages = 0
            mock_query.order_by.return_value.paginate.return_value = mock_pagination

            with patch('services.score_rule_service.db_readonly_scope') as mock_scope:
                mock_scope.return_value.__enter__.return_value.query.return_value = mock_query

                result = ScoreRuleService.get_rules()

                assert result["rules"] == []
                assert result["total"] == 0
                assert result["page"] == 1

    def test_get_rules_with_filters(self, app):
        """测试获取规则列表-带过滤条件"""
        with app.app_context():

            mock_rule = MagicMock()
            mock_rule.id = 1
            mock_rule.name = "测试规则"
            mock_rule.description = "测试描述"
            mock_rule.category_id = 1
            mock_rule.category = None
            mock_rule.score = 10
            mock_rule.is_active = True
            mock_rule.daily_limit = 5
            mock_rule.min_interval = 0
            mock_rule.created_at = None
            mock_rule.updated_at = None

            mock_pagination = MagicMock()
            mock_pagination.items = [mock_rule]
            mock_pagination.total = 1
            mock_pagination.page = 1
            mock_pagination.per_page = 10
            mock_pagination.pages = 1

            mock_filtered = MagicMock()
            mock_filtered.order_by.return_value.paginate.return_value = mock_pagination

            with patch('services.score_rule_service.db_readonly_scope') as mock_scope:
                mock_session = MagicMock()
                mock_session.query.return_value.filter.return_value.filter.return_value = mock_filtered
                mock_scope.return_value.__enter__.return_value = mock_session

                result = ScoreRuleService.get_rules(category_id=1, is_active=True)

                assert len(result["rules"]) == 1
                assert result["rules"][0]["name"] == "测试规则"

    def test_get_rule_not_found(self, app):
        """测试获取规则-不存在"""
        with app.app_context():

            with patch('services.score_rule_service.db_readonly_scope'):
                with patch('services.score_rule_service.get_by_id') as mock_get:
                    mock_get.return_value = None

                    result = ScoreRuleService.get_rule(999)

                    assert result is None

    def test_get_rule_success(self, app):
        """测试获取规则-成功"""
        with app.app_context():

            mock_rule = MagicMock()
            mock_rule.id = 1
            mock_rule.name = "测试规则"
            mock_rule.description = "测试描述"
            mock_rule.category_id = 1
            mock_rule.category = None
            mock_rule.score = 10
            mock_rule.is_active = True
            mock_rule.daily_limit = 5
            mock_rule.min_interval = 0
            mock_rule.created_at = None
            mock_rule.updated_at = None

            with patch('services.score_rule_service.db_readonly_scope'):
                with patch('services.score_rule_service.get_by_id') as mock_get:
                    mock_get.return_value = mock_rule

                    result = ScoreRuleService.get_rule(1)

                    assert result is not None
                    assert result["id"] == 1
                    assert result["name"] == "测试规则"

    def test_create_rule_success(self, app):
        """测试创建规则-成功"""
        with app.app_context():

            mock_rule = MagicMock()
            mock_rule.id = 1
            mock_rule.name = "新规则"
            mock_rule.description = "新规则描述"
            mock_rule.category_id = None
            mock_rule.category = None
            mock_rule.score = 20
            mock_rule.is_active = True
            mock_rule.daily_limit = 0
            mock_rule.min_interval = 0
            mock_rule.created_at = None
            mock_rule.updated_at = None

            with patch('services.score_rule_service.db_session_scope') as mock_scope:
                mock_session = MagicMock()
                mock_scope.return_value.__enter__.return_value = mock_session

                with patch('services.score_rule_service.ScoreRule') as mock_cls:
                    mock_cls.return_value = mock_rule

                    with patch.object(ScoreRuleService, 'get_rule') as mock_get:
                        mock_get.return_value = {
                            "id": 1,
                            "name": "新规则",
                            "score": 20
                        }

                        result = ScoreRuleService.create_rule({
                            "name": "新规则",
                            "score": 20
                        })

                        assert result["id"] == 1
                        assert result["name"] == "新规则"

    def test_update_rule_not_found(self, app):
        """测试更新规则-不存在"""
        with app.app_context():

            with patch('services.score_rule_service.db_session_scope'):
                with patch('services.score_rule_service.get_by_id') as mock_get:
                    mock_get.return_value = None

                    result = ScoreRuleService.update_rule(999, {"name": "更新"})

                    assert result is None

    def test_update_rule_success(self, app):
        """测试更新规则-成功"""
        with app.app_context():

            mock_rule = MagicMock()
            mock_rule.id = 1
            mock_rule.name = "旧规则"
            mock_rule.description = "旧描述"
            mock_rule.category_id = None
            mock_rule.category = None
            mock_rule.score = 10
            mock_rule.is_active = True
            mock_rule.daily_limit = 0
            mock_rule.min_interval = 0
            mock_rule.created_at = None
            mock_rule.updated_at = None

            with patch('services.score_rule_service.db_session_scope'):
                with patch('services.score_rule_service.get_by_id') as mock_get:
                    mock_get.return_value = mock_rule

                    with patch.object(ScoreRuleService, 'get_rule') as mock_get_rule:
                        mock_get_rule.return_value = {
                            "id": 1,
                            "name": "更新规则",
                            "score": 15
                        }

                        result = ScoreRuleService.update_rule(1, {
                            "name": "更新规则",
                            "score": 15
                        })

                        assert result["id"] == 1
                        assert result["name"] == "更新规则"

    def test_delete_rule_not_found(self, app):
        """测试删除规则-不存在"""
        with app.app_context():

            with patch('services.score_rule_service.db_session_scope'):
                with patch('services.score_rule_service.get_by_id') as mock_get:
                    mock_get.return_value = None

                    result = ScoreRuleService.delete_rule(999)

                    assert result is False

    def test_delete_rule_success(self, app):
        """测试删除规则-成功"""
        with app.app_context():

            mock_rule = MagicMock()
            mock_rule.id = 1

            with patch('services.score_rule_service.db_session_scope') as mock_scope:
                mock_session = MagicMock()
                mock_scope.return_value.__enter__.return_value = mock_session

                with patch('services.score_rule_service.get_by_id') as mock_get:
                    mock_get.return_value = mock_rule

                    result = ScoreRuleService.delete_rule(1)

                    assert result is True
