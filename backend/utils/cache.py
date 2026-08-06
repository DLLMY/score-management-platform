from typing import Any, Callable, Optional, Dict
from functools import wraps
import time
import json
import threading

import hashlib

"""
响应缓存工具模块
提供 API 响应缓存功能，减少数据库查询压力
"""


class CacheEntry:
    """缓存条目"""

    def __init__(self, value: Any, ttl: int):
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl
        self.hits = 0
        self.last_access = time.time()

    def is_expired(self) -> bool:
        """检查是否过期"""
        return time.time() - self.created_at > self.ttl

    def access(self) -> Any:
        """访问缓存并更新统计"""
        self.hits += 1
        self.last_access = time.time()
        return self.value

    def get_age(self) -> float:
        """获取缓存年龄（秒）"""
        return time.time() - self.created_at


class ResponseCache:
    """响应缓存"""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
        }

    def _generate_key(self, *args, **kwargs) -> str:
        """生成缓存键"""
        key_data = {"args": args, "kwargs": sorted(kwargs.items())}
        key_str = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.sha256(key_str.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._stats["misses"] += 1
                return None
            if entry.is_expired():
                del self._cache[key]
                self._stats["misses"] += 1
                return None
            self._stats["hits"] += 1
            return entry.access()

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """设置缓存"""
        with self._lock:
            # 如果缓存已满，删除最老的条目
            if len(self._cache) >= self._max_size:
                self._evict_oldest()
            ttl = ttl or self._default_ttl
            self._cache[key] = CacheEntry(value, ttl)

    def delete(self, key: str) -> bool:
        """删除缓存"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> int:
        """清空所有缓存"""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count

    def invalidate_pattern(self, pattern: str) -> int:
        """使匹配模式的缓存失效（只清理 stats 相关）"""
        # 注意：这是简化实现，实际可能需要更复杂的模式匹配
        return 0

    def _evict_oldest(self) -> None:
        """淘汰最老的缓存"""
        if not self._cache:
            return
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        del self._cache[oldest_key]
        self._stats["evictions"] += 1

    def cleanup_expired(self) -> int:
        """清理过期缓存"""
        with self._lock:
            expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        with self._lock:
            total = self._stats["hits"] + self._stats["misses"]
            hit_rate = self._stats["hits"] / total * 100 if total > 0 else 0
            return {
                **self._stats,
                "size": len(self._cache),
                "max_size": self._max_size,
                "hit_rate": round(hit_rate, 2),
            }

    def __len__(self) -> int:
        """缓存大小"""
        with self._lock:
            return len(self._cache)


_default_cache: Optional[ResponseCache] = None
_cache_lock = threading.Lock()


def get_default_cache() -> ResponseCache:
    """获取默认缓存实例"""
    global _default_cache
    if _default_cache is None:
        with _cache_lock:
            if _default_cache is None:
                _default_cache = ResponseCache(max_size=1000, default_ttl=300)  # noqa: F841
    return _default_cache


def cached(ttl: int = 300, cache: Optional[ResponseCache] = None):
    """
    缓存装饰器
    Args:
        ttl: 缓存时间（秒）
        cache: 缓存实例，默认使用全局缓存
    Example:
        @cached(ttl=60)
        def get_user_stats(user_id):
            # 复杂查询
            return stats
    """

    def decorator(func: Callable) -> Callable:
        _cache = cache or get_default_cache()  # noqa: F841

        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{func.__module__}.{func.__name__}:{_cache._generate_key(*args, **kwargs)}"
            # 尝试获取缓存
            cached_value = _cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            # 执行函数
            result = func(*args, **kwargs)  # noqa: F841
            # 存入缓存（注意：结果应该是可序列化的）
            try:
                _cache.set(cache_key, result, ttl)
            except (TypeError, ValueError):
                # 如果结果不可序列化，跳过缓存
                pass
            return result

        # 添加缓存控制方法
        wrapper.clear_cache = lambda: _cache.clear()
        wrapper.invalidate = lambda: _cache.delete(cache_key)
        wrapper.get_cache_stats = lambda: _cache.get_stats()
        return wrapper

    return decorator


def invalidate_cache(func_name: str, cache: Optional[ResponseCache] = None) -> None:
    """
    使指定函数的缓存失效
    注意：这需要配合缓存装饰器使用
    """
    # 实现依赖于缓存键的生成规则
    # 这里提供简化版本
    pass


class CacheWarmer:
    """缓存预热器"""

    def __init__(self, cache: Optional[ResponseCache] = None):
        self._cache = cache or get_default_cache()
        self._warmup_tasks: Dict[str, Callable] = {}

    def register(self, name: str, func: Callable, *args, **kwargs) -> None:
        """注册预热任务"""
        self._warmup_tasks[name] = lambda: func(*args, **kwargs)

    def warmup(self) -> Dict[str, Any]:
        """执行所有预热任务"""
        results = {}
        for name, task in self._warmup_tasks.items():
            try:
                result = task()  # noqa: F841
                results[name] = {"status": "success", "result": result}
            except Exception as e:
                results[name] = {"status": "error", "error": str(e)}
        return results


def clear_cache() -> int:
    """清空默认缓存"""
    return get_default_cache().clear()


def get_cache_stats() -> Dict[str, Any]:
    """获取缓存统计"""
    return get_default_cache().get_stats()


__all__ = [
    "CacheEntry",
    "ResponseCache",
    "get_default_cache",
    "cached",
    "invalidate_cache",
    "CacheWarmer",
    "clear_cache",
    "get_cache_stats",
]
