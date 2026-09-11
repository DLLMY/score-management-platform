from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models import db, SecurityAudit, RateLimitRecord
from services.security_service import (
    check_login_rate_limit as _service_check_login_rate_limit,
    record_failed_login as _service_record_failed_login,
    clear_login_attempts as _service_clear_login_attempts,
    increment_rate_limit_request,
    create_rate_limit_record,
    log_security_event as _service_log_security_event,
    clear_rate_limit_records,
    get_audit_stats,
    get_suspicious_ips,
)
from datetime import datetime, timedelta
from utils.permission import requires_permission
from utils.response import APIResponse
from utils.api_cache_middleware import cached_api, invalidate_cache
from utils.pagination import get_pagination
from utils.params import get_int_arg
from functools import wraps

import jwt
import hmac
import hashlib

ns_security = Namespace("security", description="安全加固相关操作")


def check_login_rate_limit(username, ip_address, max_attempts=5, lockout_minutes=15):
    """
    检查登录频率限制
    返回: (is_allowed, message, retry_after_seconds)
    （F17：落库委托 services.security_service，本函数保留以维持 auth/student/admins/sub_accounts 导入契约）
    """
    return _service_check_login_rate_limit(username, ip_address, max_attempts, lockout_minutes)


def record_failed_login(username, ip_address, max_attempts=5, lockout_minutes=15):
    """
    记录失败的登录尝试
    （F17：落库委托 services.security_service）
    """
    _service_record_failed_login(username, ip_address, max_attempts, lockout_minutes)


def clear_login_attempts(username):
    """
    清除登录尝试记录（登录成功后调用）
    （F17：落库委托 services.security_service）
    """
    _service_clear_login_attempts(username)


def verify_request_signature():
    """
    验证请求签名
    """

    def decorator(f):

        @wraps(f)
        def decorated_function(*args, **kwargs):
            signature = request.headers.get("X-Signature")
            timestamp = request.headers.get("X-Timestamp")

            if not signature or not timestamp:
                return APIResponse.error(message="缺少签名信息", status_code=401)

            try:
                timestamp_int = int(timestamp)
                if abs(datetime.now().timestamp() - timestamp_int) > 300:
                    log_security_event("invalid_signature", "warning", details="签名已过期")
                    return APIResponse.error(message="签名已过期", status_code=401)
            except ValueError:
                return APIResponse.error(message="无效的时间戳", status_code=401)

            secret_key = current_app.config.get("API_SECRET_KEY")
            if not secret_key:
                # 缺失 API_SECRET_KEY 时拒绝放行（fail-closed），禁止使用默认弱密钥
                log_security_event("invalid_signature", "warning", details="API_SECRET_KEY 未配置")
                raise RuntimeError("API_SECRET_KEY 未配置，签名验证无法安全执行")
            sign_string = f"{request.method}{request.path}{timestamp}{request.get_data()}"
            expected_signature = hmac.new(
                secret_key.encode(), sign_string.encode(), hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(signature, expected_signature):
                log_security_event("invalid_signature", "warning", details="签名验证失败")
                return APIResponse.error(message="签名验证失败", status_code=401)

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def rate_limit(max_requests=100, window_minutes=1):
    """
    请求频率限制装饰器
    """

    def decorator(f):

        @wraps(f)
        def decorated_function(*args, **kwargs):
            ip = request.remote_addr
            endpoint = request.endpoint or request.path
            now = datetime.now()
            window_start = now - timedelta(minutes=window_minutes)

            record = RateLimitRecord.query.filter_by(ip_address=ip, endpoint=endpoint).filter(
                RateLimitRecord.window_start >= window_start
            )

            if record:
                if record.request_count >= max_requests:
                    log_security_event("rate_limit_exceeded", "warning", details=f"{endpoint}")
                    return APIResponse.error(message="请求过于频繁，请稍后再试", status_code=429)

                increment_rate_limit_request(record)
            else:
                create_rate_limit_record(ip, endpoint, now)

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def log_security_event(
    event_type, severity="info", user_id=None, user_type="unknown", details=None
):
    """
    记录安全审计日志
    （F17：落库委托 services.security_service，本函数保留供本模块装饰器调用）
    """
    _service_log_security_event(event_type, severity, user_id, user_type, details)


def verify_token_expiry(token):
    """
    验证JWT令牌时效性
    """
    try:
        secret = current_app.config.get("SECRET_KEY")
        if not secret:
            # 缺失 SECRET_KEY 时拒绝解码（fail-closed），禁止使用默认弱密钥
            raise RuntimeError("SECRET_KEY 未配置，无法安全校验 JWT")
        payload = jwt.decode(token, secret, algorithms=["HS256"])

        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.now():
            return False, "令牌已过期"

        iat = payload.get("iat")
        if iat:
            age = datetime.now().timestamp() - iat
            max_age = current_app.config.get("TOKEN_MAX_AGE", 86400)
            if age > max_age:
                return False, "令牌已过期"

        return True, payload

    except jwt.ExpiredSignatureError:
        return False, "令牌已过期"
    except jwt.InvalidTokenError:
        return False, "无效的令牌"


security_audit_model = ns_security.model(
    "SecurityAudit",
    {
        "event_type": fields.String(description="事件类型"),
        "severity": fields.String(description="严重级别"),
        "start_date": fields.String(description="开始日期"),
        "end_date": fields.String(description="结束日期"),
        "user_id": fields.Integer(description="用户ID"),
    },
)


@ns_security.route("/audit-logs")
class SecurityAuditLogs(Resource):

    @ns_security.doc("get_security_audit_logs", description="获取安全审计日志")
    @ns_security.param("event_type", "事件类型")
    @ns_security.param("severity", "严重级别(info/warning/error/critical)")
    @ns_security.param("start_date", "开始日期")
    @ns_security.param("end_date", "结束日期")
    @ns_security.param("user_id", "用户ID")
    @ns_security.param("page", "页码")
    @ns_security.param("per_page", "每页数量")
    @ns_security.response(200, "成功")
    @requires_permission("system.settings")
    @cached_api(ttl=30)
    def get(self):
        """
        获取安全审计日志

        记录所有安全相关事件，包括登录失败、权限验证、异常访问等。
        """
        event_type = request.args.get("event_type")
        severity = request.args.get("severity")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        user_id = request.args.get("user_id")
        page, per_page = get_pagination(default=50)

        query = SecurityAudit.query
        if event_type:
            query = query.filter(SecurityAudit.event_type == event_type)
        if severity:
            query = query.filter(SecurityAudit.severity == severity)
        if start_date:
            query = query.filter(SecurityAudit.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(
                SecurityAudit.created_at <= datetime.fromisoformat(end_date) + timedelta(days=1)
            )
        if user_id:
            query = query.filter(SecurityAudit.user_id == int(user_id))

        pagination = query.order_by(SecurityAudit.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            "logs": [
                {
                    "id": log.id,
                    "event_type": log.event_type,
                    "severity": log.severity,
                    "user_id": log.user_id,
                    "user_type": log.user_type,
                    "ip_address": log.ip_address,
                    "request_path": log.request_path,
                    "request_method": log.request_method,
                    "event_details": log.event_details,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }


@ns_security.route("/audit-stats")
class SecurityAuditStats(Resource):

    @ns_security.doc("get_security_stats", description="获取安全统计")
    @ns_security.response(200, "成功")
    @requires_permission("system.settings")
    @cached_api(ttl=60)
    def get(self):
        """
        获取安全统计数据

        提供安全事件的统计概览。
        """
        return get_audit_stats()


@ns_security.route("/suspicious-ips")
class SuspiciousIPs(Resource):

    @ns_security.doc("get_suspicious_ips", description="获取可疑IP列表")
    @ns_security.response(200, "成功")
    @requires_permission("system.settings")
    @cached_api(ttl=30)
    def get(self):
        """
        获取可疑IP列表

        基于访问频率和错误率识别可疑IP。
        """
        threshold = get_int_arg("threshold", default=50)
        page, per_page = get_pagination(default=20)
        return get_suspicious_ips(threshold, page, per_page)


@ns_security.route("/rate-limit-status")
class RateLimitStatus(Resource):

    @ns_security.doc("get_rate_limit_status", description="获取限流状态")
    @ns_security.param("ip", "IP地址")
    @ns_security.response(200, "成功")
    @requires_permission("system.settings")
    @cached_api(ttl=30)
    def get(self):
        """
        获取IP的限流状态

        查看特定IP的请求频率和限流情况。
        """
        ip = request.args.get("ip")

        if not ip:
            ip = request.remote_addr

        now = datetime.now()
        window_start = now - timedelta(minutes=1)

        query = RateLimitRecord.query.filter(
            RateLimitRecord.ip_address == ip, RateLimitRecord.window_start >= window_start
        )
        total_requests = (
            query.with_entities(db.func.sum(RateLimitRecord.request_count)).scalar() or 0
        )
        page, per_page = get_pagination(default=20)
        pagination = query.order_by(RateLimitRecord.window_start.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        records = pagination.items

        return {
            "ip_address": ip,
            "endpoints": [
                {
                    "endpoint": r.endpoint,
                    "request_count": r.request_count,
                    "window_start": r.window_start.isoformat(),
                }
                for r in records
            ],
            "total_requests": int(total_requests),
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
            },
        }


@ns_security.route("/clear-rate-limit")
class ClearRateLimit(Resource):

    @ns_security.doc("clear_rate_limit", description="清除IP限流记录")
    @ns_security.param("ip", "IP地址")
    @ns_security.response(200, "成功")
    @requires_permission("system.settings")
    def delete(self, ip=None):
        """
        清除IP的限流记录

        手动清除特定IP的限流状态。
        """
        ip = ip or request.args.get("ip")

        if not ip:
            return APIResponse.error(message="请提供IP地址", status_code=400)

        deleted = clear_rate_limit_records(ip)
        invalidate_cache("api:/api/security/*")

        return APIResponse.success(data={"deleted": deleted}, message=f"已清除 {deleted} 条记录")


@ns_security.route("/verify-token")
class VerifyToken(Resource):

    @ns_security.doc("verify_token", description="验证JWT令牌")
    @ns_security.response(200, "成功")
    @ns_security.response(401, "令牌无效")
    @requires_permission("system.config")
    def post(self):
        """
        验证JWT令牌时效性

        检查令牌是否过期或无效。
        """
        data = request.get_json()
        token = data.get("token")

        if not token:
            return APIResponse.error(message="请提供令牌", status_code=400)

        is_valid, result = verify_token_expiry(token)

        if is_valid:
            return APIResponse.success(data={"valid": True, "payload": result})
        return APIResponse.error(message=result, status_code=401, valid=False)
