from utils.db_session import db_session_scope, db_readonly_scope
from models import SystemConfig


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
                "updated_at": (config.updated_at.isoformat() if config.updated_at else None),
            }

    @staticmethod
    def update_config(data):
        with db_session_scope(detach=False) as session:
            config = session.query(SystemConfig).first()
            if not config:
                config = SystemConfig()
                session.add(config)

            if "system_name" in data:
                config.system_name = data["system_name"]
            if "system_logo" in data:
                config.system_logo = data["system_logo"]
            if "default_score" in data:
                config.default_score = data["default_score"]
            if "min_score" in data:
                config.min_score = data["min_score"]
            if "max_score" in data:
                config.max_score = data["max_score"]
            if "enable_notifications" in data:
                config.enable_notifications = data["enable_notifications"]
            if "notification_sound" in data:
                config.notification_sound = data["notification_sound"]
            if "auto_save" in data:
                config.auto_save = data["auto_save"]
            if "theme" in data:
                config.theme = data["theme"]
            if "language" in data:
                config.language = data["language"]

            session.commit()
            return SystemConfigService.get_config()

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
