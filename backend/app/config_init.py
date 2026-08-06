import os
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
    """验证密钥安全性"""
    secret_key = app.config.get("SECRET_KEY", "")
    jwt_secret = os.getenv("JWT_SECRET_KEY", "")

    validation_errors = []

    if secret_key == "your_secret_key_here_change_in_production":
        validation_errors.append("SECRET_KEY 使用了默认值")

    if len(secret_key) < 32:
        validation_errors.append(f"SECRET_KEY 长度不足32位（当前{len(secret_key)}位）")

    if not jwt_secret or len(jwt_secret) < 32:
        validation_errors.append("JWT_SECRET_KEY 未设置或长度不足")

    if validation_errors:
        print("\n" + "=" * 60)
        print("🔒 密钥安全检查结果")
        print("=" * 60)
        for error in validation_errors:
            print(f"  ❌ {error}")
        if app.config.get("ENV") == "production":
            print("  ⚠️  生产环境下请确保所有密钥都已正确设置")
        print("=" * 60 + "\n")

    return len(validation_errors) == 0


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

    from utils.config_validator import validate_config

    validate_config()

    return app
