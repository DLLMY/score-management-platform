"""is_device_online 单测：以 last_heartbeat 时效性为准的设备在线判定。

覆盖：无心跳/超时/活跃 三种场景，与 status 字段不一致时以时间为准。
"""

from datetime import datetime, timedelta

from services.heartbeat_service import is_device_online


def _make_device(status="online", last_heartbeat=None, heartbeat_timeout=60, ota_protect_until=None):
    """构造轻量 Device 模拟对象（绕过 SQLAlchemy 实例化）。"""

    class _D:
        pass

    d = _D()
    d.status = status
    d.last_heartbeat = last_heartbeat
    d.heartbeat_timeout = heartbeat_timeout
    d.ota_protect_until = ota_protect_until
    return d


class TestIsDeviceOnline:
    def test_none_device_offline(self):
        assert is_device_online(None) is False

    def test_no_heartbeat_never_reported_offline(self):
        """无 last_heartbeat（设备从未上报）→ 离线，即使 status=online。"""
        d = _make_device(status="online", last_heartbeat=None)
        assert is_device_online(d) is False

    def test_fresh_heartbeat_online(self):
        """心跳新鲜 + status=online → 在线。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(status="online", last_heartbeat=now - timedelta(seconds=10))
        assert is_device_online(d, now=now) is True

    def test_timeout_heartbeat_offline_even_if_status_online(self):
        """心跳超时（>heartbeat_timeout）→ 离线，即使 status 字段仍为 online（陈旧未更新）。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online", last_heartbeat=now - timedelta(seconds=120), heartbeat_timeout=60
        )
        assert is_device_online(d, now=now) is False

    def test_timeout_uses_default_when_heartbeat_timeout_none(self):
        """heartbeat_timeout 为空时使用默认 60 秒。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online", last_heartbeat=now - timedelta(seconds=90), heartbeat_timeout=None
        )
        assert is_device_online(d, now=now) is False  # 90 > 60 默认

    def test_fresh_heartbeat_but_status_offline(self):
        """心跳新鲜但 status=offline（MQTT 标记）→ 离线。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(status="offline", last_heartbeat=now - timedelta(seconds=10))
        assert is_device_online(d, now=now) is False

    def test_exactly_at_threshold_online(self):
        """刚好等于阈值（差 60 秒整）→ 视为在线（边界用 > 严格大于）。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online", last_heartbeat=now - timedelta(seconds=60), heartbeat_timeout=60
        )
        assert is_device_online(d, now=now) is True

    # ---- G4: OTA 离线保护窗 ----

    def test_ota_protect_window_forces_online_when_heartbeat_stale(self):
        """G4：OTA 保护窗内，即便心跳已超时（下载/重启期正常中断）也强制视为在线。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online",
            last_heartbeat=now - timedelta(minutes=5),  # 远超 60s 阈值
            heartbeat_timeout=60,
            ota_protect_until=now + timedelta(minutes=10),
        )
        assert is_device_online(d, now=now) is True

    def test_ota_protect_window_forces_online_even_if_status_offline(self):
        """G4：保护窗内，即使 status 字段已被其他逻辑置为 offline，仍判在线（保护窗优先）。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="offline",
            last_heartbeat=now - timedelta(minutes=5),
            heartbeat_timeout=60,
            ota_protect_until=now + timedelta(minutes=10),
        )
        assert is_device_online(d, now=now) is True

    def test_ota_protect_window_expired_returns_to_normal_detection(self):
        """G4：保护窗已过期 → 退化为常规心跳判定（此时心跳超时则离线）。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online",
            last_heartbeat=now - timedelta(minutes=5),
            heartbeat_timeout=60,
            ota_protect_until=now - timedelta(minutes=1),  # 已过窗
        )
        assert is_device_online(d, now=now) is False

    def test_ota_protect_window_none_no_effect_when_stale(self):
        """G4：无保护窗（ota_protect_until=None）→ 心跳超时仍判离线（回归基线）。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online",
            last_heartbeat=now - timedelta(minutes=5),
            heartbeat_timeout=60,
            ota_protect_until=None,
        )
        assert is_device_online(d, now=now) is False

    def test_ota_protect_window_without_heartbeat_still_offline(self):
        """G4：保护窗存在但设备从未上报心跳（last_heartbeat=None）→ 仍离线（窗判定前先判心跳存在）。"""
        now = datetime(2026, 8, 13, 12, 0, 0)
        d = _make_device(
            status="online",
            last_heartbeat=None,
            heartbeat_timeout=60,
            ota_protect_until=now + timedelta(minutes=10),
        )
        assert is_device_online(d, now=now) is False

