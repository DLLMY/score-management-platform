"""Device.is_online 属性回归测试。

确保设备在线判定走 last_heartbeat TTL（修复「无心跳却显示在线」），
并防止 DeviceExport 直接读 device.is_online 时的 AttributeError 复发。
"""

from datetime import datetime, timedelta

from models import Device
from services.heartbeat_service import is_device_online


def test_is_online_property_no_heartbeat_is_offline():
    d = Device(device_id="PROP_NO_HB", status="online")
    d.last_heartbeat = None
    assert d.is_online is False


def test_is_online_property_fresh_heartbeat_is_online():
    d = Device(device_id="PROP_FRESH", status="online")
    d.last_heartbeat = datetime.now()
    assert d.is_online is True


def test_is_online_property_stale_heartbeat_offline_even_if_status_online():
    # 核心回归：status 仍为 online 但心跳已超时，应判定离线（而非虚高在线）
    d = Device(device_id="PROP_STALE", status="online")
    d.last_heartbeat = datetime.now() - timedelta(seconds=120)
    d.heartbeat_timeout = 60
    assert d.is_online is False


def test_is_online_property_delegates_to_function():
    d = Device(device_id="PROP_DELEG", status="online")
    d.last_heartbeat = datetime.now() - timedelta(seconds=120)
    d.heartbeat_timeout = 60
    assert d.is_online == is_device_online(d)
    assert d.is_online is False


def test_is_online_property_status_offline_is_offline():
    d = Device(device_id="PROP_OFF", status="offline")
    d.last_heartbeat = datetime.now()
    assert d.is_online is False
