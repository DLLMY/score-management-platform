"""Prometheus 指标导出器（P1-监控）。

独立于业务指标路由 ``/api/system/metrics``（后者需鉴权、返回历史采样），
本模块暴露 Prometheus 原生 scrape 端点 ``/metrics``（免鉴权、受 TESTING 守卫），
包含 HTTP 请求计数 / 耗时、未捕获异常计数与进程资源指标，供 Prometheus / Grafana 拉取。

设计要点：
- 使用独立 ``CollectorRegistry``，避免污染 prometheus_client 全局注册表及其默认
  process / platform 收集器，也避免被其它（可能存在的）全局注册互相干扰。
- 指标对象在模块加载时创建一次；``/metrics`` 端点返回 ``generate_latest(registry)``。
- 请求级指标通过 ``before_request`` / ``after_request`` 记录，异常通过
  ``got_request_exception`` 信号计数（不覆盖既有错误处理器）。
- ``/metrics`` 自身不被统计、且对限流器豁免（监控拉取端点不应被限流拦截）。
"""
import time

from flask import request, g, Response, signals
from prometheus_client import (
    CollectorRegistry,
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
    ProcessCollector,
)

# ---------------------------------------------------------------------------
# 独立注册表（不污染全局），进程级资源指标挂到该注册表
# ---------------------------------------------------------------------------
registry = CollectorRegistry()
_process_collector = ProcessCollector(registry=registry)

REQUEST_COUNT = Counter(
    "flask_http_requests_total",
    "Total HTTP requests handled by the Flask app.",
    ["method", "endpoint", "status"],
    registry=registry,
)

REQUEST_LATENCY = Histogram(
    "flask_http_request_duration_seconds",
    "HTTP request latency in seconds.",
    ["method", "endpoint"],
    registry=registry,
)

EXCEPTION_COUNT = Counter(
    "flask_exceptions_total",
    "Total uncaught exceptions raised while handling requests.",
    ["exception_type"],
    registry=registry,
)

# 应用存活 / 构建信息（常量为 1，便于在 Grafana 做信息面板）
APP_INFO = Gauge(
    "score_app_info",
    "Application build info; always 1, labeled by version.",
    ["version"],
    registry=registry,
)
APP_INFO.labels(version="1.0.0").set(1)


def _on_request_exception(sender, exception, **_extra):  # noqa: ANN001, ANN202
    """记录未捕获异常（通过信号，避免覆盖既有 errorhandler）。"""
    EXCEPTION_COUNT.labels(exception_type=type(exception).__name__).inc()


def init_metrics(app):
    """在 Flask app 上挂载 ``/metrics`` 端点与请求记录中间件。

    幂等：同一 app 重复调用直接跳过（多 create_app / 反复 import 安全）。
    调用方应以 ``TESTING`` 守卫（测试 app 不注册，避免污染测试并零回归）。
    """
    if getattr(app, "_prom_metrics_registered", False):
        return
    app._prom_metrics_registered = True

    @app.before_request
    def _metrics_start():
        if request.path == "/metrics":
            return
        g._metrics_start = time.perf_counter()

    @app.after_request
    def _metrics_record(response):
        start = getattr(g, "_metrics_start", None)
        if start is None:
            return response
        if request.path == "/metrics":
            return response
        elapsed = time.perf_counter() - start
        endpoint = request.endpoint or "unknown"
        REQUEST_LATENCY.labels(method=request.method, endpoint=endpoint).observe(elapsed)
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status=response.status_code,
        ).inc()
        return response

    @app.route("/metrics")
    def metrics():
        return Response(generate_latest(registry), mimetype=CONTENT_TYPE_LATEST)

    # 异常计数（信号方式，不覆盖既有错误处理器）
    signals.got_request_exception.connect(_on_request_exception, app)

    # 免限流：/metrics 是监控拉取端点，不应被默认限流拦截导致 scrape 失败
    limiter = getattr(app, "limiter", None)
    if limiter is not None:
        try:
            limiter.exempt(metrics)
        except Exception:  # noqa: BLE001 - 限流豁免失败不应阻断启动
            pass
