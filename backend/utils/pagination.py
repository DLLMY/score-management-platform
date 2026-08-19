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
