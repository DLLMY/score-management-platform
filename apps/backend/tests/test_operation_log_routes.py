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
