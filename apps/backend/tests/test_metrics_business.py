"""P1-监控：业务指标埋点 helper 单测（OTA / MQTT / 设备在线 / 缓存）。

与 ``test_metrics_exporter.py``（HTTP/进程级冒烟）互补，本模块专门验证
``metrics_exporter`` 新增的 7 个业务指标可由对应 helper 安全埋点：
- 计数/赋值语义正确（helper 内部统一 try/except，绝不阻断主流程）；
- 这些指标名会出现在 ``/metrics`` 原生 exposition 中，供 Prometheus/Grafana 拉取。

运行：``pytest tests/test_metrics_business.py -v``
"""
import pytest
from flask import Flask

from app.metrics_exporter import registry as _REGISTRY


@pytest.fixture
def metrics_app():
    """最小 Flask app（非 TESTING），挂载 ``/metrics`` 路由。"""
    app = Flask(__name__)
    app.config["TESTING"] = False
    init_metrics(app)
    return app


from app.metrics_exporter import init_metrics  # noqa: E402  (fixture 依赖，置于 import 区尾部)


def _sample_value(registry, name, **labels):
    """从独立 registry 读取某指标在指定标签下的样本值（找不到返回 None）。"""
    for metric in registry.collect():
        if metric.name != name:
            continue
        for s in metric.samples:
            if s.labels == labels:
                return s.value
    return None


def test_record_ota_update_increments_counter():
    from app.metrics_exporter import record_ota_update

    before = _sample_value(_REGISTRY, "ota_updates", device_type="phonebox", status="completed") or 0
    record_ota_update("phonebox", "completed")
    after = _sample_value(_REGISTRY, "ota_updates", device_type="phonebox", status="completed")
    assert after == before + 1


def test_record_ota_update_normalizes_empty_device_type():
    from app.metrics_exporter import record_ota_update

    # device_type 为 None / 空 → 归一化为 'phonebox'（与模型 server_default 一致）
    record_ota_update(None, "started")
    assert _sample_value(_REGISTRY, "ota_updates", device_type="phonebox", status="started") is not None
    record_ota_update("", "failed")
    assert _sample_value(_REGISTRY, "ota_updates", device_type="phonebox", status="failed") is not None


def test_record_ota_negotiation_increments_counter():
    from app.metrics_exporter import record_ota_negotiation

    before = _sample_value(_REGISTRY, "ota_negotiations", result="upgrade") or 0
    record_ota_negotiation("upgrade")
    after = _sample_value(_REGISTRY, "ota_negotiations", result="upgrade")
    assert after == before + 1


def test_set_mqtt_connection_sets_gauge():
    from app.metrics_exporter import set_mqtt_connection

    set_mqtt_connection("control", True)
    assert _sample_value(_REGISTRY, "mqtt_connection_state", link="control") == 1
    set_mqtt_connection("control", False)
    assert _sample_value(_REGISTRY, "mqtt_connection_state", link="control") == 0


def test_record_mqtt_message_increments_counter():
    from app.metrics_exporter import record_mqtt_message

    before = _sample_value(_REGISTRY, "mqtt_messages", direction="received", link="telemetry") or 0
    record_mqtt_message("received", "telemetry")
    after = _sample_value(_REGISTRY, "mqtt_messages", direction="received", link="telemetry")
    assert after == before + 1


def test_set_device_counts_sets_gauges():
    from app.metrics_exporter import set_device_counts

    set_device_counts(7, 12)
    assert _sample_value(_REGISTRY, "score_devices_online") == 7
    assert _sample_value(_REGISTRY, "score_devices_total") == 12


def test_record_redis_op_increments_counter():
    from app.metrics_exporter import record_redis_op

    before = _sample_value(_REGISTRY, "redis_cache_ops", operation="get", result="hit") or 0
    record_redis_op("get", "hit")
    after = _sample_value(_REGISTRY, "redis_cache_ops", operation="get", result="hit")
    assert after == before + 1


def test_business_metrics_present_in_exposition(metrics_app):
    client = metrics_app.test_client()
    body = client.get("/metrics").get_data(as_text=True)
    for name in (
        "ota_updates_total",
        "ota_negotiations_total",
        "mqtt_connection_state",
        "mqtt_messages_total",
        "score_devices_online",
        "score_devices_total",
        "redis_cache_ops_total",
    ):
        assert name in body
