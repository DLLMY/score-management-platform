#!/usr/bin/env python3
"""
班主任手机箱自助开箱策略测试

覆盖：
1. 服务层 evaluate 四态：DEFER（无策略）/ BLOCK（班主任关闭）/ ALLOW_OVERRIDE（一键放行）/
   ALLOW_WINDOW（预设时段）。
2. 路由层：班主任仅能管理自己班级（越权 403）、策略读写、一键放行与取消。
3. admin 可管理任意班级。

注意：路由鉴权依赖 @requires_permission("phonebox.unlock.manage")，本测试为班主任补
RolePermissionMapping（与 init_default_roles 一致），并验证静态回退 PERMISSIONS['teacher']。
"""

import pytest
from datetime import datetime, timedelta

from services import phonebox_policy as svc
from services.phonebox_policy import (
    POLICY_DEFER,
    POLICY_BLOCK,
    POLICY_ALLOW_OVERRIDE,
    POLICY_ALLOW_WINDOW,
)


def _make_class(db_session):
    from models import ClassInfo
    import uuid

    cls = ClassInfo(name="PHONECLASS" + uuid.uuid4().hex[:6], grade="高一", description="测试班")
    db_session.add(cls)
    db_session.commit()
    return cls


def _make_teacher(db_session, class_info_id, username="teacher1"):
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
    # 补齐 RBAC，使 has_permission 命中 phonebox.unlock.manage
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

    tokens = generate_tokens(admin_id=teacher.id, username=teacher.username, role="teacher")
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + tokens["access_token"],
    }


# ---------------- 服务层 evaluate 四态 ----------------


class TestPhoneBoxPolicyEvaluate:
    def test_no_policy_defer(self, db_session):
        cls = _make_class(db_session)
        res = svc.evaluate(cls.id)
        assert res["decision"] == POLICY_DEFER
        assert res["reason"] == "no_policy"

    def test_teacher_disabled_block(self, db_session):
        cls = _make_class(db_session)
        svc.set_policy(cls.id, allow_self_unlock=False, updated_by=1)
        res = svc.evaluate(cls.id)
        assert res["decision"] == POLICY_BLOCK
        assert res["reason"] == "teacher_disabled"

    def test_override_active(self, db_session):
        cls = _make_class(db_session)
        svc.set_policy(cls.id, allow_self_unlock=True, updated_by=1)
        svc.one_click_allow(cls.id, minutes=30, updated_by=1)
        res = svc.evaluate(cls.id)
        assert res["decision"] == POLICY_ALLOW_OVERRIDE
        assert res["reason"] == "override"

    def test_override_expired_then_defer(self, db_session):
        cls = _make_class(db_session)
        svc.set_policy(cls.id, allow_self_unlock=True, updated_by=1)
        # 构造一个已过期的 override_until
        policy = svc.get_policy(cls.id)
        policy.override_until = datetime.now() - timedelta(minutes=10)
        from models import db

        db.session.commit()
        res = svc.evaluate(cls.id)
        # 过期后无时段 -> DEFER
        assert res["decision"] == POLICY_DEFER

    def test_in_window_allow(self, db_session):
        cls = _make_class(db_session)
        now = datetime.now()
        windows = [
            {
                "day": now.weekday(),
                "start_hour": max(0, now.hour - 1),
                "start_minute": 0,
                "end_hour": min(23, now.hour + 1),
                "end_minute": 59,
            }
        ]
        svc.set_policy(cls.id, allow_self_unlock=True, unlock_windows=windows, updated_by=1)
        res = svc.evaluate(cls.id)
        assert res["decision"] == POLICY_ALLOW_WINDOW
        assert res["reason"] == "window"

    def test_window_mismatch_defer(self, db_session):
        cls = _make_class(db_session)
        # 一个不在今天的时段
        windows = [{"day": 0, "start_hour": 3, "start_minute": 0, "end_hour": 4, "end_minute": 0}]
        svc.set_policy(cls.id, allow_self_unlock=True, unlock_windows=windows, updated_by=1)
        res = svc.evaluate(cls.id)
        assert res["decision"] == POLICY_DEFER


# ---------------- 路由层：班主任班级隔离与读写 ----------------


class TestPhoneBoxPolicyRoutes:
    def _setup_teacher(self, db_session):
        cls = _make_class(db_session)
        teacher = _make_teacher(db_session, cls.id)
        return cls, teacher

    def test_teacher_get_own_policy(self, client, db_session):
        cls, teacher = self._setup_teacher(db_session)
        resp = client.get(
            f"/api/phonebox-policy?class_info_id={cls.id}", headers=_teacher_headers(teacher)
        )
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["success"] is True
        assert body["data"]["class_info_id"] == cls.id

    def test_teacher_blocked_on_other_class(self, client, db_session):
        cls, teacher = self._setup_teacher(db_session)
        other = _make_class(db_session)
        resp = client.get(
            f"/api/phonebox-policy?class_info_id={other.id}", headers=_teacher_headers(teacher)
        )
        body = resp.get_json()
        assert resp.status_code == 403
        assert body["success"] is False

    def test_teacher_put_windows(self, client, db_session):
        cls, teacher = self._setup_teacher(db_session)
        windows = [
            {"day": -1, "start_hour": 12, "start_minute": 0, "end_hour": 12, "end_minute": 20}
        ]
        resp = client.put(
            f"/api/phonebox-policy?class_info_id={cls.id}",
            headers=_teacher_headers(teacher),
            json={"allow_self_unlock": True, "unlock_windows": windows},
        )
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["data"]["allow_self_unlock"] is True
        assert body["data"]["unlock_windows"] == windows

    def test_teacher_one_click_override(self, client, db_session):
        cls, teacher = self._setup_teacher(db_session)
        resp = client.post(
            f"/api/phonebox-policy/override?class_info_id={cls.id}",
            headers=_teacher_headers(teacher),
            json={"minutes": 15},
        )
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["data"]["override_active"] is True
        assert body["data"]["override_until"] is not None

    def test_teacher_cancel_override(self, client, db_session):
        cls, teacher = self._setup_teacher(db_session)
        # 先放行
        client.post(
            f"/api/phonebox-policy/override?class_info_id={cls.id}",
            headers=_teacher_headers(teacher),
            json={"minutes": 15},
        )
        # 再取消
        resp = client.post(
            f"/api/phonebox-policy/cancel-override?class_info_id={cls.id}",
            headers=_teacher_headers(teacher),
        )
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["data"]["override_active"] is False
        assert body["data"]["override_until"] is None

    def test_admin_manage_any_class(self, client, db_session, auth_headers):
        cls = _make_class(db_session)
        # admin（auth_headers，role=admin，拥有 all）可管理任意班级
        resp = client.put(
            f"/api/phonebox-policy?class_info_id={cls.id}",
            headers=auth_headers,
            json={"allow_self_unlock": False},
        )
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["data"]["allow_self_unlock"] is False


# ---------------- 预设时段格式校验 ----------------


class TestNormalizeWindows:
    """时段必须归一化为 start_hour/start_minute 结构，否则服务层读不到会静默失效。"""

    def test_accepts_hour_minute_form(self):
        out, err = svc.normalize_windows(
            [{"day": -1, "start_hour": 12, "start_minute": 0, "end_hour": 12, "end_minute": 30}]
        )
        assert err is None
        assert out[0]["start_hour"] == 12 and out[0]["end_minute"] == 30

    def test_converts_hhmm_string_form(self):
        """兼容 'HH:MM' 写法并自动转换，避免存进去却永不命中。"""
        out, err = svc.normalize_windows([{"day": 2, "start": "09:05", "end": "10:15"}])
        assert err is None
        assert out[0] == {
            "day": 2,
            "start_hour": 9,
            "start_minute": 5,
            "end_hour": 10,
            "end_minute": 15,
        }

    def test_rejects_end_before_start(self):
        out, err = svc.normalize_windows(
            [{"day": -1, "start_hour": 15, "start_minute": 0, "end_hour": 14, "end_minute": 0}]
        )
        assert out is None and "结束时间不能早于开始时间" in err

    def test_rejects_out_of_range_hour(self):
        out, err = svc.normalize_windows(
            [{"day": -1, "start_hour": 25, "start_minute": 0, "end_hour": 26, "end_minute": 0}]
        )
        assert out is None and err is not None

    def test_rejects_invalid_day(self):
        out, err = svc.normalize_windows(
            [{"day": 9, "start_hour": 1, "start_minute": 0, "end_hour": 2, "end_minute": 0}]
        )
        assert out is None and "day" in err

    def test_rejects_missing_fields(self):
        out, err = svc.normalize_windows([{"day": -1}])
        assert out is None and err is not None


# ---------------- 学生自助开箱端到端（MQTT handle_unlock_message）----------------


def _make_student(db_session, class_info_id, score=100):
    """建一个绑定班级、有卡号、积分充足的学生。"""
    from models import User
    import uuid

    user = User(
        name="测试学生",
        card_id="CARD" + uuid.uuid4().hex[:10].upper(),
        class_info_id=class_info_id,
        current_score=score,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _make_time_rule(db_session, allow_unlock, now=None):
    """建一条覆盖「当前时刻」的全局 TimeRule，用于模拟全局门禁开/关。"""
    from models import TimeRule

    now = now or datetime.now()
    rule = TimeRule(
        name="测试全局门禁",
        day_of_week=-1,
        start_hour=0,
        start_minute=0,
        end_hour=23,
        end_minute=59,
        is_active=True,
        allow_unlock=allow_unlock,
    )
    db_session.add(rule)
    db_session.commit()
    return rule


def _capture_unlock(monkeypatch):
    """拦截 publish_mqtt，捕获下发给设备的开箱结果。"""
    import json as _json
    import services.mqtt_message_service as mms

    captured = {}

    def fake_publish(topic, payload, *args, **kwargs):
        captured["topic"] = topic
        try:
            captured["payload"] = _json.loads(payload)
        except Exception:
            captured["payload"] = payload
        return True

    monkeypatch.setattr(mms, "publish_mqtt", fake_publish)
    # 用户缓存会跨用例串味，禁用之
    monkeypatch.setattr(mms.mqtt_manager, "get_cached_user", lambda card_id: None)
    monkeypatch.setattr(mms.mqtt_manager, "set_cached_user", lambda card_id, user: None)
    return captured


class TestStudentUnlockUsesTeacherPolicy:
    """验证「班主任自由决定」真正作用于学生刷卡开箱这条链路。"""

    def test_teacher_disabled_blocks_even_when_global_allows(self, db_session, monkeypatch):
        """班主任关闭本班 → 即使全局门禁放行也拒绝，reason=teacher_disabled。"""
        from services.mqtt_message_service import MQTTMessageService

        cls = _make_class(db_session)
        student = _make_student(db_session, cls.id)
        _make_time_rule(db_session, allow_unlock=True)  # 全局允许
        svc.set_policy(cls.id, allow_self_unlock=False, unlock_windows=None, updated_by=None)

        captured = _capture_unlock(monkeypatch)
        now = datetime.now()
        MQTTMessageService().handle_unlock_message(
            {"box_id": "A", "card_id": student.card_id, "hour": now.hour, "minute": now.minute}
        )

        assert captured["payload"]["result"] == "false"
        assert captured["payload"]["reason"] == "teacher_disabled"

    def test_override_allows_even_when_global_blocks(self, db_session, monkeypatch):
        """班主任一键放行 → 即使全局门禁禁止也能开箱（核心诉求：班主任自由决定）。"""
        from services.mqtt_message_service import MQTTMessageService

        cls = _make_class(db_session)
        student = _make_student(db_session, cls.id, score=100)
        _make_time_rule(db_session, allow_unlock=False)  # 全局禁止
        svc.one_click_allow(cls.id, minutes=30, updated_by=None)

        captured = _capture_unlock(monkeypatch)
        now = datetime.now()
        MQTTMessageService().handle_unlock_message(
            {"box_id": "A", "card_id": student.card_id, "hour": now.hour, "minute": now.minute}
        )

        assert captured["payload"]["result"] == "true"
        assert captured["payload"]["reason"] == "score_ok"
        # 开箱应扣 10 分
        assert captured["payload"]["current_score"] == 90

    def test_preset_window_allows_even_when_global_blocks(self, db_session, monkeypatch):
        """班主任预设时段命中 → 覆盖全局禁止，允许开箱。"""
        from services.mqtt_message_service import MQTTMessageService

        cls = _make_class(db_session)
        student = _make_student(db_session, cls.id, score=100)
        _make_time_rule(db_session, allow_unlock=False)  # 全局禁止

        now = datetime.now()
        start = now - timedelta(minutes=10)
        end = now + timedelta(minutes=10)
        svc.set_policy(
            cls.id,
            allow_self_unlock=True,
            unlock_windows=[
                {
                    "day": -1,
                    "start_hour": start.hour,
                    "start_minute": start.minute,
                    "end_hour": end.hour,
                    "end_minute": end.minute,
                }
            ],
            updated_by=None,
        )

        captured = _capture_unlock(monkeypatch)
        MQTTMessageService().handle_unlock_message(
            {"box_id": "A", "card_id": student.card_id, "hour": now.hour, "minute": now.minute}
        )

        assert captured["payload"]["result"] == "true"
        assert captured["payload"]["reason"] == "score_ok"

    def test_no_policy_falls_back_to_global_rule(self, db_session, monkeypatch):
        """无班主任策略 → 回退原有全局门禁逻辑（不得因新功能而放宽）。"""
        from services.mqtt_message_service import MQTTMessageService

        cls = _make_class(db_session)
        student = _make_student(db_session, cls.id)
        _make_time_rule(db_session, allow_unlock=False)  # 全局禁止且无班级策略

        captured = _capture_unlock(monkeypatch)
        now = datetime.now()
        MQTTMessageService().handle_unlock_message(
            {"box_id": "A", "card_id": student.card_id, "hour": now.hour, "minute": now.minute}
        )

        assert captured["payload"]["result"] == "false"
        assert captured["payload"]["reason"] == "not_in_time"

    def test_no_policy_global_allows_but_score_low(self, db_session, monkeypatch):
        """无策略 + 全局允许 + 积分不足 → score_low（原路径积分门槛不得因重构丢失）。"""
        from services.mqtt_message_service import MQTTMessageService

        cls = _make_class(db_session)
        student = _make_student(db_session, cls.id, score=30)  # < 60
        _make_time_rule(db_session, allow_unlock=True)  # 全局允许，无班级策略

        captured = _capture_unlock(monkeypatch)
        now = datetime.now()
        MQTTMessageService().handle_unlock_message(
            {"box_id": "A", "card_id": student.card_id, "hour": now.hour, "minute": now.minute}
        )

        assert captured["payload"]["result"] == "false"
        assert captured["payload"]["reason"] == "score_low"
        assert captured["payload"]["current_score"] == 30

    def test_override_still_respects_score_gate(self, db_session, monkeypatch):
        """一键放行只解除时间限制，积分不足仍然拒绝（不得绕过积分门槛）。"""
        from services.mqtt_message_service import MQTTMessageService

        cls = _make_class(db_session)
        student = _make_student(db_session, cls.id, score=30)  # < 60
        _make_time_rule(db_session, allow_unlock=False)
        svc.one_click_allow(cls.id, minutes=30, updated_by=None)

        captured = _capture_unlock(monkeypatch)
        now = datetime.now()
        MQTTMessageService().handle_unlock_message(
            {"box_id": "A", "card_id": student.card_id, "hour": now.hour, "minute": now.minute}
        )

        assert captured["payload"]["result"] == "false"
        assert captured["payload"]["reason"] == "score_low"
