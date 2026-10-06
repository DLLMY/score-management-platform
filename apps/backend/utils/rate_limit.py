from config import config

"""
限流配置模块
功能：统一配置API接口的限流策略
作者：开发团队
日期：2026-06-14
"""


def get_rate_limit_config(limit_name: str, default_value: str) -> str:
    """获取限流配置，开发环境自动放宽"""
    env_value = config.get_rate_limit_env(limit_name)
    if env_value:
        return env_value
    # 开发环境放宽限流
    if config.APP_ENV == "development":
        # 开发环境：放宽5-10倍
        if "per minute" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per minute"
        if "per second" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per second"
        if "per hour" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per hour"
        if "per day" in default_value:
            num = int(default_value.split()[0])
            return f"{num * 5} per day"
    return default_value



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
