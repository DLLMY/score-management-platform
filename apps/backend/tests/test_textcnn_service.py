import numpy as np
import tempfile
import os

try:
    from services.textcnn_service import TextCNNClassifier
except ImportError:
    pass

try:
    from services.textcnn_service import IntentMatcher
except ImportError:
    pass


class TestTextCNNClassifier:
    """TextCNN分类器测试"""

    def test_initialization(self):
        """测试初始化"""
        from services.textcnn_service import TextCNNClassifier

        cnn = TextCNNClassifier()

        assert cnn.embedding_dim == 128
        assert cnn.max_len == 32
        assert cnn.num_filters == 64
        assert cnn.filter_sizes == [2, 3, 4]
        assert cnn.vocab_size > 0
        assert cnn.num_classes == 5

    def test_tokenize(self):
        """测试字符级分词"""

        cnn = TextCNNClassifier()
        text = "测试文本"

        tokens = cnn._tokenize(text)

        assert len(tokens) == cnn.max_len
        assert isinstance(tokens, np.ndarray)

    def test_forward_single(self):
        """测试前向传播 - 单文本"""

        cnn = TextCNNClassifier()
        text = "测试文本"

        result = cnn.forward(text)

        assert "predictions" in result
        assert "probabilities" in result
        assert "features" in result
        assert len(result["predictions"]) == 1
        assert result["probabilities"].shape == (1, 5)

    def test_forward_batch(self):
        """测试前向传播 - 批量文本"""

        cnn = TextCNNClassifier()
        texts = ["测试文本1", "测试文本2", "测试文本3"]

        result = cnn.forward(texts)

        assert len(result["predictions"]) == 3
        assert result["probabilities"].shape == (3, 5)

    def test_predict_intent(self):
        """测试意图预测"""

        cnn = TextCNNClassifier()
        text = "张三积极发言"

        intent, confidence = cnn.predict_intent(text)

        assert intent in ["praise", "punish", "attendance", "behavior", "other"]
        assert 0 <= confidence <= 1

    def test_get_sentence_embedding(self):
        """测试获取句子向量"""

        cnn = TextCNNClassifier()
        text = "测试文本"

        embedding = cnn.get_sentence_embedding(text)

        assert isinstance(embedding, np.ndarray)
        assert len(embedding) == cnn.num_filters * len(cnn.filter_sizes)

    def test_cosine_similarity(self):
        """测试余弦相似度计算"""

        cnn = TextCNNClassifier()

        similarity = cnn.cosine_similarity("上课发言", "主动回答问题")

        assert isinstance(similarity, float)
        assert 0 <= similarity <= 1

    def test_cosine_similarity_same(self):
        """测试相同文本相似度"""

        cnn = TextCNNClassifier()

        similarity = cnn.cosine_similarity("测试文本", "测试文本")

        assert similarity > 0.9

    def test_save_load_model(self):
        """测试模型保存和加载"""

        cnn = TextCNNClassifier()

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            model_path = f.name

        try:
            cnn.save_model(model_path)

            assert os.path.exists(model_path)

            new_cnn = TextCNNClassifier()
            new_cnn.load_model(model_path)

            assert new_cnn.embedding_dim == cnn.embedding_dim
            assert new_cnn.max_len == cnn.max_len
            assert new_cnn.num_filters == cnn.num_filters
        finally:
            if os.path.exists(model_path):
                os.remove(model_path)

    def test_train(self):
        """测试模型训练"""

        cnn = TextCNNClassifier()

        texts = [
            "张三积极发言",
            "李四迟到",
            "王五帮助同学",
            "赵六上课睡觉",
            "钱七打扫卫生",
            "孙八早退",
            "周九主动回答问题",
            "吴十打架",
        ]
        labels = ["praise", "punish", "praise", "punish", "praise", "punish", "praise", "punish"]

        cnn.train(texts, labels, epochs=2)

        assert True

    def test_relu(self):
        """测试ReLU激活函数"""

        cnn = TextCNNClassifier()

        x = np.array([-1, 0, 1, 2])
        result = cnn._relu(x)

        assert np.array_equal(result, np.array([0, 0, 1, 2]))

    def test_max_pool(self):
        """测试最大池化"""

        cnn = TextCNNClassifier()

        inputs = np.array([[[1, 2, 3], [4, 5, 6]]])
        result = cnn._max_pool(inputs)

        assert result.shape == (1, 2)
        assert np.array_equal(result, np.array([[3, 6]]))


class TestIntentMatcher:
    """意图匹配器测试"""

    def test_initialization(self):
        """测试初始化"""
        from services.textcnn_service import IntentMatcher

        matcher = IntentMatcher()

        assert matcher.cnn is not None
        assert len(matcher.praise_patterns) > 0
        assert len(matcher.punish_patterns) > 0
        assert len(matcher.attendance_patterns) > 0
        assert len(matcher.behavior_patterns) > 0

    def test_match_pattern(self):
        """测试模式匹配"""

        matcher = IntentMatcher()

        text = "张三积极发言"
        matches = matcher.match_pattern(text, matcher.praise_patterns)

        assert isinstance(matches, list)

    def test_predict(self):
        """测试综合预测"""

        matcher = IntentMatcher()

        result = matcher.predict("张三积极发言")

        assert "intent" in result
        assert "confidence" in result
        assert "cnn_intent" in result
        assert "rule_intent" in result
        assert "matches" in result

    def test_predict_praise(self):
        """测试表扬意图预测"""

        matcher = IntentMatcher()

        result = matcher.predict("张三主动回答问题，表现优秀")

        assert result["intent"] == "praise"

    def test_predict_punish(self):
        """测试惩罚意图预测"""

        matcher = IntentMatcher()

        result = matcher.predict("李四迟到，上课睡觉")

        assert result["intent"] == "punish"

    def test_predict_attendance(self):
        """测试考勤意图预测"""

        matcher = IntentMatcher()

        result = matcher.predict("王五请假")

        assert result["intent"] == "attendance"

    def test_semantic_search(self):
        """测试语义搜索"""

        matcher = IntentMatcher()

        text = "上课发言"
        candidates = ["主动回答问题", "迟到早退", "帮助同学", "上课睡觉"]

        results = matcher.semantic_search(text, candidates, top_k=2)

        assert len(results) == 2
        assert results[0]["similarity"] >= results[1]["similarity"]

    def test_benchmark(self):
        """测试性能基准"""

        matcher = IntentMatcher()

        test_texts = ["测试文本1", "测试文本2", "测试文本3"]

        avg_time = matcher.benchmark(test_texts)

        assert isinstance(avg_time, float)
        assert avg_time >= 0

    def test_rule_confidence_high(self):
        """测试规则置信度高的情况"""

        matcher = IntentMatcher()

        result = matcher.predict("张三非常优秀，积极帮助同学")

        assert result["rule_confidence"] > 0.5
        assert result["intent"] == "praise"

    def test_rule_confidence_low(self):
        """测试规则置信度低的情况"""

        matcher = IntentMatcher()

        result = matcher.predict("普通文本")

        assert result["rule_confidence"] <= 0.5
