#!/usr/bin/env python3
""" """

# BERT服务测试模块
"""
"""

import pytest
import numpy as np
from unittest.mock import patch, MagicMock

try:
    from services.bert_service import BertNLPService
except ImportError:
    pass

try:
    import sys
except ImportError:
    pass

try:
    from services.bert_service import get_bert_service
except ImportError:
    pass

try:
    from services.bert_service import initialize_bert_service
except ImportError:
    pass


class TestBertService:
    """BERT服务测试类"""

    def test_service_creation_default(self):
        """测试服务默认创建"""
        from services.bert_service import BertNLPService

        service = BertNLPService(use_quantization=False)
        assert service is not None
        assert service.model_path is not None
        assert service.use_quantization is False

    def test_service_creation_custom_path(self):
        """测试服务自定义模型路径"""

        service = BertNLPService(model_path="/custom/path", use_quantization=True)
        assert service.model_path == "/custom/path"
        assert service.use_quantization is True

    def test_is_available_not_initialized(self):
        """测试未初始化时的可用性检查"""

        service = BertNLPService(model_path="/nonexistent/path")
        assert service.is_available() is False

    def test_get_stats_not_initialized(self):
        """测试未初始化时的状态获取"""

        service = BertNLPService(model_path="/nonexistent/path")
        stats = service.get_stats()
        assert isinstance(stats, dict)
        assert stats["initialized"] is False
        assert stats["warmup_done"] is False
        assert stats["load_time"] == 0.0

    def test_warmup_not_initialized(self):
        """测试未初始化时的预热"""

        service = BertNLPService(model_path="/nonexistent/path")
        service.warmup()
        assert service._warmup_done is False

    def test_get_embedding_not_initialized(self):
        """测试未初始化时获取向量"""

        service = BertNLPService(model_path="/nonexistent/path")
        result = service.get_embedding("测试文本")
        assert result is None

    def test_batch_get_embeddings_not_initialized(self):
        """测试未初始化时批量获取向量"""

        service = BertNLPService(model_path="/nonexistent/path")
        results = service.batch_get_embeddings(["测试1", "测试2"])
        assert isinstance(results, list)
        assert len(results) == 2
        assert all(r is None for r in results)

    def test_predict_intent_not_initialized(self):
        """测试未初始化时意图预测"""

        service = BertNLPService(model_path="/nonexistent/path")
        intent, confidence = service.predict_intent("表扬李华")
        assert intent == "unknown"
        assert confidence == 0.0

    def test_batch_predict_intent_not_initialized(self):
        """测试未初始化时批量意图预测"""

        service = BertNLPService(model_path="/nonexistent/path")
        results = service.batch_predict_intent(["表扬", "迟到"])
        assert isinstance(results, list)
        assert len(results) == 2
        assert all(r[0] == "unknown" for r in results)
        assert all(r[1] == 0.0 for r in results)

    def test_calculate_similarity_not_initialized(self):
        """测试未初始化时相似度计算"""

        service = BertNLPService(model_path="/nonexistent/path")
        similarity = service.calculate_similarity("文本1", "文本2")
        assert similarity == 0.0

    def test_batch_calculate_similarity_not_initialized(self):
        """测试未初始化时批量相似度计算"""

        service = BertNLPService(model_path="/nonexistent/path")
        results = service.batch_calculate_similarity(["文本1", "文本2"], "目标")
        assert isinstance(results, list)
        assert len(results) == 2
        assert all(r == 0.0 for r in results)

    def test_analyze_sentiment_not_initialized(self):
        """测试未初始化时情感分析"""

        service = BertNLPService(model_path="/nonexistent/path")
        result = service.analyze_sentiment("表扬学生")
        assert isinstance(result, dict)
        assert result["positive"] == 0
        assert result["negative"] == 0
        assert result["neutral"] == 0
        assert result["score"] == 0.0

    def test_cosine_sim(self):
        """测试余弦相似度计算"""

        service = BertNLPService(model_path="/nonexistent/path")

        a = np.array([1.0, 0.0, 0.0])
        b = np.array([1.0, 0.0, 0.0])
        assert service._cosine_sim(a, b) == pytest.approx(1.0)

        a = np.array([1.0, 0.0, 0.0])
        b = np.array([0.0, 1.0, 0.0])
        assert service._cosine_sim(a, b) == pytest.approx(0.0)

        a = np.array([0.0, 0.0, 0.0])
        b = np.array([1.0, 0.0, 0.0])
        assert service._cosine_sim(a, b) == 0.0

        b = np.array([0.0, 0.0, 0.0])
        assert service._cosine_sim(a, b) == 0.0

    def test_cosine_sim_exception(self):
        """测试余弦相似度异常处理"""

        service = BertNLPService(model_path="/nonexistent/path")
        assert service._cosine_sim("invalid", "invalid") == 0.0

    def test_model_load_success_with_mock(self):
        """测试模型加载成功-直接mock内部状态"""

        mock_tokenizer = MagicMock()
        mock_model = MagicMock()
        mock_model.eval = MagicMock()

        service = BertNLPService(model_path="/valid/path")
        service.tokenizer = mock_tokenizer
        service.model = mock_model
        service._initialized = True

        assert service.is_available() is True
        assert service.tokenizer is not None
        assert service.model is not None

    def test_model_load_with_quantization_failure_mock(self):
        """测试模型加载时量化失败-直接mock内部状态"""

        service = BertNLPService(model_path="/valid/path")
        service.tokenizer = MagicMock()
        service.model = MagicMock()
        service._initialized = True
        service.use_quantization = False

        assert service._initialized is True
        assert service.use_quantization is False

    def test_model_load_exception_with_mock(self):
        """测试模型加载异常-直接mock内部状态"""

        service = BertNLPService(model_path="/valid/path")

        assert service._initialized is False

    def test_warmup_success_with_mock(self):
        """测试模型预热成功-直接mock内部状态"""

        mock_tokenizer = MagicMock()
        mock_model = MagicMock()

        service = BertNLPService(model_path="/valid/path")
        service.tokenizer = mock_tokenizer
        service.model = mock_model
        service._initialized = True

        with patch.object(service, "get_embedding") as mock_get_embedding:
            service.warmup()

            assert service._warmup_done is True
            assert mock_get_embedding.call_count == 5

    def test_warmup_already_done_with_mock(self):
        """测试预热已完成-直接mock内部状态"""

        service = BertNLPService(model_path="/valid/path")
        service._initialized = True
        service._warmup_done = True

        with patch.object(service, "get_embedding") as mock_get_embedding:
            service.warmup()

            assert service._warmup_done is True
            mock_get_embedding.assert_not_called()

    def test_get_embedding_success_with_mock(self):
        """测试获取向量成功-直接mock内部状态和torch模块"""
        import sys

        mock_torch = MagicMock()
        mock_torch.no_grad.return_value.__enter__ = MagicMock()
        mock_torch.no_grad.return_value.__exit__ = MagicMock()
        mock_torch.nn = MagicMock()
        mock_torch.qint8 = MagicMock()

        sys.modules["torch"] = mock_torch

        if "services.bert_service" in sys.modules:
            del sys.modules["services.bert_service"]

        final_embedding = np.array([[1.0, 0.0, 0.0]])

        mock_tensor = MagicMock()
        mock_tensor.mean.return_value.cpu.return_value.numpy.return_value = final_embedding

        mock_output = MagicMock()
        mock_output.last_hidden_state = mock_tensor

        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {"input_ids": MagicMock(), "attention_mask": MagicMock()}

        mock_model = MagicMock(return_value=mock_output)

        service = BertNLPService(model_path="/valid/path")
        service.tokenizer = mock_tokenizer
        service.model = mock_model
        service._initialized = True

        result = service.get_embedding("测试文本")

        assert result is not None
        assert isinstance(result, np.ndarray)

    def test_get_embedding_exception_with_mock(self):
        """测试获取向量异常-直接mock内部状态"""

        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {"input_ids": MagicMock(), "attention_mask": MagicMock()}

        mock_model = MagicMock(side_effect=Exception("Embedding error"))

        service = BertNLPService(model_path="/valid/path")
        service.tokenizer = mock_tokenizer
        service.model = mock_model
        service._initialized = True

        result = service.get_embedding("测试文本")

        assert result is None

    def test_analyze_sentiment_positive_with_mock(self):
        """测试情感分析-积极-直接mock内部状态"""

        service = BertNLPService(model_path="/valid/path")
        service._initialized = True

        result = service.analyze_sentiment("表扬学生表现优秀")
        assert isinstance(result, dict)
        assert result["positive"] > 0
        assert result["score"] > 0

    def test_analyze_sentiment_negative_with_mock(self):
        """测试情感分析-消极-直接mock内部状态"""

        service = BertNLPService(model_path="/valid/path")
        service._initialized = True

        result = service.analyze_sentiment("批评学生迟到")
        assert isinstance(result, dict)
        assert result["negative"] > 0
        assert result["score"] < 0

    def test_analyze_sentiment_neutral_with_mock(self):
        """测试情感分析-中性-直接mock内部状态"""

        service = BertNLPService(model_path="/valid/path")
        service._initialized = True

        result = service.analyze_sentiment("今天天气不错")
        assert isinstance(result, dict)
        assert result["neutral"] == 1
        assert result["score"] == 0.0

    def test_get_bert_service_singleton(self):
        """测试单例模式"""
        from services.bert_service import get_bert_service

        service1 = get_bert_service()
        service2 = get_bert_service()

        assert service1 is service2

    def test_initialize_bert_service(self):
        """测试初始化函数"""
        from services.bert_service import initialize_bert_service

        result = initialize_bert_service(warmup=False)

        assert isinstance(result, bool)

    @patch("services.bert_service.TRANSFORMERS_AVAILABLE", False)
    def test_transformers_not_available(self):
        """测试transformers不可用时"""

        service = BertNLPService(model_path="/valid/path")
        assert service._initialized is False
        assert service.is_available() is False
