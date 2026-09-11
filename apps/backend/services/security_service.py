"""安全加固写入/事务路径薄封装（F17 防腐层：从 api/system/security_routes 收口）。

check_login_rate_limit / record_failed_login / clear_login_attempts 被
auth/student/admins/sub_accounts 跨模块导入，路由保留同名委托函数维持导入契约。
只读聚合（audit-stats / suspicious-ips 的 db.session.query 分组统计）留在路由。
"""

from datetime import datetime, timedelta

from flask import request

from models import db, SecurityAudit, RateLimitRecord, LoginAttempt


def check_login_rate_limit(username, ip_address, max_attempts=5, lockout_minutes=15):
    """检查登录频率限制，返回 (is_allowed, message, retry_after_seconds)。"""
    now = datetime.now()
    record = LoginAttempt.query.filter_by(username=username).first()

    if record and record.locked_until and record.locked_until > now:
        retry_after = int((record.locked_until - now).total_seconds())
        return False, "登录失败次数过多，账户已被锁定", retry_after

    if record and record.last_attempt_at:
        window_start = now - timedelta(minutes=lockout_minutes)
        if record.last_attempt_at < window_start:
            record.attempt_count = 1
            record.locked_until = None
            db.session.commit()

    return True, None, 0


def record_failed_login(username, ip_address, max_attempts=5, lockout_minutes=15):
    """记录失败的登录尝试。"""
    now = datetime.now()
    record = LoginAttempt.query.filter_by(username=username).first()

    if not record:
        record = LoginAttempt(
            username=username, ip_address=ip_address, attempt_count=1, last_attempt_at=now
        )
        db.session.add(record)
    else:
        record.attempt_count += 1
        record.last_attempt_at = now
        record.ip_address = ip_address
        if record.attempt_count >= max_attempts:
            record.locked_until = now + timedelta(minutes=lockout_minutes)

    db.session.commit()


def clear_login_attempts(username):
    """清除登录尝试记录（登录成功后调用）。"""
    LoginAttempt.query.filter_by(username=username).delete()
    db.session.commit()


def increment_rate_limit_request(record):
    """复刻 rate_limit 装饰器命中窗口内记录的自增 + commit。"""
    record.request_count += 1
    db.session.commit()


def create_rate_limit_record(ip_address, endpoint, now):
    """复刻 rate_limit 装饰器无记录分支的新建 + commit。"""
    new_record = RateLimitRecord(
        ip_address=ip_address, endpoint=endpoint, request_count=1, window_start=now
    )
    db.session.add(new_record)
    db.session.commit()


def log_security_event(
    event_type, severity="info", user_id=None, user_type="unknown", details=None
):
    """记录安全审计日志（失败回滚防脏 session 污染后续请求）。"""
    try:
        audit = SecurityAudit(
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            user_type=user_type,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", "")[:500],
            request_path=request.path,
            request_method=request.method,
            response_status=None,
            event_details=details,
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        db.session.rollback()  # 失败回滚，防脏 session 污染后续请求


def clear_rate_limit_records(ip):
    """复刻 ClearRateLimit.delete 批量删除 + commit。返回删除条数。"""
    deleted = RateLimitRecord.query.filter_by(ip_address=ip).delete()
    db.session.commit()
    return deleted


def get_audit_stats():
    """安全审计统计聚合（薄路由收尾）。

    原 security_routes 内联 db.session.query 分组统计已整体下沉，响应结构逐字节不变。
    """
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())

    last_24h = today_start - timedelta(hours=24)
    last_7d = today_start - timedelta(days=7)

    stats = {
        "total": SecurityAudit.query.count(),
        "last_24h": SecurityAudit.query.filter(SecurityAudit.created_at >= last_24h).count(),
        "last_7d": SecurityAudit.query.filter(SecurityAudit.created_at >= last_7d).count(),
        "by_severity": {},
        "by_type": {},
        "top_ips": [],
    }

    severity_counts = (
        db.session.query(SecurityAudit.severity, db.func.count(SecurityAudit.id))
        .group_by(SecurityAudit.severity)
        .all()
    )

    for severity, count in severity_counts:
        stats["by_severity"][severity] = count

    type_counts = (
        db.session.query(SecurityAudit.event_type, db.func.count(SecurityAudit.id))
        .filter(SecurityAudit.created_at >= last_7d)
        .all()
    )

    for event_type, count in type_counts:
        stats["by_type"][event_type] = count

    top_ips = (
        db.session.query(
            SecurityAudit.ip_address, db.func.count(SecurityAudit.id).label("count")
        )
        .filter(
            SecurityAudit.created_at >= last_24h,
            SecurityAudit.severity.in_(["warning", "error", "critical"]),
        )
        .filter(
            SecurityAudit.created_at >= last_24h,
            SecurityAudit.severity.in_(["warning", "error", "critical"]),
        )
        .order_by(db.text("count DESC"))
        .limit(10)
        .all()
    )

    stats["top_ips"] = [{"ip": ip, "count": count} for ip, count in top_ips]

    return stats


def get_suspicious_ips(threshold, page, per_page):
    """基于访问频率/错误率识别可疑 IP（薄路由收尾）。

    原 security_routes SuspiciousIPs.get 内联 db.session.query 分页聚合已下沉，响应结构逐字节不变。
    """
    last_1h = datetime.now() - timedelta(hours=1)

    pagination = (
        db.session.query(
            SecurityAudit.ip_address,
            db.func.count(SecurityAudit.id).label("event_count"),
            db.func.count(db.func.nullif(SecurityAudit.response_status, 200)).label("error_count"),
        )
        .filter(SecurityAudit.created_at >= last_1h)
        .group_by(SecurityAudit.ip_address)
        .having(db.func.count(SecurityAudit.id) > threshold)
        .order_by(db.text("event_count DESC"))
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    suspicious_ips = pagination.items

    return {
        "ips": [
            {
                "ip_address": ip,
                "event_count": event_count,
                "error_count": error_count,
                "error_rate": (
                    round(error_count / event_count * 100, 1) if event_count > 0 else 0
                ),
            }
            for ip, event_count, error_count in suspicious_ips
        ],
        "total": pagination.total,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }
