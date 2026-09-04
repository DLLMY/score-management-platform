# -*- coding: utf-8 -*-
"""微信 access_token 进程内缓存行为测试。

背景（2026-09-04 存量观察项修复）：access_token 有效期 7200s、微信对获取接口
有每日上限，原实现每次发送都现取 → 群发通知会快速耗尽配额。修复：进程内缓存
（按 appid 关联 + 提前 60s 刷新 + 网络/接口异常降级回退旧 token）。
"""
from unittest.mock import MagicMock

import pytest

from services.notification_service import (
    _WECHAT_TOKEN_REFRESH_SKEW,
    NotificationService,
)


@pytest.fixture
def token_config(app):
    with app.app_context():
        app.config["WECHAT_APPID"] = "test_appid"
        app.config["WECHAT_SECRET"] = "test_secret"
    yield


@pytest.fixture
def clean_cache(monkeypatch):
    import services.notification_service as svc

    monkeypatch.setattr(svc, "_WECHAT_TOKEN_CACHE", {})
    yield svc._WECHAT_TOKEN_CACHE


def _fake_get_factory(payload):
    def fake_get(url, timeout=10):
        fake_get.calls.append(url)
        resp = MagicMock()
        resp.json.return_value = payload
        return resp

    fake_get.calls = []
    return fake_get


def test_token_fetched_once_and_cached(monkeypatch, token_config, clean_cache, app):
    import time

    fake = _fake_get_factory({"access_token": "tok-A", "expires_in": 7200})
    monkeypatch.setattr("requests.get", fake)

    with app.app_context():
        assert NotificationService._get_wechat_access_token() == "tok-A"
        assert NotificationService._get_wechat_access_token() == "tok-A"

    assert len(fake.calls) == 1, "缓存有效期内第二次调用不应再请求微信接口"
    assert clean_cache["token"] == "tok-A"
    # 过期时间落在 now+7200 附近（含提前刷新余量）
    assert clean_cache["expires_at"] > time.time() + 7200 - _WECHAT_TOKEN_REFRESH_SKEW - 5


def test_expired_token_refetches(monkeypatch, token_config, clean_cache, app):
    import time

    clean_cache.update({"appid": "test_appid", "token": "stale", "expires_at": time.time() - 10})
    fake = _fake_get_factory({"access_token": "tok-B", "expires_in": 7200})
    monkeypatch.setattr("requests.get", fake)

    with app.app_context():
        assert NotificationService._get_wechat_access_token() == "tok-B"
    assert len(fake.calls) == 1
    assert clean_cache["token"] == "tok-B"


def test_api_error_degrades_to_stale_token(monkeypatch, token_config, clean_cache, app):
    import time

    clean_cache.update(
        {"appid": "test_appid", "token": "stale", "expires_at": time.time() - 10}
    )
    # 过期触发刷新，但接口返回错误 → 降级回退旧 token
    fake = _fake_get_factory({"errcode": 45009, "errmsg": "reach max api daily quota limit"})
    monkeypatch.setattr("requests.get", fake)

    with app.app_context():
        assert NotificationService._get_wechat_access_token() == "stale"


def test_network_error_degrades_to_stale_token(monkeypatch, token_config, clean_cache, app):
    import time

    clean_cache.update(
        {"appid": "test_appid", "token": "stale", "expires_at": time.time() - 10}
    )

    def boom(url, timeout=10):
        raise ConnectionError("network down")

    monkeypatch.setattr("requests.get", boom)
    with app.app_context():
        assert NotificationService._get_wechat_access_token() == "stale"


def test_no_config_ignores_cache(monkeypatch, clean_cache, app):
    # 配置缺失时即使缓存有值也不返回（不跨配置串用）
    with app.app_context():
        app.config["WECHAT_APPID"] = None
        app.config["WECHAT_SECRET"] = None
        clean_cache.update({"appid": "test_appid", "token": "tok-X", "expires_at": 1e18})

        assert NotificationService._get_wechat_access_token() is None


def test_other_appid_not_served_from_cache(monkeypatch, token_config, clean_cache, app):
    # 换 appid 必须重新请求（防多配置串用）
    clean_cache.update({"appid": "other_appid", "token": "tok-other", "expires_at": 1e18})
    fake = _fake_get_factory({"access_token": "tok-mine", "expires_in": 7200})
    monkeypatch.setattr("requests.get", fake)

    with app.app_context():
        assert NotificationService._get_wechat_access_token() == "tok-mine"
    assert len(fake.calls) == 1
