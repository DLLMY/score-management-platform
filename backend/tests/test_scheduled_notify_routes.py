"""scheduled-notify 列表端点分页契约测试（#850 续做）。

验证 GET /api/scheduled_notify/ 返回信封 + items 数组 + 分页元数据，
且向后兼容前端防御性读取（Array.isArray ? : .items）。
"""

from datetime import datetime, timedelta

from models import ScheduledNotify


def _unwrap(payload):
    """兼容 API 信封单/双元组：单元组 → dict；双重元组 → [envelope, status] 取首个。"""
    return payload[0] if isinstance(payload, list) else payload


def _make_notify(db_session, n):
    notify = ScheduledNotify(
        text="scheduled test %d" % n,
        scheduled_at=datetime.now() + timedelta(hours=n),
        status="pending",
    )
    db_session.add(notify)
    return notify


def test_list_scheduled_notify_paginated(client, app, auth_headers, db_session):
    with app.app_context():
        for i in range(3):
            _make_notify(db_session, i)
        db_session.commit()
        resp = client.get("/api/scheduled_notify/", headers=auth_headers)
        assert resp.status_code == 200
        body = _unwrap(resp.get_json())
        assert body["success"] is True
        data = body["data"]
        assert isinstance(data["items"], list)
        assert len(data["items"]) == 3
        assert data["total"] >= 3
        assert data["page"] == 1
        assert "per_page" in data
        assert "pages" in data


def test_list_scheduled_notify_paging_params(client, app, auth_headers, db_session):
    with app.app_context():
        for i in range(3):
            _make_notify(db_session, i)
        db_session.commit()
        resp = client.get(
            "/api/scheduled_notify/?page=1&per_page=2", headers=auth_headers
        )
        assert resp.status_code == 200
        body = _unwrap(resp.get_json())
        data = body["data"]
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["pages"] == 2
        assert data["per_page"] == 2
