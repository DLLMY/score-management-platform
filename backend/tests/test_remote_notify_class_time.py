#!/usr/bin/env python3
"""
上课时间拦截 - 远程通知下发端点集成测试

覆盖 api/scores/remote_notify_routes.py 的 5 个下发端点：
/send、/broadcast、/send_to_device/<id>、/score_change、/test

验证：
1. 上课时间（全局 TimeRule 或按班级课表反查命中）下发被后端硬拦截（success=False）。
2. 拦截触发 notify_audit 落库（reason_code=GLOBAL_TIME_RULE / CLASS_IN_SESSION）。
3. 拥有 all 权限的管理员以 force_send=True 可绕过拦截（success=True，并写 FORCE 审计）。
"""

from services.class_time_checker import ClassTimeChecker
from models import NotifyAudit, Device, ClassInfo


def _patch_allow_blocked(
    monkeypatch, code="GLOBAL_TIME_RULE", message="当前处于上课时间（测试），系统自动通知已暂停"
):
    """强制 is_notification_allowed 返回拦截（非广播路径）。"""
    monkeypatch.setattr(
        ClassTimeChecker,
        "is_notification_allowed",
        lambda target_class_info_id=None, target_user_id=None, force_send=False: (
            False,
            message,
            code,
            {"name": "测试上课时段"},
        ),
    )


class TestRemoteNotifyClassTime:
    """远程通知 5 个端点在上课时间的拦截行为"""

    def test_send_blocked_during_class(self, app, client, auth_headers, monkeypatch):
        """/send：上课时间应拦截，并写 GLOBAL_TIME_RULE 审计。"""
        _patch_allow_blocked(monkeypatch, code="GLOBAL_TIME_RULE")
        resp = client.post(
            "/api/remote_notify/send",
            json={"text": "测试通知", "force_send": False},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["success"] is False
        assert "上课" in data["message"]

        with app.app_context():
            cnt = NotifyAudit.query.filter_by(reason_code="GLOBAL_TIME_RULE").count()
            assert cnt >= 1

    def test_send_allowed_with_force_send(self, app, client, auth_headers, monkeypatch):
        """/send：force_send=True 且 admin 拥有 all 权限 -> 放行并写 FORCE 审计。"""
        # 测试环境 MQTT broker 不可用：mock 发布成功，专注校验 force_send 放行与审计
        monkeypatch.setattr("api.scores.remote_notify_routes.publish_mqtt", lambda *a, **k: True)
        resp = client.post(
            "/api/remote_notify/send",
            json={"text": "强制通知", "force_send": True},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["success"] is True

        with app.app_context():
            cnt = NotifyAudit.query.filter_by(reason_code="FORCE").count()
            assert cnt >= 1

    def test_broadcast_blocked_during_class(self, app, client, auth_headers, monkeypatch):
        """/broadcast：广播路径走 is_broadcast_blocked，上课时间拦截并写 CLASS_IN_SESSION 审计。"""
        monkeypatch.setattr(
            ClassTimeChecker,
            "is_broadcast_blocked",
            lambda force_send=False: (
                True,
                "当前有班级正在上课，广播通知已暂停",
                "CLASS_IN_SESSION",
            ),
        )
        resp = client.post(
            "/api/remote_notify/broadcast",
            json={"text": "广播", "force_send": False},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["success"] is False
        assert "上课" in data["message"]

        with app.app_context():
            cnt = NotifyAudit.query.filter_by(reason_code="CLASS_IN_SESSION").count()
            assert cnt >= 1

    def test_send_to_device_blocked_by_class(
        self, app, client, auth_headers, monkeypatch, db_session
    ):
        """/send_to_device：按设备反查班级，该班上课 -> 拦截。"""
        cls = ClassInfo(name="拦截测试班", grade="高一")
        db_session.add(cls)
        db_session.commit()
        dev = Device(device_id="DEV_BLOCK_1", class_info_id=cls.id, name="设备1")
        db_session.add(dev)
        db_session.commit()

        monkeypatch.setattr(
            ClassTimeChecker,
            "is_notification_allowed",
            lambda target_class_info_id=None, target_user_id=None, force_send=False: (
                False,
                "拦截测试班正在上课，系统自动通知已暂停",
                "CLASS_IN_SESSION",
                {"class_name": "拦截测试班"},
            ),
        )
        resp = client.post(
            "/api/remote_notify/send_to_device/DEV_BLOCK_1",
            json={"text": "按设备下发", "force_send": False},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["success"] is False
        assert "上课" in data["message"]

    def test_score_change_blocked_during_class(self, app, client, auth_headers, monkeypatch):
        """/score_change：上课时间应拦截。"""
        _patch_allow_blocked(monkeypatch, code="GLOBAL_TIME_RULE")
        resp = client.post(
            "/api/remote_notify/score_change",
            json={
                "student_name": "张三",
                "score_change": -5,
                "reason": "违纪",
                "force_send": False,
            },
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["success"] is False
        assert "上课" in data["message"]

    def test_test_endpoint_blocked_when_force_false(self, app, client, auth_headers, monkeypatch):
        """/test：force_send=False 且上课时间 -> 拦截；默认 force_send=True 不在此测。"""
        _patch_allow_blocked(monkeypatch, code="GLOBAL_TIME_RULE")
        resp = client.post(
            "/api/remote_notify/test",
            json={"text": "测试", "force_send": False},
            headers=auth_headers,
        )
        data = resp.get_json()
        assert data["success"] is False
