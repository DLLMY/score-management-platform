try:
    from services.rule_recommendation_service import RuleRecommendationService
except ImportError:
    pass

try:
    from models import ScoreRecord, db
except ImportError:
    pass


class TestRuleRecommendationService:
    """规则推荐服务测试"""

    def test_get_rule_effectiveness_empty(self, app, clean_db):
        """测试获取规则有效性 - 无记录"""
        from services.rule_recommendation_service import RuleRecommendationService

        with app.app_context():
            result = RuleRecommendationService.get_rule_effectiveness(1)
            assert result["rule_id"] == 1
            assert result["usage_count"] == 0
            assert result["effectiveness"] == 0.0

    def test_get_rule_effectiveness_with_records(self, app):
        """测试获取规则有效性 - 有记录"""
        from models import ScoreRecord, db

        with app.app_context():
            for i in range(10):
                record = ScoreRecord(student_id=1, rule_id=1, score_change=5, description="测试")
                db.session.add(record)
            db.session.commit()

            result = RuleRecommendationService.get_rule_effectiveness(1)
            assert result["rule_id"] == 1
            assert result["usage_count"] == 10
            assert result["effectiveness"] > 0.0

            ScoreRecord.query.filter_by(rule_id=1).delete()
            db.session.commit()

    def test_get_rule_effectiveness_trend_increasing(self, app):
        """测试规则有效性趋势 - 增长"""

        with app.app_context():
            for i in range(14):
                score_change = 5 if i < 7 else 15
                record = ScoreRecord(
                    student_id=1, rule_id=1, score_change=score_change, description="测试"
                )
                db.session.add(record)
            db.session.commit()

            result = RuleRecommendationService.get_rule_effectiveness(1)
            assert result["trend"] == "increasing"

            ScoreRecord.query.filter_by(rule_id=1).delete()
            db.session.commit()

    def test_get_rule_effectiveness_trend_decreasing(self, app):
        """测试规则有效性趋势 - 下降"""

        with app.app_context():
            for i in range(14):
                score_change = 15 if i < 7 else 5
                record = ScoreRecord(
                    student_id=1, rule_id=1, score_change=score_change, description="测试"
                )
                db.session.add(record)
            db.session.commit()

            result = RuleRecommendationService.get_rule_effectiveness(1)
            assert result["trend"] == "decreasing"

            ScoreRecord.query.filter_by(rule_id=1).delete()
            db.session.commit()

    def test_analyze_behavior_patterns_empty(self, app, clean_db):
        """测试分析行为模式 - 无记录"""

        with app.app_context():
            result = RuleRecommendationService.analyze_behavior_patterns()
            assert result == []

    def test_find_new_rule_opportunities(self, app):
        """测试发现新规则机会"""

        with app.app_context():
            result = RuleRecommendationService.find_new_rule_opportunities()
            assert isinstance(result, list)

    def test_suggest_rule_optimizations(self, app, sample_rule):
        """测试规则优化建议"""

        with app.app_context():
            result = RuleRecommendationService.suggest_rule_optimizations()
            assert isinstance(result, list)

    def test_suggest_rule_combinations_empty(self, app):
        """测试规则组合建议 - 无记录"""

        with app.app_context():
            result = RuleRecommendationService.suggest_rule_combinations()
            assert result == []

    def test_get_all_recommendations(self, app):
        """测试获取所有推荐"""

        with app.app_context():
            result = RuleRecommendationService.get_all_recommendations()
            assert isinstance(result, dict)
            assert "new_rules" in result
            assert "optimizations" in result
            assert "combinations" in result
            assert "summary" in result

    def test_get_rule_statistics(self, app):
        """测试获取规则统计"""

        with app.app_context():
            result = RuleRecommendationService.get_rule_statistics()
            assert isinstance(result, dict)
            assert "total_rules" in result
            assert "active_rules" in result
            assert "inactive_rules" in result

    def test_train_recommendation_model_empty(self, app, clean_db):
        """测试训练推荐模型 - 无数据"""

        with app.app_context():
            result = RuleRecommendationService.train_recommendation_model()
            assert result["status"] == "error"
            assert "没有足够的训练数据" in result["message"]

    def test_train_recommendation_model_with_data(self, app):
        """测试训练推荐模型 - 有数据"""

        with app.app_context():
            for i in range(100):
                record = ScoreRecord(student_id=i % 10 + 1, score_change=5, description="训练数据")
                db.session.add(record)
            db.session.commit()

            result = RuleRecommendationService.train_recommendation_model(days=30)
            assert result["status"] == "success"
            assert "模型训练完成" in result["message"]

            ScoreRecord.query.delete()
            db.session.commit()

    def test_evaluate_model_empty(self, app):
        """测试评估模型 - 无数据"""

        with app.app_context():
            result = RuleRecommendationService.evaluate_model()
            assert result["status"] == "error"
            assert "没有足够的评估数据" in result["message"]

    def test_evaluate_model_with_data(self, app, sample_rule):
        """测试评估模型 - 有数据"""

        with app.app_context():
            for i in range(50):
                record = ScoreRecord(
                    student_id=i % 10 + 1,
                    rule_id=sample_rule.id,
                    score_change=5,
                    description="评估数据",
                )
                db.session.add(record)
            db.session.commit()

            result = RuleRecommendationService.evaluate_model()
            assert result["status"] == "success"
            assert "模型评估完成" in result["message"]

            ScoreRecord.query.filter_by(rule_id=sample_rule.id).delete()
            db.session.commit()

    def test_recommendation_types(self):
        """测试推荐类型定义"""

        types = RuleRecommendationService.RECOMMENDATION_TYPES
        assert "new_rule" in types
        assert "optimization" in types
        assert "combination" in types
        assert types["new_rule"]["name"] == "新规则推荐"
        assert types["optimization"]["name"] == "规则优化建议"
        assert types["combination"]["name"] == "规则组合建议"

    def test_find_new_rule_opportunities_with_existing_rules(self, app, sample_rule):
        """测试发现新规则机会 - 已有规则分类"""

        with app.app_context():
            result = RuleRecommendationService.find_new_rule_opportunities()
            assert isinstance(result, list)
