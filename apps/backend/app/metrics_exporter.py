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

from flask import Response, g, request, signals
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    ProcessCollector,
    generate_latest,
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

# ---------------------------------------------------------------------------
# 业务指标（P1-Grafana：OTA / MQTT / 设备在线 / 缓存）
#
# 与 HTTP/进程级指标共用同一独立 ``registry``，但由业务事件点以纯增量方式埋点，
# 不依赖 Flask app 上下文、也不受 TESTING 守卫影响（计数器在模块加载即创建；
# 仅 ``/metrics`` 路由注册受 TESTING 守卫）。所有埋点通过下方 helper 完成，
# 内部统一 try/except，绝不阻断主业务流程。
# ---------------------------------------------------------------------------
OTA_UPDATES = Counter(
    "ota_updates_total",
    "OTA update outcomes reported by devices.",
    ["device_type", "status"],
    registry=registry,
)

OTA_NEGOTIATIONS = Counter(
    "ota_negotiations_total",
    "OTA version-negotiation outcomes by decision action.",
    ["result"],
    registry=registry,
)

MQTT_CONNECTION_STATE = Gauge(
    "mqtt_connection_state",
    "MQTT broker connection state per link (1 connected, 0 otherwise).",
    ["link"],
    registry=registry,
)

MQTT_MESSAGES = Counter(
    "mqtt_messages_total",
    "MQTT messages handled (received/published) per link.",
    ["direction", "link"],
    registry=registry,
)

DEVICES_ONLINE = Gauge(
    "score_devices_online",
    "Number of devices currently considered online.",
    registry=registry,
)

DEVICES_TOTAL = Gauge(
    "score_devices_total",
    "Total number of device records.",
    registry=registry,
)

REDIS_CACHE_OPS = Counter(
    "redis_cache_ops_total",
    "Redis cache operations by operation and result.",
    ["operation", "result"],
    registry=registry,
)


def _on_request_exception(sender, exception, **_extra):
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
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 业务指标埋点 helper（全部 try/except 包裹，绝不阻断主业务流程）
# ---------------------------------------------------------------------------
def _norm_device_type(device_type):
    """归一化 device_type 标签（None/空 → 'phonebox'，与模型 server_default 一致）。"""
    if not device_type:
        return "phonebox"
    text = str(device_type).strip()
    return text or "phonebox"


def record_ota_update(device_type, status):
    """记录一次 OTA 上报结果（status: started/completed/failed）。"""
    try:
        OTA_UPDATES.labels(device_type=_norm_device_type(device_type), status=status).inc()
    except Exception:
        pass


def record_ota_negotiation(result):
    """记录一次版本协商结果（result: no_firmware/up_to_date/skip_too_old/upgrade）。"""
    try:
        OTA_NEGOTIATIONS.labels(result=result).inc()
    except Exception:
        pass


def set_mqtt_connection(link, connected):
    """设置某条 MQTT 链路连接状态（link: control/telemetry）。"""
    try:
        MQTT_CONNECTION_STATE.labels(link=link).set(1 if connected else 0)
    except Exception:
        pass


def record_mqtt_message(direction, link):
    """记录一条 MQTT 消息（direction: received/published；link: control/telemetry）。"""
    try:
        MQTT_MESSAGES.labels(direction=direction, link=link).inc()
    except Exception:
        pass


def set_device_counts(online, total):
    """设置设备在线/总数快照（供设备在线率面板）。"""
    try:
        DEVICES_ONLINE.set(int(online))
        DEVICES_TOTAL.set(int(total))
    except Exception:
        pass


def record_redis_op(operation, result):
    """记录一次 Redis 缓存操作（operation: get/set/delete；result: hit/miss/ok/err）。"""
    try:
        REDIS_CACHE_OPS.labels(operation=operation, result=result).inc()
    except Exception:
        pass
