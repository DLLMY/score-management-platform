"""统一请求参数解析 helper（B1 公共逻辑提取 2026-08-22）。

收敛散落各路由的 `request.args.get(..., type=int)` / 裸 `int(request.args.get(...))` 解析
（原 60+ 处手写，非法输入处理不一致：部分 500、部分回退）。本模块提供类型安全读取：
- 参数缺失 / 非法输入 → 回退 default（不抛 500）
- 可选 min/max 钳制到边界（默认不钳制，保持各路由原有边界语义）

用法：
    days = get_int_arg("days", default=7, min_val=1)
    score = get_float_arg("score", default=0.0)
"""

from flask import request


def get_int_arg(name: str, default=None, min_val: int = None, max_val: int = None):
    """读取 int 查询参数；缺失/非法回退 default；可选钳制到 [min_val, max_val]。"""
    try:
        raw = request.args.get(name)
        if raw is None or raw == "":
            return default
        value = int(raw)
    except (TypeError, ValueError):
        return default
    if min_val is not None and value < min_val:
        value = min_val
    if max_val is not None and value > max_val:
        value = max_val
    return value


def get_float_arg(name: str, default=None, min_val: float = None, max_val: float = None):
    """读取 float 查询参数；缺失/非法回退 default；可选钳制到 [min_val, max_val]。"""
    try:
        raw = request.args.get(name)
        if raw is None or raw == "":
            return default
        value = float(raw)
    except (TypeError, ValueError):
        return default
    if min_val is not None and value < min_val:
        value = min_val
    if max_val is not None and value > max_val:
        value = max_val
    return value


def get_str_arg(name: str, default=None, strip: bool = True):
    """读取字符串查询参数；缺失回退 default；可选去除首尾空白。"""
    value = request.args.get(name)
    if value is None:
        return default
    return value.strip() if strip else value


def parse_date_range(start_date, end_date):
    """解析 start_date/end_date（ISO 字符串）为 datetime 对（B7 2026-08-23）。

    收敛 records_routes / operation_logs 等处的手写 try/except 样板。
    错误文案与既有路由保持一致（"start_date 格式非法（应为 ISO 日期）" 等）。

    :return: (start_dt, end_dt, error_msg)；error_msg 非 None 时前两者为 None。
    """
    from datetime import datetime

    start_dt = end_dt = None
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            return None, None, "start_date 格式非法（应为 ISO 日期）"
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            return None, None, "end_date 格式非法（应为 ISO 日期）"
    return start_dt, end_dt, None
