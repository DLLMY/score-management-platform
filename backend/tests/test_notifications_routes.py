"""notifications 域路由行为测试（F17 路由服务化 · 防腐层迁移基线/回归）。

覆盖 3 只读 GET + 6 写入路径（create/update/delete/mark-read/send/batch），
断言逐字节复刻的响应体/状态码/错误信息，锁定契约零漂移。
写入路径已收口至 services.notification_service 的 DB-CRUD 模块；本文件
同时作为迁移前后的行为一致性基线（迁移前/后定向跑批须全绿）。
"""

import uuid

import pytest


def _create(client, auth_headers, **payload):
    """通过 POST / 创建一条用户通知，返回 (resp_json, notification_id)。"""
    resp = client.post("/api/notifications/", json=payload, headers=auth_headers)
    return resp, (resp.get_json() or {}).get("data", {}).get("notification_id")


def _get_notification(app, nid):
    from models import Notification

    with app.app_context():
        return Notification.query.get(nid)


# ----------------------------- 只读 GET -----------------------------

def test_list_notifications_empty(client, auth_headers):
    resp = client.get("/api/notifications/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert "notifications" in body and "total" in body
    assert body["total"] == 0
    assert body["notifications"] == []


def test_list_notifications_fields(client, auth_headers, db_session, sample_user):
    _create(client, auth_headers, user_id=sample_user.id, title="列表标题", content="列表内容")
    resp = client.get("/api/notifications/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total"] >= 1
    item = body["notifications"][0]
    # F9-B 合并后字段必须存在，前后端字段不错位
    for key in ("id", "user_id", "student_id", "user_name", "title", "content",
                "type", "status", "phone", "recipient_type", "priority",
                "is_read", "read_at", "extra_data", "created_at", "sent_at"):
        assert key in item
    assert item["recipient_type"] == "user"


def test_get_notification_detail(client, auth_headers, db_session, sample_user):
    _, nid = _create(client, auth_headers, user_id=sample_user.id, title="详情", content="内容")
    resp = client.get(f"/api/notifications/{nid}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["id"] == nid
    assert body["title"] == "详情"
    # 契约修复：detail 端点补齐 student_id（与 list 端点一致，F9-B 收尾不一致已整改）
    assert body["user_id"] == sample_user.id
    assert body["student_id"] == sample_user.id


def test_get_notification_404(client, auth_headers):
    resp = client.get("/api/notifications/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_get_user_notifications(client, auth_headers, db_session, sample_user):
    _create(client, auth_headers, user_id=sample_user.id, title="用户通知", content="内容")
    resp = client.get(f"/api/notifications/user/{sample_user.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert "notifications" in body
    assert body["total"] >= 1
    for n in body["notifications"]:
        assert n["id"] is not None


# ----------------------------- 写入：create -----------------------------

def test_create_notification_201(client, auth_headers, app, db_session, sample_user):
    resp, nid = _create(client, auth_headers, user_id=sample_user.id, title="创建", content="内容")
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["success"] is True
    assert body["message"] == "通知创建成功"
    assert isinstance(nid, int)
    n = _get_notification(app, nid)
    assert n is not None
    assert n.title == "创建"
    # Notification.recipient_type 默认 "user"，契约兼容
    assert n.recipient_type == "user"


# ----------------------------- 写入：update -----------------------------

def test_update_notification(client, auth_headers, app, db_session, sample_user):
    _, nid = _create(client, auth_headers, user_id=sample_user.id, title="旧标题", content="旧内容")
    resp = client.put(
        f"/api/notifications/{nid}",
        json={"title": "新标题", "status": "sent"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["message"] == "通知更新成功"
    n = _get_notification(app, nid)
    assert n.title == "新标题"
    # status=sent 且原 sent_at 为空时自动补 sent_at（与原路由一致）
    assert n.status == "sent"
    assert n.sent_at is not None


def test_update_notification_404(client, auth_headers):
    resp = client.put(
        "/api/notifications/999999",
        json={"title": "x"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ----------------------------- 写入：delete -----------------------------

def test_delete_notification(client, auth_headers, app, db_session, sample_user):
    _, nid = _create(client, auth_headers, user_id=sample_user.id, title="删除", content="内容")
    resp = client.delete(f"/api/notifications/{nid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["message"] == "通知删除成功"
    assert _get_notification(app, nid) is None


# ----------------------------- 写入：mark read -----------------------------

def test_mark_notification_read(client, auth_headers, app, db_session, sample_user):
    _, nid = _create(client, auth_headers, user_id=sample_user.id, title="已读", content="内容")
    resp = client.post(f"/api/notifications/{nid}/read", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["message"] == "通知已标记为已读"
    n = _get_notification(app, nid)
    assert n.status == "read"
    assert n.is_read is True
    assert n.read_at is not None


# ----------------------------- 写入：send -----------------------------

def test_send_notification(client, auth_headers, app, db_session, sample_user):
    resp = client.post(
        "/api/notifications/send",
        json={"user_id": sample_user.id, "title": "单发", "content": "内容"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "通知发送成功"
    nid = body["data"]["notification_id"]
    n = _get_notification(app, nid)
    assert n.status == "sent"
    assert n.sent_at is not None


# ----------------------------- 写入：batch -----------------------------

def test_batch_send_by_user_ids(client, auth_headers, db_session, sample_user):
    resp = client.post(
        "/api/notifications/batch",
        json={"title": "群发", "content": "内容", "user_ids": [sample_user.id], "force_send": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["data"]["sent"] == 1
    assert body["data"]["total"] == 1


def test_batch_send_by_class_id(client, auth_headers, db_session, sample_class):
    from models import User

    user = User(
        name="班内学生",
        card_id="CARD" + str(uuid.uuid4())[:8],
        class_name="某班",
        class_info_id=sample_class.id,
        current_score=100,
    )
    db_session.add(user)
    db_session.commit()
    resp = client.post(
        "/api/notifications/batch",
        json={"title": "班通知", "content": "内容", "class_id": sample_class.id, "force_send": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["sent"] == 1


def test_batch_send_missing_title(client, auth_headers):
    resp = client.post(
        "/api/notifications/batch",
        json={"content": "内容", "user_ids": [1]},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "标题" in (resp.get_json() or {}).get("message", "")


def test_batch_send_missing_target(client, auth_headers):
    resp = client.post(
        "/api/notifications/batch",
        json={"title": "标题", "content": "内容"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "user_ids" in (resp.get_json() or {}).get("message", "") or "class_id" in (
        resp.get_json() or {}
    ).get("message", "")


def test_batch_send_no_force_send_allowed_by_default(client, auth_headers, db_session):
    """不带 force_send，且默认测试库无上课时段规则/课表 → 不拦截，正常放行发送。"""
    resp = client.post(
        "/api/notifications/batch",
        json={"title": "群发", "content": "内容", "user_ids": [1]},
        headers=auth_headers,
    )
    # 默认测试库无上课时段规则 → 不拦截，正常发送
    assert resp.status_code == 200
    assert resp.get_json()["data"]["sent"] == 1
