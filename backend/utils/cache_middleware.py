"""
缓存中间件
用于在请求处理前后进行缓存操作
"""

from functools import wraps
from flask import request
from services.redis_cache_service import cache, CACHE_KEYS


def cache_response(key_prefix: str, expire: int = 60, unless=None):

    def decorator(f):

        @wraps(f)
        def wrapper(*args, **kwargs):
            if callable(unless) and unless():
                return f(*args, **kwargs)
            cache_key = f"{key_prefix}:{request.path}"
            if request.args:
                cache_key += f":{request.query_string.decode()}"
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return cached_data
            response = f(*args, **kwargs)
            if hasattr(response, "get_json"):
                cache.set(cache_key, response.get_json(), expire)
            return response

        return wrapper

    return decorator


def invalidate_cache(pattern: str):

    def decorator(f):

        @wraps(f)
        def wrapper(*args, **kwargs):
            result = f(*args, **kwargs)
            cache.clear_pattern(pattern)
            return result

        return wrapper

    return decorator


class CacheMiddleware:

    @staticmethod
    def get_user_cache(user_id: int):
        return cache.get(CACHE_KEYS["user"].format(user_id=user_id))

    @staticmethod
    def set_user_cache(user_id: int, data: dict, expire: int = 300):
        cache.set(CACHE_KEYS["user"].format(user_id=user_id), data, expire)

    @staticmethod
    def invalidate_user_cache(user_id: int):
        cache.delete(CACHE_KEYS["user"].format(user_id=user_id))

    @staticmethod
    def get_device_status(device_id: str):
        return cache.get(CACHE_KEYS["device_status"].format(device_id=device_id))

    @staticmethod
    def set_device_status(device_id: str, status: dict, expire: int = 60):
        cache.set(CACHE_KEYS["device_status"].format(device_id=device_id), status, expire)

    @staticmethod
    def get_rules_cache():
        return cache.get(CACHE_KEYS["rules"])

    @staticmethod
    def set_rules_cache(rules: list, expire: int = 600):
        cache.set(CACHE_KEYS["rules"], rules, expire)

    @staticmethod
    def invalidate_rules_cache():
        cache.delete(CACHE_KEYS["rules"])

    @staticmethod
    def get_categories_cache():
        return cache.get(CACHE_KEYS["categories"])

    @staticmethod
    def set_categories_cache(categories: list, expire: int = 3600):
        cache.set(CACHE_KEYS["categories"], categories, expire)

    @staticmethod
    def invalidate_categories_cache():
        cache.delete(CACHE_KEYS["categories"])

    @staticmethod
    def get_dashboard_stats():
        return cache.get(CACHE_KEYS["dashboard_stats"])

    @staticmethod
    def set_dashboard_stats(stats: dict, expire: int = 120):
        cache.set(CACHE_KEYS["dashboard_stats"], stats, expire)

    @staticmethod
    def invalidate_dashboard_stats():
        cache.delete(CACHE_KEYS["dashboard_stats"])

    @staticmethod
    def get_rankings(rank_type: str):
        return cache.get(CACHE_KEYS["rankings"].format(rank_type=rank_type))

    @staticmethod
    def set_rankings(rank_type: str, rankings: list, expire: int = 300):
        cache.set(CACHE_KEYS["rankings"].format(rank_type=rank_type), rankings, expire)

    @staticmethod
    def invalidate_rankings():
        cache.clear_pattern("rankings:*")

    @staticmethod
    def rate_limit_check(ip: str, endpoint: str, limit: int = 60, window: int = 60) -> bool:
        key = CACHE_KEYS["rate_limit"].format(ip=ip, endpoint=endpoint)
        current = cache.get(key) or 0
        if current >= limit:
            return False
        cache.set(key, current + 1, window)
        return True


cache_middleware = CacheMiddleware()
