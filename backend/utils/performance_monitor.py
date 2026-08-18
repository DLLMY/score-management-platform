from datetime import datetime, timedelta
from collections import defaultdict, deque
from typing import Dict, List
from flask import request, g
import time
import logging
import threading

"""
性能监控服务
跟踪系统性能指标，识别性能瓶颈
"""
logger = logging.getLogger(__name__)


class PerformanceAlert:
    """性能告警"""

    def __init__(self, alert_type, message, severity="warning", **details):
        self.alert_type = alert_type
        self.message = message
        self.severity = severity
        self.details = details
        self.timestamp = datetime.now()
        self.acknowledged = False


class PerformanceMetrics:
    """性能指标收集器"""

    def __init__(self):
        self.request_metrics = defaultdict(lambda: deque(maxlen=10000))
        self.query_metrics = defaultdict(lambda: deque(maxlen=10000))
        self.cache_metrics = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
        }
        self.resource_metrics = {
            "cpu_usage": deque(maxlen=1000),
            "memory_usage": deque(maxlen=1000),
            "response_times": deque(maxlen=10000),
        }
        self.slow_requests = deque(maxlen=100)
        self.slow_queries = deque(maxlen=100)
        self.alerts = deque(maxlen=100)
        self.lock = threading.Lock()
        self.start_time = time.time()
        self.slow_request_threshold = 500
        self.slow_query_threshold = 100
        self.alert_slow_request_count = 5
        self.alert_slow_query_count = 5
        self.alert_cache_hit_rate = 70
        self.last_alert_time = {}
        self.alert_cooldown = 300

    def record_request(self, endpoint: str, method: str, duration: float, status_code: int):
        """记录请求指标"""
        with self.lock:
            key = f"{method}:{endpoint}"
            self.request_metrics[key].append(
                {
                    "duration": duration,
                    "status_code": status_code,
                    "timestamp": datetime.now(),
                }
            )
            # 记录响应时间
            self.resource_metrics["response_times"].append(duration)
            # 检测慢请求
            if duration > self.slow_request_threshold:
                self.slow_requests.append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "duration": duration,
                        "status_code": status_code,
                        "timestamp": datetime.now(),
                        "query_params": dict(request.args) if request else {},
                    }
                )
                # 保持最多100条慢请求记录
                if len(self.slow_requests) > 100:
                    self.slow_requests.pop(0)

    def record_query(self, query_type: str, duration: float, rows: int = 0, query_sql: str = None):
        """记录数据库查询指标"""
        with self.lock:
            self.query_metrics[query_type].append(
                {
                    "duration": duration,
                    "rows": rows,
                    "timestamp": datetime.now(),
                }
            )
            if duration > self.slow_query_threshold:
                slow_query_info = {
                    "query_type": query_type,
                    "duration": duration,
                    "rows": rows,
                    "timestamp": datetime.now(),
                    "sql": query_sql[:500] if query_sql else None,
                }
                self.slow_queries.append(slow_query_info)
                if len(self.slow_queries) > 100:
                    self.slow_queries.pop(0)
                self._check_slow_query_alert(query_type, duration)

    def record_cache_hit(self):
        """记录缓存命中"""
        with self.lock:
            self.cache_metrics["hits"] += 1

    def record_cache_miss(self):
        """记录缓存未命中"""
        with self.lock:
            self.cache_metrics["misses"] += 1

    def record_cache_set(self):
        """记录缓存写入"""
        with self.lock:
            self.cache_metrics["sets"] += 1

    def record_cache_delete(self):
        """记录缓存删除"""
        with self.lock:
            self.cache_metrics["deletes"] += 1

    def get_summary(self) -> Dict:
        """获取性能摘要"""
        with self.lock:
            uptime = time.time() - self.start_time
            # 计算请求统计
            request_stats = {}
            for key, metrics in self.request_metrics.items():
                if metrics:
                    durations = [m["duration"] for m in metrics]
                    sorted_durations = sorted(durations)
                    p95_index = int(len(sorted_durations) * 0.95)
                    p95_index = max(0, min(p95_index, len(sorted_durations) - 1))
                    request_stats[key] = {
                        "count": len(metrics),
                        "avg_duration": round(sum(durations) / len(durations), 2),
                        "max_duration": round(max(durations), 2),
                        "min_duration": round(min(durations), 2),
                        "p95": round(sorted_durations[p95_index], 2),
                    }
            # 计算查询统计
            query_stats = {}
            for key, metrics in self.query_metrics.items():
                if metrics:
                    durations = [m["duration"] for m in metrics]
                    query_stats[key] = {
                        "count": len(metrics),
                        "avg_duration": round(sum(durations) / len(durations), 2),
                        "max_duration": round(max(durations), 2),
                        "min_duration": round(min(durations), 2),
                    }
            # 计算缓存命中率
            total_cache_ops = self.cache_metrics["hits"] + self.cache_metrics["misses"]
            cache_hit_rate = round(
                (self.cache_metrics["hits"] / total_cache_ops * 100) if total_cache_ops > 0 else 0,
                2,
            )
            # 计算总体响应时间统计
            response_times = self.resource_metrics["response_times"]
            overall_stats = {}
            if response_times:
                sorted_times = sorted(response_times)
                p95_index = int(len(sorted_times) * 0.95)
                p95_index = max(0, min(p95_index, len(sorted_times) - 1))
                overall_stats = {
                    "avg_response_time": round(sum(response_times) / len(response_times), 2),
                    "max_response_time": round(max(response_times), 2),
                    "min_response_time": round(min(response_times), 2),
                    "p95_response_time": round(sorted_times[p95_index], 2),
                }
            else:
                overall_stats = {
                    "avg_response_time": 0,
                    "max_response_time": 0,
                    "min_response_time": 0,
                    "p95_response_time": 0,
                }
            return {
                "uptime": round(uptime, 2),
                "uptime_formatted": str(timedelta(seconds=int(uptime))),
                "total_requests": sum(len(m) for m in self.request_metrics.values()),
                "total_queries": sum(len(m) for m in self.query_metrics.values()),
                "cache": {
                    "hits": self.cache_metrics["hits"],
                    "misses": self.cache_metrics["misses"],
                    "sets": self.cache_metrics["sets"],
                    "deletes": self.cache_metrics["deletes"],
                    "hit_rate": f"{cache_hit_rate}%",
                },
                "request_stats": request_stats,
                "query_stats": query_stats,
                "overall": overall_stats,
                "slow_request_count": len(self.slow_requests),
                "slow_query_count": len(self.slow_queries),
            }

    def get_slow_requests(self, limit: int = 20) -> List[Dict]:
        """获取慢请求列表（timestamp 归一为 isoformat，保证可 JSON 序列化）"""
        with self.lock:
            items = sorted(self.slow_requests, key=lambda x: x["duration"], reverse=True)[:limit]
            return [
                {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in it.items()}
                for it in items
            ]

    def get_slow_queries(self, limit: int = 20) -> List[Dict]:
        """获取慢查询列表（timestamp 归一为 isoformat，保证可 JSON 序列化）"""
        with self.lock:
            items = sorted(self.slow_queries, key=lambda x: x["duration"], reverse=True)[:limit]
            return [
                {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in it.items()}
                for it in items
            ]

    def reset(self):
        """重置所有指标"""
        with self.lock:
            self.request_metrics = defaultdict(lambda: deque(maxlen=10000))
            self.query_metrics = defaultdict(lambda: deque(maxlen=10000))
            self.cache_metrics = {"hits": 0, "misses": 0, "sets": 0, "deletes": 0}
            self.resource_metrics = {
                "cpu_usage": deque(maxlen=1000),
                "memory_usage": deque(maxlen=1000),
                "response_times": deque(maxlen=10000),
            }
            self.slow_requests = deque(maxlen=100)
            self.slow_queries = deque(maxlen=100)
            self.alerts = deque(maxlen=100)
            self.last_alert_time = {}
            self.start_time = time.time()

    def _add_alert(self, alert_type, message, severity="warning", **details):
        """添加告警"""
        now = time.time()
        alert_key = f"{alert_type}:{message[:50]}"
        if alert_key in self.last_alert_time:
            if now - self.last_alert_time[alert_key] < self.alert_cooldown:
                return
        self.last_alert_time[alert_key] = now
        alert = PerformanceAlert(alert_type, message, severity, **details)
        self.alerts.append(alert)
        logger_func = logger.warning if severity == "warning" else logger.error
        logger_func(
            f"[Performance Alert] [{severity.upper()}] {alert_type}: {message}", extra=details
        )

    def _check_slow_query_alert(self, query_type, duration):
        """检查慢查询告警"""
        slow_count = sum(1 for q in self.slow_queries if q["query_type"] == query_type)
        if slow_count >= self.alert_slow_query_count:
            self._add_alert(
                "slow_query",
                f"查询类型 '{query_type}' 出现 {slow_count} 次慢查询，最长耗时 {duration:.2f}ms",
                severity="warning",
                query_type=query_type,
                slow_count=slow_count,
                max_duration=duration,
            )

    def _check_slow_request_alert(self, endpoint, method, duration):
        """检查慢请求告警"""
        slow_count = sum(
            1 for r in self.slow_requests if r["endpoint"] == endpoint and r["method"] == method
        )
        if slow_count >= self.alert_slow_request_count:
            self._add_alert(
                "slow_request",
                f"请求 {method} {endpoint} 出现 {slow_count} 次慢响应，最长耗时 {duration:.2f}ms",
                severity="warning",
                endpoint=endpoint,
                method=method,
                slow_count=slow_count,
                max_duration=duration,
            )

    def _check_cache_hit_rate_alert(self):
        """检查缓存命中率告警"""
        total_cache_ops = self.cache_metrics["hits"] + self.cache_metrics["misses"]
        if total_cache_ops > 0:
            hit_rate = (self.cache_metrics["hits"] / total_cache_ops) * 100
            if hit_rate < self.alert_cache_hit_rate:
                self._add_alert(
                    "cache_low_hit_rate",
                    f"缓存命中率较低: {hit_rate:.2f}%",
                    severity="warning",
                    hit_rate=hit_rate,
                    hits=self.cache_metrics["hits"],
                    misses=self.cache_metrics["misses"],
                )

    def check_alerts(self):
        """检查所有告警条件"""
        with self.lock:
            self._check_cache_hit_rate_alert()

    def get_alerts(self, limit: int = 20, acknowledged: bool = None) -> List[Dict]:
        """获取告警列表"""
        with self.lock:
            alerts = list(self.alerts)
            if acknowledged is not None:
                alerts = [a for a in alerts if a.acknowledged == acknowledged]
            return sorted(alerts, key=lambda x: x.timestamp, reverse=True)[:limit]

    def acknowledge_alert(self, alert_index: int):
        """确认告警"""
        with self.lock:
            if 0 <= alert_index < len(self.alerts):
                self.alerts[alert_index].acknowledged = True
                return True
        return False

    def get_optimization_suggestions(self) -> List[str]:
        """获取性能优化建议"""
        suggestions = []
        summary = self.get_summary()
        # 缓存命中率建议
        hit_rate = float(summary["cache"]["hit_rate"].replace("%", ""))
        if hit_rate < 70:
            suggestions.append(f"缓存命中率较低 ({hit_rate}%)，建议增加缓存时间或扩大缓存范围")
        # 慢请求建议
        if summary["slow_request_count"] > 0:
            slow_requests = self.get_slow_requests(3)
            for req in slow_requests:
                suggestions.append(
                    f"慢请求: {req['method']} {req['endpoint']} ({req['duration']:.2f}ms)"
                )
        # 慢查询建议
        if summary["slow_query_count"] > 0:
            slow_queries = self.get_slow_queries(3)
            for query in slow_queries:
                suggestions.append(
                    f"慢查询: {query['query_type']} ({query['duration']:.2f}ms, {query['rows']}行)"
                )
        # 响应时间建议
        avg_response = summary["overall"]["avg_response_time"]
        if avg_response > 200:
            suggestions.append(f"平均响应时间较高 ({avg_response}ms)，建议优化API或增加缓存")
        return suggestions


class PerformanceMonitor:
    """性能监控器"""

    _instance = None  # noqa: F841

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.metrics = PerformanceMetrics()
        return cls._instance

    def get_metrics(self) -> PerformanceMetrics:
        return self.metrics

    def log_summary(self):
        """记录性能摘要日志"""
        summary = self.metrics.get_summary()
        logger.info(
            f"[Performance] Uptime: {summary['uptime_formatted']}, "
            f"Requests: {summary['total_requests']}, "
            f"Queries: {summary['total_queries']}, "
            f"Cache Hit Rate: {summary['cache']['hit_rate']}, "
            f"Avg Response: {summary['overall']['avg_response_time']}ms"
        )


performance_monitor = PerformanceMonitor()


class PerformanceMiddleware:
    """性能监控中间件"""

    def __init__(self, app=None):
        if app:
            self.init_app(app)

    def init_app(self, app):
        """初始化Flask应用"""

        @app.before_request
        def before_request():
            g.start_time = time.time()
            g.request_start = datetime.now()

        @app.after_request
        def after_request(response):
            if hasattr(g, "start_time"):
                duration = (time.time() - g.start_time) * 1000
                endpoint = request.endpoint or request.path
                performance_monitor.get_metrics().record_request(
                    endpoint=endpoint,
                    method=request.method,
                    duration=duration,
                    status_code=response.status_code,
                )
            return response

        logger.info("[Performance] 性能监控中间件已启用")


def log_performance_summary():
    """定时记录性能摘要（每5分钟）"""
    while True:
        try:
            performance_monitor.log_summary()
        except Exception as e:
            logger.error(f"记录性能摘要失败: {e}")
        time.sleep(300)


def start_performance_logger():
    """启动性能日志记录线程"""
    thread = threading.Thread(target=log_performance_summary, daemon=True)
    thread.start()
    logger.info("[Performance] 性能日志记录线程已启动")
