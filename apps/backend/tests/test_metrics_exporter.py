"""P1-监控：Prometheus /metrics 端点冒烟测试。

独立于业务鉴权路由 /api/system/metrics，本测试直接驱动 init_metrics 挂载到
一个最小 Flask app（非 TESTING），验证：
- GET /metrics 返回 200 + text/plain + Prometheus  exposition 含核心指标
- 普通请求会被计入 flask_http_requests_total
- /metrics 自身不被计入（且对限流豁免）
"""
import re

import pytest
from flask import Flask

from app.metrics_exporter import init_metrics


@pytest.fixture
def metrics_app():
    app = Flask(__name__)
    app.config["TESTING"] = False  # 模拟生产 / 开发环境（非测试守卫）

    @app.route("/ping")
    def ping():
        return "pong"

    init_metrics(app)
    return app


def _counter_value(text, method, endpoint, status):
    """从 Prometheus exposition 文本解析某标签组合的计数值。"""
    pattern = (
        r'flask_http_requests_total\{endpoint="%s",method="%s",status="%s"\} (\d+)'
        % (re.escape(endpoint), re.escape(method), re.escape(status))
    )
    m = re.search(pattern, text)
    return int(m.group(1)) if m else 0


def test_metrics_endpoint_status_and_content_type(metrics_app):
    client = metrics_app.test_client()
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert resp.content_type.startswith("text/plain")
    body = resp.get_data(as_text=True)
    # 核心业务指标
    assert "flask_http_requests_total" in body
    assert "flask_http_request_duration_seconds" in body
    assert "score_app_info" in body
    # 进程级资源指标（ProcessCollector）已挂到独立注册表：在 Linux 生产（含 psutil）
    # 会暴露 process_resident_memory_bytes / process_cpu 等；Windows 无 psutil 时不输出，
    # 故此处仅确认 ProcessCollector 已注册，不强制其输出内容。
    from prometheus_client import ProcessCollector

    from app.metrics_exporter import registry as _registry

    assert any(isinstance(c, ProcessCollector) for c in _registry._collector_to_names)


def test_metrics_records_request_count(metrics_app):
    client = metrics_app.test_client()
    before = _counter_value(
        client.get("/metrics").get_data(as_text=True), "GET", "ping", "200"
    )
    client.get("/ping")
    after = _counter_value(
        client.get("/metrics").get_data(as_text=True), "GET", "ping", "200"
    )
    assert after == before + 1


def test_metrics_route_excluded_from_count(metrics_app):
    client = metrics_app.test_client()
    body = client.get("/metrics").get_data(as_text=True)
    # /metrics 自身不应被计入请求计数（endpoint="metrics" 不应出现）
    assert 'endpoint="metrics"' not in body
