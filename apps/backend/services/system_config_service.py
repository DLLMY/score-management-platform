from utils.db_session import db_session_scope, db_readonly_scope
from models import SystemConfig
from utils.logger import log_warning


class SystemConfigService:

    @staticmethod
    def get_config():
        with db_readonly_scope() as session:
            config = session.query(SystemConfig).first()
            if not config:
                return None
            return {
                "id": config.id,
                "system_name": config.system_name,
                "system_logo": config.system_logo,
                "default_score": config.default_score,
                "min_score": config.min_score,
                "max_score": config.max_score,
                "enable_notifications": config.enable_notifications,
                "notification_sound": config.notification_sound,
                "auto_save": config.auto_save,
                "theme": config.theme,
                "language": config.language,
                # 差异 #4 阶段 1：设备白名单开关（默认关闭，保持历史行为）
                "device_whitelist_enabled": bool(
                    getattr(config, "device_whitelist_enabled", False)
                ),
                "updated_at": (config.updated_at.isoformat() if config.updated_at else None),
            }

    @staticmethod
    def update_config(data):
        with db_session_scope(detach=False) as session:
            config = session.query(SystemConfig).first()
            if not config:
                config = SystemConfig()
                session.add(config)

            SystemConfigService._apply_config_fields(config, data)

            session.commit()
            return SystemConfigService.get_config()

    _CONFIG_FIELDS = (
        "system_name",
        "system_logo",
        "default_score",
        "min_score",
        "max_score",
        "enable_notifications",
        "notification_sound",
        "auto_save",
        "theme",
        "language",
        # 差异 #4 阶段 1：设备白名单开关
        "device_whitelist_enabled",
    )

    @staticmethod
    def _apply_config_fields(config, data):
        """将 data 中存在的已知配置字段应用到 config 实例（缺失字段不覆盖）。"""
        for field in SystemConfigService._CONFIG_FIELDS:
            if field in data:
                setattr(config, field, data[field])
        # 差异 #4：开关变更后立即失效进程内缓存，避免最长 10s 的生效延迟
        if "device_whitelist_enabled" in data:
            try:
                from utils.device_auth import reset_whitelist_flag_cache

                reset_whitelist_flag_cache()
            except Exception as e:  # pragma: no cover - 缓存失效失败不应阻断配置更新
                log_warning(f"设备白名单缓存失效失败(已忽略): {e}")


    @staticmethod
    def get_default_score():
        config = SystemConfigService.get_config()
        return config["default_score"] if config else 0

    @staticmethod
    def get_score_limits():
        config = SystemConfigService.get_config()
        if config:
            return {
                "min_score": config["min_score"],
                "max_score": config["max_score"],
                "default_score": config["default_score"],
            }
        return {"min_score": 0, "max_score": 10000, "default_score": 0}
