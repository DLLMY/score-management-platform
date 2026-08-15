"""cached_api 装饰器单元测试。

验证点：
  - 兼容本项目 APIResponse 约定（返回 (data_dict, status_code) 元组）
  - 兼容裸 dict / list 响应
  - 仅缓存成功（200）响应，错误响应不缓存
  - 缓存不可用时（无 Redis / 降级）自动穿透，不影响业务
  - HIT / MISS 行为正确，命中后不再重算原函数

使用内存版 fake cache，不依赖 Redis，也不加载重型 app/torch。
"""
import json

import pytest
from flask import Flask

from utils.api_cache_middleware import cached_api


class _FakeCache:
    """模拟 RedisCache 的 get/set 语义（内存版）。"""

    def __init__(self):
        self.store = {}
        self.sets = 0

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, expire=None, ttl=None):
        self.store[key] = value
        self.sets += 1
        return True


@pytest.fixture
def app():
    return Flask(__name__)


def test_cached_api_hit_miss_with_apiresponse_tuple(app, monkeypatch):
    fake = _FakeCache()
    calls = {"n": 0}

    @cached_api(ttl=60)
    def view():
        calls["n"] += 1
        return {"success": True, "data": {"x": calls["n"]}}, 200

    monkeypatch.setattr("utils.api_cache_middleware.get_cache_service", lambda: fake)
    with app.test_request_context("/api/demo", method="GET"):
        r1 = view()
        r2 = view()

    assert calls["n"] == 1, calls  # 第二次命中缓存，不重算
    assert json.loads(r2.get_data(as_text=True))["data"]["x"] == 1
    assert r2.headers.get("X-Cache") == "HIT"


def test_cached_api_skips_non_200(app, monkeypatch):
    fake = _FakeCache()
    calls = {"n": 0}

    @cached_api(ttl=60)
    def view():
        calls["n"] += 1
        return {"success": False, "message": "err"}, 400

    monkeypatch.setattr("utils.api_cache_middleware.get_cache_service", lambda: fake)
    with app.test_request_context("/api/demo", method="GET"):
        view()
        view()

    assert calls["n"] == 2  # 400 不缓存，每次重算
    assert fake.sets == 0


def test_cached_api_bypass_when_no_cache(app, monkeypatch):
    calls = {"n": 0}

    @cached_api(ttl=60)
    def view():
        calls["n"] += 1
        return {"success": True, "data": 1}, 200

    monkeypatch.setattr("utils.api_cache_middleware.get_cache_service", lambda: None)
    with app.test_request_context("/api/demo", method="GET"):
        view()
        view()

    assert calls["n"] == 2  # 无缓存服务 → 穿透，每次重算


def test_cached_api_raw_list_response(app, monkeypatch):
    """在线设备列表返回裸 list，cached_api 应正确处理并缓存。"""
    fake = _FakeCache()
    calls = {"n": 0}

    @cached_api(ttl=30)
    def view():
        calls["n"] += 1
        return [{"id": 1, "is_online": True}]

    monkeypatch.setattr("utils.api_cache_middleware.get_cache_service", lambda: fake)
    with app.test_request_context("/api/devices/online", method="GET"):
        r1 = view()
        r2 = view()

    assert calls["n"] == 1
    assert json.loads(r2.get_data(as_text=True)) == [{"id": 1, "is_online": True}]
    assert r2.headers.get("X-Cache") == "HIT"


def test_cached_api_query_params_part_of_key(app, monkeypatch):
    """不同查询参数应生成不同缓存键（前端轮询的 _/timestamp 已被排除）。"""
    fake = _FakeCache()
    seen = []

    @cached_api(ttl=30)
    def view():
        from flask import request

        seen.append(dict(request.args))
        return {"ok": True}, 200

    monkeypatch.setattr("utils.api_cache_middleware.get_cache_service", lambda: fake)
    with app.test_request_context("/api/x?foo=1&_=123"):
        view()
    with app.test_request_context("/api/x?foo=2&_=456"):
        view()

    # 两次 foo 不同 → 不命中，计算两次；_ 被排除不影响
    assert len(seen) == 2
    assert seen[0]["foo"] == "1" and seen[1]["foo"] == "2"
