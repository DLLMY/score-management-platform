import redis
import json
import time
import hashlib
from datetime import timedelta
from functools import wraps
from typing import Any, Dict, List, Optional


class CacheService:
    def __init__(self, host="localhost", port=6379, db=0):
        self.redis_client = None
        self.is_redis_available = False
        self.connection_retries = 3
        self.retry_delay = 2

        self._connect_redis(host, port, db)

        # 默认TTL设置（秒）
        self.default_ttl = {
            "short": 60,  # 1分钟 - 高频变化数据
            "medium": 300,  # 5分钟 - 普通数据
            "long": 3600,  # 1小时 - 低频变化数据
            "persistent": 86400,  # 24小时 - 基本不变的数据
        }

        # 统计信息
        self.stats = {"hits": 0, "misses": 0, "sets": 0, "deletes": 0, "start_time": time.time(), "redis_errors": 0}

        # 缓存键前缀
        self.prefix = "score_management:"

    def _connect_redis(self, host: str, port: int, db: int) -> None:
        """尝试连接Redis，支持重试"""
        for attempt in range(self.connection_retries):
            try:
                self.redis_client = redis.Redis(
                    host=host,
                    port=port,
                    db=db,
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                    retry_on_timeout=True,
                )
                self.redis_client.ping()
                self.is_redis_available = True
                print(f"Redis连接成功（第{attempt + 1}次尝试）")
                return
            except Exception as e:
                print(f"Redis连接失败（第{attempt + 1}次尝试）: {e}")
                if attempt < self.connection_retries - 1:
                    time.sleep(self.retry_delay)

        print("Redis连接失败，将使用内存缓存作为备用")
        self.redis_client = None
        self.memory_cache = {}
        self.memory_tags = {}  # 标签管理

    def _add_prefix(self, key: str) -> str:
        """添加缓存键前缀"""
        return f"{self.prefix}{key}"

    def get(self, key: str) -> Any:
        """获取缓存值"""
        key = self._add_prefix(key)
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value:
                    self.stats["hits"] += 1
                    return json.loads(value)
                self.stats["misses"] += 1
                return None
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis get失败: {e}")
                return self._memory_get(key)
        return self._memory_get(key)

    def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """批量获取多个缓存值"""
        prefixed_keys = [self._add_prefix(k) for k in keys]
        result = {}

        if self.redis_client:
            try:
                values = self.redis_client.mget(prefixed_keys)
                for i, key in enumerate(keys):
                    if values[i]:
                        result[key] = json.loads(values[i])
                        self.stats["hits"] += 1
                    else:
                        self.stats["misses"] += 1
                return result
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis mget失败: {e}")

        # 内存缓存实现
        for key in keys:
            value = self._memory_get(self._add_prefix(key))
            if value is not None:
                result[key] = value
        return result

    def set(self, key: str, value: Any, ttl: int = 3600, tags: Optional[List[str]] = None) -> bool:
        """设置缓存值"""
        prefixed_key = self._add_prefix(key)
        if self.redis_client:
            try:
                # 使用pipeline提高性能
                pipe = self.redis_client.pipeline()
                pipe.setex(prefixed_key, ttl, json.dumps(value))

                if tags:
                    for tag in tags:
                        tag_key = self._add_prefix(f"tag:{tag}")
                        pipe.sadd(tag_key, key)  # 存储原始key，便于后续操作
                        pipe.expire(tag_key, ttl + 3600)  # 标签过期时间略长于缓存

                pipe.execute()
                self.stats["sets"] += 1
                return True
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis set失败: {e}")
                return self._memory_set(prefixed_key, value, ttl, tags)
        return self._memory_set(prefixed_key, value, ttl, tags)

    def set_many(self, items: Dict[str, Any], ttl: int = 3600, tags: Optional[List[str]] = None) -> int:
        """批量设置多个缓存值"""
        count = 0

        if self.redis_client:
            try:
                pipe = self.redis_client.pipeline()
                for key, value in items.items():
                    prefixed_key = self._add_prefix(key)
                    pipe.setex(prefixed_key, ttl, json.dumps(value))

                # 添加标签（所有key共享相同标签）
                if tags:
                    for tag in tags:
                        tag_key = self._add_prefix(f"tag:{tag}")
                        pipe.sadd(tag_key, *items.keys())
                        pipe.expire(tag_key, ttl + 3600)

                pipe.execute()
                self.stats["sets"] += len(items)
                return len(items)
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis set_many失败: {e}")

        # 内存缓存实现
        for key, value in items.items():
            if self._memory_set(self._add_prefix(key), value, ttl, tags):
                count += 1
        return count

    def delete(self, key: str) -> bool:
        """删除缓存值"""
        prefixed_key = self._add_prefix(key)
        if self.redis_client:
            try:
                self.redis_client.delete(prefixed_key)
                self._remove_key_from_tags(key)
                self.stats["deletes"] += 1
                return True
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis delete失败: {e}")
                return self._memory_delete(prefixed_key)
        return self._memory_delete(prefixed_key)

    def delete_many(self, keys: List[str]) -> int:
        """批量删除多个缓存值"""
        prefixed_keys = [self._add_prefix(k) for k in keys]
        count = 0

        if self.redis_client:
            try:
                count = self.redis_client.delete(*prefixed_keys)
                for key in keys:
                    self._remove_key_from_tags(key)
                self.stats["deletes"] += count
                return count
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis delete_many失败: {e}")

        # 内存缓存实现
        for key in keys:
            if self._memory_delete(self._add_prefix(key)):
                count += 1
        return count

    def exists(self, key: str) -> bool:
        """检查缓存键是否存在"""
        key = self._add_prefix(key)
        if self.redis_client:
            try:
                return self.redis_client.exists(key)
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis exists失败: {e}")
                return self._memory_exists(key)
        return self._memory_exists(key)

    def flush_all(self) -> bool:
        """清空所有缓存"""
        if self.redis_client:
            try:
                self.redis_client.flushall()
                self.memory_cache = {}
                self.memory_tags = {}
                return True
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis flushall失败: {e}")
                # 诚实失败：不清内存缓存（保持 Redis+内存一致，都是旧值），
                # 返回 False 让调用方提示"缓存刷新失败"，而非谎报成功。
                return False
        self.memory_cache = {}
        self.memory_tags = {}
        return True

    def flush_db(self) -> bool:
        """清空当前数据库"""
        if self.redis_client:
            try:
                self.redis_client.flushdb()
                return True
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis flushdb失败: {e}")
                return False
        return True

    def get_keys_by_pattern(self, pattern: str) -> List[str]:
        """根据模式获取所有匹配的键（返回不带前缀的键）"""
        prefixed_pattern = self._add_prefix(pattern)

        if self.redis_client:
            try:
                keys = self.redis_client.keys(prefixed_pattern)
                # 移除前缀返回
                return [k[len(self.prefix) :] for k in keys]
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis keys失败: {e}")
                return []

        # 内存缓存实现
        return [key for key in self.memory_cache.keys() if pattern.replace("*", "") in key]

    def delete_keys_by_pattern(self, pattern):
        """根据模式删除所有匹配的键"""
        keys = self.get_keys_by_pattern(pattern)
        for key in keys:
            self.delete(key)
        return len(keys)

    def invalidate_by_tag(self, tag: str) -> int:
        """根据标签失效所有相关缓存"""
        if self.redis_client:
            try:
                tag_key = self._add_prefix(f"tag:{tag}")
                keys = self.redis_client.smembers(tag_key)
                if keys:
                    # 为每个key添加前缀后删除
                    prefixed_keys = [self._add_prefix(k) for k in keys]
                    self.redis_client.delete(*prefixed_keys)
                    self.redis_client.delete(tag_key)
                    self.stats["deletes"] += len(keys)
                    return len(keys)
                return 0
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis invalidate_by_tag失败: {e}")
                return self._memory_invalidate_by_tag(tag)
        return self._memory_invalidate_by_tag(tag)

    def invalidate_by_tags(self, tags: List[str]) -> int:
        """根据多个标签失效相关缓存"""
        total_deleted = 0
        for tag in tags:
            total_deleted += self.invalidate_by_tag(tag)
        return total_deleted

    def _add_tags(self, key: str, tags: List[str]) -> None:
        """为键添加标签"""
        # 这个方法现在由set方法内部使用pipeline处理
        pass

    def _remove_key_from_tags(self, key: str) -> None:
        """从所有标签中移除键"""
        if self.redis_client:
            try:
                # 查找所有包含该key的标签集合
                tag_pattern = self._add_prefix("tag:*")
                tag_keys = self.redis_client.keys(tag_pattern)

                for tag_key in tag_keys:
                    self.redis_client.srem(tag_key, key)
            except Exception as e:
                self.stats["redis_errors"] += 1
                print(f"Redis remove_key_from_tags失败: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        uptime = time.time() - self.stats["start_time"]
        total_operations = self.stats["hits"] + self.stats["misses"]
        hit_rate = (self.stats["hits"] / total_operations) * 100 if total_operations > 0 else 0

        # 格式化运行时间
        uptime_str = str(timedelta(seconds=int(uptime)))

        return {
            "redis_available": self.is_redis_available,
            "hits": self.stats["hits"],
            "misses": self.stats["misses"],
            "hit_rate": f"{hit_rate:.2f}%",
            "hit_rate_float": round(hit_rate, 2),
            "sets": self.stats["sets"],
            "deletes": self.stats["deletes"],
            "total_operations": total_operations,
            "redis_errors": self.stats["redis_errors"],
            "uptime_seconds": int(uptime),
            "uptime_formatted": uptime_str,
            "prefix": self.prefix,
            "default_ttl": self.default_ttl,
        }

    def _memory_get(self, key: str) -> Any:
        """内存缓存获取"""
        if key in self.memory_cache:
            entry = self.memory_cache[key]
            if entry["expire_at"] > time.time():
                self.stats["hits"] += 1
                return entry["value"]
            else:
                self._memory_remove_key_from_tags(key)
                del self.memory_cache[key]
        self.stats["misses"] += 1
        return None

    def _memory_set(self, key: str, value: Any, ttl: int, tags: Optional[List[str]] = None) -> bool:
        """内存缓存设置"""
        self.memory_cache[key] = {"value": value, "expire_at": time.time() + ttl, "tags": tags or []}
        if tags:
            for tag in tags:
                if tag not in self.memory_tags:
                    self.memory_tags[tag] = set()
                self.memory_tags[tag].add(key)
        self.stats["sets"] += 1
        return True

    def _memory_delete(self, key: str) -> bool:
        """内存缓存删除"""
        if key in self.memory_cache:
            self._memory_remove_key_from_tags(key)
            del self.memory_cache[key]
            self.stats["deletes"] += 1
            return True
        return False

    def _memory_exists(self, key: str) -> bool:
        """内存缓存存在检查"""
        if key in self.memory_cache:
            entry = self.memory_cache[key]
            if entry["expire_at"] > time.time():
                return True
            else:
                self._memory_remove_key_from_tags(key)
                del self.memory_cache[key]
        return False

    def _memory_remove_key_from_tags(self, key: str) -> None:
        """从内存缓存标签中移除键"""
        if key in self.memory_cache:
            tags = self.memory_cache[key].get("tags", [])
            for tag in tags:
                if tag in self.memory_tags and key in self.memory_tags[tag]:
                    self.memory_tags[tag].remove(key)

    def _memory_invalidate_by_tag(self, tag: str) -> int:
        """根据标签失效内存缓存"""
        count = 0
        if tag in self.memory_tags:
            keys_to_delete = list(self.memory_tags[tag])
            for key in keys_to_delete:
                if key in self.memory_cache:
                    del self.memory_cache[key]
                    count += 1
            del self.memory_tags[tag]
        return count


cache_service = CacheService()


def generate_cache_key(func, args, kwargs):
    """生成唯一的缓存键"""
    key_parts = [func.__name__]

    # 添加位置参数
    for arg in args:
        if isinstance(arg, (int, str, float, bool)):
            key_parts.append(str(arg))
        else:
            key_parts.append(hashlib.md5(str(arg).encode(), usedforsecurity=False).hexdigest()[:8])

    # 添加关键字参数（排序以确保一致性）
    for k, v in sorted(kwargs.items()):
        if isinstance(v, (int, str, float, bool)):
            key_parts.append(f"{k}={v}")
        else:
            v_hash = hashlib.md5(str(v).encode(), usedforsecurity=False).hexdigest()[:8]
            key_parts.append(f"{k}={v_hash}")

    return ":".join(key_parts)


def cached(ttl=3600, tags=None):
    """缓存装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = generate_cache_key(func, args, kwargs)
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                return cached_result

            result = func(*args, **kwargs)
            cache_service.set(cache_key, result, ttl, tags)
            return result

        return wrapper

    return decorator


def invalidate_cache_for_func(func, *args, **kwargs):
    """失效特定函数调用的缓存"""
    cache_key = generate_cache_key(func, args, kwargs)
    return cache_service.delete(cache_key)


# 预热缓存函数
def warm_up_cache():
    """预热常用缓存"""
    print("开始预热缓存...")

    # 这里可以添加预热逻辑
    # 例如：预热用户列表、积分规则等

    print("缓存预热完成")
