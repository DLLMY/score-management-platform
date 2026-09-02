# -*- coding: utf-8 -*-
"""
统一分页参数解析（M9：per_page 上限保护 26% → 100%）。

所有列表端点统一走此 helper：
  - page 下限 1
  - per_page 上限 max_per_page（默认 200，防 ?per_page=100000 dump 全表）
  - 非法输入（非数字/负数/0）回退 default

用法:
    from utils.pagination import get_pagination
    page, per_page = get_pagination(default=20)
"""
from flask import request


def get_pagination(default=20, max_per_page=200):
    """
    解析分页参数。

    Args:
        default: per_page 缺省值（各端点保留原默认，如 10/20/50/100）
        max_per_page: per_page 硬上限（默认 200）
    Returns:
        (page, per_page) 均为 int
    """
    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    page = max(1, page)

    try:
        per_page = int(request.args.get("per_page", default))
    except (TypeError, ValueError):
        per_page = default
    per_page = min(max_per_page, max(1, per_page))
    return page, per_page


def get_limit(default=50, max_limit=200):
    """
    解析 top-N 型数量参数（排行榜 / 导出 / 最近列表等语义是"取前 N 条"、
    不适合翻页的端点）。与 get_pagination 的区别：只读 limit、不引入 page 语义。

    防 ?limit=999999999 之类的无界查询（直接进 ORM .limit() 会全表加载）。

    Args:
        default: limit 缺省值（各端点保留原默认，如 10/20/50/10000）
        max_limit: 硬上限（默认 200，与 get_pagination 的 max_per_page 对齐）
    Returns:
        int，恒满足 1 <= limit <= max_limit
    """
    try:
        limit = int(request.args.get("limit", default))
    except (TypeError, ValueError):
        limit = default
    return min(max_limit, max(1, limit))
