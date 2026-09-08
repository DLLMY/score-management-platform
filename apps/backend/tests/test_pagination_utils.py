# -*- coding: utf-8 -*-
"""utils.pagination 单元测试（get_pagination / get_limit）。

背景：
  - get_pagination 为 M9 引入，此前无测试覆盖，本次补齐既有债务；
  - get_limit 为"无界 limit"安全修复新增，供 top-N 型端点（排行榜/导出/最近列表）复用。

验证点：默认值 / 正常解析 / 上限钳制 / 非法输入回退 / 非正数下限保护 / 两者语义隔离。

使用轻量 Flask app，不加载重型 app、不依赖 Redis / torch。
"""

import pytest
from flask import Flask

from utils.pagination import get_pagination, get_limit


@pytest.fixture
def app():
    return Flask(__name__)


class TestGetPagination:
    """get_pagination：page 下限 1，per_page 上限 max_per_page（防全表 dump）。"""

    def test_defaults_when_no_args(self, app):
        with app.test_request_context("/api/x"):
            assert get_pagination(default=20) == (1, 20)

    def test_normal_page_and_per_page(self, app):
        with app.test_request_context("/api/x?page=3&per_page=50"):
            assert get_pagination(default=20) == (3, 50)

    def test_per_page_clamped_to_max(self, app):
        with app.test_request_context("/api/x?per_page=100000"):
            assert get_pagination(default=20) == (1, 200)

    def test_custom_max_per_page(self, app):
        with app.test_request_context("/api/x?per_page=500"):
            assert get_pagination(default=20, max_per_page=100) == (1, 100)

    def test_invalid_per_page_falls_back_to_default(self, app):
        with app.test_request_context("/api/x?per_page=abc"):
            assert get_pagination(default=20) == (1, 20)

    def test_nonpositive_per_page_clamped_to_one(self, app):
        with app.test_request_context("/api/x?per_page=0"):
            assert get_pagination(default=20) == (1, 1)
        with app.test_request_context("/api/x?per_page=-5"):
            assert get_pagination(default=20) == (1, 1)

    def test_invalid_page_falls_back_to_one(self, app):
        with app.test_request_context("/api/x?page=abc&per_page=10"):
            assert get_pagination(default=20) == (1, 10)

    def test_nonpositive_page_clamped_to_one(self, app):
        with app.test_request_context("/api/x?page=0"):
            assert get_pagination(default=20) == (1, 20)
        with app.test_request_context("/api/x?page=-3"):
            assert get_pagination(default=20) == (1, 20)


class TestGetLimit:
    """get_limit：只读 limit，恒满足 1 <= limit <= max_limit。"""

    def test_default_when_no_args(self, app):
        with app.test_request_context("/api/x"):
            assert get_limit(default=50) == 50

    def test_normal_limit(self, app):
        with app.test_request_context("/api/x?limit=30"):
            assert get_limit(default=50) == 30

    def test_limit_clamped_to_max(self, app):
        """防 ?limit=999999999 直接进 ORM .limit() 导致全表加载。"""
        with app.test_request_context("/api/x?limit=999999999"):
            assert get_limit(default=50) == 200

    def test_custom_max_limit(self, app):
        """导出端点用 default=10000 / max_limit=10000（与接口文档一致）。"""
        with app.test_request_context("/api/x?limit=10000"):
            assert get_limit(default=10000, max_limit=10000) == 10000
        with app.test_request_context("/api/x?limit=99999"):
            assert get_limit(default=10000, max_limit=10000) == 10000

    def test_invalid_limit_falls_back_to_default(self, app):
        with app.test_request_context("/api/x?limit=abc"):
            assert get_limit(default=50) == 50

    def test_nonpositive_limit_clamped_to_one(self, app):
        with app.test_request_context("/api/x?limit=0"):
            assert get_limit(default=50) == 1
        with app.test_request_context("/api/x?limit=-10"):
            assert get_limit(default=50) == 1

    def test_does_not_read_page_or_per_page(self, app):
        """语义隔离：get_limit 属 top-N，不应受 page/per_page 影响。"""
        with app.test_request_context("/api/x?page=9&per_page=7"):
            assert get_limit(default=50) == 50
