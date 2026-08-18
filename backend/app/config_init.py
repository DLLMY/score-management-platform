import os
import sys
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flask_cors import CORS
from flasgger import Swagger, LazyString, LazyJSONEncoder
from dotenv import load_dotenv

from config import config

_swagger_initialized = False


def validate_secret_keys(app):
    """验证密钥安全性；生产环境下无效密钥将拒绝启动（S1 硬失败）。"""
    secret_key = app.config.get("SECRET_KEY", "")
    jwt_secret = os.getenv("JWT_SECRET_KEY", "")
    flask_env = os.getenv("FLASK_ENV", app.config.get("ENV", "development")).lower()
    is_production = flask_env == "production"

    validation_errors = []
    DEFAULT_SECRET = "your_secret_key_here_change_in_production"
    DEFAULT_JWT = "CHANGE_ME_JWT_SECRET_0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p"

    if not secret_key or secret_key == DEFAULT_SECRET or len(secret_key) < 32:
        validation_errors.append("FLASK_SECRET_KEY 缺失 / 使用默认值 / 长度不足32位")
    if not jwt_secret or jwt_secret == DEFAULT_JWT or len(jwt_secret) < 32:
        validation_errors.append("JWT_SECRET_KEY 缺失 / 使用默认值 / 长度不足32位")

    if validation_errors:
        print("\n" + "=" * 60)
        print("🔒 密钥安全检查结果")
        print("=" * 60)
        for error in validation_errors:
            print(f"  ❌ {error}")
        if is_production:
            print("  🚨 生产环境下密钥校验失败，拒绝启动！")
            print("     请设置 FLASK_SECRET_KEY 与 JWT_SECRET_KEY（均 >=32 位）后再部署。")
            print("=" * 60 + "\n")
            sys.exit(1)
        else:
            print("  ⚠️  非生产环境仅警告（开发 / 测试可继续使用当前密钥）")
        print("=" * 60 + "\n")

    return len(validation_errors) == 0


def _current_flask_env(app):
    return os.getenv("FLASK_ENV", app.config.get("ENV", "development")).lower()


def _check_rbac_consistency(app):
    """M3: 非致命 RBAC 一致性启动检查。

    通过 importlib 加载 scripts/verify_rbac_consistency.py 的 run_check()，
    在应用启动时快速校验 RBAC 权限目录 / 角色 / 映射是否一致。
    生产环境发现问题仅告警（不阻断启动）；其余情况静默跳过。
    """
    try:
        import importlib.util

        basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        script_path = os.path.join(basedir, "scripts", "verify_rbac_consistency.py")
        if not os.path.exists(script_path):
            return
        spec = importlib.util.spec_from_file_location("verify_rbac_consistency", script_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        if not hasattr(mod, "run_check"):
            return
        _issues, _infos, code = mod.run_check(check_only=True, apply=False)
        if code == 0:
            print("[启动检查] RBAC 一致性 OK")
            return
        print("⚠️  [启动检查] RBAC 一致性存在问题（非致命，服务继续启动）：")
        for i in _issues:
            print(f"   - {i}")
        if _current_flask_env(app) == "production":
            print("   🚨 生产环境建议先修复 RBAC 不一致再上线")
    except Exception as e:  # 启动检查本身失败绝不应阻断服务启动
        print(f"[启动检查] RBAC 检查跳过（异常：{e}）")


def _check_redis_connectivity(app):
    """R1: 非致命 Redis 启动连通性检查。

    探测 Redis 是否可达；redis 客户端库未安装或实例不可达时仅告警并降级为内存缓存，
    绝不阻断启动。生产环境下 Redis 不可达会显著告警以引起重视。
    """
    try:
        import redis  # noqa: F401
    except ImportError:
        print("[R1] ⚠️  redis 客户端库未安装，缓存降级为内存（非致命）")
        return
    try:
        host = os.getenv("REDIS_HOST", "localhost")
        port = int(os.getenv("REDIS_PORT", "6379"))
        db = int(os.getenv("REDIS_DB", "0"))
        pwd = os.getenv("REDIS_PASSWORD", "")
        url = f"redis://:{pwd}@{host}:{port}/{db}" if pwd else f"redis://{host}:{port}/{db}"
        r = redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        r.ping()
        print(f"[R1] Redis 连通性 OK ({url})")
    except Exception as e:
        msg = f"Redis 不可达（{e}），缓存降级为内存（非致命）"
        if _current_flask_env(app) == "production":
            print(f"[R1] 🚨 生产环境 {msg}")
        else:
            print(f"[R1] ⚠️  {msg}")


def init_config(app, lightweight=False):
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    load_dotenv(os.path.join(basedir, ".env"))

    if not lightweight:
        app.json_encoder = LazyJSONEncoder

    if not lightweight:
        swagger_template = {
            "swagger": "2.0",
            "info": {
                "title": "积分管理平台 API",
                "description": "积分管理平台的RESTful API文档，提供用户管理、积分规则、分类管理等功能",
                "version": "1.0.0",
                "contact": {"name": "开发团队", "email": "support@example.com"},
            },
            "host": LazyString(lambda: lambda: __import__("flask").request.host),
            "basePath": "/api",
            "schemes": LazyString(lambda: ["http", "https"] if __import__("flask").request.is_secure else ["http"]),
            "securityDefinitions": {
                "Bearer": {
                    "type": "apiKey",
                    "name": "Authorization",
                    "in": "header",
                    "description": "JWT令牌格式: Bearer {token}",
                },
                "X-Admin-Id": {"type": "apiKey", "name": "X-Admin-Id", "in": "header", "description": "管理员ID"},
            },
            "security": [{"Bearer": []}],
        }

        swagger_config = {
            "headers": [],
            "specs": [
                {
                    "endpoint": "api_spec",
                    "route": "/api/spec",
                    "rule_filter": lambda rule: True,
                    "model_filter": lambda tag: True,
                }
            ],
            "static_url_path": "/flasgger_static",
            "swagger_ui": True,
            "specs_route": "/swagger/",
        }

        global _swagger_initialized
        if not _swagger_initialized:
            Swagger(app, template=swagger_template, config=swagger_config)
            _swagger_initialized = True  # noqa: F841

        Compress(app)

        limiter = Limiter(
            get_remote_address,
            app=app,
            default_limits=[f"{config.RATE_LIMIT_PER_HOUR} per hour", f"{config.RATE_LIMIT_PER_MINUTE} per minute"],
            storage_uri="memory://",
        )
        app.limiter = limiter
    else:
        app.limiter = None

    app.config["COMPRESS_MIMETYPES"] = [
        "text/html",
        "text/css",
        "text/xml",
        "application/json",
        "application/javascript",
        "application/xml",
        "image/svg+xml",
    ]
    app.config["COMPRESS_LEVEL"] = 6
    app.config["COMPRESS_MIN_SIZE"] = 500

    os.makedirs(os.path.join(basedir, "instance"), exist_ok=True)
    os.makedirs(os.path.join(basedir, "backups"), exist_ok=True)

    app.config["SQLALCHEMY_DATABASE_URI"] = config.DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = config.SQLALCHEMY_TRACK_MODIFICATIONS
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = config.SQLALCHEMY_ENGINE_OPTIONS

    app.config["SECRET_KEY"] = config.FLASK_SECRET_KEY

    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH
    app.url_map.strict_slashes = False

    app.config["WTF_CSRF_ENABLED"] = config.WTF_CSRF_ENABLED
    app.config["WTF_CSRF_SECRET_KEY"] = config.CSRF_SECRET_KEY
    app.config["WTF_CSRF_TIME_LIMIT"] = config.WTF_CSRF_TIME_LIMIT
    app.config["WTF_CSRF_CHECK_DEFAULT"] = False

    CORS(
        app,
        supports_credentials=True,
        resources={r"/api/*": {"origins": config.CORS_ORIGINS}},
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Admin-Id", "X-CSRFToken", "X-Requested-With"],
        expose_headers=["X-Cache", "X-Cache-TTL", "X-RateLimit-Limit", "X-RateLimit-Remaining", "Set-Cookie"],
        max_age=86400,
    )

    csrf = CSRFProtect(app)
    app.csrf = csrf
    print(f"CSRF保护已 {'启用' if app.config.get('WTF_CSRF_ENABLED') else '禁用'}")

    app.csrf_exempt_views = set()

    app.config["csrf_instance"] = csrf
    app.config["limiter_instance"] = app.limiter

    validate_secret_keys(app)

    from utils.config_validator import validate_config

    config_ok = validate_config()
    if not config_ok and _current_flask_env(app) == "production":
        # M1: 生产环境下配置校验失败（error 级）拒绝启动
        print("🚨 生产环境配置校验失败，拒绝启动！详见上方配置验证报告。")
        sys.exit(1)
    elif not config_ok:
        print("⚠️  配置校验存在错误（非生产环境仅警告，服务继续启动）")

    # M3: 非致命 RBAC 一致性启动检查
    _check_rbac_consistency(app)

    # R1: 非致命 Redis 连通性检查
    _check_redis_connectivity(app)

    from utils.performance_monitor import PerformanceMiddleware, start_performance_logger

    PerformanceMiddleware(app)
    start_performance_logger()
    print("性能监控中间件已启用")

    from utils.security_middleware import SecurityMiddleware

    SecurityMiddleware(app)
    print("安全中间件已启用")

    from utils.api_cache_middleware import setup_cache_middleware

    setup_cache_middleware(app)
    print("API缓存中间件已启用")

    return app
