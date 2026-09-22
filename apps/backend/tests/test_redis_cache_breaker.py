"""
Redis 缓存服务「快速熔断 / 快速失败」专项测试

守护性能修复：当 Redis 不可达时，/api/system/health 与 /api/users 不能
再阻塞数十秒。修复要点：
- ping() 失败必须把 self.client 置 None（自愈），否则每个请求都会重新阻塞；
- 最近连接失败应进入冷却窗口，init_app() 在此期间直接降级内存缓存，
  不再发起阻塞式连接；
- get_stats() 必须快速返回 redis_available=False，而非挂起。
"""

import time
from unittest.mock import patch, MagicMock

import redis


def _make_service_with_dead_client():
    from services.redis_cache_service import RedisCache

    service = RedisCache()
    dead = MagicMock()
    dead.ping.side_effect = redis.ConnectionError("simulated unreachable")
    service.client = dead
    return service


class TestRedisCacheBreakerHeal:
    def test_ping_failure_heals_client(self):
        service = _make_service_with_dead_client()
        assert service.ping() is False
        # 关键修复：ping 失败后必须丢弃 client，否则每请求都会重新阻塞
        assert service.client is None

    def test_is_connected_false_after_heal(self):
        service = _make_service_with_dead_client()
        assert service.is_connected is False
        assert service.client is None

    def test_no_reblock_after_heal(self):
        from services.redis_cache_service import RedisCache

        service = RedisCache()
        dead = MagicMock()
        dead.ping.side_effect = redis.ConnectionError("simulated unreachable")
        service.client = dead

        assert service.ping() is False
        assert dead.ping.call_count == 1  # 只阻塞了一次
        assert service.client is None

        # 此后 client 为 None，ping 立即返回 False，绝不再调用底层阻塞 ping
        assert service.ping() is False
        assert dead.ping.call_count == 1


class TestRedisCacheBreakerGetStats:
    def test_get_stats_reports_unavailable_without_blocking(self):
        service = _make_service_with_dead_client()
        stats = service.get_stats()
        assert stats["redis_available"] is False
        # 失败后 client 置 None，get_stats 不应再次尝试阻塞 ping
        assert service.client is None

    def test_get_stats_available_when_healthy(self):
        from services.redis_cache_service import RedisCache

        service = RedisCache()
        healthy = MagicMock()
        healthy.ping.return_value = True
        service.client = healthy
        stats = service.get_stats()
        assert stats["redis_available"] is True


class TestRedisCacheBreakerCooldown:
    def _mock_app(self, auto_start=False, testing=False):
        mock_app = MagicMock()
        mock_app.config = {
            "REDIS_URL": "redis://localhost:6379/0",
            "REDIS_MAX_CONNECTIONS": 10,
            "REDIS_SOCKET_TIMEOUT": 2,
            "REDIS_SOCKET_CONNECT_TIMEOUT": 2,
            "REDIS_AUTO_START": auto_start,
            "TESTING": testing,
        }
        return mock_app

    def test_init_app_cools_down_after_recent_failure(self):
        from services.redis_cache_service import RedisCache

        service = RedisCache()
        # 模拟"最近刚连失败"，冷却期内不应再发起阻塞式连接
        service._down_since = time.time()
        with patch(
            "services.redis_cache_service.redis.from_url"
        ) as mock_from_url, patch.object(
            service, "_try_auto_start_redis", return_value=False
        ):
            service.init_app(self._mock_app())

        # 冷却期短路：直接进入内存降级，不再尝试连接
        assert service.client is None
        mock_from_url.assert_not_called()

    def test_init_app_reconnects_after_cooldown_elapsed(self):
        from services.redis_cache_service import RedisCache

        service = RedisCache()
        # 冷却已过期（_down_since=0.0 表示从未失败）
        service._down_since = 0.0
        with patch(
            "services.redis_cache_service.redis.from_url"
        ) as mock_from_url, patch.object(
            service, "_try_auto_start_redis", return_value=False
        ):
            mock_from_url.side_effect = redis.ConnectionError("down")
            service.init_app(self._mock_app())

        # 冷却过期后，确实重新尝试了连接
        assert mock_from_url.called
        assert service.client is None  # 连接失败 -> 降级
        assert service._down_since > 0  # 并记录失败时间戳
