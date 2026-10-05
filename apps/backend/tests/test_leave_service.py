#!/usr/bin/env python3
"""请假（硬件端）后端能力测试（#413）。

覆盖：
1. leave_service 业务：req/cancel/query 三入口、ProcessedMessage 幂等、惰性过期、
   周期过期 expire_leaves、解锁前判定 resolve_leave_for_unlock（F3 三态）、
   查询态 resolve_leave_status、ISO8601 +08:00（F7）。
2. REST 端点：GET /api/leave/active（F6）、GET /api/leave/pending、POST /api/leave/{id}/cancel。
"""

import json
import uuid
from datetime import datetime, timedelta

import pytest

from models import Approval, ClassInfo, User
from services import leave_service, phonebox_policy

# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------


def _make_class(db_session):
    cls = ClassInfo(
        name="LEAVECLASS" + uuid.uuid4().hex[:6], grade="高一", description="测试班"
    )
    db_session.add(cls)
    db_session.commit()
    return cls


def _make_user(db_session, class_info_id, card_id="LEAVECARD001"):
    user = User(
        name="请假生" + uuid.uuid4().hex[:4],
        card_id=card_id,
        class_info_id=class_info_id,
        class_name="测试班",
        current_score=100,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _active_leave(db_session, user, hours=2):
    now = datetime.now()
    a = Approval(
        student_id=user.id,
        type="leave",
        title="leave-sick",
        description="硬件端请假",
        leave_type="sick",
        start_date=now.date(),
        end_date=(now + timedelta(hours=hours)).date(),
        start_time=now,
        end_time=now + timedelta(hours=hours),
        card_id=user.card_id,
        device_id="dev_leave_1",
        status="approved",
    )
    db_session.add(a)
    db_session.commit()
    return a


def _make_teacher(db_session, username="leaveteacher", class_info_id=None):
    from models import Admin, AdminRole, RolePermissionMapping
    from utils.security import hash_password

    admin = Admin(
        username=username,
        password=hash_password("test123456"),
        role="teacher",
        real_name="班主任",
        primary_class_id=class_info_id,
    )
    db_session.add(admin)
    db_session.commit()
    if not AdminRole.query.filter_by(admin_id=admin.id, role_code="teacher").first():
        db_session.add(AdminRole(admin_id=admin.id, role_code="teacher"))
    for code in ("phonebox.unlock.manage",):
        if not RolePermissionMapping.query.filter_by(
            role_code="teacher", permission_code=code
        ).first():
            db_session.add(RolePermissionMapping(role_code="teacher", permission_code=code))
    db_session.commit()
    return admin


def _teacher_headers(teacher):
    from utils.security import generate_tokens

    tokens = generate_tokens(
        admin_id=teacher.id, username=teacher.username, role="teacher"
    )
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tokens["access_token"],
    }


@pytest.fixture
def mock_publish(monkeypatch):
    calls = []

    def _fake(topic, payload):
        calls.append((topic, payload))

    monkeypatch.setattr(leave_service, "publish_mqtt", _fake)
    return calls


# ---------------------------------------------------------------------------
# leave_service 业务
# ---------------------------------------------------------------------------


class TestLeaveServiceRequest:
    def test_handle_leave_request_creates_approved(self, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        data = {
            "device_id": "dev_leave_1",
            "card_id": user.card_id,
            "leave_type": "sick",
            "leave_hours": 3,
        }
        leave_service.handle_leave_request(data)
        approvals = Approval.query.filter_by(
            student_id=user.id, type="leave", status="approved"
        ).all()
        assert len(approvals) == 1
        assert approvals[0].leave_type == "sick"
        assert approvals[0].end_time is not None
        # 下行回包已发布到 phonebox/leave/{device_id}
        assert any(t == "phonebox/leave/dev_leave_1" for t, _ in mock_publish)

    def test_handle_leave_request_idempotent_by_msg_id(self, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        data = {
            "device_id": "dev_leave_1",
            "card_id": user.card_id,
            "leave_type": "personal",
            "leave_hours": 2,
            "msg_id": "LEAVE-MSG-1",
        }
        leave_service.handle_leave_request(data)
        leave_service.handle_leave_request(data)  # 同 msg_id 重投
        approvals = Approval.query.filter_by(
            student_id=user.id, type="leave"
        ).all()
        # ProcessedMessage 幂等：仅一条请假记录
        assert len(approvals) == 1

    def test_handle_leave_request_invalid_type(self, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        data = {
            "device_id": "dev_leave_1",
            "card_id": user.card_id,
            "leave_type": "vacation",  # 非法类型
            "leave_hours": 2,
        }
        leave_service.handle_leave_request(data)
        assert (
            Approval.query.filter_by(student_id=user.id, type="leave").count() == 0
        )


class TestLeaveServiceCancelQuery:
    def test_handle_leave_cancel(self, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        _active_leave(db_session, user, hours=3)
        leave_service.handle_leave_cancel({"device_id": "dev_leave_1", "card_id": user.card_id})
        a = Approval.query.filter_by(student_id=user.id, type="leave").first()
        assert a.status == "cancelled"

    def test_handle_leave_query_on_leave(self, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        _active_leave(db_session, user, hours=3)
        leave_service.handle_leave_query({"device_id": "dev_leave_1", "card_id": user.card_id})
        # 至少发布了一次 leave_status 回包且 on_leave=True（payload 为 JSON 字符串）
        assert any(
            t == "phonebox/leave/dev_leave_1"
            and json.loads(r).get("r", {}).get("on_leave") is True
            for t, r in mock_publish
        )


class TestLeaveExpiry:
    def test_expire_leaves_marks_expired(self, app, db_session):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        now = datetime.now()
        a = Approval(
            student_id=user.id,
            type="leave",
            title="leave-old",
            leave_type="sick",
            start_time=now - timedelta(hours=5),
            end_time=now - timedelta(hours=1),  # 已过期
            card_id=user.card_id,
            status="approved",
        )
        db_session.add(a)
        db_session.commit()
        count = leave_service.expire_leaves(app)
        assert count == 1
        db_session.refresh(a)
        assert a.status == "expired"

    def test_lazy_expiry_on_query(self, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        now = datetime.now()
        a = Approval(
            student_id=user.id,
            type="leave",
            leave_type="sick",
            start_time=now - timedelta(hours=5),
            end_time=now - timedelta(hours=1),
            card_id=user.card_id,
            status="approved",
        )
        db_session.add(a)
        db_session.commit()
        # 读时惰性过期：is_on_leave 触发后该请假应置 expired
        assert leave_service.is_on_leave(user.id) is False
        db_session.refresh(a)
        assert a.status == "expired"


class TestResolveLeaveForUnlock:
    def test_no_leave_returns_normal_deduct(self, db_session):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        on_leave, points, proceed = leave_service.resolve_leave_for_unlock(user)
        assert on_leave is False
        assert points == leave_service.LEAVE_UNLOCK_COST
        assert proceed is True

    def test_exempt_leave_no_deduct(self, db_session):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        _active_leave(db_session, user, hours=3)
        phonebox_policy.set_policy(cls.id, leave_exempt_deduction=True, updated_by=1)
        on_leave, points, proceed = leave_service.resolve_leave_for_unlock(user)
        assert on_leave is True
        assert points == 0
        assert proceed is False  # 纯免扣：不扣分、保留请假

    def test_auto_checkin_cancels_and_deducts(self, db_session):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        a = _active_leave(db_session, user, hours=3)
        # 默认策略（非免扣）→ 自动销假 + 正常扣
        on_leave, points, proceed = leave_service.resolve_leave_for_unlock(user)
        assert on_leave is False
        assert points == leave_service.LEAVE_UNLOCK_COST
        assert proceed is True
        db_session.refresh(a)
        assert a.status == "cancelled"  # 已自动销假


class TestLeaveStatusAndIso:
    def test_resolve_leave_status_none(self, db_session):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        assert leave_service.resolve_leave_status(user) == {
            "on_leave": False,
            "points_deducted": None,
        }

    def test_resolve_leave_status_exempt(self, db_session):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        _active_leave(db_session, user, hours=3)
        phonebox_policy.set_policy(cls.id, leave_exempt_deduction=True, updated_by=1)
        assert leave_service.resolve_leave_status(user) == {
            "on_leave": True,
            "points_deducted": 0,
        }

    def test_to_iso_offset(self):
        from datetime import datetime as _dt

        assert leave_service._to_iso(None) is None
        out = leave_service._to_iso(_dt(2026, 1, 1, 10, 0, 0))
        assert out == "2026-01-01T10:00:00+08:00"


# ---------------------------------------------------------------------------
# REST 端点
# ---------------------------------------------------------------------------


class TestLeaveRoutes:
    def test_get_active_leaves(self, client, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        _active_leave(db_session, user, hours=3)
        teacher = _make_teacher(db_session, class_info_id=cls.id)
        resp = client.get("/api/leave/active", headers=_teacher_headers(teacher))
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert any(a["student_id"] == user.id for a in body["data"])

    def test_get_pending_leaves(self, client, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        now = datetime.now()
        db_session.add(
            Approval(
                student_id=user.id,
                type="leave",
                title="leave-pending",
                leave_type="personal",
                start_time=now,
                end_time=now + timedelta(hours=2),
                card_id=user.card_id,
                status="pending",
            )
        )
        db_session.commit()
        teacher = _make_teacher(db_session, class_info_id=cls.id)
        resp = client.get("/api/leave/pending", headers=_teacher_headers(teacher))
        assert resp.status_code == 200
        body = resp.get_json()
        assert any(a["student_id"] == user.id for a in body["data"])

    def test_teacher_cancel_leave(self, client, db_session, mock_publish):
        cls = _make_class(db_session)
        user = _make_user(db_session, cls.id)
        a = _active_leave(db_session, user, hours=3)
        teacher = _make_teacher(db_session, class_info_id=cls.id)
        resp = client.post(
            f"/api/leave/{a.id}/cancel", headers=_teacher_headers(teacher)
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["status"] == "cancelled"

    def test_teacher_cancel_nonexistent(self, client, db_session, mock_publish):
        teacher = _make_teacher(db_session)
        resp = client.post(
            "/api/leave/999999/cancel", headers=_teacher_headers(teacher)
        )
        assert resp.status_code == 404
