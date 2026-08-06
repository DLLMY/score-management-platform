"""
Tests for Redis Cache Service
"""
import redis
from unittest.mock import patch, MagicMock
import pickle
try:
    from services.redis_cache_service import RedisCache
except ImportError:
    pass

try:
    from services.redis_cache_service import RedisCacheService
except ImportError:
    pass

try:
    from services.redis_cache_service import get_cache_service, cache
except ImportError:
    pass

try:
    from services.redis_cache_service import cached
except ImportError:
    pass

try:
    from services.redis_cache_service import CACHE_KEYS
except ImportError:
    pass

try:
    from services.redis_cache_service import warmup_cache, _warmup_completed
except ImportError:
    pass


class TestRedisCacheService:
    """Test Redis cache service functionality"""

    def test_service_initialization(self):
        """Test service can be initialized"""
        from services.redis_cache_service import RedisCache
        service = RedisCache()
        assert service is not None

    def test_get_key_with_prefix(self):
        """Test key prefix is added correctly"""
        service = RedisCache()
        key = service._key('test_key')
        assert 'test_key' in key

    def test_set_cached_data_dict(self):
        """Test basic set operation with dict"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            test_key = 'test_user_1'
            test_value = {'name': '张三', 'score': 100}

            result = service.set(test_key, test_value, expire=3600)

            assert result is True
            mock_instance.setex.assert_called_once()

    def test_set_cached_data_list(self):
        """Test set operation with list"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            test_key = 'test_list'
            test_value = [1, 2, 3, 4, 5]

            result = service.set(test_key, test_value, expire=1800)

            assert result is True
            mock_instance.setex.assert_called_once()

    def test_set_cached_data_string(self):
        """Test set operation with string"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            test_key = 'test_string'
            test_value = 'hello world'

            result = service.set(test_key, test_value, expire=3600)

            assert result is True
            mock_instance.setex.assert_called_once()

    def test_set_cached_data_without_expire(self):
        """Test set operation without expire"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.set.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            test_key = 'test_no_expire'
            test_value = 'test value'

            result = service.set(test_key, test_value)

            assert result is True
            mock_instance.set.assert_called_once()

    def test_set_cached_data_with_ttl(self):
        """Test set operation with ttl (ttl is same as expire)"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            test_key = 'test_ttl'
            test_value = {'data': 'test'}

            result = service.set(test_key, test_value, expire=300)

            assert result is True
            mock_instance.setex.assert_called_once()

    def test_set_cached_data_with_pickle(self):
        """Test set operation with pickled data (non-dict/list/str)"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            test_key = 'test_pickle'
            test_value = {'name': 'test'}

            result = service.set(test_key, test_value, expire=3600)

            assert result is True
            mock_instance.setex.assert_called_once()

    def test_set_cached_data_no_client(self):
        """Test set operation when client is None"""

        service = RedisCache()
        service.client = None

        result = service.set('test_key', 'test_value')

        assert result is False

    def test_delete_cache(self):
        """Test delete operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.delete.return_value = 1
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.delete('test_key')

            assert result is True
            mock_instance.delete.assert_called_once()

    def test_delete_cache_no_client(self):
        """Test delete operation when client is None"""

        service = RedisCache()
        service.client = None

        result = service.delete('test_key')

        assert result is False

    def test_delete_cache_key_not_found(self):
        """Test delete operation on nonexistent key (always returns True when client exists)"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.delete.return_value = 0
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.delete('nonexistent_key')

            assert result is True

    def test_get_cached_data_json(self):
        """Test basic get operation with JSON data"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.get.return_value = '{"name": "张三", "score": 100}'.encode('utf-8')
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.get('test_user_1')

            assert result is not None
            assert result['name'] == '张三'
            assert result['score'] == 100

    def test_get_cached_data_pickle(self):
        """Test get operation with pickled data"""
        test_data = {'name': '张三', 'score': 100}
        pickled_data = pickle.dumps(test_data).decode("latin1")

        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.get.return_value = pickled_data
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.get('test_pickle')

            assert result is not None
            assert result['name'] == '张三'

    def test_get_nonexistent_key(self):
        """Test get operation on nonexistent key"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.get.return_value = None
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.get('nonexistent_key')

            assert result is None

    def test_get_cached_data_no_client(self):
        """Test get operation when client is None"""

        service = RedisCache()
        service.client = None

        result = service.get('test_key')

        assert result is None

    def test_exists(self):
        """Test exists operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.exists.return_value = 1
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.exists('test_key')

            assert result is True
            mock_instance.exists.assert_called_once()

    def test_exists_false(self):
        """Test exists returns False for nonexistent key"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.exists.return_value = 0
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.exists('nonexistent_key')

            assert result is False

    def test_exists_no_client(self):
        """Test exists operation when client is None"""

        service = RedisCache()
        service.client = None

        result = service.exists('test_key')

        assert result is False

    def test_incr(self):
        """Test incr operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.incr.return_value = 5
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.incr('counter', amount=2)

            assert result == 5
            mock_instance.incr.assert_called_once()

    def test_incr_no_client(self):
        """Test incr operation when client is None"""

        service = RedisCache()
        service.client = None

        result = service.incr('counter')

        assert result is None

    def test_decr(self):
        """Test decr operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.decr.return_value = 3
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.decr('counter', amount=2)

            assert result == 3
            mock_instance.decr.assert_called_once()

    def test_hget(self):
        """Test hget operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.hget.return_value = b'value'
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.hget('hash_name', 'key')

            assert result == b'value'
            mock_instance.hget.assert_called_once()

    def test_hset(self):
        """Test hset operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.hset.return_value = 1
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.hset('hash_name', 'key', 'value')

            assert result is True
            mock_instance.hset.assert_called_once()

    def test_hgetall(self):
        """Test hgetall operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.hgetall.return_value = {b'key1': b'value1', b'key2': b'value2'}
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.hgetall('hash_name')

            assert isinstance(result, dict)
            mock_instance.hgetall.assert_called_once()

    def test_hdel(self):
        """Test hdel operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.hdel.return_value = 2
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.hdel('hash_name', 'key1', 'key2')

            assert result == 2
            mock_instance.hdel.assert_called_once()

    def test_lpush(self):
        """Test lpush operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.lpush.return_value = 3
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.lpush('list_key', 'value1', 'value2')

            assert result == 3
            mock_instance.lpush.assert_called_once()

    def test_rpop(self):
        """Test rpop operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.rpop.return_value = b'value'
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.rpop('list_key')

            assert result == b'value'
            mock_instance.rpop.assert_called_once()

    def test_smembers(self):
        """Test smembers operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.smembers.return_value = {b'member1', b'member2'}
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.smembers('set_key')

            assert isinstance(result, set)
            mock_instance.smembers.assert_called_once()

    def test_sadd(self):
        """Test sadd operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.sadd.return_value = 2
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.sadd('set_key', 'member1', 'member2')

            assert result == 2
            mock_instance.sadd.assert_called_once()

    def test_zadd(self):
        """Test zadd operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.zadd.return_value = 2
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.zadd('zset_key', {'member1': 1.0, 'member2': 2.0})

            assert result == 2
            mock_instance.zadd.assert_called_once()

    def test_zrange(self):
        """Test zrange operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.zrange.return_value = [b'member1', b'member2']
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.zrange('zset_key', 0, 10)

            assert isinstance(result, list)
            mock_instance.zrange.assert_called_once()

    def test_acquire_lock(self):
        """Test acquire_lock operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.set.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.acquire_lock('test_lock', timeout=10)

            assert result is not None
            mock_instance.set.assert_called_once()

    def test_acquire_lock_fail(self):
        """Test acquire_lock fails when lock exists"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.set.return_value = None
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.acquire_lock('test_lock')

            assert result is None

    def test_release_lock(self):
        """Test release_lock operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.eval.return_value = 1
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.release_lock('test_lock', 'token')

            assert result is True
            mock_instance.eval.assert_called_once()

    def test_expire(self):
        """Test expire operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.expire.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.expire('test_key', 3600)

            assert result is True
            mock_instance.expire.assert_called_once()

    def test_ttl(self):
        """Test ttl operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.ttl.return_value = 3600
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.ttl('test_key')

            assert result == 3600
            mock_instance.ttl.assert_called_once()

    def test_clear_pattern(self):
        """Test clear_pattern operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.keys.return_value = ['key1', 'key2']
            mock_instance.delete.return_value = 2
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.clear_pattern('pattern*')

            assert result == 2
            mock_instance.keys.assert_called_once()
            mock_instance.delete.assert_called_once()

    def test_ping(self):
        """Test ping operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.ping()

            assert result is True
            mock_instance.ping.assert_called_once()


class TestRedisCacheServiceClass:
    """Test RedisCacheService class"""

    def test_init(self):
        """Test initialization"""
        from services.redis_cache_service import RedisCacheService

        service = RedisCacheService()

        assert service.client is None
        assert service._prefix == "score_management:"

    def test_is_connected(self):
        """Test is_connected property"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCacheService()
            service.client = mock_instance

            assert service.is_connected is True

    def test_get_key(self):
        """Test _get_key method"""

        service = RedisCacheService()

        result = service._get_key("test_key")

        assert "score_management:" in result
        assert "test_key" in result

    def test_get_ttl(self):
        """Test _get_ttl method"""

        service = RedisCacheService()

        assert service._get_ttl("user") == 1800
        assert service._get_ttl("device") == 600
        assert service._get_ttl("temp") == 60
        assert service._get_ttl("default") == 3600

    def test_set(self):
        """Test set method"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCacheService()
            service.client = mock_instance

            result = service.set("test_key", {"data": "test"}, expire=3600)

            assert result is True
            mock_instance.setex.assert_called_once()

    def test_get(self):
        """Test get method"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.get.return_value = '{"data": "test"}'
            mock_redis.return_value = mock_instance

            service = RedisCacheService()
            service.client = mock_instance

            result = service.get("test_key")

            assert result == {"data": "test"}

    def test_delete(self):
        """Test delete method"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.delete.return_value = 1
            mock_redis.return_value = mock_instance

            service = RedisCacheService()
            service.client = mock_instance

            result = service.delete("test_key")

            assert result is True

    def test_flush(self):
        """Test flush method"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.flushdb.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCacheService()
            service.client = mock_instance

            result = service.flush()

            assert result is True
            mock_instance.flushdb.assert_called_once()


class TestRedisCacheConvenienceFunctions:
    """Test convenience functions"""

    def test_get_cache_service(self):
        """Test get_cache_service function"""
        from services.redis_cache_service import get_cache_service, cache

        result = get_cache_service()

        assert result is cache

    def test_cached_decorator(self):
        """Test cached decorator"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.get.return_value = None
            mock_instance.setex.return_value = True
            mock_redis.return_value = mock_instance

            from services.redis_cache_service import cached

            cache.client = mock_instance

            @cached("test_prefix", expire=300)
            def test_func(x, y):
                return x + y

            result = test_func(2, 3)

            assert result == 5
            assert mock_instance.get.call_count >= 1
            assert mock_instance.setex.call_count >= 1

    def test_cached_decorator_cache_hit(self):
        """Test cached decorator with cache hit"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.get.return_value = '5'
            mock_redis.return_value = mock_instance

            cache.client = mock_instance

            @cached("test_prefix", expire=300)
            def test_func(x, y):
                return x + y

            result = test_func(2, 3)

            assert result == 5
            mock_instance.setex.assert_not_called()


class TestRedisCacheConnection:
    """Test Redis cache connection management"""

    def test_is_connected_false(self):
        """Test is_connected returns False when client is None"""

        service = RedisCache()
        assert service.is_connected is False

    def test_is_connected_ping_failure(self):
        """Test is_connected returns False when ping fails"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.side_effect = Exception("Connection failed")
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            assert service.is_connected is False

    def test_create_connection_pool(self):
        """Test _create_connection_pool"""
        with patch('redis.ConnectionPool') as mock_pool:
            mock_pool.from_url.return_value = MagicMock()

            service = RedisCache()
            result = service._create_connection_pool("redis://localhost:6379/0")

            assert result is True
            mock_pool.from_url.assert_called_once()

    def test_create_connection_pool_failure(self):
        """Test _create_connection_pool failure"""
        with patch('redis.ConnectionPool') as mock_pool:
            mock_pool.from_url.side_effect = Exception("Failed")

            service = RedisCache()
            result = service._create_connection_pool("redis://localhost:6379/0")

            assert result is False

    def test_ensure_connection_no_app(self):
        """Test ensure_connection when app is None"""

        service = RedisCache()
        service._app = None

        result = service.ensure_connection()

        assert result is False

    def test_ensure_connection_already_connected(self):
        """Test ensure_connection when already connected"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.ensure_connection()

            assert result is True


class TestRedisCacheErrorHandling:
    """Test Redis cache error handling"""

    def test_get_connection_error(self):
        """Test get with connection error"""
        with patch('redis.Redis'):
            mock_instance = MagicMock()
            mock_instance.get.side_effect = redis.ConnectionError("Connection lost")

            service = RedisCache()
            service.client = mock_instance

            result = service.get('test_key')

            assert result is None
            assert service.client is None

    def test_set_connection_error(self):
        """Test set with connection error"""
        with patch('redis.Redis'):
            mock_instance = MagicMock()
            mock_instance.setex.side_effect = redis.ConnectionError("Connection lost")

            service = RedisCache()
            service.client = mock_instance

            result = service.set('test_key', 'value', expire=300)

            assert result is False
            assert service.client is None

    def test_delete_connection_error(self):
        """Test delete with connection error"""
        with patch('redis.Redis'):
            mock_instance = MagicMock()
            mock_instance.delete.side_effect = redis.ConnectionError("Connection lost")

            service = RedisCache()
            service.client = mock_instance

            result = service.delete('test_key')

            assert result is False
            assert service.client is None

    def test_incr_connection_error(self):
        """Test incr with connection error"""
        with patch('redis.Redis'):
            mock_instance = MagicMock()
            mock_instance.incr.side_effect = redis.ConnectionError("Connection lost")

            service = RedisCache()
            service.client = mock_instance

            result = service.incr('counter')

            assert result is None
            assert service.client is None


class TestRedisCacheServiceExtended:
    """Test RedisCacheService extended functionality"""

    def test_get_pool_status_no_pool(self):
        """Test get_pool_status when pool is None"""

        service = RedisCacheService()

        result = service.get_pool_status()

        assert result["mode"] == "single_connection"

    def test_get_pool_status_with_pool(self):
        """Test get_pool_status with pool"""
        with patch('redis.ConnectionPool') as mock_pool:
            mock_pool_instance = MagicMock()
            mock_pool_instance.max_connections = 20
            mock_pool_instance._available_connections = []
            mock_pool_instance._in_use_connections = []
            mock_pool_instance._created_connections = 5
            mock_pool.from_url.return_value = mock_pool_instance

            service = RedisCacheService()
            service._pool = mock_pool_instance

            result = service.get_pool_status()

            assert result["max_connections"] == 20
            assert "available" in result

    def test_flush_with_pattern(self):
        """Test flush with pattern"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.keys.return_value = ['key1', 'key2']
            mock_instance.delete.return_value = 2
            mock_redis.return_value = mock_instance

            service = RedisCacheService()
            service.client = mock_instance

            result = service.flush(pattern='test*')

            assert result is True
            mock_instance.keys.assert_called_once()

    def test_exists_no_client(self):
        """Test exists when client is None"""

        service = RedisCacheService()

        result = service.exists('test_key')

        assert result is False


class TestRedisCacheConstants:
    """Test Redis cache constants"""

    def test_cache_keys(self):
        """Test CACHE_KEYS constant"""
        from services.redis_cache_service import CACHE_KEYS

        assert isinstance(CACHE_KEYS, dict)
        assert "user" in CACHE_KEYS
        assert "device_status" in CACHE_KEYS
        assert "rules" in CACHE_KEYS


class TestRedisCacheAdditionalMethods:
    """Test additional RedisCache methods with lower coverage"""

    def test_llen(self):
        """Test llen operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.llen.return_value = 5
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.llen('list_key')

            assert result == 5
            mock_instance.llen.assert_called_once()

    def test_srem(self):
        """Test srem operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.srem.return_value = 2
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.srem('set_key', 'member1', 'member2')

            assert result == 2
            mock_instance.srem.assert_called_once()

    def test_zrevrank(self):
        """Test zrevrank operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.zrevrank.return_value = 3
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.zrevrank('zset_key', 'member')

            assert result == 3
            mock_instance.zrevrank.assert_called_once()

    def test_zscore(self):
        """Test zscore operation"""
        with patch('redis.Redis') as mock_redis:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_instance.zscore.return_value = 1.5
            mock_redis.return_value = mock_instance

            service = RedisCache()
            service.client = mock_instance

            result = service.zscore('zset_key', 'member')

            assert result == 1.5
            mock_instance.zscore.assert_called_once()

    def test_decr_no_client(self):
        """Test decr operation when client is None"""

        service = RedisCache()
        service.client = None

        result = service.decr('counter')

        assert result is None


class TestRedisCacheConnectionRetry:
    """Test RedisCache connection retry logic"""

    def test_connect_retry(self):
        """Test connection retry mechanism"""

        with patch.object(RedisCache, '_create_connection_pool', return_value=False), \
             patch('services.redis_cache_service.redis.from_url') as mock_from_url:
            mock_instance = MagicMock()
            mock_instance.ping.side_effect = redis.ConnectionError("Failed")
            mock_from_url.return_value = mock_instance

            service = RedisCache()
            service._connect_attempts = 0
            service._pool = None

            result = service._connect("redis://localhost:6379/0")

            assert result is False
            assert mock_instance.ping.call_count == 1

    def test_init_app(self):
        """Test init_app method"""
        mock_app = MagicMock()
        mock_app.config.get.side_effect = lambda key, default=None: {
            "REDIS_URL": "redis://localhost:6379/0",
            "REDIS_MAX_CONNECTIONS": 10,
            "REDIS_SOCKET_TIMEOUT": 3,
            "REDIS_SOCKET_CONNECT_TIMEOUT": 3,
        }.get(key, default)

        service = RedisCache()
        service.init_app(mock_app)

        assert service._app is mock_app
        assert service._config['max_connections'] == 10


class TestRedisCacheServiceConnect:
    """Test RedisCacheService connection logic"""

    def test_connect_success(self):
        """Test RedisCacheService connection success"""
        with patch('redis.from_url') as mock_from_url:
            mock_instance = MagicMock()
            mock_instance.ping.return_value = True
            mock_from_url.return_value = mock_instance

            service = RedisCacheService()
            service._connect("redis://localhost:6379/0")

            assert service.client is not None

    def test_connect_failure(self):
        """Test RedisCacheService connection failure"""
        with patch('redis.from_url') as mock_from_url:
            mock_from_url.side_effect = redis.ConnectionError("Failed")

            service = RedisCacheService()
            service._connect("redis://localhost:6379/0")

            assert service.client is None

    def test_init_app(self):
        """Test RedisCacheService init_app"""
        mock_app = MagicMock()
        mock_app.config = {"REDIS_URL": "redis://localhost:6379/0"}

        service = RedisCacheService()
        service.init_app(mock_app)

        assert mock_app.config["CACHE_SERVICE"] is service


class TestRedisCacheWarmup:
    """Test cache warmup functionality"""

    def test_warmup_already_completed(self):
        """Test warmup_cache skips when already completed"""
        from services.redis_cache_service import warmup_cache, _warmup_completed

        original = _warmup_completed
        _warmup_completed = True

        mock_app = MagicMock()

        warmup_cache(mock_app)

        _warmup_completed = original

    def test_warmup_no_client(self):
        """Test warmup_cache when Redis is not connected"""

        cache.client = None

        mock_app = MagicMock()

        warmup_cache(mock_app)
