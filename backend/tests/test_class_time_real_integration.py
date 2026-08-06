#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上课时间拦截 - 真实集成测试（B+C 闭环）

与 test_remote_notify_class_time.py 的区别：
    那组测试用 monkeypatch 直接替换 ClassTimeChecker 的方法，
    因此从未真正跑过「is_during_class_time() 读取数据库里的真实 TimeRule
    → is_notification_allowed / is_broadcast_blocked → 拦截 → 审计」这条完整链路。

本文件插入一条**真实覆盖当前时间**的 TimeRule，验证：
    1. GET /api/course-schedules/now 能反映 is_during_class_time=True（真实 TimeRule 生效）。
    2. 无 force_send 的广播下发被后端硬拦截（success=False + GLOBAL_TIME_RULE 审计落库）。
    3. super_admin 以 force_send=True 绕过拦截（success=True + FORCE 审计，且不写新的拦截审计）。
    4. 无 TimeRule 时同一端点正常放行（证明上面的拦截确实由该规则触发，而非其它因素）。

publish_mqtt 被 monkeypatch 为 no-op，使测试不依赖本地 MQTT broker。
"""
import pytest
from datetime import datetime

from models import TimeRule, NotifyAudit, db


@pytest.fixture
def blocking_time_rule(app):
    """插入一条覆盖当前时间的真实 TimeRule，测试后清理。"""
    now = datetime.now()
    rule = TimeRule(
        name="E2E上课时段_临时",
        description="真实集成测试用，自动清理",
        day_of_week=-1,  # 每天生效
        start_hour=max(0, now.hour - 1),
        start_minute=0,
        end_hour=min(23, now.hour + 1),
        end_minute=59,
        is_active=True,
        allow_unlock=False,
    )
    with app.app_context():
        db.session.add(rule)
        db.session.commit()
        rid = rule.id
    yield rid
    with app.app_context():
        r = TimeRule.query.get(rid)
        if r:
            db.session.delete(r)
            db.session.commit()


def _audit_count(app, reason_code):
    with app.app_context():
        return NotifyAudit.query.filter_by(reason_code=reason_code).count()


def test_real_global_block_and_force_send(app, client, auth_headers, blocking_time_rule, monkeypatch):
    """真实 TimeRule 触发全局拦截；force_send 逃生舱绕过并写 FORCE 审计。"""
    monkeypatch.setattr("api.scores.remote_notify_routes.publish_mqtt", lambda *a, **k: True)

    # 1) /now 端点应反映真实 TimeRule：is_during_class_time=True
    r = client.get("/api/course-schedules/now", headers=auth_headers)
    body = r.get_json()
    assert body["data"]["is_during_class_time"] is True, body

    # 2) 无 force_send 广播 -> 硬拦截 + GLOBAL_TIME_RULE 审计
    before_block = _audit_count(app, "GLOBAL_TIME_RULE")
    resp = client.post(
        "/api/remote_notify/broadcast",
        json={"text": "上课期间请勿打扰"},
        headers=auth_headers,
    )
    d = resp.get_json()
    assert d["success"] is False, d
    assert "上课" in d["message"], d
    assert _audit_count(app, "GLOBAL_TIME_RULE") == before_block + 1

    # 3) force_send=True（super_admin）→ 绕过拦截 + FORCE 审计，且不写新的拦截审计
    before_force = _audit_count(app, "FORCE")
    before_block2 = _audit_count(app, "GLOBAL_TIME_RULE")
    resp2 = client.post(
        "/api/remote_notify/broadcast",
        json={"text": "紧急情况强制广播", "force_send": True},
        headers=auth_headers,
    )
    d2 = resp2.get_json()
    assert d2["success"] is True, d2
    assert "上课" not in d2["message"], d2
    assert _audit_count(app, "FORCE") == before_force + 1
    assert _audit_count(app, "GLOBAL_TIME_RULE") == before_block2  # 强发不应产生新拦截审计


def test_no_block_when_no_rule(app, client, auth_headers, monkeypatch):
    """无 TimeRule 覆盖当前时间时，广播正常放行（证明拦截确由规则触发）。"""
    monkeypatch.setattr("api.scores.remote_notify_routes.publish_mqtt", lambda *a, **k: True)

    # 确认当前确实没有覆盖 now 的活跃 TimeRule（隔离环境保证）
    with app.app_context():
        from services.class_time_checker import ClassTimeChecker
        is_ct, _ = ClassTimeChecker.is_during_class_time()
        assert is_ct is False

    resp = client.post(
        "/api/remote_notify/broadcast",
        json={"text": "正常时段广播"},
        headers=auth_headers,
    )
    d = resp.get_json()
    assert d["success"] is True, d
