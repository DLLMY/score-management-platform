"""日期/时间字符串解析工具。

后端从 JSON 收到的日期时间多为 ISO 字符串（如 "2026-08-10"、"09:00"、
"2026-08-10 09:00"），但 SQLAlchemy 的 Date/DateTime 列只接受 Python 的
date/datetime 对象。集中在此解析，避免各端点直接把字符串塞入列导致
`SQLite Date/DateTime type only accepts ...` 的 500 错误。
"""
from datetime import datetime, date


def parse_date(value):
    """将字符串/date/datetime 解析为 date 对象；无法解析或为空返回 None。"""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        s = value.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(s[:10], fmt).date()
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(s).date()
        except ValueError:
            return None
    return None


def parse_datetime(value):
    """将字符串/date/datetime 解析为 datetime 对象；无法解析或为空返回 None。

    对仅有时间部分（如 "09:00"）的字符串，组合为当天时间。
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str):
        s = value.strip()
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
            "%Y/%m/%d %H:%M:%S",
        ):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        # 仅有日期
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d")
        except ValueError:
            pass
        # 仅有时间 HH:MM -> 组合为当天
        try:
            t = datetime.strptime(s, "%H:%M")
            now = datetime.now()
            return now.replace(hour=t.hour, minute=t.minute, second=0, microsecond=0)
        except ValueError:
            pass
        # ISO 兜底
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            return None
    return None
