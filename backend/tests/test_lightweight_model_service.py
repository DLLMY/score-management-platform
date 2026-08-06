try:
    from services.lightweight_model_service import RuleBasedIntentClassifier
except ImportError:
    pass

try:
    from services.lightweight_model_service import LightweightTFIDFClassifier
except ImportError:
    pass

try:
    from services.lightweight_model_service import LightweightEngine
except ImportError:
    pass

try:
    from services.lightweight_model_service import get_light_engine
except ImportError:
    pass

try:
    from services.lightweight_model_service import train_lightweight_model
except ImportError:
    pass

try:
    from services.lightweight_model_service import LightweightModelConfig
except ImportError:
    pass



class TestRuleBasedIntentClassifier:

    def test_predict_add_intent(self):
        from services.lightweight_model_service import RuleBasedIntentClassifier

        classifier = RuleBasedIntentClassifier()
        intent, confidence, extras = classifier.predict('张三加分')

        assert intent == 'add'
        assert confidence > 0.0

    def test_predict_deduct_intent(self):

        classifier = RuleBasedIntentClassifier()
        intent, confidence, extras = classifier.predict('李四迟到')

        assert intent == 'deduct'
        assert confidence > 0.0

    def test_predict_query_intent(self):

        classifier = RuleBasedIntentClassifier()
        intent, confidence, extras = classifier.predict('查询王五的分数')

        assert intent == 'query'
        assert confidence > 0.0

    def test_predict_reset_intent(self):

        classifier = RuleBasedIntentClassifier()
        intent, confidence, extras = classifier.predict('赵六分数清零')

        assert intent == 'reset'
        assert confidence > 0.0

    def test_predict_unknown_intent(self):

        classifier = RuleBasedIntentClassifier()
        intent, confidence, extras = classifier.predict('abc123xyz')

        assert intent == 'unknown'
        assert confidence == 0.0

    def test_predict_extracts_score(self):

        classifier = RuleBasedIntentClassifier()
        intent, confidence, extras = classifier.predict('表扬小明加10分')

        assert 'score' in extras
        assert extras['score'] == 10

    def test_batch_predict(self):

        classifier = RuleBasedIntentClassifier()
        texts = ['给张三加分', '李四迟到', '查询分数']
        results = classifier.batch_predict(texts)

        assert len(results) == 3
        assert results[0][0] == 'add'
        assert results[1][0] == 'deduct'
        assert results[2][0] == 'query'


class TestLightweightTFIDFClassifier:

    def test_train_and_predict(self, temp_dir):
        from services.lightweight_model_service import LightweightTFIDFClassifier

        classifier = LightweightTFIDFClassifier(max_features=100)

        texts = [
            '张三加分', '表扬李四', '奖励王五', '小明回答问题',
            '小红迟到', '小李早退', '扣钱六分', '批评小赵',
            '查询分数', '查看排名', '积分多少', '成绩如何',
            '重置积分', '清零分数'
        ]
        labels = [
            'add', 'add', 'add', 'add',
            'deduct', 'deduct', 'deduct', 'deduct',
            'query', 'query', 'query', 'query',
            'reset', 'reset'
        ]

        success = classifier.train_light_model(texts, labels)

        assert success is True
        assert classifier._loaded is True

        intent, confidence = classifier.predict('给张三加分')
        assert intent in ['add', 'query', 'deduct', 'reset']
        assert confidence > 0.0

    def test_predict_not_loaded(self):

        classifier = LightweightTFIDFClassifier(max_features=100)

        intent, confidence = classifier.predict('测试文本')

        assert intent == 'unknown'
        assert confidence == 0.0


class TestLightweightEngine:

    def test_predict_auto_strategy(self):
        from services.lightweight_model_service import LightweightEngine

        engine = LightweightEngine()
        engine.initialize()

        result = engine.predict('给张三加5分')

        assert 'text' in result
        assert 'strategy' in result
        assert result['strategy'] == 'auto'
        assert 'final' in result
        assert 'intent' in result['final']
        assert 'confidence' in result['final']

    def test_predict_rule_strategy(self):

        engine = LightweightEngine()
        engine.initialize()

        result = engine.predict('给张三加分', strategy='rule')

        assert result['strategy'] == 'rule'
        assert len(result['predictions']) == 1
        assert result['predictions'][0]['model'] == 'rule_based'

    def test_predict_model_strategy(self):

        engine = LightweightEngine()
        engine.initialize()

        result = engine.predict('给张三加分', strategy='model')

        assert result['strategy'] == 'model'
        assert 'final' in result

    def test_predict_hybrid_strategy(self):

        engine = LightweightEngine()
        engine.initialize()

        result = engine.predict('给张三加分', strategy='hybrid')

        assert result['strategy'] == 'hybrid'
        assert len(result['predictions']) >= 1

    def test_batch_predict(self):

        engine = LightweightEngine()
        engine.initialize()

        texts = ['给张三加分', '李四迟到', '查询分数']
        results = engine.batch_predict(texts)

        assert len(results) == 3
        for r in results:
            assert 'text' in r
            assert 'final' in r

    def test_cache(self):

        engine = LightweightEngine()
        engine.initialize()

        result1 = engine.predict('测试文本缓存')
        assert result1['cached'] is False

        result2 = engine.predict('测试文本缓存')
        assert result2['cached'] is True

    def test_clear_cache(self):

        engine = LightweightEngine()
        engine.initialize()

        engine.predict('测试缓存')
        assert len(engine._cache) > 0

        engine.clear_cache()
        assert len(engine._cache) == 0

    def test_get_stats(self):

        engine = LightweightEngine()
        engine.initialize()

        stats = engine.get_stats()

        assert 'initialized' in stats
        assert 'cache_size' in stats
        assert 'models_loaded' in stats
        assert stats['initialized'] is True


class TestLightweightServiceFunctions:

    def test_get_light_engine(self):
        from services.lightweight_model_service import get_light_engine

        engine = get_light_engine()

        assert engine is not None
        assert engine._initialized is True

    def test_train_lightweight_model(self):
        from services.lightweight_model_service import train_lightweight_model

        texts = ['张三加分', '李四迟到', '查询分数']
        labels = ['add', 'deduct', 'query']

        success = train_lightweight_model(texts, labels)

        assert success is True


class TestLightweightModelConfig:

    def test_config_values(self):
        from services.lightweight_model_service import LightweightModelConfig

        assert hasattr(LightweightModelConfig, 'MODEL_PRIORITY')
        assert hasattr(LightweightModelConfig, 'MAX_FEATURES')
        assert hasattr(LightweightModelConfig, 'INFERENCE_TIMEOUT')
        assert hasattr(LightweightModelConfig, 'CACHE_SIZE')
        assert hasattr(LightweightModelConfig, 'MAX_CONCURRENT')

        assert LightweightModelConfig.MAX_FEATURES == 500
        assert LightweightModelConfig.INFERENCE_TIMEOUT == 100
        assert LightweightModelConfig.CACHE_SIZE == 1000
        assert LightweightModelConfig.MAX_CONCURRENT == 4
