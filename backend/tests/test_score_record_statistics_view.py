"""针对 score_record_service.get_record_statistics_view 的隔离单测。

覆盖三态：权限隔离 / 日期解析失败 / 正常聚合（含"无班级则默认首个授权班级"分支）。

为什么这样写：后端在坏沙箱里缺 flask_sqlalchemy，models 无法导入，整套 pytest
（conftest 会 import app）无法采集。本文件自带 loader——优先尝试真实导入（健康环境），
失败则向 sys.modules 注入轻量 stub 后按文件加载模块，使测试不依赖完整后端即可运行，
也兼容健康环境下被 pytest 正常采集。
"""

import importlib
import os
import sys
import types
import unittest
from unittest import mock

# 让 backend 根目录在 sys.path，便于 import services / models / utils
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)


def _load_service_stubbed():
    """缺失重依赖（如 flask_sqlalchemy）时，注入 stub 后按文件加载 score_record_service。"""
    models = types.ModuleType("models")
    models.db = object()
    models.ScoreRecord = object()
    models.User = object()
    models.ScoreRule = object()
    models.get_by_id = lambda *a, **k: None

    utils = types.ModuleType("utils")
    utils.__path__ = [os.path.join(_BACKEND_ROOT, "utils")]
    utils_score_utils = types.ModuleType("utils.score_utils")
    utils_score_utils.atomic_score_update = lambda *a, **k: None
    utils_logger = types.ModuleType("utils.logger")
    utils_logger.log_operation = lambda *a, **k: True
    utils_permission = types.ModuleType("utils.permission")
    utils_permission.get_allowed_classes = lambda *a, **k: None
    utils_params = types.ModuleType("utils.params")
    utils_params.parse_date_range = lambda *a, **k: (None, None, None)

    sys.modules.setdefault("utils", utils)
    sys.modules["utils.score_utils"] = utils_score_utils
    sys.modules["utils.logger"] = utils_logger
    sys.modules["utils.permission"] = utils_permission
    sys.modules["utils.params"] = utils_params
    sys.modules["models"] = models

    path = os.path.join(_BACKEND_ROOT, "services", "score_record_service.py")
    spec = importlib.util.spec_from_file_location("services.score_record_service", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["services.score_record_service"] = module
    spec.loader.exec_module(module)
    return module


def load_service():
    """优先真实导入；失败（坏沙箱）则回退到 stub 加载。"""
    try:
        import services.score_record_service as srv  # noqa: F401
        return srv
    except Exception:
        return _load_service_stubbed()


class TestGetRecordStatisticsView(unittest.TestCase):
    def setUp(self):
        self.srv = load_service()

    def test_permission_denied_when_class_not_allowed(self):
        admin = types.SimpleNamespace(id=1)
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=["ClassA"]), \
             mock.patch.object(self.srv, "parse_date_range", return_value=(None, None, None)), \
             mock.patch.object(self.srv, "get_score_statistics", return_value={}) as m_stat:
            view = self.srv.get_record_statistics_view(admin, None, "ClassB", None, None)
        self.assertEqual(view, {"error": "无权查看该班级的统计", "status": 403})
        m_stat.assert_not_called()  # 权限拦截，不应触达统计

    def test_date_parse_error_returns_400_bad_request(self):
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=None), \
             mock.patch.object(self.srv, "parse_date_range", return_value=(None, None, "日期格式错误")), \
             mock.patch.object(self.srv, "get_score_statistics", return_value={}) as m_stat:
            view = self.srv.get_record_statistics_view(None, None, None, "bad", "bad")
        self.assertEqual(view, {"error": "日期格式错误", "status": 400, "error_code": "BAD_REQUEST"})
        m_stat.assert_not_called()

    def test_normal_aggregates_with_admin_allowed_classes(self):
        admin = types.SimpleNamespace(id=1)
        allowed = ["ClassA", "ClassB"]
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=allowed), \
             mock.patch.object(self.srv, "parse_date_range", return_value=("2026-01-01", "2026-02-01", None)), \
             mock.patch.object(self.srv, "get_score_statistics", return_value={"total": 5}) as m_stat:
            view = self.srv.get_record_statistics_view(admin, 42, None, "2026-01-01", "2026-02-01")
        self.assertEqual(view, {"data": {"total": 5}})
        m_stat.assert_called_once_with(
            user_id=42, class_name=None, start_dt="2026-01-01", end_dt="2026-02-01", allowed_classes=allowed
        )

    def test_defaults_to_first_allowed_class_when_no_scope(self):
        admin = types.SimpleNamespace(id=1)
        allowed = ["ClassA", "ClassB"]
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=allowed), \
             mock.patch.object(self.srv, "parse_date_range", return_value=(None, None, None)), \
             mock.patch.object(self.srv, "get_score_statistics", return_value={}) as m_stat:
            view = self.srv.get_record_statistics_view(admin, None, None, None, None)
        self.assertEqual(view, {"data": {}})
        m_stat.assert_called_once_with(
            user_id=None, class_name="ClassA", start_dt=None, end_dt=None, allowed_classes=allowed
        )

    def test_non_admin_passes_none_allowed_classes(self):
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=None) as m_allowed, \
             mock.patch.object(self.srv, "parse_date_range", return_value=(None, None, None)), \
             mock.patch.object(self.srv, "get_score_statistics", return_value={"x": 1}) as m_stat:
            view = self.srv.get_record_statistics_view(None, None, None, None, None)
        m_allowed.assert_not_called()
        self.assertEqual(view, {"data": {"x": 1}})
        m_stat.assert_called_once_with(
            user_id=None, class_name=None, start_dt=None, end_dt=None, allowed_classes=None
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
