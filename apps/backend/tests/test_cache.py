from utils.cache import (
    CacheEntry,
    ResponseCache,
    get_default_cache,
    cached,
    CacheWarmer,
    clear_cache,
    get_cache_stats,
)


class TestCacheEntry:

    def test_is_expired(self):
        entry = CacheEntry("value", 3600)
        assert entry.is_expired() is False

    def test_access(self):
        entry = CacheEntry("value", 3600)
        assert entry.hits == 0

        value = entry.access()
        assert value == "value"
        assert entry.hits == 1

    def test_get_age(self):
        entry = CacheEntry("value", 3600)
        age = entry.get_age()
        assert age >= 0
        assert age < 1


class TestResponseCache:

    def test_get_set(self):
        cache = ResponseCache()
        cache.set("test_key", "test_value")

        result = cache.get("test_key")
        assert result == "test_value"

    def test_get_nonexistent(self):
        cache = ResponseCache()
        result = cache.get("nonexistent")
        assert result is None

    def test_delete(self):
        cache = ResponseCache()
        cache.set("test_key", "test_value")

        assert cache.delete("test_key") is True
        assert cache.delete("nonexistent") is False

    def test_clear(self):
        cache = ResponseCache()
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        count = cache.clear()
        assert count == 2
        assert len(cache) == 0

    def test_evict_oldest(self):
        cache = ResponseCache(max_size=2)
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        cache.set("key3", "value3")
        assert len(cache) == 2
        assert cache.get("key1") is None

    def test_cleanup_expired(self):
        cache = ResponseCache(default_ttl=0)
        cache.set("key1", "value1")

        count = cache.cleanup_expired()
        assert count >= 0

    def test_get_stats(self):
        cache = ResponseCache()
        cache.set("key1", "value1")
        cache.get("key1")
        cache.get("nonexistent")

        stats = cache.get_stats()
        assert "hits" in stats
        assert "misses" in stats
        assert "size" in stats
        assert "hit_rate" in stats

    def test_len(self):
        cache = ResponseCache()
        assert len(cache) == 0

        cache.set("key1", "value1")
        assert len(cache) == 1

    def test_invalidate_pattern(self):
        cache = ResponseCache()
        result = cache.invalidate_pattern("*")
        assert result == 0

    def test_generate_key(self):
        cache = ResponseCache()
        key = cache._generate_key("arg1", "arg2", kw1="val1")
        assert isinstance(key, str)
        assert len(key) == 64


class TestCacheFunctions:

    def test_get_default_cache(self):
        cache1 = get_default_cache()
        cache2 = get_default_cache()
        assert cache1 is cache2

    def test_clear_cache(self):
        cache = get_default_cache()
        cache.set("test_key", "test_value")

        count = clear_cache()
        assert count >= 0

    def test_get_cache_stats(self):
        stats = get_cache_stats()
        assert isinstance(stats, dict)


class TestCachedDecorator:

    def test_cached_decorator(self):
        call_count = [0]

        @cached(ttl=1)
        def expensive_func(x):
            call_count[0] += 1
            return x * 2

        result1 = expensive_func(5)
        result2 = expensive_func(5)

        assert result1 == 10
        assert result2 == 10
        assert call_count[0] == 1

    def test_cached_clear_cache(self):

        @cached(ttl=1)
        def expensive_func(x):
            return x * 2

        assert hasattr(expensive_func, "clear_cache")
        expensive_func.clear_cache()

    def test_cached_get_cache_stats(self):

        @cached(ttl=1)
        def expensive_func(x):
            return x * 2

        expensive_func(5)
        stats = expensive_func.get_cache_stats()
        assert isinstance(stats, dict)


class TestCacheWarmer:

    def test_cache_warmer_register(self):
        warmer = CacheWarmer()

        def warmup_task():
            return "result"

        warmer.register("test_task", warmup_task)

    def test_cache_warmer_warmup(self):
        warmer = CacheWarmer()

        def success_task():
            return "success"

        def error_task():
            raise ValueError("test error")

        warmer.register("success", success_task)
        warmer.register("error", error_task)

        results = warmer.warmup()
        assert "success" in results
        assert "error" in results
