from datetime import datetime
from utils.db_session import db_session_scope
from models import MQTTConfig


class MQTTManagementService:

    def get_mqtt_logs(self, limit=100):
        from models import MQTTLog

        with db_session_scope(auto_commit=False):
            logs = MQTTLog.query.order_by(MQTTLog.timestamp.desc()).limit(limit).all()
            return [
                {
                    "id": log.id,
                    "topic": log.topic,
                    "message": log.message,
                    "direction": log.direction,
                    "timestamp": (log.timestamp.isoformat() if log.timestamp else None),
                }
                for log in logs
            ]

    def get_mqtt_config(self):
        from models import MQTTConfig, db

        with db_session_scope():
            config = MQTTConfig.query.first()
            if not config:
                config = MQTTConfig()
                db.session.add(config)

            return {
                "id": config.id,
                "broker": config.broker,
                "port": config.port,
                "client_id": config.client_id,
                "username": config.username,
                "password": "******",
                "ssl": config.ssl,
                "timeout": config.timeout,
                "keepalive": config.keepalive,
                "updated_at": (config.updated_at.isoformat() if config.updated_at else None),
            }

    def update_mqtt_config(self, config_data):

        with db_session_scope():
            config = MQTTConfig.query.first()
            if not config:
                config = MQTTConfig()

            config.broker = config_data.get("broker", config.broker)
            config.port = config_data.get("port", config.port)
            config.client_id = config_data.get("client_id", config.client_id)
            config.username = config_data.get("username", config.username)
            if config_data.get("password") and config_data.get("password") != "******":
                config.password = config_data.get("password")
            config.ssl = config_data.get("ssl", config.ssl)
            config.timeout = config_data.get("timeout", config.timeout)
            config.keepalive = config_data.get("keepalive", config.keepalive)
            config.updated_at = datetime.now()


mqtt_management_service = MQTTManagementService()
