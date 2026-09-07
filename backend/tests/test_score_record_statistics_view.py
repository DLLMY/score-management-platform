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
    utils_permission.can_access_student = lambda *a, **k: True
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


class _FakePagination:
    def __init__(self, items, total, page, per_page, pages):
        self.items = items
        self.total = total
        self.page = page
        self.per_page = per_page
        self.pages = pages


class TestRecordListViews(unittest.TestCase):
    def setUp(self):
        self.srv = load_service()

    def test_list_normal_aggregates_with_allowed_classes(self):
        admin = types.SimpleNamespace(id=1)
        sd, ed = "2026-01-01", "2026-02-01"
        pag = _FakePagination(items=[types.SimpleNamespace(id=1)], total=10, page=2, per_page=50, pages=1)
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=["C1"]), \
             mock.patch.object(self.srv, "parse_date_range", return_value=(sd, ed, None)), \
             mock.patch.object(self.srv, "query_score_records", return_value=pag) as m_q, \
             mock.patch.object(self.srv, "serialize_score_record", return_value={"id": 1}):
            view = self.srv.get_record_list_view(admin, 7, 3, sd, ed, 2, 50)
        self.assertEqual(
            view,
            {"data": {"records": [{"id": 1}], "total": 10, "page": 2, "per_page": 50, "pages": 1}},
        )
        m_q.assert_called_once_with(
            user_id=7, rule_id=3, start_dt=sd, end_dt=ed, allowed_classes=["C1"], page=2, per_page=50
        )

    def test_list_date_error_returns_400_bad_request(self):
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=None), \
             mock.patch.object(self.srv, "parse_date_range", return_value=(None, None, "日期格式错误")), \
             mock.patch.object(self.srv, "query_score_records", return_value=None) as m_q:
            view = self.srv.get_record_list_view(None, None, None, "bad", "bad", 1, 50)
        self.assertEqual(view, {"error": "日期格式错误", "status": 400, "error_code": "BAD_REQUEST"})
        m_q.assert_not_called()

    def test_list_non_admin_passes_none_allowed_classes(self):
        pag = _FakePagination(items=[], total=0, page=1, per_page=50, pages=0)
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=None) as m_a, \
             mock.patch.object(self.srv, "parse_date_range", return_value=(None, None, None)), \
             mock.patch.object(self.srv, "query_score_records", return_value=pag) as m_q, \
             mock.patch.object(self.srv, "serialize_score_record", return_value={}):
            view = self.srv.get_record_list_view(None, None, None, None, None, 1, 50)
        m_a.assert_not_called()
        m_q.assert_called_once_with(
            user_id=None, rule_id=None, start_dt=None, end_dt=None, allowed_classes=None, page=1, per_page=50
        )
        self.assertEqual(
            view,
            {"data": {"records": [], "total": 0, "page": 1, "per_page": 50, "pages": 0}},
        )

    def test_by_user_normal_aggregates(self):
        pag = _FakePagination(items=[types.SimpleNamespace(id=9)], total=1, page=1, per_page=50, pages=1)
        with mock.patch.object(self.srv, "can_access_student", return_value=True), \
             mock.patch.object(self.srv, "query_score_records", return_value=pag) as m_q, \
             mock.patch.object(self.srv, "serialize_score_record", return_value={"id": 9}):
            view = self.srv.get_record_list_by_user_view(9, 1, 50)
        self.assertEqual(
            view,
            {"data": {"records": [{"id": 9}], "total": 1, "page": 1, "per_page": 50, "pages": 1}},
        )
        m_q.assert_called_once_with(user_id=9, allowed_classes=None, page=1, per_page=50)

    def test_by_user_access_denied_returns_403(self):
        with mock.patch.object(self.srv, "can_access_student", return_value=False), \
             mock.patch.object(self.srv, "query_score_records", return_value=None) as m_q:
            view = self.srv.get_record_list_by_user_view(9, 1, 50)
        self.assertEqual(view, {"error": "无权查看该学生的记录", "status": 403})
        m_q.assert_not_called()

    def test_score_entry_aggregates_with_allowed_classes(self):
        admin = types.SimpleNamespace(id=1)
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=["C1"]), \
             mock.patch.object(self.srv, "get_score_entry_data", return_value={"rules": [], "users": []}) as m_d:
            view = self.srv.get_score_entry_view(admin)
        self.assertEqual(view, {"data": {"rules": [], "users": []}})
        m_d.assert_called_once_with(allowed_classes=["C1"])

    def test_score_entry_non_admin_passes_none_allowed_classes(self):
        with mock.patch.object(self.srv, "get_allowed_classes", return_value=None) as m_a, \
             mock.patch.object(self.srv, "get_score_entry_data", return_value={"rules": [], "users": []}) as m_d:
            view = self.srv.get_score_entry_view(None)
        m_a.assert_not_called()
        m_d.assert_called_once_with(allowed_classes=None)
        self.assertEqual(view, {"data": {"rules": [], "users": []}})


if __name__ == "__main__":
    unittest.main(verbosity=2)
