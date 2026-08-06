"""Tests for NLP Enhanced Service"""

from unittest.mock import patch, MagicMock
try:
    from services.nlp_enhanced_service import MLIntentClassifier
except ImportError:
    pass

try:
    from services.nlp_enhanced_service import EnhancedNLPParserService
except ImportError:
    pass


class TestMLIntentClassifier:
    """测试ML意图分类器"""

    def test_init(self):
        """测试初始化"""
        from services.nlp_enhanced_service import MLIntentClassifier

        classifier = MLIntentClassifier()

        assert classifier.intent_labels is not None
        assert "add" in classifier.intent_labels
        assert "deduct" in classifier.intent_labels
        assert "query" in classifier.intent_labels
        assert "reset" in classifier.intent_labels
        assert "unknown" in classifier.intent_labels

    def test_predict_intent_positive(self):
        """测试预测正向意图"""

        classifier = MLIntentClassifier()

        result = classifier.predict_intent("学生表现优秀，奖励积分")

        assert isinstance(result, tuple)
        assert len(result) == 2
        assert result[0] in ["add", "deduct", "query", "reset", "unknown", None]

    def test_predict_intent_deduct(self):
        """测试预测扣分意图"""

        classifier = MLIntentClassifier()

        result = classifier.predict_intent("学生迟到，扣除积分")

        assert isinstance(result, tuple)
        assert len(result) == 2
        assert result[0] in ["add", "deduct", "query", "reset", "unknown", None]


class TestEnhancedNLPParserService:
    """测试增强NLP解析器服务"""

    def test_init(self):
        """测试初始化"""
        from services.nlp_enhanced_service import EnhancedNLPParserService

        engine = EnhancedNLPParserService()

        assert engine is not None

    def test_extract_name(self, app):
        """测试提取姓名"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": ["张三", "李四"],
                "name_to_id": {"张三": 1, "李四": 2},
                "behavior_keywords": [],
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            name, user_id = engine.extract_name("张三迟到了")

            assert name == "张三"

    def test_extract_name_not_found(self, app):
        """测试提取姓名-未找到"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": ["张三", "李四"],
                "name_to_id": {"张三": 1, "李四": 2},
                "behavior_keywords": [],
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            name, user_id = engine.extract_name("王五迟到了")

            assert name == "王五"

    def test_determine_intent_positive(self):
        """测试确定意图-正向"""

        engine = EnhancedNLPParserService()

        behavior_result = {"matched_keywords": ["奖励", "优秀"]}
        intent = engine.determine_intent("学生表现优秀，奖励积分", behavior_result)

        assert intent == "add"

    def test_determine_intent_negative(self):
        """测试确定意图-负向"""

        engine = EnhancedNLPParserService()

        behavior_result = {"matched_keywords": ["迟到", "扣分"]}
        intent = engine.determine_intent("学生迟到，扣除积分", behavior_result)

        assert intent == "deduct"

    def test_determine_intent_query(self):
        """测试确定意图-查询"""

        engine = EnhancedNLPParserService()

        behavior_result = {"matched_keywords": ["查询", "积分"]}
        intent = engine.determine_intent("查询张三的积分", behavior_result)

        assert intent == "query"

    def test_semantic_match(self, app):
        """测试语义匹配"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "rules_by_intent": {"add": []},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.semantic_match("测试文本", "add")

            assert isinstance(result, list)

    def test_extract_behavior(self, app):
        """测试提取行为"""

        engine = EnhancedNLPParserService()

        engine._cache = {
            "behavior_keywords": [],
            "cache_time": 0,
            "cache_ttl": 3600,
        }

        with app.app_context():
            result = engine.extract_behavior("学生上课认真听讲")

        assert isinstance(result, dict)
        assert "keywords" in result

    def test_soft_vote_confidence(self):
        """测试软投票置信度计算"""

        engine = EnhancedNLPParserService()

        mock_rule = MagicMock()
        mock_rule.score_type = "add"
        mock_rule.behavior_keyword = "奖励"

        predictions = [
            (mock_rule, "keyword", 0.8),
            (mock_rule, "semantic", 0.9),
            (mock_rule, "ml", 0.3),
        ]

        result = engine.soft_vote_confidence(predictions)

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_parse(self, app):
        """测试解析方法"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": [],
                "name_to_id": {},
                "behavior_keywords": [],
                "rules_by_intent": {},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.parse("测试文本")

            assert isinstance(result, dict)
            assert "success" in result

    def test_parse_with_name(self, app):
        """测试解析方法-带姓名"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": ["张三"],
                "name_to_id": {"张三": 1},
                "behavior_keywords": [],
                "rules_by_intent": {},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.parse("张三表现优秀")

            assert isinstance(result, dict)
            assert "success" in result


class TestEnhancedNLPParserServiceBatch:
    """测试批量处理"""

    def test_batch_parse(self, app):
        """测试批量解析"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            with patch.object(engine, 'parse', return_value={"success": True, "intent": "unknown"}):
                results = engine.batch_parse(["文本1", "文本2", "文本3"], parallel=False)

                assert isinstance(results, list)
                assert len(results) == 3


class TestMLIntentClassifierAdditional:
    """测试ML意图分类器附加功能"""

    def test_predict_intent_cache(self):
        """测试意图预测缓存"""

        classifier = MLIntentClassifier()

        result1 = classifier.predict_intent("表扬学生")
        result2 = classifier.predict_intent("表扬学生")

        assert result1 == result2

    def test_predict_intent_no_cache(self):
        """测试意图预测不使用缓存"""

        classifier = MLIntentClassifier()

        result = classifier.predict_intent("批评学生", use_cache=False)

        assert isinstance(result, tuple)

    def test_predict_intent_cache_limit(self):
        """测试意图预测缓存上限"""

        classifier = MLIntentClassifier()
        classifier._cache_max_size = 2

        classifier.predict_intent("文本1")
        classifier.predict_intent("文本2")
        classifier.predict_intent("文本3")

        assert len(classifier._prediction_cache) <= 2


class TestEnhancedNLPParserServiceMethods:
    """测试增强NLP解析器服务的其他方法"""

    def test_analyze_sentiment(self):
        """测试情感分析"""

        engine = EnhancedNLPParserService()

        sentiment = engine._analyze_sentiment("学生表现优秀，非常棒")
        assert sentiment > 0

        sentiment = engine._analyze_sentiment("学生迟到，表现很差")
        assert sentiment < 0

        sentiment = engine._analyze_sentiment("这是一段中性文本")
        assert sentiment == 0.0

    def test_get_position_weight(self):
        """测试位置权重计算"""

        engine = EnhancedNLPParserService()

        weight = engine._get_position_weight("张三迟到", "张三")
        assert weight > 0

        weight = engine._get_position_weight("迟到的张三", "张三")
        assert weight > 0

        weight = engine._get_position_weight("文本", "不存在")
        assert weight == 0.0

    def test_get_keyword_importance(self):
        """测试关键词重要性"""

        engine = EnhancedNLPParserService()

        assert engine._get_keyword_importance("strong") > 1.0
        assert engine._get_keyword_importance("medium") == 1.0
        assert engine._get_keyword_importance("weak") < 1.0
        assert engine._get_keyword_importance("unknown") == 1.0

    def test_expand_synonyms(self):
        """测试同义词扩展"""

        engine = EnhancedNLPParserService()

        expanded = engine._expand_synonyms("学生迟到了")

        assert isinstance(expanded, list)
        assert "学生迟到了" in expanded

    def test_resolve_referral(self):
        """测试指代消解"""

        engine = EnhancedNLPParserService()

        result = engine._resolve_referral("他迟到了")
        assert result == (None, None)

    def test_update_context_memory(self):
        """测试上下文记忆更新"""

        engine = EnhancedNLPParserService()

        engine._update_context_memory(user_name="张三", rule_id=1, intent="add")

        assert "张三" in engine.context_memory["recent_users"]
        assert 1 in engine.context_memory["recent_rules"]
        assert "add" in engine.context_memory["recent_intents"]

    def test_build_bm25_index(self):
        """测试BM25索引构建"""

        engine = EnhancedNLPParserService()

        documents = ["迟到扣分", "表扬加分", "作业完成"]
        index = engine._build_bm25_index(documents)

        assert isinstance(index, dict)
        assert "idf" in index
        assert "doc_term_freq" in index

    def test_bm25_score(self):
        """测试BM25评分"""

        engine = EnhancedNLPParserService()

        documents = ["迟到扣分", "表扬加分"]
        index = engine._build_bm25_index(documents)

        score = engine._bm25_score("迟到", 0, index)
        assert score > 0

        score = engine._bm25_score("迟到", 100, index)
        assert score == 0.0

    def test_rule_id_to_intent(self, app):
        """测试规则ID转意图"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            result = engine._rule_id_to_intent("add")
            assert result == "add"

            result = engine._rule_id_to_intent("unknown")
            assert result == "unknown"

            result = engine._rule_id_to_intent(999)
            assert result is None


class TestEnhancedNLPParserServiceEdgeCases:
    """测试增强NLP解析器服务的边缘情况"""

    def test_parse_empty_text(self, app):
        """测试解析空文本"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": [],
                "name_to_id": {},
                "behavior_keywords": [],
                "rules_by_intent": {},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.parse("")

            assert isinstance(result, dict)

    def test_parse_cache_hit(self, app):
        """测试解析缓存命中"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._parse_cache["test"] = {"success": True, "intent": "add"}

            result = engine.parse("test")

            assert result["success"] is True
            assert result["intent"] == "add"


class TestEnhancedNLPParserServiceDeepMatch:
    """测试深度语义匹配"""

    def test_deep_semantic_match(self, app):
        """测试深度语义匹配"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "rules_by_intent": {"add": [], "deduct": []},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.deep_semantic_match("测试文本", "add")

            assert isinstance(result, list)

    def test_context_aware_match(self, app):
        """测试上下文感知匹配"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "rules_by_intent": {"add": [], "deduct": []},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            context_history = {
                "recent_intents": ["add"],
                "recent_rules": [],
            }

            result = engine.context_aware_match("测试文本", "add", context_history)

            assert isinstance(result, list)

    def test_multi_intent_detection(self):
        """测试多意图检测"""

        engine = EnhancedNLPParserService()

        behavior_result = {
            "keywords": [],
            "positive_count": 2,
            "negative_count": 1,
        }

        result = engine.multi_intent_detection("学生表现优秀但迟到了", behavior_result)

        assert isinstance(result, list)
        assert len(result) > 0

    def test_ml_predict(self, app):
        """测试机器学习预测"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            rule, confidence = engine.ml_predict("测试文本")

            assert confidence >= 0.0
            assert confidence <= 1.0

    def test_ensemble_predict(self, app):
        """测试集成预测"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            rule, confidence, details = engine.ensemble_predict("测试文本")

            assert confidence >= 0.0
            assert confidence <= 1.0
            assert isinstance(details, list)

    def test_match_rule(self, app):
        """测试规则匹配"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": [],
                "name_to_id": {},
                "behavior_keywords": [],
                "rules_by_intent": {"add": [], "deduct": []},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.match_rule("测试文本", "add")

            assert isinstance(result, list)

    def test_check_corrections(self, app):
        """测试检查修正"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": [],
                "name_to_id": {},
                "behavior_keywords": [],
                "rules_by_intent": {},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine._check_corrections("测试文本")

            assert result is None

    def test_parse_without_correction(self, app):
        """测试无修正解析"""
        with app.app_context():

            engine = EnhancedNLPParserService()

            engine._cache = {
                "user_names": [],
                "name_to_id": {},
                "behavior_keywords": [],
                "rules_by_intent": {},
                "cache_time": 0,
                "cache_ttl": 3600,
            }

            result = engine.parse_without_correction("测试文本")

            assert isinstance(result, dict)
            assert "success" in result
