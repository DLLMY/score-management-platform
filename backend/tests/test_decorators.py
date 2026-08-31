"""B4 safe_handle 装饰器单元验证：

- 普通异常 → 标准错误信封（success=False, 含 code/status_code）
- 正常返回 → 原样透传，零侵入
- werkzeug HTTPException（401/403/404）→ 透传不吞，维持鉴权/错误中间件语义
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from werkzeug.exceptions import Forbidden

from utils.decorators import safe_handle


def test_safe_handle_catches_exception_to_envelope():
    @safe_handle()
    def boom():
        raise ValueError("boom")

    resp, status = boom()
    assert resp["success"] is False
    assert status == 500
    assert "boom" in resp["message"]


def test_safe_handle_passthrough_success():
    @safe_handle()
    def ok():
        return {"data": 1}, 200

    assert ok() == ({"data": 1}, 200)


def test_safe_handle_reraises_http_exception():
    @safe_handle()
    def forbidden():
        raise Forbidden("no")

    try:
        forbidden()
        assert False, "应透传 Forbidden"
    except Forbidden:
        pass


def test_safe_handle_uses_custom_status():
    @safe_handle(default_status=418)
    def teapot():
        raise RuntimeError("x")

    resp, status = teapot()
    assert status == 418
    assert resp["success"] is False
