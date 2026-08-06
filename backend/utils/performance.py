#!/usr/bin/env python3
"""
API性能优化工具模块
包含：缓存、查询优化、响应压缩等功能
"""

import time
import hashlib
from functools import wraps
from datetime import datetime
from flask import request, g


class QueryOptimizer:
    """数据库查询优化器"""

    def __init__(self):
        self.query_times = {}
        self.slow_queries = []

    def log_query(self, query_name, duration, query=None):
        """记录查询时间和慢查询"""
        self.query_times[query_name] = duration

        if duration > 0.5:  # 超过500ms记录为慢查询
            self.slow_queries.append({"name": query_name, "duration": duration, "timestamp": datetime.now()})
            # 保持最近100条慢查询
            if len(self.slow_queries) > 100:
                self.slow_queries = self.slow_queries[-100:]

    def get_stats(self):
        """获取查询统计信息"""
        if not self.query_times:
            return {"total_queries": 0, "avg_time": 0, "slow_queries": len(self.slow_queries)}

        total = len(self.query_times)
        avg_time = sum(self.query_times.values()) / total

        return {
            "total_queries": total,
            "avg_time": round(avg_time, 4),
            "max_time": round(max(self.query_times.values()), 4),
            "min_time": round(min(self.query_times.values()), 4),
            "slow_queries": len(self.slow_queries),
        }

    def reset_stats(self):
        """重置统计信息"""
        self.query_times = {}
        self.slow_queries = []


class ResponseCache:
    """响应缓存"""

    def __init__(self, ttl=60):
        self.cache = {}
        self.ttl = ttl  # 默认60秒

    def _make_key(self, prefix, *args, **kwargs):
        """生成缓存键"""
        key_data = f"{prefix}:{args}:{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()

    def get(self, key):
        """获取缓存"""
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return data
            del self.cache[key]
        return None

    def set(self, key, data):
        """设置缓存"""
        self.cache[key] = (data, time.time())

    def delete(self, key):
        """删除缓存"""
        if key in self.cache:
            del self.cache[key]

    def clear(self):
        """清空缓存"""
        self.cache = {}

    def cleanup(self):
        """清理过期缓存"""
        current_time = time.time()
        expired_keys = [k for k, (v, t) in self.cache.items() if current_time - t >= self.ttl]
        for key in expired_keys:
            del self.cache[key]


class RequestDeduplicator:
    """请求去重器 - 防止重复请求"""

    def __init__(self, ttl=5):
        self.requests = {}
        self.ttl = ttl

    def _make_key(self):
        """生成请求键"""
        return hashlib.md5(
            f"{request.method}:{request.path}:{request.remote_addr}".encode(),
            usedforsecurity=False,
        ).hexdigest()

    def is_duplicate(self):
        """检查是否重复请求"""
        key = self._make_key()
        current_time = time.time()

        if key in self.requests:
            last_time = self.requests[key]
            if current_time - last_time < self.ttl:
                return True

        self.requests[key] = current_time

        # 清理过期请求
        expired_keys = [k for k, t in self.requests.items() if current_time - t >= self.ttl]
        for k in expired_keys:
            del self.requests[k]

        return False


class BatchProcessor:
    """批处理器 - 批量操作优化"""

    def __init__(self, batch_size=100, flush_interval=1.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.pending_items = []
        self.last_flush_time = time.time()
        self.lock = __import__("threading").Lock()

    def add(self, item):
        """添加项目到批处理队列"""
        with self.lock:
            self.pending_items.append(item)

            should_flush = (
                len(self.pending_items) >= self.batch_size or time.time() - self.last_flush_time >= self.flush_interval
            )

            if should_flush:
                return self.flush()

            return None

    def flush(self):
        """执行批处理"""
        with self.lock:
            if not self.pending_items:
                return None

            items = self.pending_items
            self.pending_items = []
            self.last_flush_time = time.time()

            return items


# 全局实例
query_optimizer = QueryOptimizer()
response_cache = ResponseCache(ttl=60)
request_deduplicator = RequestDeduplicator(ttl=3)
batch_processor = BatchProcessor(batch_size=50, flush_interval=2.0)


def cached(ttl=60):
    """缓存装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{func.__name__}:{args}:{kwargs}"
            key_hash = hashlib.md5(str(cache_key).encode(), usedforsecurity=False).hexdigest()

            # 尝试从缓存获取
            cached_result = response_cache.get(key_hash)
            if cached_result is not None:
                return cached_result

            # 执行函数
            result = func(*args, **kwargs)

            # 存入缓存
            response_cache.set(key_hash, result)

            return result

        return wrapper

    return decorator


def optimize_query(query_name=None):
    """查询优化装饰器"""

    def decorator(func):
        name = query_name or func.__name__

        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            duration = time.time() - start_time

            query_optimizer.log_query(name, duration)

            return result

        return wrapper

    return decorator


def rate_limit_by_ip(max_requests=100, window=60):
    """基于IP的速率限制装饰器"""
    from collections import defaultdict
    from flask import jsonify

    ip_requests = defaultdict(list)

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            ip = request.remote_addr
            now = time.time()

            # 清理过期记录
            ip_requests[ip] = [t for t in ip_requests[ip] if now - t < window]

            if len(ip_requests[ip]) >= max_requests:
                return jsonify({"success": False, "message": "请求过于频繁，请稍后再试"}), 429

            ip_requests[ip].append(now)

            return func(*args, **kwargs)

        return wrapper

    return decorator


def deduplicate():
    """请求去重装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if request_deduplicator.is_duplicate():
                return jsonify({"success": False, "message": "重复请求，请稍后再试"}), 429

            return func(*args, **kwargs)

        return wrapper

    return decorator


def paginate(page=1, per_page=20, max_per_page=100):
    """分页装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            nonlocal page, per_page
            page = request.args.get("page", page, type=int)
            per_page = request.args.get("per_page", per_page, type=int)

            # 限制最大每页数量
            per_page = min(per_page, max_per_page)

            # 确保页码合法
            page = max(1, page)

            result = func(*args, **kwargs, page=page, per_page=per_page)

            if isinstance(result, dict) and "items" in result:
                result["pagination"] = {"page": page, "per_page": per_page, "total": result.get("total", 0)}

            return result

        return wrapper

    return decorator


def setup_performance_monitoring(app):
    """配置性能监控中间件"""

    @app.before_request
    def before_request():
        g.start_time = time.time()
        g.request_id = hashlib.md5(
            f"{time.time()}:{request.remote_addr}:{request.path}".encode(),
            usedforsecurity=False,
        ).hexdigest()[:8]

    @app.after_request
    def after_request(response):
        if hasattr(g, "start_time"):
            duration = time.time() - g.start_time

            # 添加性能头
            response.headers["X-Response-Time"] = f"{duration*1000:.0f}ms"
            response.headers["X-Request-ID"] = g.request_id

            # 慢请求警告
            if duration > 2.0:
                app.logger.warning(f"Slow request: {request.method} {request.path} took {duration:.2f}s")

        return response

    return {
        "query_optimizer": query_optimizer,
        "response_cache": response_cache,
        "request_deduplicator": request_deduplicator,
        "batch_processor": batch_processor,
    }
