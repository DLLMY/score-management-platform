from unittest.mock import patch

try:
    from services.nlp_optimizer import NLPCache
except ImportError:
    pass

try:
    from services.nlp_optimizer import get_nlp_optimizer
except ImportError:
    pass

try:
    from services.nlp_optimizer import NLPPerformanceOptimizer
except ImportError:
    pass

try:
    from services.nlp_optimizer import warmup_nlp
except ImportError:
    pass


class TestNLPCache:
    """NLP缓存测试"""

    def test_hash_text(self):
        """测试文本哈希生成"""
        from services.nlp_optimizer import NLPCache

        cache = NLPCache()
        text = "test text"
        hash1 = cache._hash_text(text)
        hash2 = cache._hash_text(text)

        assert hash1 == hash2
        assert len(hash1) == 64

    def test_get_set(self):
        """测试缓存获取和设置"""

        cache = NLPCache()
        text = "测试文本"
        result = {"intent": "add", "name": "张三"}

        cache.set(text, result)
        cached = cache.get(text)

        assert cached == result

    def test_get_not_found(self):
        """测试获取不存在的缓存"""

        cache = NLPCache()
        result = cache.get("不存在的文本")

        assert result is None

    def test_batch_get(self):
        """测试批量获取缓存"""

        cache = NLPCache()
        cache.set("文本1", {"intent": "add"})
        cache.set("文本2", {"intent": "query"})

        texts = ["文本1", "文本2", "文本3"]
        results, uncached = cache.batch_get(texts)

        assert "文本1" in results
        assert "文本2" in results
        assert "文本3" not in results
        assert "文本3" in uncached

    def test_batch_set(self):
        """测试批量设置缓存"""

        cache = NLPCache()
        text_results = {
            "文本1": {"intent": "add"},
            "文本2": {"intent": "query"},
        }

        cache.batch_set(text_results)

        assert cache.get("文本1") == {"intent": "add"}
        assert cache.get("文本2") == {"intent": "query"}

    def test_clear(self):
        """测试清空缓存"""

        cache = NLPCache()
        cache.set("文本1", {"intent": "add"})

        assert cache.get("文本1") is not None

        cache.clear()

        assert cache.get("文本1") is None

    def test_local_cache_limit(self):
        """测试本地缓存大小限制"""

        cache = NLPCache()
        cache._max_local_cache = 3

        for i in range(5):
            cache.set(f"文本{i}", {"intent": "test", "id": i})

        assert len(cache._local_cache) <= 3


class TestNLPPerformanceOptimizer:
    """NLP性能优化器测试"""

    def test_singleton_instance(self):
        """测试单例模式"""
        from services.nlp_optimizer import get_nlp_optimizer

        optimizer1 = get_nlp_optimizer()
        optimizer2 = get_nlp_optimizer()

        assert optimizer1 is optimizer2

    def test_parse_with_cache_cached(self):
        """测试带缓存的解析 - 命中缓存"""
        from services.nlp_optimizer import NLPPerformanceOptimizer

        optimizer = NLPPerformanceOptimizer()
        text = "缓存文本"
        expected = {"intent": "add"}

        optimizer._cache.set(text, expected)

        def parser_func(t):
            raise ValueError("不应该调用解析函数")

        result = optimizer.parse_with_cache(text, parser_func)

        assert result == expected

    def test_parse_with_cache_not_cached(self):
        """测试带缓存的解析 - 未命中缓存"""

        optimizer = NLPPerformanceOptimizer()
        text = "未缓存文本"
        expected = {"intent": "add"}

        def parser_func(t):
            return expected

        result = optimizer.parse_with_cache(text, parser_func)

        assert result == expected
        assert optimizer._cache.get(text) == expected

    def test_batch_parse_all_cached(self):
        """测试批量解析 - 全部已缓存"""

        optimizer = NLPPerformanceOptimizer()
        texts = ["文本1", "文本2"]

        optimizer._cache.set("文本1", {"intent": "add"})
        optimizer._cache.set("文本2", {"intent": "query"})

        def parser_func(t):
            raise ValueError("不应该调用解析函数")

        results = optimizer.batch_parse(texts, parser_func)

        assert len(results) == 2
        assert results[0]["intent"] == "add"
        assert results[1]["intent"] == "query"

    def test_batch_parse_not_cached(self):
        """测试批量解析 - 未缓存"""

        optimizer = NLPPerformanceOptimizer()
        texts = ["文本1", "文本2", "文本3"]

        def parser_func(t):
            return {"intent": "add", "text": t}

        results = optimizer.batch_parse(texts, parser_func)

        assert len(results) == 3
        assert results[0]["text"] == "文本1"
        assert results[1]["text"] == "文本2"
        assert results[2]["text"] == "文本3"

    def test_get_stats(self):
        """测试获取性能统计"""

        optimizer = NLPPerformanceOptimizer()

        def parser_func(t):
            return {"intent": "test"}

        optimizer.parse_with_cache("文本1", parser_func)
        optimizer.parse_with_cache("文本2", parser_func)

        stats = optimizer.get_stats()

        assert stats["total_requests"] == 2
        assert stats["cached_requests"] == 0
        assert stats["avg_response_time"] >= 0
        assert "cache_hit_rate" in stats
        assert "models_loaded" in stats

    def test_get_service(self):
        """测试获取服务实例"""

        optimizer = NLPPerformanceOptimizer()

        assert optimizer.get_service("bert") is None
        assert optimizer.get_service("ml") is None
        assert optimizer.get_service("parser") is None
        assert optimizer.get_service("unknown") is None

    def test_warmup(self):
        """测试模型预热"""

        optimizer = NLPPerformanceOptimizer()
        optimizer._warmup_done = False
        optimizer._models_loaded = False

        optimizer.warmup()

        assert optimizer._warmup_done is True

    def test_warmup_nlp_function(self):
        """测试warmup_nlp函数"""
        from services.nlp_optimizer import warmup_nlp

        optimizer = get_nlp_optimizer()
        optimizer._warmup_done = False

        with patch.object(optimizer, "warmup") as mock_warmup:
            warmup_nlp()
            mock_warmup.assert_called_once()

    def test_warmup_already_done(self):
        """测试已完成预热"""

        optimizer = NLPPerformanceOptimizer()
        optimizer._warmup_done = True

        optimizer.warmup()

        assert optimizer._warmup_done is True
