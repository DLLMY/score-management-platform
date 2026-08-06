from functools import wraps
from flask import request, jsonify, make_response
from services.redis_cache_service import get_cache_service
from config.config_loader import config_loader
import json

import hashlib

DEFAULT_CACHE_TTL = config_loader.get_config("CACHE_TTL", {}).get("default", 60)
API_CACHE_TTL = config_loader.get_config("API_CACHE_TTL", 300)


def generate_cache_key(prefix="api"):
    """
    生成API缓存键
    基于请求方法、路径和查询参数生成唯一缓存键。
    Args:
        prefix: 缓存键前缀
    Returns:
        缓存键字符串
    """
    # 获取请求信息
    method = request.method
    path = request.path
    # 获取查询参数（排除某些动态参数）
    args = dict(request.args)
    # 移除时间戳等动态参数
    dynamic_params = ["_", "timestamp", "t", "nocache"]
    for param in dynamic_params:
        args.pop(param, None)
    # 生成唯一键
    data = f"{method}:{path}:{json.dumps(args, sort_keys=True)}"
    hash_key = hashlib.sha256(data.encode()).hexdigest()
    return f"{prefix}:{path}:{hash_key}"


def get_ttl_for_path(path):
    """
    根据API路径获取缓存TTL
    Args:
        path: API路径
    Returns:
        TTL秒数
    """
    # 检查精确匹配
    if path in API_CACHE_TTL:
        return API_CACHE_TTL[path]
    # 检查前缀匹配
    for api_path, ttl in API_CACHE_TTL.items():
        if path.startswith(api_path):
            return ttl
    return DEFAULT_CACHE_TTL


def cached_api(ttl=None, key_prefix="api", unless=None):
    """
    API缓存装饰器
    用于缓存GET请求的响应，减少重复数据库查询。
    Args:
        ttl: 缓存时间（秒），如果不指定则根据路径自动获取
        key_prefix: 缓存键前缀
        unless: 条件函数，返回True时不缓存
    使用示例:
        @cached_api(ttl=60)
        def get_users():
            return jsonify({'users': [...]})
        @cached_api(unless=lambda: request.args.get('nocache'))
        def get_devices():
            return jsonify({'devices': [...]})
    """

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # 只缓存GET请求
            if request.method != "GET":
                return f(*args, **kwargs)
            # 检查条件函数
            if unless and unless():
                return f(*args, **kwargs)
            # 获取缓存服务
            cache = get_cache_service()
            if not cache:
                return f(*args, **kwargs)
            # 生成缓存键
            cache_key = generate_cache_key(key_prefix)
            # 确定TTL
            cache_ttl = ttl if ttl is not None else get_ttl_for_path(request.path)
            # 尝试从缓存获取
            cached_response = cache.get(cache_key)
            if cached_response is not None:
                # 返回缓存的响应
                response = make_response(jsonify(cached_response))
                response.headers["X-Cache"] = "HIT"
                response.headers["X-Cache-TTL"] = str(cache_ttl)
                return response
            # 执行原函数
            result = f(*args, **kwargs)  # noqa: F841
            # 处理响应
            if hasattr(result, "get_json"):
                response_data = result.get_json()
                status_code = result.status_code
            else:
                response_data = result
                status_code = 200
            # 只缓存成功的响应
            if status_code == 200 and response_data:
                # 存入缓存
                cache.set(cache_key, response_data, ttl=cache_ttl)
            # 返回响应
            response = make_response(jsonify(response_data), status_code)
            response.headers["X-Cache"] = "MISS"
            response.headers["X-Cache-TTL"] = str(cache_ttl)
            return response

        return wrapper

    return decorator


def invalidate_cache(path_pattern=None):
    """
    缓存失效函数
    当数据变更时，清除相关的API缓存。
    Args:
        path_pattern: 路径模式（可选），如 'users:*' 清除所有用户相关缓存
    使用示例:
        invalidate_cache('users:*')  # 清除所有用户缓存
        invalidate_cache()           # 清除所有API缓存
    """
    cache = get_cache_service()
    if not cache:
        return
    if path_pattern:
        # 清除特定路径的缓存
        pattern = f"api:{path_pattern}"
        cache.flush(pattern)
    else:
        # 清除所有API缓存
        cache.flush("api:*")


def invalidate_user_cache(user_id):
    """
    清除用户相关缓存
    Args:
        user_id: 用户ID
    """
    invalidate_cache("users:*")
    invalidate_cache("api:/api/users/*")


def invalidate_device_cache(device_id):
    """
    清除设备相关缓存
    Args:
        device_id: 设备ID
    """
    invalidate_cache("devices:*")
    invalidate_cache("api:/api/devices/*")


def invalidate_rule_cache(rule_id):
    """
    清除规则相关缓存
    Args:
        rule_id: 规则ID
    """
    invalidate_cache("rules:*")
    invalidate_cache("api:/api/rules/*")


def setup_cache_middleware(app):
    """
    设置Flask缓存中间件
    Args:
        app: Flask应用实例
    """

    @app.before_request
    def before_request_cache():
        """请求前处理"""
        # 可以在这里添加缓存预热逻辑
        pass

    @app.after_request
    def after_request_cache(response):
        """请求后处理"""
        # 添加缓存统计信息
        if "X-Cache" not in response.headers:
            response.headers["X-Cache"] = "BYPASS"
        return response


class CacheStatistics:
    """缓存统计类"""

    def __init__(self):
        self.hit_count = 0
        self.miss_count = 0
        self.bypass_count = 0

    def record_hit(self):
        self.hit_count += 1

    def record_miss(self):
        self.miss_count += 1

    def record_bypass(self):
        self.bypass_count += 1

    def get_stats(self):
        total = self.hit_count + self.miss_count + self.bypass_count
        hit_rate = (self.hit_count / total * 100) if total > 0 else 0
        return {
            "hit_count": self.hit_count,
            "miss_count": self.miss_count,
            "bypass_count": self.bypass_count,
            "total_requests": total,
            "hit_rate": round(hit_rate, 2),
        }

    def reset(self):
        self.hit_count = 0
        self.miss_count = 0
        self.bypass_count = 0


cache_stats = CacheStatistics()
