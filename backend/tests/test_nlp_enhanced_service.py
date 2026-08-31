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

    def test_determine_intent_query_over_action(self):
        """#3 深化: 疑问句式含动作词（加/扣）时须判 query，不得误判 add/deduct"""

        engine = EnhancedNLPParserService()

        behavior_result = {"keywords": [], "positive_count": 0, "negative_count": 0}
        # "小明加了多少分" 同时含动作词"加"与查询词"多少分" → 应为 query
        assert engine.determine_intent("小明加了多少分", behavior_result) == "query"
        # "他扣分了吗" 含查询词"吗"与动作词"扣分" → 应为 query
        assert engine.determine_intent("他扣分了吗", behavior_result) == "query"

    def test_determine_intent_negation_blocks_action(self):
        """#3 深化: 否定前缀须阻断动作意图（与 S6 一致）"""

        engine = EnhancedNLPParserService()

        behavior_result = {"keywords": [], "positive_count": 0, "negative_count": 0}
        # "不要加分"/"禁止减分" 中动作词被否定 → 不得返回 add/deduct
        assert engine.determine_intent("不要加分", behavior_result) != "add"
        assert engine.determine_intent("禁止减分", behavior_result) != "deduct"

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

            with patch.object(engine, "parse", return_value={"success": True, "intent": "unknown"}):
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

    def test_analyze_sentiment_negation_flips(self):
        """#2 深化：否定词应翻转情感极性（不认真→负面，没有迟到→正面）"""

        engine = EnhancedNLPParserService()

        # 否定正面词 → 负面
        assert engine._analyze_sentiment("该生不认真") < 0
        assert engine._analyze_sentiment("该生认真") > 0

        # 否定负面词 → 正面
        assert engine._analyze_sentiment("该生没有迟到") > 0
        assert engine._analyze_sentiment("该生迟到") < 0

        # 程度副词不翻转符号，仅放大
        assert engine._analyze_sentiment("该生非常优秀") > 0
        assert engine._analyze_sentiment("该生表现很差") < 0

    def test_public_analyze_sentiment_negation(self):
        """#2 深化：公开情感端点的标签也应反映否定/程度语义，契约不变"""

        engine = EnhancedNLPParserService()

        assert engine.analyze_sentiment("该生不认真")["sentiment"] == "negative"
        assert engine.analyze_sentiment("该生没有迟到")["sentiment"] == "positive"
        assert engine.analyze_sentiment("该生迟到")["sentiment"] == "negative"
        assert engine.analyze_sentiment("这是一段中性文本")["sentiment"] == "neutral"

    def test_expand_synonyms_recall(self):
        """#2 深化：新增同义词组应产生有效扩展候选"""

        engine = EnhancedNLPParserService()

        expanded = engine._expand_synonyms("该生积极参与讨论")

        assert isinstance(expanded, list)
        assert "该生积极参与讨论" in expanded
        # 新增的"积极参与"→"积极参加"等近义替换应出现在扩展结果中
        assert "该生积极参加讨论" in expanded
        assert len(expanded) > 1

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

    def test_multi_intent_detection_negation(self):
        """#3 深化: 否定前缀须阻断动作意图进入意图集合"""

        engine = EnhancedNLPParserService()

        behavior_result = {"keywords": [], "positive_count": 0, "negative_count": 0}
        result = engine.multi_intent_detection("不要加分", behavior_result)
        intents = [r["intent"] for r in result]

        assert "add" not in intents

    def test_multi_intent_detection_query_dominates(self):
        """#3 深化: 疑词句式中 query 须出现且置信度不低于动作意图"""

        engine = EnhancedNLPParserService()

        behavior_result = {"keywords": [], "positive_count": 0, "negative_count": 0}
        result = engine.multi_intent_detection("小明加了多少分", behavior_result)
        intents = [r["intent"] for r in result]

        assert "query" in intents
        query_conf = next(r["confidence"] for r in result if r["intent"] == "query")
        add_conf = next(
            (r["confidence"] for r in result if r["intent"] == "add"), 0.0
        )
        assert query_conf >= add_conf

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


# ==================== 匹配层单测（绕开 BERT/TFIDF 环境依赖） ====================
# deep_semantic_match 综合分 = 0.2*TFIDF + 0.2*BM25 + 0.3*BERT + 0.3*keyword，
# 门槛 score > 0.15（严格大于）。沙箱缺 BERT/TFIDF 信号时无法端到端验证活跃链路，
# 故对匹配层做**可注入的确定性单测**：把 TFIDF/BM25/同义词/反义词全部打桩，
# 只验证权重配比、硬门槛、top_n、排序与过滤逻辑。

import pytest


def _seed_rule(db_session, keyword, intent, tags=None):
    """种入一条启用规则并返回 ORM 对象。"""
    from models import NLPScoringRule

    rule = NLPScoringRule(
        behavior_keyword=keyword,
        behavior_description=keyword,
        score_type=intent,
        score_value=1.0,
        behavior_tags=tags if tags is not None else [],
        is_active=True,
    )
    db_session.add(rule)
    db_session.commit()
    return rule


def _engine_forced_refresh(app):
    """构造引擎并强制重建缓存，使刚种入的规则进入 rules_by_intent。"""
    with app.app_context():
        engine = EnhancedNLPParserService()
        engine._cache["cache_time"] = 0  # 越过 cache_ttl，强制 _refresh_cache 重建
        engine._refresh_cache()
    return engine


def _stub_components(monkeypatch, engine, bm25=0.0, antonym=False, bert_service=None):
    """把环境相关分量全部固定，使综合分可预测（单变量隔离）。

    bert_service 默认 None → **关闭 BERT 分量**；需要验证 BERT 时显式传入替身。
    之所以默认关闭：真实 BERT 在本环境可用，若不隔离，权重/门槛类断言会被
    BERT 的 0.3 贡献干扰（实测 weighting_formula 会从 0.35 变成 0.65）。
    """
    engine.vectorizer = None  # TFIDF 分量归零
    monkeypatch.setattr(engine, "_expand_synonyms", lambda t: [t])
    monkeypatch.setattr(engine, "_bm25_score", lambda t, i, idx: bm25)
    monkeypatch.setattr(engine, "_has_antonym_conflict", lambda t, r: antonym)
    monkeypatch.setattr("services.bert_service.get_bert_service", lambda: bert_service)


def test_deep_semantic_match_no_rules_returns_empty(app, db_session):
    """该意图下无规则 → 直接返回 []，不做任何计算。"""
    engine = _engine_forced_refresh(app)
    assert engine.deep_semantic_match("张三迟到扣2分", "deduct") == []


def test_deep_semantic_match_weighting_formula(app, db_session, monkeypatch):
    """权重配比固化：0.2*TFIDF + 0.2*BM25 + 0.3*BERT + 0.3*keyword。"""
    rule = _seed_rule(db_session, "迟到", "deduct")
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=1.0)  # BM25 归一后 = 1.0

    matched = engine.deep_semantic_match("迟到", "deduct")
    assert matched, "关键词命中应产生匹配"
    assert matched[0][0].id == rule.id
    # keyword=0.5（关键词直接命中）、BM25=1.0、TFIDF=0、BERT=0
    # combined = 0.2*0 + 0.2*1.0 + 0.3*0 + 0.3*0.5 = 0.35
    assert matched[0][1] == pytest.approx(0.35)


def test_deep_semantic_match_threshold_is_strict(app, db_session, monkeypatch):
    """门槛为**严格大于** 0.15：恰好 0.15 必须被排除。

    keyword 命中给 0.5 → 0.3*0.5 = 0.15，其余分量归零时综合分正好落在门槛上。
    """
    _seed_rule(db_session, "迟到", "deduct")
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=0.0)

    assert engine.deep_semantic_match("迟到", "deduct") == []


class _FakeBertService:
    """可控 BERT 替身：用预置向量代替真实模型推理，便于断言相似度计算。

    真实 BERT 依赖 torch 链与模型文件，沙箱不可靠；替身只实现
    `_get_bert_service_safe` 实际用到的三个方法。
    """

    def __init__(self, vectors):
        self._vectors = vectors
        self.batch_calls = 0
        self.single_calls = 0

    def is_available(self):
        return True

    def batch_get_embeddings(self, texts):
        self.batch_calls += 1
        return [self._vectors.get(t) for t in texts]

    def get_embedding(self, text):
        self.single_calls += 1
        return self._vectors.get(text)


def test_deep_semantic_match_bert_unavailable_falls_back_to_zero(app, db_session, monkeypatch):
    """BERT 不可用 → 相似度归零，与接入前 np.zeros 的降级行为完全一致。"""
    rule = _seed_rule(db_session, "迟到", "deduct", tags=["迟到"])
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=0.0)
    monkeypatch.setattr("services.bert_service.get_bert_service", lambda: None)

    matched = engine.deep_semantic_match("迟到", "deduct")
    assert matched
    # keyword = 0.5（关键词）+ 0.1（tag）= 0.6；TFIDF/BM25/BERT 均为 0
    # combined = 0.3 * 0.6 = 0.18
    assert matched[0][0].id == rule.id
    assert matched[0][1] == pytest.approx(0.18)


def test_deep_semantic_match_bert_rescues_lexically_unrelated_rule(app, db_session, monkeypatch):
    """BERT 的核心价值：字面完全不重叠但语义相近时仍能命中规则。

    「上课打瞌睡」与规则「睡觉」无任何字面重合 → keyword=0、BM25 桩为 0，
    接入前综合分恒为 0 → 必然漏匹配；接入后 BERT 归一相似度=1.0
    → combined = 0.3，越过 0.15 门槛命中。
    """
    import numpy as np

    rule = _seed_rule(db_session, "睡觉", "deduct")
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=0.0)

    rule_text = "睡觉 睡觉"  # behavior_keyword + behavior_description 拼接
    fake = _FakeBertService(
        {rule_text: np.array([1.0, 0.0]), "上课打瞌睡": np.array([0.6, 0.8])}
    )
    monkeypatch.setattr("services.bert_service.get_bert_service", lambda: fake)

    matched = engine.deep_semantic_match("上课打瞌睡", "deduct")
    assert matched, "语义相近但字面不重合的规则应被 BERT 捞回"
    assert matched[0][0].id == rule.id
    # 候选内相对归一：唯一候选归一为 1.0 → 0.3*1.0 = 0.3
    assert matched[0][1] == pytest.approx(0.3)


def test_deep_semantic_match_bert_normalizes_within_candidates(app, db_session, monkeypatch):
    """BERT 采用候选内相对归一（与 BM25 一致），表达相对贴近度而非绝对余弦。

    查询 [1, 0.6]：与「睡觉」[1,0] 余弦 ≈0.857、与「迟到」[0,1] ≈0.514
    → 归一后 1.0 / 0.6 → 综合分 0.30 / 0.18，两者都越过 0.15 硬门槛。

    ⚠️ 不能取 0.5 的比例：0.3*0.5 = 0.15，恰好等于门槛，会被「严格大于」判排除。
    """
    import numpy as np

    _seed_rule(db_session, "睡觉", "deduct")
    _seed_rule(db_session, "迟到", "deduct")
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=0.0)

    fake = _FakeBertService(
        {
            "睡觉 睡觉": np.array([1.0, 0.0]),
            "迟到 迟到": np.array([0.0, 1.0]),
            "打瞌睡": np.array([1.0, 0.6]),
        }
    )
    monkeypatch.setattr("services.bert_service.get_bert_service", lambda: fake)

    matched = engine.deep_semantic_match("打瞌睡", "deduct")
    by_keyword = {r.behavior_keyword: score for r, score in matched}
    assert by_keyword["睡觉"] == pytest.approx(0.3 * 1.0)
    assert by_keyword["迟到"] == pytest.approx(0.3 * 0.6)


def test_bert_rule_vectors_cached_by_signature(app, db_session, monkeypatch):
    """规则向量按规则文本签名缓存：规则未变时不重复过 BERT（性能护栏）。"""
    import numpy as np

    _seed_rule(db_session, "睡觉", "deduct")
    engine = _engine_forced_refresh(app)
    fake = _FakeBertService(
        {
            "睡觉 睡觉": np.array([1.0, 0.0]),
            "打瞌睡": np.array([0.8, 0.6]),
            "走神": np.array([0.7, 0.7]),
        }
    )
    monkeypatch.setattr("services.bert_service.get_bert_service", lambda: fake)

    engine.deep_semantic_match("打瞌睡", "deduct")
    after_first = fake.batch_calls
    assert after_first == 1

    engine.deep_semantic_match("走神", "deduct")
    assert fake.batch_calls == after_first, "规则文本未变，不应重复计算规则向量"


def test_deep_semantic_match_top_n_and_desc_order(app, db_session, monkeypatch):
    """返回按分数降序排列，且条数不超过 top_n。"""
    for kw in ("迟到", "早退", "睡觉"):
        _seed_rule(db_session, kw, "deduct")
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=0.5)

    matched = engine.deep_semantic_match("迟到", "deduct", top_n=2)
    assert len(matched) <= 2
    scores = [score for _, score in matched]
    assert scores == sorted(scores, reverse=True)


def test_deep_semantic_match_antonym_conflict_excluded(app, db_session, monkeypatch):
    """存在反义冲突的规则，即使分数过门槛也要被剔除。"""
    _seed_rule(db_session, "迟到", "deduct")
    engine = _engine_forced_refresh(app)
    _stub_components(monkeypatch, engine, bm25=1.0, antonym=True)

    assert engine.deep_semantic_match("迟到", "deduct") == []
