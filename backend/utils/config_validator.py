from typing import List, Dict
import os


class ConfigValidator:
    """配置验证工具"""

    def __init__(self):
        self.warnings: List[Dict[str, str]] = []
        self.errors: List[Dict[str, str]] = []
        self.flask_env = os.getenv("FLASK_ENV", "development").lower()

    def _add_warning(self, category: str, message: str):
        self.warnings.append({"category": category, "message": message})

    def _add_error(self, category: str, message: str):
        self.errors.append({"category": category, "message": message})

    def validate_jwt_secret(self) -> None:
        jwt_secret = os.getenv("JWT_SECRET_KEY", "")
        if not jwt_secret:
            self._add_error("security", "JWT_SECRET_KEY 未设置")
            return

        if len(jwt_secret) < 32:
            self._add_warning(
                "security", f"JWT_SECRET_KEY 长度不足32字节（当前{len(jwt_secret)}字节）"
            )

        if jwt_secret == "CHANGE_ME_JWT_SECRET_0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p":
            self._add_error("security", "JWT_SECRET_KEY 使用默认值，生产环境必须修改")

    def validate_flask_secret(self) -> None:
        flask_secret = os.getenv("FLASK_SECRET_KEY", "")
        if not flask_secret:
            self._add_error("security", "FLASK_SECRET_KEY 未设置")
            return

        if len(flask_secret) < 32:
            self._add_warning(
                "security", f"FLASK_SECRET_KEY 长度不足32字节（当前{len(flask_secret)}字节）"
            )

        if flask_secret == "CHANGE_ME_IN_PRODUCTION_0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p":
            self._add_error("security", "FLASK_SECRET_KEY 使用默认值，生产环境必须修改")

    def validate_redis_config(self) -> None:
        redis_db = int(os.getenv("REDIS_DB", "0"))
        celery_db = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")

        if "/1" not in celery_db and "/0" in celery_db:
            self._add_warning("redis", "Celery和缓存使用相同的Redis DB，可能导致数据冲突")

        if redis_db < 0 or redis_db > 15:
            self._add_error("redis", f"Redis DB {redis_db} 超出有效范围(0-15)")

    def validate_cors_config(self) -> None:
        cors_origins = os.getenv("CORS_ORIGINS", "")
        if "*" in cors_origins and self.flask_env == "production":
            self._add_error("security", "生产环境CORS配置不允许使用通配符(*)")

    def validate_database_config(self) -> None:
        db_uri = os.getenv("DATABASE_URI", "")
        if "sqlite://" in db_uri and self.flask_env == "production":
            self._add_warning("database", "生产环境建议使用PostgreSQL或MySQL，而非SQLite")

    def validate_mqtt_config(self) -> None:
        mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
        mqtt_ssl = os.getenv("MQTT_SSL", "false").lower() == "true"

        if mqtt_port == 1883 and mqtt_ssl:
            self._add_warning("mqtt", "MQTT SSL启用但端口使用1883（非SSL默认端口）")

        if mqtt_port == 8883 and not mqtt_ssl:
            self._add_warning("mqtt", "MQTT端口使用8883（SSL端口）但SSL未启用")

    def validate_port_config(self) -> None:
        flask_port = int(os.getenv("FLASK_PORT", "5000"))
        if flask_port < 1 or flask_port > 65535:
            self._add_error("port", f"FLASK_PORT {flask_port} 超出有效范围(1-65535)")

    def validate_env_consistency(self) -> None:
        debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
        if self.flask_env == "production" and debug_mode:
            self._add_error("security", "生产环境不应启用DEBUG模式")

        if (
            self.flask_env == "production"
            and os.getenv("BACKUP_ENABLED", "false").lower() != "true"
        ):
            self._add_warning("backup", "生产环境建议启用自动备份")

    def validate_rate_limit_config(self) -> None:
        try:
            per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
            per_hour = int(os.getenv("RATE_LIMIT_PER_HOUR", "1000"))

            if per_minute * 60 < per_hour:
                self._add_warning(
                    "rate_limit",
                    f"每分钟限制({per_minute})*60 < 每小时限制({per_hour})，配置可能不一致",
                )

            if per_minute < 0 or per_hour < 0:
                self._add_error("rate_limit", "限流配置值不能为负数")
        except ValueError:
            self._add_error("rate_limit", "限流配置值必须为整数")

    def validate_all(self) -> Dict[str, List[Dict[str, str]]]:
        self.warnings.clear()
        self.errors.clear()

        self.validate_jwt_secret()
        self.validate_flask_secret()
        self.validate_redis_config()
        self.validate_cors_config()
        self.validate_database_config()
        self.validate_mqtt_config()
        self.validate_port_config()
        self.validate_env_consistency()
        self.validate_rate_limit_config()

        return {"errors": self.errors, "warnings": self.warnings}

    def print_report(self) -> None:
        print("\n" + "=" * 70)
        print("🔧 配置验证报告")
        print("=" * 70)
        print(f"环境: {self.flask_env}")
        print("=" * 70)

        if self.errors:
            print(f"\n❌ 错误 ({len(self.errors)}):")
            for i, error in enumerate(self.errors, 1):
                print(f"   {i}. [{error['category']}] {error['message']}")
        else:
            print("\n✅ 无错误")

        if self.warnings:
            print(f"\n⚠️  警告 ({len(self.warnings)}):")
            for i, warning in enumerate(self.warnings, 1):
                print(f"   {i}. [{warning['category']}] {warning['message']}")
        else:
            print("\n✅ 无警告")

        print("\n" + "=" * 70)

        if self.errors and self.flask_env == "production":
            print("🚨 生产环境存在配置错误，建议修复后再部署！")
            print("=" * 70)

    def is_valid(self) -> bool:
        return len(self.errors) == 0


def validate_config() -> bool:
    """验证配置的便捷函数"""
    validator = ConfigValidator()
    validator.validate_all()
    validator.print_report()
    return validator.is_valid()


if __name__ == "__main__":
    validate_config()
