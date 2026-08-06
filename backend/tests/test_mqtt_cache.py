import unittest
import time

from services.mqtt.mqtt_cache import MQTTCache


class TestMQTTCache(unittest.TestCase):

    def test_init(self):
        """测试初始化"""
        cache = MQTTCache()

        assert cache._user_cache == {}
        assert cache._cache_lock is not None
        assert cache._cache_ttl == 60

    def test_set_and_get_cached_user(self):
        """测试设置和获取缓存用户"""
        cache = MQTTCache()
        mock_user = {"id": 1, "name": "test"}

        cache.set_cached_user("card123", mock_user)
        result = cache.get_cached_user("card123")

        assert result == mock_user

    def test_get_cached_user_not_found(self):
        """测试获取不存在的缓存用户"""
        cache = MQTTCache()

        result = cache.get_cached_user("nonexistent")

        assert result is None

    def test_cache_ttl_expiration(self):
        """测试缓存过期"""
        cache = MQTTCache()
        cache._cache_ttl = 1
        mock_user = {"id": 1, "name": "test"}

        cache.set_cached_user("card123", mock_user)
        result = cache.get_cached_user("card123")
        assert result == mock_user

        time.sleep(1.1)

        result = cache.get_cached_user("card123")
        assert result is None

    def test_clear_cache(self):
        """测试清空缓存"""
        cache = MQTTCache()
        cache.set_cached_user("card123", {"id": 1})
        cache.set_cached_user("card456", {"id": 2})

        assert cache.get_cached_user("card123") is not None
        assert cache.get_cached_user("card456") is not None

        cache.clear_cache()

        assert cache.get_cached_user("card123") is None
        assert cache.get_cached_user("card456") is None

    def test_get_cache_stats(self):
        """测试获取缓存统计"""
        cache = MQTTCache()

        stats = cache.get_cache_stats()
        assert stats["cache_size"] == 0
        assert stats["ttl"] == 60

        cache.set_cached_user("card123", {"id": 1})

        stats = cache.get_cache_stats()
        assert stats["cache_size"] == 1
        assert stats["ttl"] == 60


if __name__ == '__main__':
    unittest.main()
