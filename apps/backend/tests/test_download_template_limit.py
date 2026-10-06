"""R17 回归测试：成绩模板下载的学生查询上限保护。

回归缺陷：`_query_template_students` 在未传参（全校语义）时无上限 `.all()`，
全表加载 + 逐行写入 xlsx，数据量增长后造成内存/CPU 放大（DoS 面）。
修复：三条分支统一走 `get_limit(default=MAX_TEMPLATE_ROWS, max_limit=MAX_TEMPLATE_ROWS)`。

⚠️ 本文件刻意只依赖 `utils.pagination`（纯函数，不拉起 app/models），
源码守卫通过读文件文本实现，避免导入 app 生态。
"""

from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DL_ROUTES = BACKEND_ROOT / "api" / "data" / "download_routes.py"


class _FakeQuery:
    """记录 .limit() 是否被调用及其参数的最小 Query 替身。"""

    def __init__(self):
        self.limits = []

    def filter(self, *args, **kwargs):
        return self

    def filter_by(self, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, n):
        self.limits.append(n)
        return self

    def all(self):
        return ["<student>"]


class _FakeModel:
    """最小 User 模型替身（供 _query_template_students 的 query 链使用）。"""

    class query:
        pass

    class class_info_id:
        pass

    class card_id:
        pass

    class class_name:
        pass


@pytest.fixture
def fake_query(monkeypatch):
    """把 _FakeModel.query 换成可观测的 _FakeQuery 实例。"""
    q = _FakeQuery()
    monkeypatch.setattr(_FakeModel, "query", q)
    return q


@pytest.fixture
def query_students(monkeypatch):
    """加载 _query_template_students（需 Flask request 上下文供 get_limit 读 args）。"""
    import flask

    from api.data import download_routes

    with flask.Flask(__name__).test_request_context("/?"):
        yield download_routes._query_template_students


class TestTemplateStudentsLimit:
    def test_limit_constant_declared(self):
        from api.data import download_routes

        assert download_routes.MAX_TEMPLATE_ROWS == 10000

    def test_all_students_branch_is_bounded(self, fake_query, query_students):
        """未传参（全校）分支必须带上限。"""
        query_students(_FakeModel, None, None)
        assert fake_query.limits, "全校分支必须调用 .limit()"
        assert fake_query.limits[-1] == 10000

    def test_class_id_branch_is_bounded(self, fake_query, query_students):
        query_students(_FakeModel, 1, None)
        assert fake_query.limits, "class_id 分支必须调用 .limit()"
        assert fake_query.limits[-1] == 10000

    def test_class_name_branch_is_bounded(self, fake_query, query_students):
        query_students(_FakeModel, None, "高一(1)班")
        assert fake_query.limits, "class_name 分支必须调用 .limit()"
        assert fake_query.limits[-1] == 10000

    def test_uses_shared_limit_helper(self):
        """必须复用 utils.pagination.get_limit（项目既定防护范式），而非硬编码常量。"""
        src = DL_ROUTES.read_text(encoding="utf-8")
        assert "from utils.pagination import get_limit" in src
        assert "get_limit(default=MAX_TEMPLATE_ROWS, max_limit=MAX_TEMPLATE_ROWS)" in src

    def test_no_unbounded_all_in_student_query(self):
        """防回归：学生查询函数体内不得出现无上限的 .all() 链。"""
        src = DL_ROUTES.read_text(encoding="utf-8")
        start = src.index("def _query_template_students(")
        body = src[start : src.index("\ndef ", start + 10)]
        # 每个 return 块都应在 .all() 前有 .limit(
        assert body.count(".limit(") == 3, "三条分支都必须有 .limit()"
        assert body.count(".all()") == 3
