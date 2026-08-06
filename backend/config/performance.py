from .config_loader import config_loader

"""
系统性能优化配置
整合所有性能优化措施，确保系统高效运行
注意：所有配置项统一从config.py读取，此文件仅提供应用配置的便利方法
"""


class PerformanceConfig:
    """性能优化配置 - 从统一配置读取"""

    SQLITE_CONFIG = config_loader.get_config("SQLITE_CONFIG", {})
    CONNECTION_POOL = config_loader.get_config("SQLALCHEMY_ENGINE_OPTIONS", {})
    BATCH_CONFIG = {
        "batch_size": 1000,
        "commit_interval": 1000,
        "use_batch_insert": True,
    }
    REDIS_CONFIG = config_loader.get_redis_config()
    REDIS_CONFIG.update(
        {
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "max_connections": CONNECTION_POOL.get("max_overflow", 20),
            "decode_responses": True,
        }
    )
    CACHE_TTL = config_loader.get_config("CACHE_TTL", {})
    COMPRESS_CONFIG = {
        "mimetypes": [
            "text/html",
            "text/css",
            "text/xml",
            "application/json",
            "application/javascript",
            "application/xml",
            "image/svg+xml",
        ],
        "level": 6,
        "threshold": 1024,
    }
    REQUEST_TIMEOUT = {
        "default": 30,
        "file_upload": 300,
        "long_running": 120,
    }
    RATE_LIMITS = {
        "default": "60 per minute",
        "api_login": "25 per minute",
        "api_records": "150 per minute",
        "api_score_entry": "100 per minute",
        "api_firmware_upload": "50 per minute",
        "api_rbac": "100 per minute",
    }
    BACKGROUND_TASK = {
        "enabled": True,
        "thread_pool_size": 4,
        "max_workers": 10,
    }
    SCHEDULED_TASKS = {
        "data_sync_check": {
            "interval": 3600,
            "enabled": True,
        },
        "data_fix": {
            "hour": 3,
            "enabled": True,
        },
        "database_backup": {
            "hour": 2,
            "enabled": True,
        },
        "heartbeat_check": {
            "interval": 30,
            "enabled": True,
        },
        "cache_cleanup": {
            "interval": 21600,
            "enabled": True,
        },
        "log_cleanup": {
            "interval": 86400,
            "enabled": True,
        },
    }
    LOG_CONFIG = {
        "level": config.LOG_LEVEL,
        "max_size": config.LOG_MAX_BYTES,
        "backup_count": config.LOG_BACKUP_COUNT,
        "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    }
    FRONTEND_CONFIG = {
        "lazy_loading": {
            "enabled": True,
            "preload_on_hover": True,
            "preload_priority": {
                "high": ["/users", "/devices", "/rules", "/dashboard"],
                "medium": ["/users/:id", "/analysis", "/score-records"],
                "low": ["/settings", "/profile", "/help"],
            },
        },
        "cache_warmup": {
            "enabled": True,
            "delay": 500,
            "endpoints": [
                {"key": "classes", "url": "/api/classes", "priority": "medium"},
                {"key": "score_rules", "url": "/api/rules", "priority": "medium"},
                {"key": "categories", "url": "/api/score-categories", "priority": "medium"},
                {"key": "system_config", "url": "/api/system/config", "priority": "low"},
            ],
        },
        "api_cache": {
            "enabled": True,
            "ttl": config.API_CACHE_TTL,
        },
        "image_optimization": {
            "enabled": True,
            "lazy_load": True,
            "responsive": True,
            "formats": ["webp", "avif"],
        },
        "list_optimization": {
            "virtual_scroll": True,
            "skeleton_loading": True,
            "pagination": {
                "default_page_size": 20,
                "max_page_size": 100,
            },
        },
    }
    PERFORMANCE_MONITORING = {
        "enabled": True,
        "response_time_threshold": 500,
        "slow_query_threshold": 100,
        "memory_threshold": 80,
        "cpu_threshold": 80,
    }
    DEBUG_CONFIG = {
        "enabled": config.FLASK_DEBUG,
        "sql_echo": False,
        "cache_debug": False,
        "performance_logging": False,
    }


def apply_performance_optimizations(app):
    """
    应用性能优化配置到Flask应用
    :param app: Flask应用实例
    """
    app.config["COMPRESS_MIMETYPES"] = PerformanceConfig.COMPRESS_CONFIG["mimetypes"]
    app.config["COMPRESS_LEVEL"] = PerformanceConfig.COMPRESS_CONFIG["level"]
    app.config["COMPRESS_THRESHOLD"] = PerformanceConfig.COMPRESS_CONFIG["threshold"]
    app.config["CACHE_TTL_CONFIG"] = PerformanceConfig.CACHE_TTL
    app.config["RATE_LIMIT_CONFIG"] = PerformanceConfig.RATE_LIMITS
    app.config["BACKGROUND_TASK_CONFIG"] = PerformanceConfig.BACKGROUND_TASK
    app.config["SCHEDULED_TASKS_CONFIG"] = PerformanceConfig.SCHEDULED_TASKS
    app.config["PERFORMANCE_MONITORING_CONFIG"] = PerformanceConfig.PERFORMANCE_MONITORING
    app.config["DEBUG_PERFORMANCE"] = PerformanceConfig.DEBUG_CONFIG
    print("[Performance] 性能优化配置已应用")


performance_config = PerformanceConfig()
