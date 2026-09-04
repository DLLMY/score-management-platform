#!/usr/bin/env python3
"""
Redis缓存服务
提供统一的缓存接口，支持数据缓存、分布式锁、消息队列等功能
"""

import logging
import json
import os
import pickle
import shutil
import subprocess
import threading
import time
from datetime import datetime
from functools import wraps
from typing import Any, Callable, Optional

import redis

logger = logging.getLogger(__name__)

_warmup_completed = False

# 防止多实例/重入时重复拉起 Redis 子进程
_auto_start_lock = threading.Lock()
_auto_start_attempted = False


def _safe(default):
    """R8 修复: Redis 方法统一降级——连接断开/MISCONF 时返回默认值而非裸抛 ConnectionError。

    模块级函数（类体内引用类名不可用，会 NameError）。
    """

    def deco(fn):
        def wrapper(self, *args, **kwargs):
            try:
                return fn(self, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Redis {fn.__name__} error (degraded): {e}")
                return default() if callable(default) else default

        return wrapper

    return deco


class RedisCache:
    def __init__(self, app=None):
        self.client = None
        self._prefix = "score_management:"
        self._stats = {"hits": 0, "misses": 0, "sets": 0, "deletes": 0}
        if app:
            self.init_app(app)

    def init_app(self, app):
        self._app = app
        self._config = {
            "url": app.config.get("REDIS_URL", "redis://localhost:6379/0"),
            "max_connections": app.config.get("REDIS_MAX_CONNECTIONS", 10),
            "socket_timeout": app.config.get("REDIS_SOCKET_TIMEOUT", 5),
            "socket_connect_timeout": app.config.get("REDIS_SOCKET_CONNECT_TIMEOUT", 5),
        }
        redis_url = self._config["url"]

        # 1) 先尝试直连（Redis 可能已在本机运行）
        if self._connect(redis_url):
            logger.info(f"Redis connected: {redis_url}")
            self._register(app)
            return

        # 2) 测试环境 / 未开启自动拉起 → 直接降级为内存缓存
        if app.config.get("TESTING"):
            logger.info("测试环境跳过 Redis 自动拉起")
            self.client = None
            self._register(app)
            return
        if not app.config.get("REDIS_AUTO_START", False):
            logger.warning("REDIS_AUTO_START 未开启，使用内存缓存降级")
            self.client = None
            self._register(app)
            return

        # 3) 自动拉起本地 Redis 子进程并重试
        logger.error("Redis 初始连接失败，尝试自动拉起本地 Redis ...")
        if self._try_auto_start_redis(app) and self._connect(redis_url):
            logger.info(f"Redis connected (auto-started): {redis_url}")
            self._register(app)
            return

        logger.warning("Redis 自动拉起失败/未配置，使用内存缓存降级")
        self.client = None
        self._register(app)

    def _register(self, app):
        try:
            app.config["CACHE_SERVICE"] = self
        except Exception as e:
            logger.warning(f"注册 CACHE_SERVICE 到 app.config 失败: {e}")

    def _resolve_redis_server_executable(self, app):
        """按优先级探测本地 redis-server 可执行文件，返回绝对路径或 None。"""
        cfg_cmd = (app.config.get("REDIS_SERVER_COMMAND") or "").strip()
        if cfg_cmd:
            return cfg_cmd
        candidates = []
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        if os.name == "nt":
            candidates.append(os.path.join(project_root, "redis", "redis-server.exe"))
            candidates.append(r"C:\Redis\redis-server.exe")
            bin_name = "redis-server.exe"
        else:
            bin_name = "redis-server"
        path_exe = shutil.which(bin_name)
        if path_exe:
            candidates.append(path_exe)
        for c in candidates:
            if c and os.path.isfile(c) and os.access(c, os.X_OK):
                return c
        return None

    def _try_auto_start_redis(self, app):
        """在本地自动启动一个 redis-server 子进程并等待就绪。成功返回 True。"""
        global _auto_start_attempted
        if _auto_start_attempted:
            return False
        with _auto_start_lock:
            if _auto_start_attempted:
                return False
            _auto_start_attempted = True

            host = app.config.get("REDIS_HOST", "localhost")
            if host not in ("localhost", "127.0.0.1"):
                logger.warning("Redis 为非本地地址，跳过自动拉起")
                return False

            exe = self._resolve_redis_server_executable(app)
            if not exe:
                logger.warning("未找到 redis-server 可执行文件，跳过自动拉起（可设置 REDIS_SERVER_COMMAND）")
                return False

            port = int(app.config.get("REDIS_PORT", 6379))
            db = int(app.config.get("REDIS_DB", 0))
            log_path = (app.config.get("REDIS_SERVER_LOG") or "").strip()
            args = [exe, "--port", str(port), "--save", "", "--appendonly", "no"]

            logf = subprocess.DEVNULL
            opened = None
            if log_path:
                try:
                    opened = open(log_path, "ab", buffering=0)
                    logf = opened
                except Exception as e:
                    logger.warning(f"打开 Redis 日志文件失败，降级为丢弃输出: {e}")
                    logf = subprocess.DEVNULL
                    opened = None

            spawn_kwargs = dict(stdout=logf, stderr=logf, stdin=subprocess.DEVNULL)
            if os.name == "nt":
                flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
                    subprocess, "CREATE_NEW_PROCESS_GROUP", 0
                )
                spawn_kwargs["creationflags"] = flags
                spawn_kwargs["close_fds"] = opened is None
            else:
                spawn_kwargs["start_new_session"] = True
                spawn_kwargs["close_fds"] = opened is None

            try:
                proc = subprocess.Popen(args, **spawn_kwargs)
                logger.info(f"已启动 Redis 子进程 pid={proc.pid} exe={exe}")
            except Exception as e:
                logger.error(f"启动 Redis 子进程失败: {e}")
                return False
            finally:
                if opened is not None:
                    try:
                        opened.close()
                    except Exception as e:
                        logger.debug(f"关闭 Redis 日志文件句柄失败: {e}")

            timeout = int(app.config.get("REDIS_AUTO_START_TIMEOUT", 15))
            deadline = time.time() + timeout
            probe_url = f"redis://{host}:{port}/{db}"
            while time.time() < deadline:
                try:
                    probe = redis.from_url(probe_url, socket_connect_timeout=2, socket_timeout=2)
                    if probe.ping():
                        return True
                except Exception:
                    # 就绪探测轮询：未就绪属预期（0.5s 后重试），无需告警刷日志
                    pass
                time.sleep(0.5)
            logger.error("Redis 子进程启动后超时未就绪")
            return False

    def _get_key(self, key: str) -> str:
        """兼容旧测试：_key 的别名。"""
        return self._key(key)

    def _get_ttl(self, key_type: str) -> int:
        """兼容旧测试：按缓存类别返回 TTL。"""
        ttl_map = {"user": 1800, "device": 600, "temp": 60, "default": 3600}
        return ttl_map.get(key_type, ttl_map["default"])

    def _create_connection_pool(self, url: str) -> bool:
        """兼容旧测试：根据 URL 创建连接池。"""
        try:
            self._pool = redis.ConnectionPool.from_url(url)
            return True
        except Exception:
            self._pool = None
            return False

    def _connect(self, url: str) -> bool:
        """兼容旧测试：连接 Redis 并返回是否成功。"""
        try:
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )
            client.ping()
            self.client = client
            return True
        except Exception:
            self.client = None
            return False

    def _key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    def get(self, key: str) -> Optional[Any]:
        if not self.client:
            return None
        try:
            value = self.client.get(self._key(key))
            if value is None:
                self._stats["misses"] += 1
                return None
            self._stats["hits"] += 1
            try:
                return json.loads(value)
            except (json.JSONDecodeError, UnicodeDecodeError, TypeError, ValueError):
                try:
                    if isinstance(value, (bytes, bytearray)):
                        return pickle.loads(bytes(value))  # nosec B301 - trusted internal cache
                    return pickle.loads(
                        value.encode("latin1")
                    )  # nosec B301 - trusted internal cache
                except Exception:
                    return value
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self.client = None
            return None

    def set(
        self, key: str, value: Any, expire: int = None, ttl: int = None, tags: list = None
    ) -> bool:
        # 兼容 ttl 和 expire 两个参数名
        if ttl is not None:
            expire = ttl
        if not self.client:
            return False
        try:
            redis_key = self._key(key)
            if isinstance(value, (dict, list)):
                value = json.dumps(value, default=str)
            elif not isinstance(value, str):
                value = pickle.dumps(value)
                self.client.setex(redis_key, expire or 3600, value)
                self._stats["sets"] += 1
                self._store_tags(redis_key, tags, expire)
                return True
            if expire:
                self.client.setex(redis_key, expire, value)
            else:
                self.client.set(redis_key, value)
            self._stats["sets"] += 1
            self._store_tags(redis_key, tags, expire)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            self.client = None
            return False

    def _store_tags(self, redis_key: str, tags, expire) -> None:
        """将缓存键登记到各标签集合，便于按标签批量失效（兼容旧 cache_service 契约）。"""
        if not tags:
            return
        try:
            for tag in tags:
                tag_key = self._key(f"tag:{tag}")
                self.client.sadd(tag_key, redis_key)
                if expire:
                    self.client.expire(tag_key, expire + 3600)
        except Exception as e:
            # 标签登记失败会导致按标签批量失效不完整（可能读到旧缓存值），需告警
            logger.warning(f"缓存标签登记失败: {e}")

    def delete(self, key: str) -> bool:
        if not self.client:
            return False
        try:
            self.client.delete(self._key(key))
            self._stats["deletes"] += 1
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            self.client = None
            return False

    def exists(self, key: str) -> bool:
        if not self.client:
            return False
        return bool(self.client.exists(self._key(key)))

    def expire(self, key: str, seconds: int) -> bool:
        if not self.client:
            return False
        return bool(self.client.expire(self._key(key), seconds))

    def ttl(self, key: str) -> int:
        if not self.client:
            return -1
        return self.client.ttl(self._key(key))

    def incr(self, key: str, amount: int = 1) -> Optional[int]:
        if not self.client:
            return None
        try:
            return self.client.incr(self._key(key), amount)
        except Exception as e:
            logger.error(f"Redis incr error: {e}")
            self.client = None
            return None

    def decr(self, key: str, amount: int = 1) -> Optional[int]:
        if not self.client:
            return None
        try:
            return self.client.decr(self._key(key), amount)
        except Exception as e:
            logger.error(f"Redis decr error: {e}")
            self.client = None
            return None

    @_safe(None)
    def hget(self, name: str, key: str) -> Optional[str]:
        if not self.client:
            return None
        return self.client.hget(self._key(name), key)

    def hset(self, name: str, key: str, value: str) -> bool:
        if not self.client:
            return False
        try:
            self.client.hset(self._key(name), key, value)
            return True
        except Exception as e:
            logger.error(f"Redis hset error: {e}")
            return False

    @_safe({})
    def hgetall(self, name: str) -> dict:
        if not self.client:
            return {}
        return self.client.hgetall(self._key(name)) or {}

    @_safe(0)
    def hdel(self, name: str, *keys) -> int:
        if not self.client:
            return 0
        return self.client.hdel(self._key(name), *keys)

    @_safe(0)
    def lpush(self, key: str, *values) -> int:
        if not self.client:
            return 0
        return self.client.lpush(self._key(key), *values)

    @_safe(None)
    def rpop(self, key: str) -> Optional[str]:
        if not self.client:
            return None
        return self.client.rpop(self._key(key))

    @_safe(0)
    def llen(self, key: str) -> int:
        if not self.client:
            return 0
        return self.client.llen(self._key(key))

    @_safe(set)
    def smembers(self, key: str) -> set:
        if not self.client:
            return set()
        return self.client.smembers(self._key(key)) or set()

    @_safe(0)
    def sadd(self, key: str, *values) -> int:
        if not self.client:
            return 0
        return self.client.sadd(self._key(key), *values)

    @_safe(0)
    def srem(self, key: str, *values) -> int:
        if not self.client:
            return 0
        return self.client.srem(self._key(key), *values)

    @_safe(0)
    def zadd(self, key: str, mapping: dict) -> int:
        if not self.client:
            return 0
        return self.client.zadd(self._key(key), mapping)

    @_safe([])
    def zrange(self, key: str, start: int, end: int, desc: bool = False) -> list:
        if not self.client:
            return []
        return self.client.zrange(self._key(key), start, end, desc=desc)

    @_safe(None)
    def zrevrank(self, key: str, member: str) -> Optional[int]:
        if not self.client:
            return None
        return self.client.zrevrank(self._key(key), member)

    @_safe(None)
    def zscore(self, key: str, member: str) -> Optional[float]:
        if not self.client:
            return None
        return self.client.zscore(self._key(key), member)

    def acquire_lock(self, lock_name: str, timeout: int = 10) -> Optional[str]:
        if not self.client:
            return None
        lock_key = self._key(f"lock:{lock_name}")
        token = f"{datetime.now().timestamp()}"
        if self.client.set(lock_key, token, nx=True, ex=timeout):
            return token
        return None

    def release_lock(self, lock_name: str, token: str) -> bool:
        if not self.client:
            return False
        lock_key = self._key(f"lock:{lock_name}")
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        return bool(self.client.eval(lua_script, 1, lock_key, token))

    def clear_pattern(self, pattern: str) -> int:
        if not self.client:
            return 0
        full_pattern = self._key(pattern)
        keys = self.client.keys(full_pattern)
        if keys:
            return self.client.delete(*keys)
        return 0

    def ping(self) -> bool:
        if not self.client:
            return False
        try:
            return self.client.ping()
        except Exception:
            return False

    @property
    def is_connected(self) -> bool:
        """兼容旧测试/旧调用：连接是否正常"""
        return self.ping()

    def ensure_connection(self) -> bool:
        """兼容旧测试：确保连接可用，失败时尝试重连"""
        try:
            if self.client is None:
                self._connect()
            return self.ping()
        except Exception:
            return False

    def flush(self, pattern: str = None) -> bool:
        """兼容旧测试：清空当前库或按模式清理（仅测试环境使用）"""
        if not self.client:
            return False
        try:
            if pattern:
                full = self._key(pattern)
                keys = self.client.keys(full)
                if keys:
                    self.client.delete(*keys)
            else:
                self.client.flushdb()
            return True
        except Exception:
            return False

    def get_pool_status(self) -> dict:
        """兼容旧测试：返回连接池状态摘要"""
        try:
            pool = getattr(self, "_pool", None)
            if pool is not None:
                return {
                    "mode": "connection_pool",
                    "connected": self.ping(),
                    "max_connections": getattr(pool, "max_connections", None),
                    "available": len(getattr(pool, "_available_connections", []) or []),
                    "in_use": len(getattr(pool, "_in_use_connections", []) or []),
                    "created": getattr(pool, "_created_connections", None),
                }
            return {
                "mode": "single_connection",
                "connected": self.ping(),
                "max_connections": None,
                "available": None,
            }
        except Exception:
            return {"mode": "single_connection", "connected": False}

    def invalidate_by_tag(self, tag: str) -> int:
        """按标签失效所有相关缓存（兼容 services.cache_service.CacheService 契约）。"""
        if not self.client:
            return 0
        try:
            tag_key = self._key(f"tag:{tag}")
            keys = self.client.smembers(tag_key)
            if keys:
                self.client.delete(*keys)
                self._stats["deletes"] += len(keys)
            self.client.delete(tag_key)
            return len(keys)
        except Exception as e:
            logger.error(f"Redis invalidate_by_tag error: {e}")
            self.client = None
            return 0

    def invalidate_by_tags(self, tags: list) -> int:
        """按多个标签批量失效。"""
        return sum(self.invalidate_by_tag(t) for t in (tags or []))

    def get_stats(self) -> dict:
        """缓存统计信息（兼容旧 system_routes 读取 redis_available/hit_rate/total_operations）。"""
        try:
            connected = self.is_connected
            total = self._stats["hits"] + self._stats["misses"]
            hit_rate = (self._stats["hits"] / total * 100) if total else 0
            pool = self.get_pool_status() if connected else {}
            return {
                "redis_available": connected,
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "hit_rate": f"{hit_rate:.2f}%",
                "hit_rate_float": round(hit_rate, 2),
                "sets": self._stats["sets"],
                "deletes": self._stats["deletes"],
                "total_operations": total,
                "prefix": self._prefix,
                **pool,
            }
        except Exception:
            return {"redis_available": False, "hit_rate": "N/A", "total_operations": 0}

    def flush_all(self) -> bool:
        """清空当前库全部缓存键（兼容 services.cache_service.CacheService.flush_all）。"""
        return self.flush()


cache = RedisCache()
RedisCacheService = RedisCache


def get_cache_service():
    """获取缓存服务实例"""
    return cache


def cached(key_prefix: str, expire: int = 300):
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = f"{key_prefix}:{':'.join(str(a) for a in args)}"
            result = cache.get(cache_key)
            if result is not None:
                return result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, expire)
            return result

        return wrapper

    return decorator


CACHE_KEYS = {
    "user": "user:{user_id}",
    "user_scores": "user_scores:{user_id}",
    "device_status": "device:{device_id}:status",
    "device_online": "devices:online",
    "rules": "rules:all",
    "categories": "categories:all",
    "dashboard_stats": "dashboard:stats",
    "rankings": "rankings:{rank_type}",
    "daily_stats": "stats:daily:{date}",
    "blacklist": "blacklist:user:{user_id}",
    "rate_limit": "ratelimit:{ip}:{endpoint}",
}


def warmup_cache(app):
    """
    缓存预热函数 - 在应用启动时预加载常用数据到Redis缓存
    """
    if not cache.client:
        logger.warning("Redis未连接，跳过缓存预热")
        return

    logger.info("开始缓存预热...")

    with app.app_context():
        try:
            # 预热规则数据
            from models import ScoreRule

            rules = ScoreRule.query.all()
            rules_data = [
                {
                    "id": r.id,
                    "name": r.name,
                    "score": r.score,
                    "category_id": r.category_id,
                    "enabled": r.is_active,
                    "description": r.description,
                }
                for r in rules
            ]
            cache.set("rules:all", rules_data, expire=3600)
            logger.info(f"预热规则数据: {len(rules_data)} 条")

            # 预热分类数据
            from models import ScoreCategory

            categories = ScoreCategory.query.all()
            categories_data = [
                {"id": c.id, "name": c.name, "color": c.color, "enabled": c.is_active}
                for c in categories
            ]
            cache.set("categories:all", categories_data, expire=3600)
            logger.info(f"预热分类数据: {len(categories_data)} 条")

            # 预热设备在线状态
            from models import Device

            devices = Device.query.all()
            online_devices = [d.device_id for d in devices if d.is_online]
            if online_devices:
                cache.client.delete(cache._key("devices:online"))
                cache.client.sadd(cache._key("devices:online"), *online_devices)
            logger.info(f"预热设备在线状态: {len(online_devices)} 台在线")

            # 预热排名规则
            from models import ScoreRankRule

            rank_rules = ScoreRankRule.query.all()
            rank_rules_data = [
                {
                    "id": r.id,
                    "name": r.name,
                    "min_score": r.min_score,
                    "max_score": r.max_score,
                    "enabled": r.is_active,
                    "color": r.color,
                }
                for r in rank_rules
            ]
            cache.set("rank_rules:all", rank_rules_data, expire=3600)
            logger.info(f"预热排名规则: {len(rank_rules_data)} 条")

            # 预热时间规则
            from models import TimeRule

            time_rules = TimeRule.query.all()
            time_rules_data = [
                {
                    "id": t.id,
                    "name": t.name,
                    "day_of_week": t.day_of_week,
                    "start_hour": t.start_hour,
                    "start_minute": t.start_minute,
                    "end_hour": t.end_hour,
                    "end_minute": t.end_minute,
                    "enabled": t.is_active,
                }
                for t in time_rules
            ]
            cache.set("time_rules:all", time_rules_data, expire=3600)
            logger.info(f"预热时间规则: {len(time_rules_data)} 条")

            # 设置缓存预热时间戳
            cache.set("cache_warmup:timestamp", datetime.now().isoformat(), expire=7200)
            logger.info("缓存预热完成")

        except Exception as e:
            logger.error(f"缓存预热失败: {e}", exc_info=True)
