import time
import json
import threading
import psutil
from functools import wraps
from typing import Dict, Any, Callable
from collections import defaultdict
from flask import request

"""
APM监控服务
=========== 集成Prometheus指标导出，用于应用性能监控。

功能：
1. 请求性能指标（响应时间、请求量、错误率）
2. 数据库性能指标（查询时间、连接池状态）
3. 缓存性能指标（命中率、操作量）
4. MQTT性能指标（消息量、连接状态）
5. 系统资源指标（CPU、内存、磁盘）

使用方式：
    from utils.monitoring_service import MonitoringService
    monitoring = MonitoringService(app)
    # 记录请求
    monitoring.record_request('GET', '/api/users', 200, 150)
    # 记录数据库查询
    monitoring.record_db_query('SELECT', 'users', 50)
"""
try:
    from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    print("[Monitoring] Prometheus客户端未安装，监控功能受限")


class MonitoringService:
    """APM监控服务"""

    _instance = None  # noqa: F841
    _lock = threading.Lock()  # noqa: F841

    def __new__(cls, app=None):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, app=None):
        if self._initialized:
            return
        self._initialized = True
        self.registry = CollectorRegistry() if PROMETHEUS_AVAILABLE else None
        self._metrics: Dict[str, Any] = {}
        self._stats: Dict[str, Any] = {
            "requests": defaultdict(int),
            "request_times": defaultdict(list),
            "db_queries": defaultdict(int),
            "cache_operations": defaultdict(int),
        }
        self._start_time = time.time()
        # 初始化指标
        self._init_metrics()
        # 注册到Flask应用
        if app:
            self.init_app(app)

    def _init_metrics(self):
        """初始化Prometheus指标"""
        if not PROMETHEUS_AVAILABLE:
            return
        # ========== HTTP请求指标 ==========
        self._metrics["http_requests_total"] = Counter(
            "http_requests_total", "HTTP请求总数", ["method", "endpoint", "status"], registry=self.registry
        )
        self._metrics["http_request_duration_seconds"] = Histogram(
            "http_request_duration_seconds",
            "HTTP请求响应时间",
            ["method", "endpoint"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
            registry=self.registry,
        )
        self._metrics["http_requests_in_progress"] = Gauge(
            "http_requests_in_progress", "正在处理的HTTP请求数", ["method", "endpoint"], registry=self.registry
        )
        # ========== 数据库指标 ==========
        self._metrics["db_queries_total"] = Counter(
            "db_queries_total", "数据库查询总数", ["operation", "table"], registry=self.registry
        )
        self._metrics["db_query_duration_seconds"] = Histogram(
            "db_query_duration_seconds",
            "数据库查询响应时间",
            ["operation", "table"],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
            registry=self.registry,
        )
        self._metrics["db_connections_in_use"] = Gauge(
            "db_connections_in_use", "数据库连接池使用数", registry=self.registry
        )
        self._metrics["db_connections_available"] = Gauge(
            "db_connections_available", "数据库连接池可用数", registry=self.registry
        )
        # ========== 缓存指标 ==========
        self._metrics["cache_operations_total"] = Counter(
            "cache_operations_total", "缓存操作总数", ["operation", "result"], registry=self.registry
        )
        self._metrics["cache_hit_rate"] = Gauge("cache_hit_rate", "缓存命中率", registry=self.registry)
        self._metrics["cache_memory_bytes"] = Gauge("cache_memory_bytes", "缓存内存使用量", registry=self.registry)
        # ========== MQTT指标 ==========
        self._metrics["mqtt_messages_total"] = Counter(
            "mqtt_messages_total", "MQTT消息总数", ["direction", "topic"], registry=self.registry
        )
        self._metrics["mqtt_connections"] = Gauge("mqtt_connections", "MQTT连接状态", registry=self.registry)
        self._metrics["mqtt_queue_size"] = Gauge("mqtt_queue_size", "MQTT消息队列大小", registry=self.registry)
        self._metrics["process_cpu_seconds"] = Gauge("process_cpu_seconds", "进程CPU使用时间", registry=self.registry)
        self._metrics["process_memory_bytes"] = Gauge("process_memory_bytes", "进程内存使用量", registry=self.registry)
        self._metrics["process_open_fds"] = Gauge("process_open_fds", "进程打开文件描述符数", registry=self.registry)
        self._metrics["system_cpu_usage"] = Gauge("system_cpu_usage", "系统CPU使用率", registry=self.registry)
        self._metrics["system_memory_usage"] = Gauge("system_memory_usage", "系统内存使用率", registry=self.registry)
        self._metrics["system_disk_usage"] = Gauge("system_disk_usage", "系统磁盘使用率", registry=self.registry)
        # ========== 应用信息 ========== self._metrics["app_info"] = Info("app_info", "应用信息", registry=self.registry)
        self._metrics["app_info"].info({"version": "2.0", "name": "score_management", "environment": "production"})
        self._metrics["app_uptime_seconds"] = Gauge("app_uptime_seconds", "应用运行时间", registry=self.registry)

    def init_app(self, app):
        """初始化Flask应用"""

        # 添加监控端点
        @app.route("/metrics")
        def metrics_endpoint():
            """Prometheus指标端点"""
            self._update_system_metrics()
            if PROMETHEUS_AVAILABLE:
                return generate_latest(self.registry), 200, {"Content-Type": "text/plain; charset=utf-8"}
            else:
                return self._get_stats_json(), 200, {"Content-Type": "application/json"}

        # 添加请求中间件
        @app.before_request
        def before_request():
            """请求开始前记录"""
            from flask import request

            endpoint = request.endpoint or "unknown"
            method = request.method
            if PROMETHEUS_AVAILABLE:
                self._metrics["http_requests_in_progress"].labels(method=method, endpoint=endpoint).inc()
            request._monitor_start_time = time.time()

        @app.after_request
        def after_request(response):
            """请求结束后记录"""
            endpoint = request.endpoint or "unknown"
            method = request.method
            status = response.status_code
            # 计算响应时间
            duration = time.time() - getattr(request, "_monitor_start_time", time.time())
            self.record_request(method, endpoint, status, duration)
            if PROMETHEUS_AVAILABLE:
                self._metrics["http_requests_in_progress"].labels(method=method, endpoint=endpoint).dec()
            return response

        print("[Monitoring] 监控服务已初始化")

    def record_request(self, method: str, endpoint: str, status: int, duration: float):
        """记录HTTP请求"""
        if PROMETHEUS_AVAILABLE:
            self._metrics["http_requests_total"].labels(method=method, endpoint=endpoint, status=str(status)).inc()
            self._metrics["http_request_duration_seconds"].labels(method=method, endpoint=endpoint).observe(duration)
        # 内部统计
        self._stats["requests"][f"{method}:{endpoint}:{status}"] += 1
        self._stats["request_times"][f"{method}:{endpoint}"].append(duration)

    def record_db_query(self, operation: str, table: str, duration: float):
        """记录数据库查询"""
        if PROMETHEUS_AVAILABLE:
            self._metrics["db_queries_total"].labels(operation=operation, table=table).inc()
            self._metrics["db_query_duration_seconds"].labels(operation=operation, table=table).observe(duration)
        self._stats["db_queries"][f"{operation}:{table}"] += 1

    def record_cache_operation(self, operation: str, result: str):
        """记录缓存操作"""
        if PROMETHEUS_AVAILABLE:
            self._metrics["cache_operations_total"].labels(operation=operation, result=result).inc()
        self._stats["cache"][f"{operation}:{result}"] += 1
        # 更新命中率
        if result == "hit":
            self._stats["cache_hits"] += 1
        elif result == "miss":
            self._stats["cache_misses"] += 1
        total = self._stats["cache_hits"] + self._stats["cache_misses"]
        if total > 0:
            hit_rate = self._stats["cache_hits"] / total
            if PROMETHEUS_AVAILABLE:
                self._metrics["cache_hit_rate"].set(hit_rate)

    def record_mqtt_message(self, direction: str, topic: str):
        """记录MQTT消息"""
        if PROMETHEUS_AVAILABLE:
            self._metrics["mqtt_messages_total"].labels(direction=direction, topic=topic).inc()
        self._stats["mqtt"][f"{direction}:{topic}"] += 1

    def update_db_pool_status(self, in_use: int, available: int):
        """更新数据库连接池状态"""
        if PROMETHEUS_AVAILABLE:
            self._metrics["db_connections_in_use"].set(in_use)
            self._metrics["db_connections_available"].set(available)

    def update_mqtt_status(self, connected: bool, queue_size: int):
        """更新MQTT状态"""
        if PROMETHEUS_AVAILABLE:
            self._metrics["mqtt_connections"].set(1 if connected else 0)
            self._metrics["mqtt_queue_size"].set(queue_size)

    def _update_system_metrics(self):
        """更新系统资源指标"""
        if not PROMETHEUS_AVAILABLE:
            return
        # 进程指标
        process = psutil.Process()
        self._metrics["process_cpu_seconds"].set(process.cpu_seconds())
        self._metrics["process_memory_bytes"].set(process.memory_info().rss)
        try:
            self._metrics["process_open_fds"].set(process.num_fds())
        except psutil.AccessDenied:
            pass
        # 系统指标
        self._metrics["system_cpu_usage"].set(psutil.cpu_percent())
        self._metrics["system_memory_usage"].set(psutil.virtual_memory().percent)
        # 磁盘使用率
        disk = psutil.disk_usage("/")
        self._metrics["system_disk_usage"].set(disk.percent)
        # 运行时间
        uptime = time.time() - self._start_time
        self._metrics["app_uptime_seconds"].set(uptime)

    def _get_stats_json(self) -> str:
        """获取统计数据的JSON格式（无Prometheus时使用）"""
        stats = {
            "uptime": time.time() - self._start_time,
            "requests": dict(self._stats["requests"]),
            "db_queries": dict(self._stats["db_queries"]),
            "cache": dict(self._stats["cache"]),
            "mqtt": dict(self._stats["mqtt"]),
            "cache_hit_rate": (
                self._stats["cache_hits"] / (self._stats["cache_hits"] + self._stats["cache_misses"])
                if self._stats["cache_hits"] + self._stats["cache_misses"] > 0
                else 0
            ),
            "system": {
                "cpu": psutil.cpu_percent(),
                "memory": psutil.virtual_memory().percent,
                "disk": psutil.disk_usage("/").percent,
            },
        }
        return json.dumps(stats, indent=2)

    def get_metrics(self) -> Dict[str, Any]:
        """获取所有指标"""
        self._update_system_metrics()
        if PROMETHEUS_AVAILABLE:
            return {"prometheus": generate_latest(self.registry).decode("utf-8"), "stats": dict(self._stats)}
        else:
            return json.loads(self._get_stats_json())

    def monitor_function(self, name: str):
        """函数监控装饰器"""

        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)  # noqa: F841
                    duration = time.time() - start_time
                    self.record_request("FUNCTION", name, 200, duration)
                    return result
                except Exception:
                    duration = time.time() - start_time
                    self.record_request("FUNCTION", name, 500, duration)
                    raise

            return wrapper

        return decorator


monitoring_service = MonitoringService()


def get_monitoring_service() -> MonitoringService:
    """获取监控服务实例"""
    return monitoring_service


def init_monitoring(app):
    """初始化监控"""
    monitoring_service.init_app(app)
    return monitoring_service


def setup_monitoring(app):
    """初始化监控（兼容旧接口）"""
    monitoring_service.init_app(app)
    return monitoring_service
