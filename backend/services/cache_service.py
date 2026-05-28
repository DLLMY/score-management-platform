import redis
import json
import time
import hashlib
from datetime import datetime
from functools import wraps

class CacheService:
    def __init__(self, host='localhost', port=6379, db=0):
        self.redis_client = None
        self.is_redis_available = False
        try:
            self.redis_client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
            self.redis_client.ping()
            self.is_redis_available = True
            print("Redis连接成功")
        except Exception as e:
            print(f"Redis连接失败，将使用内存缓存作为备用: {e}")
            self.redis_client = None
            self.memory_cache = {}
            self.memory_tags = {}  # 标签管理
        
        # 统计信息
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'start_time': time.time()
        }
    
    def get(self, key):
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value:
                    self.stats['hits'] += 1
                    return json.loads(value)
                self.stats['misses'] += 1
                return None
            except Exception as e:
                print(f"Redis get失败: {e}")
                return self._memory_get(key)
        return self._memory_get(key)
    
    def set(self, key, value, ttl=3600, tags=None):
        if self.redis_client:
            try:
                self.redis_client.setex(key, ttl, json.dumps(value))
                if tags:
                    self._add_tags(key, tags)
                self.stats['sets'] += 1
                return True
            except Exception as e:
                print(f"Redis set失败: {e}")
                return self._memory_set(key, value, ttl, tags)
        return self._memory_set(key, value, ttl, tags)
    
    def delete(self, key):
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                self._remove_key_from_tags(key)
                self.stats['deletes'] += 1
                return True
            except Exception as e:
                print(f"Redis delete失败: {e}")
                return self._memory_delete(key)
        return self._memory_delete(key)
    
    def exists(self, key):
        if self.redis_client:
            try:
                return self.redis_client.exists(key)
            except Exception as e:
                print(f"Redis exists失败: {e}")
                return self._memory_exists(key)
        return self._memory_exists(key)
    
    def flush_all(self):
        if self.redis_client:
            try:
                self.redis_client.flushall()
                return True
            except Exception as e:
                print(f"Redis flushall失败: {e}")
                self.memory_cache = {}
                self.memory_tags = {}
                return True
        self.memory_cache = {}
        self.memory_tags = {}
        return True
    
    def get_keys_by_pattern(self, pattern):
        """根据模式获取所有匹配的键"""
        if self.redis_client:
            try:
                return [key for key in self.redis_client.keys(pattern)]
            except Exception as e:
                print(f"Redis keys失败: {e}")
                return []
        # 内存缓存实现
        return [key for key in self.memory_cache.keys() if pattern.replace('*', '') in key]
    
    def delete_keys_by_pattern(self, pattern):
        """根据模式删除所有匹配的键"""
        keys = self.get_keys_by_pattern(pattern)
        for key in keys:
            self.delete(key)
        return len(keys)
    
    def invalidate_by_tag(self, tag):
        """根据标签失效所有相关缓存"""
        if self.redis_client:
            try:
                tag_key = f"tag:{tag}"
                keys = self.redis_client.smembers(tag_key)
                if keys:
                    self.redis_client.delete(*keys)
                    self.redis_client.delete(tag_key)
                    return len(keys)
                return 0
            except Exception as e:
                print(f"Redis invalidate_by_tag失败: {e}")
                return self._memory_invalidate_by_tag(tag)
        return self._memory_invalidate_by_tag(tag)
    
    def _add_tags(self, key, tags):
        """为键添加标签"""
        if self.redis_client:
            try:
                for tag in tags:
                    tag_key = f"tag:{tag}"
                    self.redis_client.sadd(tag_key, key)
                    # 设置标签过期时间（略长于缓存）
                    self.redis_client.expire(tag_key, 86400)
            except Exception as e:
                print(f"Redis add_tags失败: {e}")
    
    def _remove_key_from_tags(self, key):
        """从所有标签中移除键"""
        if self.redis_client:
            try:
                # 这在Redis中比较复杂，简化处理
                pass
            except Exception as e:
                print(f"Redis remove_key_from_tags失败: {e}")
    
    def get_stats(self):
        """获取缓存统计信息"""
        uptime = time.time() - self.stats['start_time']
        hit_rate = (self.stats['hits'] / (self.stats['hits'] + self.stats['misses'])) * 100 if (self.stats['hits'] + self.stats['misses']) > 0 else 0
        
        return {
            'redis_available': self.is_redis_available,
            'hits': self.stats['hits'],
            'misses': self.stats['misses'],
            'hit_rate': f"{hit_rate:.2f}%",
            'sets': self.stats['sets'],
            'deletes': self.stats['deletes'],
            'uptime_seconds': int(uptime)
        }
    
    def _memory_get(self, key):
        if key in self.memory_cache:
            entry = self.memory_cache[key]
            if entry['expire_at'] > time.time():
                self.stats['hits'] += 1
                return entry['value']
            else:
                self._memory_remove_key_from_tags(key)
                del self.memory_cache[key]
        self.stats['misses'] += 1
        return None
    
    def _memory_set(self, key, value, ttl, tags=None):
        self.memory_cache[key] = {
            'value': value,
            'expire_at': time.time() + ttl,
            'tags': tags or []
        }
        if tags:
            for tag in tags:
                if tag not in self.memory_tags:
                    self.memory_tags[tag] = set()
                self.memory_tags[tag].add(key)
        self.stats['sets'] += 1
        return True
    
    def _memory_delete(self, key):
        if key in self.memory_cache:
            self._memory_remove_key_from_tags(key)
            del self.memory_cache[key]
            self.stats['deletes'] += 1
            return True
        return False
    
    def _memory_exists(self, key):
        if key in self.memory_cache:
            entry = self.memory_cache[key]
            if entry['expire_at'] > time.time():
                return True
            else:
                self._memory_remove_key_from_tags(key)
                del self.memory_cache[key]
        return False
    
    def _memory_remove_key_from_tags(self, key):
        if key in self.memory_cache:
            tags = self.memory_cache[key].get('tags', [])
            for tag in tags:
                if tag in self.memory_tags and key in self.memory_tags[tag]:
                    self.memory_tags[tag].remove(key)
    
    def _memory_invalidate_by_tag(self, tag):
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
            key_parts.append(hashlib.md5(str(arg).encode()).hexdigest()[:8])
    
    # 添加关键字参数（排序以确保一致性）
    for k, v in sorted(kwargs.items()):
        if isinstance(v, (int, str, float, bool)):
            key_parts.append(f"{k}={v}")
        else:
            key_parts.append(f"{k}={hashlib.md5(str(v).encode()).hexdigest()[:8]}")
    
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
