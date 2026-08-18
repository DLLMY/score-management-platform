import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask import jsonify
from flask import Flask

import functools

"""
限流配置模块
功能：统一配置API接口的限流策略
作者：开发团队
日期：2026-06-14
"""


def get_rate_limit_config(limit_name: str, default_value: str) -> str:
    """获取限流配置，开发环境自动放宽"""
    env_value = os.getenv(f"RATE_LIMIT_{limit_name.upper()}")
    if env_value:
        return env_value
    # 开发环境放宽限流
    if os.getenv("FLASK_ENV") == "development":
        # 开发环境：放宽5-10倍
        if "per minute" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per minute"
        elif "per second" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per second"
        elif "per hour" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per hour"
        elif "per day" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per day"
    return default_value


default_limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[
        get_rate_limit_config("daily", "200 per day"),
        get_rate_limit_config("hourly", "50 per hour"),
    ],
    storage_uri="memory://",  # 使用内存存储（生产环境应使用Redis）
    strategy="fixed-window",  # 固定窗口策略
    headers_enabled=True,  # 启用限流响应头
)


def get_user_limiter_key():
    """获取基于用户的限流键"""
    from utils.permission import get_current_admin

    admin = get_current_admin()
    if admin:
        return str(admin.id)
    return get_remote_address()


def create_limiter_with_user_key():
    """创建基于用户ID的限流器"""
    return Limiter(
        key_func=get_user_limiter_key,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://",
        strategy="fixed-window",
        headers_enabled=True,
    )


class RateLimitStrategy:
    """限流策略常量"""

    # 登录接口 - 严格限制，防止暴力破解
    LOGIN = get_rate_limit_config("login", "5 per minute")  # 每IP每分钟5次
    # 注册接口 - 严格限制
    REGISTER = get_rate_limit_config("register", "3 per minute")  # 每IP每分钟3次
    # 密码相关接口 - 严格限制
    PASSWORD = get_rate_limit_config("password", "3 per minute")  # 每IP每分钟3次
    # MQTT消息接口 - 较高限制
    MQTT_PUBLISH = get_rate_limit_config("mqtt_publish", "100 per second")  # 每秒100次
    MQTT_MESSAGE = get_rate_limit_config("mqtt_message", "500 per minute")  # 每分钟500次
    # 数据查询接口 - 中等限制
    QUERY = get_rate_limit_config("query", "30 per minute")  # 每用户每分钟30次
    LIST = get_rate_limit_config("list", "60 per minute")  # 每用户每分钟60次
    # 数据操作接口 - 中等限制
    CREATE = get_rate_limit_config("create", "20 per minute")  # 每用户每分钟20次
    UPDATE = get_rate_limit_config("update", "20 per minute")  # 每用户每分钟20次
    DELETE = get_rate_limit_config("delete", "10 per minute")  # 每用户每分钟10次
    # 批量操作接口 - 较低限制
    BATCH_CREATE = get_rate_limit_config("batch_create", "5 per minute")  # 每用户每分钟5次
    BATCH_UPDATE = get_rate_limit_config("batch_update", "5 per minute")  # 每用户每分钟5次
    # 文件上传接口 - 较低限制
    UPLOAD = get_rate_limit_config("upload", "10 per minute")  # 每用户每分钟10次
    # 导出接口 - 较低限制
    EXPORT = get_rate_limit_config("export", "5 per minute")  # 每用户每分钟5次
    # 调试/管理接口 - 较高限制
    DEBUG = get_rate_limit_config("debug", "30 per minute")  # 每IP每分钟30次
    ADMIN = get_rate_limit_config("admin", "60 per minute")  # 每IP每分钟60次


def rate_limit(limit_string, message=None):
    """
    通用限流装饰器
    Args:
        limit_string: 限流规则，如 "10 per minute"
        message: 超限时的提示信息
    Returns:
        装饰器函数
    """

    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            # 限流由 Flask-Limiter 自动处理
            return f(*args, **kwargs)

        # 设置限流规则
        wrapper.__ratelimit_limit__ = limit_string
        wrapper.__ratelimit_key_func__ = get_remote_address
        return wrapper

    return decorator


def login_rate_limit(f):
    """登录接口限流"""

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)

    wrapper.__ratelimit__ = RateLimitStrategy.LOGIN
    return wrapper


def admin_rate_limit(f):
    """管理员接口限流"""

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)

    wrapper.__ratelimit__ = RateLimitStrategy.ADMIN
    return wrapper


def mqtt_rate_limit(f):
    """MQTT消息接口限流"""

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)

    wrapper.__ratelimit__ = RateLimitStrategy.MQTT_PUBLISH
    return wrapper


def query_rate_limit(f):
    """查询接口限流"""

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)

    wrapper.__ratelimit__ = RateLimitStrategy.QUERY
    return wrapper


def mutation_rate_limit(f):
    """数据修改接口限流"""

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)

    wrapper.__ratelimit__ = RateLimitStrategy.UPDATE
    return wrapper


def rate_limit_exceeded_handler(e):
    """限流超限响应处理"""
    return (
        jsonify(
            {
                "success": False,
                "message": "请求过于频繁，请稍后再试",
                "error": "rate_limit_exceeded",
                "retry_after": e.description,
            }
        ),
        429,
    )


def configure_limiter(limiter, app):
    """
    配置限流器
    Args:
        limiter: Limiter实例
        app: Flask应用实例
    """
    # 注册限流超限处理器
    limiter.init_app(app)

    # 添加自定义错误处理
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return rate_limit_exceeded_handler(e)

    # 配置限流响应头（如果启用）
    @app.after_request
    def add_rate_limit_headers(response):
        # X-RateLimit-Limit: 总限制数
        # X-RateLimit-Remaining: 剩余请求数
        # X-RateLimit-Reset: 重置时间戳
        return response


app = Flask(__name__)
configure_limiter(default_limiter, app)


@app.route("/api/login", methods=["POST"])
@default_limiter.limit(RateLimitStrategy.LOGIN)
def login():
    # 登录逻辑
    pass


@app.route("/api/mqtt/publish", methods=["POST"])
@default_limiter.limit(RateLimitStrategy.MQTT_PUBLISH)
def mqtt_publish():
    # MQTT发布逻辑
    pass


def get_dynamic_limit(user_role=None, endpoint=None):
    """
    获取动态限流值
    根据用户角色和接口类型返回不同的限流值。
    Args:
        user_role: 用户角色 (admin, teacher, student)
        endpoint: API端点
    Returns:
        限流字符串
    """
    # 管理员拥有更高的限流额度
    admin_multiplier = {
        "admin": 2.0,
        "teacher": 1.5,
        "student": 1.0,
    }  # 管理员2倍额度  # 教师1.5倍额度  # 学生标准额度
    # 根据端点类型调整基础额度
    base_limits = {"query": 30, "create": 20, "update": 20, "delete": 10}
    base = base_limits.get(endpoint, 30)
    multiplier = admin_multiplier.get(user_role, 1.0)
    return f"{int(base * multiplier)} per minute"


def is_rate_limit_exempt(ip_address):
    """
    检查IP是否在限流豁免列表中
    Args:
        ip_address: IP地址
    Returns:
        是否豁免
    """
    # 本地开发环境豁免
    exempt_ips = ["127.0.0.1", "localhost", "::1"]
    return ip_address in exempt_ips


class RateLimitStats:
    """限流统计"""

    def __init__(self):
        self.requests_count = {}  # 请求计数
        self.blocked_count = {}  # 阻止计数

    def record_request(self, key):
        """记录请求"""
        self.requests_count[key] = self.requests_count.get(key, 0) + 1

    def record_blocked(self, key):
        """记录阻止"""
        self.blocked_count[key] = self.blocked_count.get(key, 0) + 1

    def get_stats(self):
        """获取统计信息"""
        return {"requests": self.requests_count, "blocked": self.blocked_count}

    def reset(self):
        """重置统计"""
        self.requests_count.clear()
        self.blocked_count.clear()


rate_limit_stats = RateLimitStats()
