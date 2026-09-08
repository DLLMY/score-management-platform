"""安全加固路由/助手行为测试（F17 防腐层迁移前后一致性基线）。

契约：
- check_login_rate_limit / record_failed_login / clear_login_attempts：跨模块助手
  （auth/student/admins/sub_accounts 导入），5 次失败锁定 → 窗口过期重置 → clear 后无记录
- DELETE /api/security/clear-rate-limit?ip=...  200，data.deleted，message "已清除 N 条记录"
- GET  /api/security/audit-logs                 200，返回 {"logs": [...]}
- log_security_event 落库 SecurityAudit

迁移核心契约：登录限流/审计落库由 services/security_service 逐字节复刻，
路由保留同名函数以维持跨模块导入契约。
"""

from datetime import datetime, timedelta

from models import LoginAttempt, SecurityAudit, db


def test_login_rate_limit_helpers(client, app):
    from api.system.security_routes import (
        check_login_rate_limit,
        record_failed_login,
        clear_login_attempts,
    )

    with app.app_context():
        for _ in range(5):
            record_failed_login("lockuser", "1.2.3.4")
        allowed, msg, retry_after = check_login_rate_limit("lockuser", "1.2.3.4")
        assert allowed is False
        assert "锁定" in msg
        assert retry_after > 0

        # 窗口过期且锁定已过期 → 重置计数并解锁
        rec = LoginAttempt.query.filter_by(username="lockuser").first()
        rec.last_attempt_at = datetime.now() - timedelta(minutes=30)
        rec.locked_until = datetime.now() - timedelta(minutes=1)
        db.session.commit()
        allowed, msg, retry_after = check_login_rate_limit("lockuser", "1.2.3.4")
        assert allowed is True

        # clear 后记录消失
        clear_login_attempts("lockuser")
        assert LoginAttempt.query.filter_by(username="lockuser").first() is None


def test_clear_rate_limit_endpoint(client, app, auth_headers):
    with app.app_context():
        resp = client.delete("/api/security/clear-rate-limit?ip=9.9.9.9", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert "deleted" in body["data"]
    assert "已清除" in body["message"]


def test_audit_logs_endpoint(client, app, auth_headers):
    with app.app_context():
        resp = client.get("/api/security/audit-logs", headers=auth_headers)
    assert resp.status_code == 200
    assert "logs" in resp.get_json()


def test_log_security_event_persists(client, app):
    from api.system.security_routes import log_security_event

    with app.app_context():
        log_security_event("test_event", "info", details="test-detail")
        assert SecurityAudit.query.filter_by(event_type="test_event").first() is not None
