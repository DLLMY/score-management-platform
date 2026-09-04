# -*- coding: utf-8 -*-
"""阿里云短信签名回归测试。

背景缺陷（2026-09-04 深审实锤，运行期复现）：
- 原 `_send_aliyun_sms` 调用 `hashlib.hmac.new(...).b64decode()`：
  a) hashlib 无 hmac 属性 → AttributeError（模块 'hashlib' has no attribute 'hmac'）；
  b) 即便修正模块引用，HMAC 对象也无 b64decode，且缺少 digest→base64 编码步骤；
  c) string_to_sign 用 `quote("/")` 保持字面 '/'，而阿里云 RPC 签名规范要求 %2F。
  三重缺陷叠加 → 短信渠道每次发送都在签名处异常（被 except 吞掉），恒失败。

本测试以独立算法路径（urllib.parse + RFC3986 safe=''）重算期望签名，
逐字节比对 HTTP 请求 URL 中的 Signature，锁定修复并防回归。
"""
import base64
import hashlib
import hmac
import urllib.parse

import pytest


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def _official_signature(params, access_key_secret):
    """阿里云 OpenAPI RPC 签名（独立实现，与生产代码不共享工具函数）。

    返回原始 base64（URL 百分号编码前的形态）；生产 URL 经 parse_qsl
    解码后亦为原始 base64，两者可直接逐字节比对。
    """
    canonicalized = "&".join(
        sorted(
            f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(v), safe='')}"
            for k, v in params.items()
        )
    )
    string_to_sign = "GET&%2F&" + urllib.parse.quote(canonicalized, safe="")
    digest = hmac.new(
        f"{access_key_secret}&".encode(), string_to_sign.encode(), hashlib.sha1
    ).digest()
    return base64.b64encode(digest).decode()


@pytest.fixture
def sms_config(app):
    with app.app_context():
        app.config["SMS_CONFIG"] = {
            "provider": "aliyun",
            "access_key_id": "LTAI5t_test_id",
            "access_key_secret": "test_secret_value",
            "sign_name": "测试签名",
            "template_code": "SMS_123456",
        }
    yield app.config["SMS_CONFIG"]


def test_send_aliyun_sms_signature_valid_and_success(monkeypatch, sms_config, app):
    from services.notification_service import NotificationService

    captured = {}

    def fake_get(url, timeout=10):
        captured["url"] = url
        return _FakeResp({"Code": "OK", "BizId": "biz-20260904"})

    monkeypatch.setattr("requests.get", fake_get)

    with app.app_context():
        result = NotificationService.send_sms_notification("13800138000", "设备离线告警")

    # 修复后必须真实走完签名与 HTTP（此前在签名处 AttributeError → success False）
    assert result.get("success") is True
    assert result.get("biz_id") == "biz-20260904"
    assert "url" in captured

    query = urllib.parse.urlsplit(captured["url"]).query
    params = dict(urllib.parse.parse_qsl(query))

    # 请求必须携带签名所需全量公共参数
    for key in (
        "AccessKeyId",
        "Action",
        "Format",
        "PhoneNumbers",
        "SignName",
        "SignatureMethod",
        "SignatureNonce",
        "SignatureVersion",
        "TemplateCode",
        "TemplateParam",
        "Timestamp",
        "Version",
    ):
        assert key in params, f"缺少签名公共参数: {key}"

    # 逐字节比对独立算法签名 → 锁定 hmac/base64/%2F 修复
    expected = _official_signature(
        {k: v for k, v in params.items() if k != "Signature"},
        sms_config["access_key_secret"],
    )
    assert params["Signature"] == expected, "阿里云签名与官方算法不一致（回归）"


def test_send_aliyun_sms_unconfigured_provider(app):
    from services.notification_service import NotificationService

    with app.app_context():
        app.config["SMS_CONFIG"] = {"provider": "nonexistent"}
        result = NotificationService.send_sms_notification("13800138000", "msg")
    assert result.get("success") is False
    assert "SMS_CONFIG.provider" in result.get("message", "")
