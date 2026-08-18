from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from utils.rate_limit import RateLimitStrategy, get_rate_limit_config


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
    limiter = Limiter(
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
    return limiter


def configure_rate_limits(app, limiter):
    # F7 修复: 补 /api/student/login（学生登录此前完全不在限流名单）
    login_endpoints = ["/api/admins/login", "/api/auth/login", "/api/admins/refresh-token", "/api/student/login"]
    for rule in app.url_map.iter_rules():
        if rule.rule in login_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.LOGIN)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.LOGIN}")

    password_endpoints = ["/api/admins/change-password", "/api/admins/reset-password", "/api/admins/forgot-password"]
    for rule in app.url_map.iter_rules():
        if rule.rule in password_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.PASSWORD)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.PASSWORD}")

    device_write_endpoints = [
        "/api/devices",
        "/api/devices/<int:device_id>",
        "/api/devices/batch",
        "/api/devices/<int:device_id>/remote-control",
        "/api/devices/device/<int:device_id>/heartbeats",
    ]
    for rule in app.url_map.iter_rules():
        if rule.rule in device_write_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.CREATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")
        elif rule.rule in device_write_endpoints and ("PUT" in rule.methods or "DELETE" in rule.methods):
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.UPDATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.UPDATE}")

    rule_endpoints = ["/api/rules", "/api/rules/<int:rule_id>"]
    for rule in app.url_map.iter_rules():
        if rule.rule in rule_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.CREATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")
        elif rule.rule in rule_endpoints and ("PUT" in rule.methods or "DELETE" in rule.methods):
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.UPDATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.UPDATE}")

    approval_endpoints = ["/api/approvals", "/api/approvals/<int:approval_id>"]
    for rule in app.url_map.iter_rules():
        if rule.rule in approval_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.CREATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")

    user_endpoints = ["/api/users", "/api/users/<int:user_id>", "/api/users/batch"]
    for rule in app.url_map.iter_rules():
        if rule.rule in user_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.CREATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")
        elif rule.rule in user_endpoints and ("PUT" in rule.methods or "DELETE" in rule.methods):
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.UPDATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.UPDATE}")

    rbac_endpoints = [
        "/api/rbac/roles",
        "/api/rbac/roles/<int:role_id>",
        "/api/rbac/permissions",
        "/api/rbac/permissions/<int:perm_id>",
        "/api/rbac/admin-roles",
        "/api/rbac/admin-roles/<int:admin_id>",
    ]
    for rule in app.url_map.iter_rules():
        if rule.rule in rbac_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.CREATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")
        elif rule.rule in rbac_endpoints and ("PUT" in rule.methods or "DELETE" in rule.methods):
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.UPDATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.UPDATE}")

    upload_endpoints = ["/api/upload", "/api/firmware/upload"]
    for rule in app.url_map.iter_rules():
        if rule.rule in upload_endpoints and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.UPLOAD)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.UPLOAD}")

    export_endpoints = ["/api/users/export", "/api/records/export", "/api/devices/export"]
    for rule in app.url_map.iter_rules():
        if rule.rule in export_endpoints and "GET" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.EXPORT)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.EXPORT}")

    for rule in app.url_map.iter_rules():
        if rule.rule == "/api/records/score-entry" and "POST" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.CREATE)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.CREATE}")
        elif rule.rule == "/api/records/statistics" and "GET" in rule.methods:
            view_func = app.view_functions[rule.endpoint]
            limiter.limit(RateLimitStrategy.QUERY)(view_func)
            print(f"已为 {rule.rule} 添加限流: {RateLimitStrategy.QUERY}")

    print("全局限流规则配置完成")


def init_csrf(app, csrf_secret_key):
    csrf = CSRFProtect(app)
    print(f"CSRF保护已 {'启用' if app.config.get('WTF_CSRF_ENABLED') else '禁用'}")
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

            if rule.rule in exempt_rules:
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule == "/api/devices/<int:id>/remote-control":
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule == "/api/box/verify":
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule.startswith("/api/devices/device/") and rule.rule.endswith("/heartbeats"):
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule.startswith("/api/mqtt/"):
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
                if limiter:
                    limiter.exempt(view_func)
                    print(f"已为 {rule.rule} 添加限流豁免")
            elif rule.rule.startswith("/api/nlp/"):
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule.startswith("/api/scheduled_notify/") and (
                rule.rule.endswith("/trigger") or rule.rule.endswith("/cancel")
            ):
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule == "/api/remote_notify/test":
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
            elif rule.rule.startswith("/api/admin_notifications/"):
                csrf.exempt(view_func)
                print(f"已为 {rule.rule} 添加CSRF豁免")
