import os
import secrets
from datetime import timedelta
from dotenv import load_dotenv

"""
统一配置管理模块
"""


def _generate_secret_key() -> str:
    return secrets.token_hex(32)


basedir = os.path.abspath(os.path.dirname(__file__))
env = os.getenv("FLASK_ENV", "development").lower()
env_file = os.path.join(basedir, f".env.{env}")
if os.path.exists(env_file):
    load_dotenv(env_file)
load_dotenv(os.path.join(basedir, ".env"), override=False)


class Config:
    """
    统一配置类
    集中管理所有配置项，提供类型提示和默认值。
    所有配置应从此处读取或修改。
    """

    # ========== Flask应用配置 ==========
    FLASK_APP = os.getenv("FLASK_APP", "app.py")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", _generate_secret_key())
    FLASK_HOST = os.getenv("FLASK_HOST", "127.0.0.1")
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    # ========== 数据库配置 ==========
    _default_db_path = os.path.join(basedir, "instance", "score_management.db")
    _db_uri_from_env = os.getenv("DATABASE_URI")  # noqa: F841
    if _db_uri_from_env and _db_uri_from_env.startswith("sqlite:///"):
        _db_path = _db_uri_from_env.replace("sqlite:///", "")  # noqa: F841
        if not os.path.isabs(_db_path):
            _db_path = os.path.join(basedir, _db_path)  # noqa: F841
        DATABASE_URI = f"sqlite:///{_db_path}"
    else:
        DATABASE_URI = _db_uri_from_env or f"sqlite:///{_default_db_path}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {
            "timeout": 30,
            "check_same_thread": False,
            "detect_types": 0,
        },
        "pool_size": 20,
        "max_overflow": 40,
        "pool_timeout": 30,
        "pool_recycle": 1200,
        "pool_pre_ping": True,
        "echo": False,
        "execution_options": {
            "stream_results": False,
        },
    }
    SQLITE_CONFIG = {
        "journal_mode": "WAL",
        "cache_size": -100000,
        "temp_store": "memory",
        "mmap_size": 256 * 1024 * 1024,
        "synchronous": 1,
        "foreign_keys": 1,
        "busy_timeout": 5000,
        "locking_mode": "NORMAL",
    }
    # ========== Redis缓存配置 ==========
    # 统一使用 DB/0 作为主要缓存
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))  # 统一使用 DB 0
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

    @property
    def REDIS_URL(self) -> str:
        """构建Redis连接URL"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ========== Redis 自动拉起配置 ==========
    # 后端启动时若本机未运行 Redis，是否自动拉起一个本地 redis-server 子进程。
    # 仅对 localhost/127.0.0.1 生效；生产环境(env=production)默认关闭，开发环境默认开启。
    REDIS_AUTO_START = os.getenv(
        "REDIS_AUTO_START", "true" if env != "production" else "false"
    ).lower() == "true"
    # 自定义 redis-server 可执行文件路径；留空则按 项目根/redis/redis-server(.exe) →
    # C:\Redis\redis-server.exe → PATH 顺序自动探测。
    REDIS_SERVER_COMMAND = os.getenv("REDIS_SERVER_COMMAND", "")
    # 启动子进程最长等待就绪时间(秒)，超过则放弃并退回内存缓存。
    REDIS_AUTO_START_TIMEOUT = int(os.getenv("REDIS_AUTO_START_TIMEOUT", "15"))
    # 子进程日志输出路径；留空则丢弃(stdout/stderr → DEVNULL)。
    REDIS_SERVER_LOG = os.getenv("REDIS_SERVER_LOG", "")

    # ========== Celery任务队列配置 ==========
    # Celery使用与主应用相同的Redis实例，不同的DB (使用DB 1避免与缓存冲突)
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
    CELERY_TASK_SERIALIZER = "json"
    CELERY_RESULT_SERIALIZER = "json"
    CELERY_ACCEPT_CONTENT = ["json"]
    CELERY_TIMEZONE = "Asia/Shanghai"
    CELERY_ENABLE_UTC = True
    # Celery并发配置
    CELERY_WORKER_CONCURRENCY = int(os.getenv("CELERY_WORKER_CONCURRENCY", "4"))
    CELERY_WORKER_PREFETCH_MULTIPLIER = 1
    CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
    # Celery任务路由
    CELERY_TASK_QUEUES = {
        "mqtt": {
            "exchange": "mqtt",
            "exchange_type": "direct",
            "routing_key": "mqtt",
        },
        "export": {
            "exchange": "export",
            "exchange_type": "direct",
            "routing_key": "export",
        },
        "notification": {
            "exchange": "notification",
            "exchange_type": "direct",
            "routing_key": "notification",
        },
        "default": {
            "exchange": "default",
            "exchange_type": "direct",
            "routing_key": "default",
        },
    }
    CELERY_TASK_ROUTES = {
        "tasks.mqtt_tasks.*": {"queue": "mqtt"},
        "tasks.export_tasks.*": {"queue": "export"},
        "tasks.notification_tasks.*": {"queue": "notification"},
    }
    # Celery定时任务（Celery Beat）
    CELERY_BEAT_SCHEDULE = {
        "clean-expired-results": {
            "task": "tasks.scheduled_tasks.clean_expired_results",
            "schedule": timedelta(hours=24),
            "options": {"queue": "default"},
        },
        "sync-device-status": {
            "task": "tasks.scheduled_tasks.sync_device_status",
            "schedule": timedelta(minutes=5),
            "options": {"queue": "mqtt"},
        },
        "health-check": {
            "task": "tasks.scheduled_tasks.health_check",
            "schedule": timedelta(hours=1),
            "options": {"queue": "default"},
        },
        "daily-summary": {
            "task": "tasks.scheduled_tasks.daily_summary",
            "schedule": timedelta(days=1),
            "options": {"queue": "export"},
        },
        "clean-api-cache": {
            "task": "tasks.scheduled_tasks.clean_api_cache",
            "schedule": timedelta(minutes=10),
            "options": {"queue": "default"},
        },
        "warmup-cache": {
            "task": "tasks.scheduled_tasks.warmup_cache_task",
            "schedule": timedelta(minutes=30),
            "options": {"queue": "default"},
        },
    }
    CELERY_BEAT_SCHEDULER = "celery.beat:PersistentScheduler"
    CELERY_BEAT_SCHEDULE_FILENAME = "celerybeat-schedule"
    # Celery任务重试配置
    CELERY_TASK_DEFAULT_RETRY_DELAY = 30
    CELERY_TASK_MAX_RETRIES = 3
    CELERY_TASK_ACKS_LATE = True
    CELERY_TASK_REJECT_ON_WORKER_LOST = True
    # Celery任务时间限制
    CELERY_TASK_TIME_LIMIT = 300  # 5分钟
    CELERY_TASK_SOFT_TIME_LIMIT = 240  # 4分钟
    # ========== MQTT配置 ==========
    MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
    MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
    MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "score_backend")
    MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
    MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
    MQTT_SSL = os.getenv("MQTT_SSL", "false").lower() == "true"
    MQTT_TIMEOUT = int(os.getenv("MQTT_TIMEOUT", "10"))
    MQTT_KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))
    MQTT_TOPIC_PREFIX = os.getenv("MQTT_TOPIC_PREFIX", "score/management")
    MQTT_TRANSPORT = os.getenv("MQTT_TRANSPORT", "tcp")
    # ========== JWT认证配置 ==========
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", _generate_secret_key())
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "3600"))
    JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", "604800"))
    JWT_ALGORITHM = "HS256"
    # ========== CSRF安全配置 ==========
    CSRF_SECRET_KEY = os.getenv("CSRF_SECRET_KEY", JWT_SECRET_KEY)
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600
    CSRF_TOKEN_LENGTH = 32
    # ========== 限流配置 ==========
    RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
    RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", "1000"))
    # 开发环境放宽限流
    if FLASK_ENV == "development":
        RATE_LIMIT_PER_MINUTE = 200
        RATE_LIMIT_PER_HOUR = 5000
    # ========== CORS配置 ==========
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(", ")
    # ========== 安全配置 ==========
    PASSWORD_MIN_LENGTH = 6
    PASSWORD_MAX_LENGTH = 128
    PASSWORD_REQUIRE_UPPERCASE = True
    PASSWORD_REQUIRE_LOWERCASE = True
    PASSWORD_REQUIRE_DIGIT = True
    PASSWORD_REQUIRE_SPECIAL = False
    SESSION_COOKIE_SECURE = FLASK_ENV == "production"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    # ========== 备份配置 ==========
    BACKUP_ENABLED = os.getenv("BACKUP_ENABLED", "false").lower() == "true"
    BACKUP_INTERVAL_HOURS = int(os.getenv("BACKUP_INTERVAL_HOURS", "24"))
    BACKUP_MAX_COUNT = int(os.getenv("BACKUP_MAX_COUNT", "10"))
    BACKUP_DIR = os.path.join(basedir, "backups")
    # ========== 日志配置 ==========
    LOG_DIR = os.path.join(basedir, "logs")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_MAX_BYTES = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT = 30
    # ========== 缓存TTL配置（秒） ==========
    CACHE_TTL = {
        "user": 1800,  # 用户信息 30分钟
        "device": 300,  # 设备状态 5分钟
        "rule": 3600,  # 积分规则 1小时
        "stats": 600,  # 统计数据 10分钟
        "record": 60,  # 积分记录 1分钟
        "notification": 30,  # 通知 30秒
        "default": 300,  # 默认 5分钟
        "dashboard": 120,  # Dashboard 2分钟
        "leaderboard": 300,  # 排行榜 5分钟
        "device_status": 60,  # 设备状态 1分钟
        "users": 180,  # 用户列表 3分钟
        "classes": 300,  # 班级列表 5分钟
        "categories": 3600,  # 分类 1小时
        "operation_logs": 60,  # 操作日志 1分钟
        "approvals": 60,  # 审批 1分钟
        "system_config": 3600,  # 系统配置 1小时
        "mqtt_config": 300,  # MQTT配置 5分钟
        "etag": 7200,  # ETag缓存 2小时
        "statistics": 3600,  # 统计数据 1小时
        "cluster": 7200,  # 聚类结果 2小时
        "composite_score": 7200,  # 综合评分 2小时
        "warning": 1800,  # 预警 30分钟
    }
    # ========== API缓存TTL配置（秒） ==========
    API_CACHE_TTL = {
        "/api/users": 60,  # 用户列表 60秒
        "/api/devices": 5,  # 设备列表 5秒
        "/api/rules": 300,  # 规则列表 5分钟
        "/api/categories": 300,  # 分类列表 5分钟
        "/api/rank": 300,  # 排名 5分钟
        "/api/statistics": 600,  # 统计数据 10分钟
        "/api/analysis": 300,  # 分析数据 5分钟
        "/api/dashboard": 30,  # Dashboard 30秒
        "/api/score-categories": 300,  # 积分分类 5分钟
        "/api/rbac/roles": 300,  # RBAC角色 5分钟
        "/api/rbac/permissions": 300,  # RBAC权限 5分钟
        "/api/rbac/admin-roles": 120,  # 管理员角色 2分钟
        "/api/classes": 300,  # 班级列表 5分钟
        "/api/system/config": 3600,  # 系统配置 1小时
        "/api/dashboard/data": 120,  # Dashboard数据 2分钟
    }
    # ========== Gunicorn配置 ==========
    GUNICORN_BIND = "0.0.0.0:5000"
    GUNICORN_WORKERS = os.cpu_count() * 2 + 1 if os.cpu_count() else 4
    GUNICORN_THREADS = 4
    GUNICORN_WORKER_CLASS = os.getenv("GUNICORN_WORKER_CLASS", "gevent")
    GUNICORN_MAX_REQUESTS = 1000
    GUNICORN_TIMEOUT = 120
    GUNICORN_GRACEFUL_TIMEOUT = 60
    GUNICORN_LOG_LEVEL = "info"
    GUNICORN_KEEPALIVE = 60
    GUNICORN_MAX_REQUESTS_JITTER = 200

    @classmethod
    def validate(cls) -> dict:
        """
        验证配置项
        Returns:
            验证结果字典，包含警告信息
        """
        warnings = []
        # 检查SECRET_KEY是否通过环境变量设置（生产环境必须设置）
        if env == "production" and not os.getenv("FLASK_SECRET_KEY"):
            warnings.append(
                {"type": "security", "message": "生产环境FLASK_SECRET_KEY未通过环境变量设置，使用自动生成的临时密钥"}
            )
        # 检查JWT_SECRET_KEY是否通过环境变量设置（生产环境必须设置）
        if env == "production" and not os.getenv("JWT_SECRET_KEY"):
            warnings.append(
                {"type": "security", "message": "生产环境JWT_SECRET_KEY未通过环境变量设置，使用自动生成的临时密钥"}
            )
        # 检查CORS配置
        if "*" in cls.CORS_ORIGINS:
            warnings.append({"type": "security", "message": "CORS配置允许所有来源，生产环境建议设置具体域名"})
        # 检查备份配置
        if not cls.BACKUP_ENABLED:
            warnings.append({"type": "recommendation", "message": "备份功能未启用，建议启用定期备份"})
        # 检查Redis连接
        if cls.REDIS_HOST == "localhost":
            warnings.append({"type": "recommendation", "message": "Redis使用localhost，生产环境建议使用远程Redis"})
        return {"valid": len([w for w in warnings if w["type"] == "security"]) == 0, "warnings": warnings}

    @classmethod
    def get_summary(cls) -> dict:
        """
        获取配置摘要
        Returns:
            配置摘要字典
        """
        return {
            "flask": {
                "env": cls.FLASK_ENV,
                "debug": cls.FLASK_DEBUG,
                "host": cls.FLASK_HOST,
                "port": cls.FLASK_PORT,
            },
            "redis": {
                "host": cls.REDIS_HOST,
                "port": cls.REDIS_PORT,
                "db": cls.REDIS_DB,
                "url": cls.REDIS_URL,
            },
            "celery": {
                "broker": cls.CELERY_BROKER_URL,
                "queues": list(cls.CELERY_TASK_QUEUES.keys()),
                "worker_concurrency": cls.CELERY_WORKER_CONCURRENCY,
            },
            "mqtt": {
                "broker": cls.MQTT_BROKER,
                "port": cls.MQTT_PORT,
                "topic_prefix": cls.MQTT_TOPIC_PREFIX,
            },
            "security": {
                "cors_origins_count": len(cls.CORS_ORIGINS),
                "rate_limit_per_minute": cls.RATE_LIMIT_PER_MINUTE,
            },
            "backup": {
                "enabled": cls.BACKUP_ENABLED,
                "interval_hours": cls.BACKUP_INTERVAL_HOURS,
            },
        }


config = Config()


def get_config() -> Config:
    """
    获取配置实例
    Returns:
        配置实例
    """
    return config


__all__ = [
    "Config",
    "config",
    "get_config",
    # Flask配置
    "FLASK_APP",
    "FLASK_ENV",
    "FLASK_DEBUG",
    "FLASK_SECRET_KEY",
    "FLASK_HOST",
    "FLASK_PORT",
    # 数据库配置
    "DATABASE_URI",
    # Redis配置
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_DB",
    "REDIS_URL",
    "REDIS_AUTO_START",
    "REDIS_SERVER_COMMAND",
    "REDIS_AUTO_START_TIMEOUT",
    "REDIS_SERVER_LOG",
    # Celery配置
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    # MQTT配置
    "MQTT_BROKER",
    "MQTT_PORT",
    "MQTT_TOPIC_PREFIX",
    # JWT配置
    "JWT_SECRET_KEY",
    "JWT_ACCESS_TOKEN_EXPIRES",
    # 安全配置
    "CSRF_SECRET_KEY",
    "CORS_ORIGINS",
    # 缓存配置
    "CACHE_TTL",
    "API_CACHE_TTL",
]
