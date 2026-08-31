"""时间/时长序列化 helper（B5 公共逻辑提取 2026-08-22）。

收敛散落各路由/服务的 `value.isoformat() if value else None` 写法（原 ~150 处手写，
部分未做 None 保护 → 'NoneType' has no attribute 'isoformat' 500）。

本模块提供 None 安全的序列化：
- None / 空值 → 回退 default（默认 None），绝不抛异常
- datetime / date → isoformat()
- 已是 str → 原样返回（兼容已被序列化过的值，避免二次 .isoformat() 崩溃）
- timedelta → 转为「H:MM:SS」或带天数的「DdHH:MM:SS」

用法：
    "created_at": serialize_dt(r.created_at),
    "birth_date": serialize_date(u.birth_date),
    "duration": serialize_timedelta(delta),
"""

from datetime import date, datetime, timedelta


def serialize_dt(value, default=None):
    """None 安全地将 datetime/date/str 序列化为 ISO 字符串；其它类型回退 default。"""
    if value is None or value == "":
        return default
    if isinstance(value, str):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return default


def serialize_date(value, default=None):
    """None 安全地将 date/datetime 序列化为 YYYY-MM-DD 字符串。"""
    if value is None or value == "":
        return default
    if isinstance(value, str):
        return value
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return default


def serialize_timedelta(value, default=None):
    """None 安全地将 timedelta 序列化为人类可读时长字符串。"""
    if value is None:
        return default
    if isinstance(value, str):
        return value
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        days, rem = divmod(total, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, seconds = divmod(rem, 60)
        if days:
            return f"{days}d{hours:02d}:{minutes:02d}:{seconds:02d}"
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return default
