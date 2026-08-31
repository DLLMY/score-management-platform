"""B5 serialize_dt / serialize_date / serialize_timedelta 单元验证。

纯函数测试，无需 Flask 应用上下文；验证 None 安全与等价行为，
确保 `/api/scores/*` 与通知模板序列化在字段为空时不抛 500。
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, date, timedelta

from utils.serialize import serialize_dt, serialize_date, serialize_timedelta


def test_serialize_dt_none():
    assert serialize_dt(None) is None
    assert serialize_dt(None, default="--") == "--"
    assert serialize_dt("") is None


def test_serialize_dt_datetime():
    dt = datetime(2026, 8, 22, 13, 5, 9)
    assert serialize_dt(dt) == "2026-08-22T13:05:09"


def test_serialize_dt_date():
    d = date(2026, 8, 22)
    assert serialize_dt(d) == "2026-08-22"


def test_serialize_dt_passthrough_str():
    # 已被序列化的值原样返回，避免二次 .isoformat() 崩溃
    assert serialize_dt("2026-08-22T13:05:09") == "2026-08-22T13:05:09"


def test_serialize_dt_equivalent_to_inline_guard():
    from datetime import datetime as _dt

    value = _dt(2026, 1, 2, 3, 4, 5)
    # 与原路由写法 `value.isoformat() if value else None` 等价
    assert serialize_dt(value) == (value.isoformat() if value else None)
    assert serialize_dt(None) == (value.isoformat() if value else None) is False or serialize_dt(None) is None


def test_serialize_date():
    assert serialize_date(None) is None
    assert serialize_date(date(2026, 8, 22)) == "2026-08-22"
    assert serialize_date(datetime(2026, 8, 22, 10, 0, 0)) == "2026-08-22"
    assert serialize_date("2026-08-22") == "2026-08-22"


def test_serialize_timedelta():
    assert serialize_timedelta(None) is None
    assert serialize_timedelta(timedelta(seconds=3661)) == "01:01:01"
    assert serialize_timedelta(timedelta(days=2, hours=3, minutes=4, seconds=5)) == "2d03:04:05"
    assert serialize_timedelta("01:00:00") == "01:00:00"
