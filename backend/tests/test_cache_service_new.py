import time
from unittest.mock import patch
try:
    from services.cache_service import CacheService
except ImportError:
    pass


class TestCacheService:

    def test_init_with_redis_unavailable(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            from services.cache_service import CacheService
            cache = CacheService(host='localhost', port=6379)

            assert cache.is_redis_available is False
            assert cache.redis_client is None
            assert hasattr(cache, 'memory_cache')

    def test_memory_cache_set_get(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('test_key', {'name': 'test'})
            result = cache.get('test_key')
            assert result == {'name': 'test'}

    def test_memory_cache_delete(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('test_key', 'test_value')
            assert cache.get('test_key') == 'test_value'

            cache.delete('test_key')
            assert cache.get('test_key') is None

    def test_memory_cache_exists(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            assert cache.exists('nonexistent') is False
            cache.set('test_key', 'test_value')
            assert cache.exists('test_key') is True

    def test_memory_cache_ttl_expiration(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('test_key', 'test_value', ttl=1)
            assert cache.get('test_key') == 'test_value'

            time.sleep(1.1)
            assert cache.get('test_key') is None

    def test_memory_cache_get_many(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('key1', 'value1')
            cache.set('key2', 'value2')

            result = cache.get_many(['key1', 'key2', 'key3'])
            assert result['key1'] == 'value1'
            assert result['key2'] == 'value2'
            assert 'key3' not in result

    def test_memory_cache_set_many(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            items = {'key1': 'value1', 'key2': 'value2'}
            count = cache.set_many(items)
            assert count == 2
            assert cache.get('key1') == 'value1'

    def test_memory_cache_delete_many(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('key1', 'value1')
            cache.set('key2', 'value2')

            count = cache.delete_many(['key1', 'key2'])
            assert count == 2
            assert cache.get('key1') is None

    def test_memory_cache_tags(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('key1', 'value1', tags=['tag1', 'tag2'])
            cache.set('key2', 'value2', tags=['tag1'])

            assert cache.get('key1') == 'value1'
            assert cache.get('key2') == 'value2'

            deleted = cache.invalidate_by_tag('tag1')
            assert deleted >= 1
            assert cache.get('key1') is None
            assert cache.get('key2') is None

    def test_memory_cache_flush_all(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('key1', 'value1')
            cache.set('key2', 'value2')

            result = cache.flush_all()
            assert result is True
            assert cache.get('key1') is None
            assert cache.get('key2') is None

    def test_get_stats(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('key1', 'value1')
            cache.get('key1')
            cache.get('nonexistent')
            cache.delete('key1')

            stats = cache.get_stats()
            assert stats['redis_available'] is False
            assert stats['hits'] >= 1
            assert stats['misses'] >= 1
            assert stats['sets'] >= 1
            assert stats['deletes'] >= 1
            assert 'hit_rate' in stats

    def test_get_keys_by_pattern(self):
        with patch('redis.Redis') as mock_redis:
            mock_redis.side_effect = Exception("Connection refused")
            cache = CacheService(host='localhost', port=6379)

            cache.set('user:1', 'value1')
            cache.set('user:2', 'value2')
            cache.set('admin:1', 'value3')

            keys = cache.get_keys_by_pattern('user:*')
            assert len(keys) >= 2
