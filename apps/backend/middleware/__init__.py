from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from utils.rate_limit import RateLimitStrategy, get_rate_limit_config


from utils.logger import log_info


def init_cors(app):
    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                    "http://localhost:5000",
                    "http://127.0.0.1:5000",
                ]
            }
        },
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Admin-Id", "X-CSRFToken"],
    )


def init_limiter(app, redis_url):
    return Limiter(
        get_remote_address,
        app=app,
        default_limits=[
            get_rate_limit_config("daily", "5000 per day"),
            get_rate_limit_config("hourly", "1000 per hour"),
            get_rate_limit_config("minute", "60 per minute"),
        ],
        storage_uri=redis_url,
        key_prefix="rate_limit:",
    )


def _limit_methods(app, limiter, endpoints, method, strategy):
    """对匹配 endpoints 且含指定 HTTP 方法的路由应用单一限流策略。"""
    endpoint_set = set(endpoints)
    for rule in app.url_map.iter_rules():
        if rule.rule in endpoint_set and method in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(strategy)(view_func)
            log_info(f"已为 {rule.rule} 添加限流: {strategy}")


def _limit_write_endpoints(app, limiter, endpoints):
    """对匹配 endpoints 的路由：POST->CREATE，PUT/DELETE->UPDATE。"""
    endpoint_set = set(endpoints)
    for rule in app.url_map.iter_rules():
        if rule.rule in endpoint_set:
            view_func = app.view_functions[rule.endpoint]
            if "POST" in rule.methods:
                limiter.limit(RateLimitStrategy.CREATE)(view_func)
                log_info(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")
            elif "PUT" in rule.methods or "DELETE" in rule.methods:
                limiter.limit(RateLimitStrategy.UPDATE)(view_func)
                log_info(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.UPDATE}")


def configure_rate_limits(app, limiter):
    # F7 修复: 补 /api/student/login（学生登录此前完全不在限流名单）
    login_endpoints = [
        "/api/admins/login",
        "/api/auth/login",
        "/api/admins/refresh-token",
        "/api/student/login",
    ]
    _limit_methods(app, limiter, login_endpoints, "POST", RateLimitStrategy.LOGIN)

    password_endpoints = [
        "/api/admins/change-password",
        "/api/admins/reset-password",
        "/api/admins/forgot-password",
    ]
    _limit_methods(app, limiter, password_endpoints, "POST", RateLimitStrategy.PASSWORD)

    device_write_endpoints = [
        "/api/devices",
        "/api/devices/<int:device_id>",
        "/api/devices/batch",
        "/api/devices/<int:device_id>/remote-control",
        "/api/devices/device/<int:device_id>/heartbeats",
    ]
    _limit_write_endpoints(app, limiter, device_write_endpoints)

    rule_endpoints = ["/api/rules", "/api/rules/<int:rule_id>"]
    _limit_write_endpoints(app, limiter, rule_endpoints)

    approval_endpoints = ["/api/approvals", "/api/approvals/<int:approval_id>"]
    _limit_methods(app, limiter, approval_endpoints, "POST", RateLimitStrategy.CREATE)

    user_endpoints = ["/api/users", "/api/users/<int:user_id>", "/api/users/batch"]
    _limit_write_endpoints(app, limiter, user_endpoints)

    rbac_endpoints = [
        "/api/rbac/roles",
        "/api/rbac/roles/<int:role_id>",
        "/api/rbac/permissions",
        "/api/rbac/permissions/<int:perm_id>",
        "/api/rbac/admin-roles",
        "/api/rbac/admin-roles/<int:admin_id>",
    ]
    _limit_write_endpoints(app, limiter, rbac_endpoints)

    upload_endpoints = ["/api/upload", "/api/firmware/upload"]
    _limit_methods(app, limiter, upload_endpoints, "POST", RateLimitStrategy.UPLOAD)

    export_endpoints = ["/api/users/export", "/api/records/export", "/api/devices/export"]
    _limit_methods(app, limiter, export_endpoints, "GET", RateLimitStrategy.EXPORT)

    _limit_methods(app, limiter, ["/api/records/score-entry"], "POST", RateLimitStrategy.CREATE)
    _limit_methods(app, limiter, ["/api/records/statistics"], "GET", RateLimitStrategy.QUERY)

    log_info("全局限流规则配置完成")



def init_csrf(app, csrf_secret_key):
    csrf = CSRFProtect(app)
    log_info(f"CSRF保护已 {'启用' if app.config.get('WTF_CSRF_ENABLED') else '禁用'}")
    return csrf


def configure_csrf_exemptions(app, csrf, limiter):
    exempt_rules = [
        "/api/admins/login",
        "/api/admins/refresh-token",
        "/api/admins/csrf-token",
        "/api/auth/login",
        "/api/system/frontend-performance",
        "/api/system/frontend-performance/batch",
        "/api/system/frontend-error",
    ]

    for rule in app.url_map.iter_rules():
        if rule.endpoint in app.view_functions:
            view_func = app.view_functions[rule.endpoint]

            if rule.rule in exempt_rules or rule.rule == "/api/devices/<int:id>/remote-control" or rule.rule == "/api/box/verify" or rule.rule.startswith("/api/devices/device/") and rule.rule.endswith("/heartbeats"):
                csrf.exempt(view_func)
                log_info(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule.startswith("/api/mqtt/"):
                csrf.exempt(view_func)
                log_info(f"已为 {rule.rule} 添加CSRF豁免")
                if limiter:
                    limiter.exempt(view_func)
                    log_info(f"已为 {rule.rule} 添加限流豁免")
            elif rule.rule.startswith("/api/nlp/") or rule.rule.startswith("/api/scheduled_notify/") and (
                rule.rule.endswith("/trigger") or rule.rule.endswith("/cancel")
            ) or rule.rule == "/api/remote_notify/test" or rule.rule.startswith("/api/admin_notifications/"):
                csrf.exempt(view_func)
                log_info(f"已为 {rule.rule} 添加CSRF豁免")
