#!/usr/bin/env python3
"""
Redis缓存服务
提供统一的缓存接口，支持数据缓存、分布式锁、消息队列等功能
"""

import json
import pickle
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Optional, Union

import redis
from flask import current_app

class RedisCache:
    def __init__(self, app=None):
        self.client = None
        self._prefix = 'score_platform:'
        if app:
            self.init_app(app)

    def init_app(self, app):
        redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        try:
            self.client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True
            )
            self.client.ping()
            print(f"Redis connected: {redis_url}")
        except redis.ConnectionError as e:
            print(f"Redis connection failed: {e}")
            self.client = None

    def _key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    def get(self, key: str) -> Optional[Any]:
        if not self.client:
            return None
        try:
            value = self.client.get(self._key(key))
            if value is None:
                return None
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                try:
                    return pickle.loads(value.encode('latin1'))
                except Exception:
                    return value
        except Exception as e:
            print(f"Redis get error: {e}")
            return None

    def set(self, key: str, value: Any, expire: int = None) -> bool:
        if not self.client:
            return False
        try:
            key = self._key(key)
            if isinstance(value, (dict, list)):
                value = json.dumps(value, default=str)
            elif not isinstance(value, str):
                value = pickle.dumps(value)
                self.client.setex(key, expire or 3600, value.encode('latin1'))
                return True
            if expire:
                self.client.setex(key, expire, value)
            else:
                self.client.set(key, value)
            return True
        except Exception as e:
            print(f"Redis set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        if not self.client:
            return False
        try:
            self.client.delete(self._key(key))
            return True
        except Exception as e:
            print(f"Redis delete error: {e}")
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
            print(f"Redis incr error: {e}")
            return None

    def decr(self, key: str, amount: int = 1) -> Optional[int]:
        if not self.client:
            return None
        try:
            return self.client.decr(self._key(key), amount)
        except Exception as e:
            print(f"Redis decr error: {e}")
            return None

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
            print(f"Redis hset error: {e}")
            return False

    def hgetall(self, name: str) -> dict:
        if not self.client:
            return {}
        return self.client.hgetall(self._key(name)) or {}

    def hdel(self, name: str, *keys) -> int:
        if not self.client:
            return 0
        return self.client.hdel(self._key(name), *keys)

    def lpush(self, key: str, *values) -> int:
        if not self.client:
            return 0
        return self.client.lpush(self._key(key), *values)

    def rpop(self, key: str) -> Optional[str]:
        if not self.client:
            return None
        return self.client.rpop(self._key(key))

    def llen(self, key: str) -> int:
        if not self.client:
            return 0
        return self.client.llen(self._key(key))

    def smembers(self, key: str) -> set:
        if not self.client:
            return set()
        return self.client.smembers(self._key(key)) or set()

    def sadd(self, key: str, *values) -> int:
        if not self.client:
            return 0
        return self.client.sadd(self._key(key), *values)

    def srem(self, key: str, *values) -> int:
        if not self.client:
            return 0
        return self.client.srem(self._key(key), *values)

    def zadd(self, key: str, mapping: dict) -> int:
        if not self.client:
            return 0
        return self.client.zadd(self._key(key), mapping)

    def zrange(self, key: str, start: int, end: int, desc: bool = False) -> list:
        if not self.client:
            return []
        return self.client.zrange(self._key(key), start, end, desc=desc)

    def zrevrank(self, key: str, member: str) -> Optional[int]:
        if not self.client:
            return None
        return self.client.zrevrank(self._key(key), member)

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

cache = RedisCache()

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
    'user': 'user:{user_id}',
    'user_scores': 'user_scores:{user_id}',
    'device_status': 'device:{device_id}:status',
    'device_online': 'devices:online',
    'rules': 'rules:all',
    'categories': 'categories:all',
    'dashboard_stats': 'dashboard:stats',
    'rankings': 'rankings:{rank_type}',
    'daily_stats': 'stats:daily:{date}',
    'blacklist': 'blacklist:user:{user_id}',
    'rate_limit': 'ratelimit:{ip}:{endpoint}',
}

def warmup_cache(app):
    """
    缓存预热函数 - 在应用启动时预加载常用数据到Redis缓存
    """
    if not cache.client:
        print("Redis未连接，跳过缓存预热")
        return
    
    print("开始缓存预热...")
    
    with app.app_context():
        try:
            # 预热规则数据
            from models import ScoreRule
            rules = ScoreRule.query.all()
            rules_data = [
                {
                    'id': r.id,
                    'name': r.name,
                    'score': r.score,
                    'category_id': r.category_id,
                    'enabled': r.is_active,
                    'description': r.description
                } for r in rules
            ]
            cache.set('rules:all', rules_data, expire=3600)
            print(f"预热规则数据: {len(rules_data)} 条")
            
            # 预热分类数据
            from models import ScoreCategory
            categories = ScoreCategory.query.all()
            categories_data = [
                {
                    'id': c.id,
                    'name': c.name,
                    'color': c.color,
                    'enabled': c.is_active
                } for c in categories
            ]
            cache.set('categories:all', categories_data, expire=3600)
            print(f"预热分类数据: {len(categories_data)} 条")
            
            # 预热设备在线状态
            from models import Device
            devices = Device.query.all()
            online_devices = [d.device_id for d in devices if d.status == 'online']
            if online_devices:
                cache.client.delete(cache._key('devices:online'))
                cache.client.sadd(cache._key('devices:online'), *online_devices)
            print(f"预热设备在线状态: {len(online_devices)} 台在线")
            
            # 预热排名规则
            from models import ScoreRankRule
            rank_rules = ScoreRankRule.query.all()
            rank_rules_data = [
                {
                    'id': r.id,
                    'name': r.name,
                    'min_score': r.min_score,
                    'max_score': r.max_score,
                    'enabled': r.is_active,
                    'color': r.color
                } for r in rank_rules
            ]
            cache.set('rank_rules:all', rank_rules_data, expire=3600)
            print(f"预热排名规则: {len(rank_rules_data)} 条")
            
            # 预热时间规则
            from models import TimeRule
            time_rules = TimeRule.query.all()
            time_rules_data = [
                {
                    'id': t.id,
                    'name': t.name,
                    'day_of_week': t.day_of_week,
                    'start_hour': t.start_hour,
                    'start_minute': t.start_minute,
                    'end_hour': t.end_hour,
                    'end_minute': t.end_minute,
                    'enabled': t.is_active
                } for t in time_rules
            ]
            cache.set('time_rules:all', time_rules_data, expire=3600)
            print(f"预热时间规则: {len(time_rules_data)} 条")
            
            # 设置缓存预热时间戳
            cache.set('cache_warmup:timestamp', datetime.now().isoformat(), expire=7200)
            print("缓存预热完成")
            
        except Exception as e:
            print(f"缓存预热失败: {e}")
            import traceback
            traceback.print_exc()
