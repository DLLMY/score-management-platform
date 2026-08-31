"""permission-logs 列表端点分页契约测试（#850）。

验证 GET /api/permission-logs/ 返回信封 + logs 数组 + 分页元数据，
且向后兼容前端防御性读取（Array.isArray ? : .logs）。
"""

from models import PermissionLog


def _unwrap(payload):
    """兼容 API 信封单/双元组：单元组 → dict；双重元组 → [envelope, status] 取首个。"""
    return payload[0] if isinstance(payload, list) else payload


def _make_log(db_session, n):
    log = PermissionLog(
        operator_id=1,
        operator_type="admin",
        action="grant",
        target_type="role",
        target_id=n,
        description="test %d" % n,
        ip_address="127.0.0.1",
    )
    db_session.add(log)
    return log


def test_list_permission_logs_paginated(client, app, auth_headers, db_session):
    with app.app_context():
        for i in range(3):
            _make_log(db_session, i)
        db_session.commit()
        resp = client.get("/api/permission-logs/", headers=auth_headers)
        assert resp.status_code == 200
        body = _unwrap(resp.get_json())
        assert body["success"] is True
        data = body["data"]
        assert isinstance(data["logs"], list)
        assert len(data["logs"]) == 3
        assert data["total"] >= 3
        assert data["page"] == 1
        assert "per_page" in data
        assert "pages" in data


def test_list_permission_logs_filter(client, app, auth_headers, db_session):
    with app.app_context():
        _make_log(db_session, 1)
        db_session.commit()
        resp = client.get("/api/permission-logs/?action=grant", headers=auth_headers)
        assert resp.status_code == 200
        body = _unwrap(resp.get_json())
        assert body["data"]["total"] >= 1
