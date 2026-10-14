"""操作日志路由行为测试（薄路由收尾前后一致性基线）。

契约（基于当前实现）：
- GET /api/operation-logs/stats  status 200，返回聚合裸 dict：
  total_count / success_count / failure_count / unlock_a_count / unlock_b_count /
  success_rate / by_type(list of {type,count}) / by_day(list of {date,total,success,failure})
- 该内联聚合已下沉 services/operation_log_service.get_stats，响应结构逐字节不变。
"""

from models import OperationLog


def _json(resp):
    return resp.get_json()


class TestOperationLogRoutes:

    def test_get_stats_contract(self, client, app, auth_headers):
        with app.app_context():
            resp = client.get("/api/operation-logs/stats", headers=auth_headers)
        assert resp.status_code == 200
        body = _json(resp)
        assert isinstance(body, dict)
        for key in (
            "total_count",
            "success_count",
            "failure_count",
            "unlock_a_count",
            "unlock_b_count",
            "success_rate",
        ):
            assert key in body
        assert isinstance(body["by_type"], list)
        assert isinstance(body["by_day"], list)
        for item in body["by_type"]:
            assert "type" in item and "count" in item
        for item in body["by_day"]:
            assert {"date", "total", "success", "failure"} <= set(item.keys())

    def test_get_stats_with_time_filter(self, client, app, auth_headers):
        # 时间参数应被透传且不影响响应结构
        with app.app_context():
            resp = client.get(
                "/api/operation-logs/stats",
                query_string={"start_time": "2020-01-01T00:00:00", "end_time": "2030-01-01T00:00:00"},
                headers=auth_headers,
            )
        assert resp.status_code == 200
        body = _json(resp)
        assert isinstance(body["by_type"], list)
        assert isinstance(body["by_day"], list)


# ---- R23: 操作日志聚合查询合并的回归防护（5xCOUNT->条件聚合 / 4xCOUNT->2）----
import re
import time

from sqlalchemy import event

from models import OperationLog, db
from services.operation_log_service import get_stats


def _count_table_selects(app, fn, tables):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（R22 同款 harness）。"""
    pat = re.compile(
        "|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables)
    )
    counter = {"n": 0}

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            return fn(), counter["n"]
    finally:
        event.remove(engine, "after_cursor_execute", _after)


class TestOperationLogAggregationR23:
    """R23：get_stats /summary 聚合查询合并的回归防护。"""

    def _seed(self, app, rows):
        with app.app_context():
            for r in rows:
                db.session.add(OperationLog(operation_type=r[0], description=r[1]))
            db.session.commit()

    def test_get_stats_conditional_aggregation(self, app):
        # 4 行，1 成功/0 失败/1 开A/1 开B（描述用词互不包含）
        self._seed(app, [
            ("login", "管理员登录成功"),
            ("unlock", "开A箱操作"),
            ("unlock", "开B箱操作"),
            ("sync", "数据同步完成"),
        ])
        # 业务查询恒定 3：1 条件聚合 + by_type + by_day（旧逻辑 7）
        (stats, cnt) = _count_table_selects(
            app, lambda: get_stats(None, None), {"operation_log"}
        )
        assert cnt == 3, cnt
        assert stats["total_count"] == 4
        assert stats["success_count"] == 1
        assert stats["failure_count"] == 0
        assert stats["unlock_a_count"] == 1
        assert stats["unlock_b_count"] == 1

    def test_summary_conditional_aggregation(self, client, app, auth_headers):
        self._seed(app, [
            ("login", "管理员登录成功"),
            ("unlock", "开A箱操作"),
            ("unlock", "开B箱操作"),
            ("sync", "数据同步完成"),
        ])
        # 唯一 ?v= 穿透 cached_api(ttl=60)；业务查询恒定 2：今日条件聚合 + 周计数（旧逻辑 4）
        (resp, cnt) = _count_table_selects(
            app,
            lambda: client.get(
                "/api/operation-logs/summary?v=r23s%d" % int(time.time() * 1000),
                headers=auth_headers,
            ),
            {"operation_log"},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["today"]["total"] == 4
        assert body["today"]["success"] == 1
        assert body["today"]["failure"] == 0
        assert body["week"]["total"] == 4
        assert cnt == 2, cnt
