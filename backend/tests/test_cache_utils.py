import time
from utils.cache import ResponseCache
try:
    from utils.cache import CacheEntry
except ImportError:
    pass


class TestCacheUtils:

    def test_cache_set_and_get(self):
        cache = ResponseCache(max_size=100, default_ttl=300)
        cache.set('test_key', 'test_value')
        result = cache.get('test_key')
        assert result == 'test_value'

    def test_cache_expiration(self):
        cache = ResponseCache(max_size=100, default_ttl=1)
        cache.set('expiring_key', 'value', ttl=1)
        assert cache.get('expiring_key') == 'value'
        time.sleep(1.1)
        assert cache.get('expiring_key') is None

    def test_cache_not_found(self):
        cache = ResponseCache(max_size=100, default_ttl=300)
        assert cache.get('non_existent_key') is None

    def test_cache_stats(self):
        cache = ResponseCache(max_size=100, default_ttl=300)
        cache.set('key1', 'value1')
        cache.get('key1')
        cache.get('key1')
        cache.get('non_existent')

        stats = cache.get_stats()
        assert stats['hits'] >= 2
        assert stats['misses'] >= 1

    def test_cache_clear(self):
        cache = ResponseCache(max_size=100, default_ttl=300)
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.clear()
        assert cache.get('key1') is None
        assert cache.get('key2') is None

    def test_cache_delete(self):
        cache = ResponseCache(max_size=100, default_ttl=300)
        cache.set('key1', 'value1')
        cache.delete('key1')
        assert cache.get('key1') is None

    def test_cache_size_limit(self):
        cache = ResponseCache(max_size=2, default_ttl=300)
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')

        stats = cache.get_stats()
        assert stats['evictions'] >= 1

    def test_cache_len(self):
        cache = ResponseCache(max_size=100, default_ttl=300)
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        assert len(cache) >= 2

    def test_cache_entry_is_expired(self):
        from utils.cache import CacheEntry
        entry = CacheEntry('value', ttl=1)
        assert entry.is_expired() is False
        time.sleep(1.1)
        assert entry.is_expired() is True

    def test_cache_entry_access(self):
        entry = CacheEntry('value', ttl=300)
        result = entry.access()
        assert result == 'value'
        assert entry.hits == 1

    def test_cache_entry_get_age(self):
        entry = CacheEntry('value', ttl=300)
        age = entry.get_age()
        assert age >= 0
