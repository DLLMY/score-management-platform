# -*- coding: utf-8 -*-
"""差异 #4 设备认证凭证体系测试：门禁（白名单 + 签名）与密钥签发/吊销。

覆盖：
  阶段 1  白名单开关默认关闭 ⇒ 未登记设备仍可注册（零行为变化）；开启后拒绝。
  阶段 2  无密钥设备放行；有密钥设备必须带有效 ts/nonce/sig。
  阶段 3  issue_device_secret / 吊销语义。
"""

import time
import uuid

import pytest
from models import Device, SystemConfig, db

from services.mqtt_manager import MQTTManager
from utils.device_auth import (
    compute_signature,
    issue_device_secret,
    reset_whitelist_flag_cache,
    should_register_unknown_device,
    verify_device_signature,
)


@pytest.fixture(autouse=True)
def _clear_flag_cache():
    """每个用例前后清空白名单缓存，避免跨用例串味。"""
    reset_whitelist_flag_cache()
    yield
    reset_whitelist_flag_cache()


def _make_device(session, secret=None, device_id=None):
    device = Device(
        device_id=device_id or f"auth-{uuid.uuid4().hex[:12]}",
        name="认证测试设备",
        status="online",
    )
    if secret:
        device.device_secret = secret
    session.add(device)
    session.commit()
    return device


class TestWhitelistGate:
    """阶段 1：白名单开关。"""

    def test_default_allows_unknown_device(self, app, session):
        """默认（未配置）→ 允许未登记设备上报即注册，保持历史行为。"""
        with app.app_context():
            assert should_register_unknown_device() is True

    def test_gate_allows_unknown_device_by_default(self, app, session):
        """门禁对未登记设备默认放行。"""
        with app.app_context():
            ok = MQTTManager._passes_device_auth_gate(
                None, {"device_id": "unknown-1"}, "unknown-1"
            )
            assert ok is True

    def test_gate_rejects_unknown_device_when_enabled(self, app, session):
        """开关开启 → 未登记设备被拒绝。"""
        with app.app_context():
            config = SystemConfig.query.first()
            if not config:
                config = SystemConfig()
                db.session.add(config)
            config.device_whitelist_enabled = True
            db.session.commit()
            reset_whitelist_flag_cache()

            assert should_register_unknown_device() is False
            ok = MQTTManager._passes_device_auth_gate(
                None, {"device_id": "unknown-2"}, "unknown-2"
            )
            assert ok is False

            # 还原，避免影响其他用例
            config.device_whitelist_enabled = False
            db.session.commit()

    def test_gate_allows_registered_device_when_enabled(self, app, session):
        """开关开启 → 已登记设备仍可上报。"""
        with app.app_context():
            device = _make_device(session)

            config = SystemConfig.query.first()
            if not config:
                config = SystemConfig()
                db.session.add(config)
            config.device_whitelist_enabled = True
            db.session.commit()
            reset_whitelist_flag_cache()

            try:
                ok = MQTTManager._passes_device_auth_gate(
                    device, {"device_id": device.device_id}, device.device_id
                )
                assert ok is True
            finally:
                config.device_whitelist_enabled = False
                db.session.commit()


class TestSignatureGate:
    """阶段 2：设备签名校验。"""

    def test_no_secret_passes(self, app, session):
        """无密钥设备放行（灰度兼容）。"""
        with app.app_context():
            device = _make_device(session, secret=None)
            ok, reason = verify_device_signature(device, {"device_id": device.device_id})
            assert ok is True
            assert reason == "no_secret_configured"

    def test_missing_fields_rejected(self, app, session):
        """有密钥但缺 ts/nonce/sig → 拒绝。"""
        with app.app_context():
            device = _make_device(session, secret="a" * 64)
            ok, reason = verify_device_signature(device, {"device_id": device.device_id})
            assert ok is False
            assert reason == "missing_signature_fields"

    def test_valid_signature_passes(self, app, session):
        """合法签名 → 通过。"""
        with app.app_context():
            secret = "b" * 64
            device = _make_device(session, secret=secret)
            now = int(time.time())
            payload = {"device_id": device.device_id, "ts": now, "nonce": "n1", "uptime": 123}
            payload["sig"] = compute_signature(secret, device.device_id, now, "n1", payload)

            ok, reason = verify_device_signature(device, payload)
            assert ok is True
            assert reason == "ok"

    def test_tampered_payload_rejected(self, app, session):
        """篡改 payload → 签名失配。"""
        with app.app_context():
            secret = "c" * 64
            device = _make_device(session, secret=secret)
            now = int(time.time())
            payload = {"device_id": device.device_id, "ts": now, "nonce": "n1", "uptime": 123}
            payload["sig"] = compute_signature(secret, device.device_id, now, "n1", payload)
            payload["uptime"] = 999  # 篡改

            ok, reason = verify_device_signature(device, payload)
            assert ok is False
            assert reason == "signature_mismatch"

    def test_expired_timestamp_rejected(self, app, session):
        """时间戳超出窗口 → 拒绝。"""
        with app.app_context():
            secret = "d" * 64
            device = _make_device(session, secret=secret)
            stale = int(time.time()) - 3600
            payload = {"device_id": device.device_id, "ts": stale, "nonce": "n1"}
            payload["sig"] = compute_signature(secret, device.device_id, stale, "n1", payload)

            ok, reason = verify_device_signature(device, payload)
            assert ok is False
            assert reason == "timestamp_out_of_window"

    def test_gate_rejects_bad_signature(self, app, session):
        """门禁对有密钥但签名错误的设备返回 False。"""
        with app.app_context():
            device = _make_device(session, secret="e" * 64)
            ok = MQTTManager._passes_device_auth_gate(
                device, {"device_id": device.device_id}, device.device_id
            )
            assert ok is False


class TestSecretLifecycle:
    """阶段 3：密钥签发与吊销。"""

    def test_issue_secret(self, app, session):
        """签发密钥：长度 64、落库、记录签发时间。"""
        with app.app_context():
            device = _make_device(session)
            assert device.device_secret is None

            secret = issue_device_secret(device, commit=True)
            assert len(secret) == 64
            assert device.device_secret == secret
            assert device.secret_issued_at is not None

            # 重新读取确认已持久化
            refreshed = Device.query.filter_by(device_id=device.device_id).first()
            assert refreshed.device_secret == secret

    def test_issue_secret_enables_verification(self, app, session):
        """签发后该设备立即进入强制验签状态。"""
        with app.app_context():
            device = _make_device(session)
            secret = issue_device_secret(device, commit=True)

            # 无签名 → 拒绝
            ok, reason = verify_device_signature(device, {"device_id": device.device_id})
            assert ok is False and reason == "missing_signature_fields"

            # 带正确签名 → 通过
            now = int(time.time())
            payload = {"device_id": device.device_id, "ts": now, "nonce": "x"}
            payload["sig"] = compute_signature(secret, device.device_id, now, "x", payload)
            ok, reason = verify_device_signature(device, payload)
            assert ok is True and reason == "ok"

    def test_revoke_secret_restores_lenient_mode(self, app, session):
        """吊销密钥 → 回到免验签状态（不阻断设备上报）。"""
        with app.app_context():
            device = _make_device(session)
            issue_device_secret(device, commit=True)

            device.device_secret = None
            device.secret_issued_at = None
            db.session.commit()

            ok, reason = verify_device_signature(device, {"device_id": device.device_id})
            assert ok is True
            assert reason == "no_secret_configured"
