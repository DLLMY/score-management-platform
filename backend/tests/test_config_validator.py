import os
from unittest.mock import patch

try:
    from utils.config_validator import ConfigValidator
except ImportError:
    pass

try:
    from utils.config_validator import validate_config
except ImportError:
    pass


class TestConfigValidator:
    """配置验证器测试"""

    def test_validate_jwt_secret_empty(self):
        """测试JWT密钥为空时返回错误"""
        from utils.config_validator import ConfigValidator

        real_getenv = os.getenv

        def fake_getenv(key, default=None):
            if key == "JWT_SECRET_KEY":
                return ""
            return real_getenv(key, default)

        validator = ConfigValidator()
        with patch("utils.config_validator.os.getenv", side_effect=fake_getenv):
            validator.validate_jwt_secret()

        assert len(validator.errors) == 1
        assert validator.errors[0]["category"] == "security"

    def test_validate_jwt_secret_short(self):
        """测试JWT密钥过短时返回警告"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"JWT_SECRET_KEY": "short_key"}, clear=False):
            validator.validate_jwt_secret()

        assert len(validator.warnings) == 1
        assert validator.warnings[0]["category"] == "security"

    def test_validate_jwt_secret_default_value(self):
        """测试JWT密钥使用默认值时返回错误"""

        validator = ConfigValidator()
        with patch.dict(
            os.environ,
            {"JWT_SECRET_KEY": "CHANGE_ME_JWT_SECRET_0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p"},
            clear=False,
        ):
            validator.validate_jwt_secret()

        assert len(validator.errors) == 1

    def test_validate_jwt_secret_valid(self):
        """测试JWT密钥有效时不产生错误或警告"""

        validator = ConfigValidator()
        with patch.dict(
            os.environ,
            {"JWT_SECRET_KEY": "valid_secret_key_at_least_32_characters_long"},
            clear=False,
        ):
            validator.validate_jwt_secret()

        assert len(validator.errors) == 0
        assert len(validator.warnings) == 0

    def test_validate_flask_secret_empty(self):
        """测试Flask密钥为空时返回错误"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"FLASK_SECRET_KEY": ""}, clear=False):
            validator.validate_flask_secret()

        assert len(validator.errors) == 1

    def test_validate_flask_secret_short(self):
        """测试Flask密钥过短时返回警告"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"FLASK_SECRET_KEY": "short"}, clear=False):
            validator.validate_flask_secret()

        assert len(validator.warnings) == 1

    def test_validate_redis_config_db_conflict(self):
        """测试Redis DB冲突时返回警告"""

        validator = ConfigValidator()
        with patch.dict(
            os.environ,
            {"REDIS_DB": "0", "CELERY_BROKER_URL": "redis://localhost:6379/0"},
            clear=False,
        ):
            validator.validate_redis_config()

        assert len(validator.warnings) == 1

    def test_validate_redis_config_db_out_of_range(self):
        """测试Redis DB超出范围时返回错误"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"REDIS_DB": "16"}, clear=False):
            validator.validate_redis_config()

        assert len(validator.errors) == 1

    def test_validate_cors_config_wildcard_in_production(self):
        """测试生产环境CORS使用通配符时返回错误"""

        validator = ConfigValidator()
        validator.flask_env = "production"
        with patch.dict(os.environ, {"CORS_ORIGINS": "*"}, clear=False):
            validator.validate_cors_config()

        assert len(validator.errors) == 1

    def test_validate_database_config_sqlite_in_production(self):
        """测试生产环境使用SQLite时返回警告"""

        validator = ConfigValidator()
        validator.flask_env = "production"
        with patch.dict(os.environ, {"DATABASE_URI": "sqlite:///test.db"}, clear=False):
            validator.validate_database_config()

        assert len(validator.warnings) == 1

    def test_validate_mqtt_config_ssl_port_mismatch(self):
        """测试MQTT SSL与端口不匹配时返回警告"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"MQTT_PORT": "1883", "MQTT_SSL": "true"}, clear=False):
            validator.validate_mqtt_config()

        assert len(validator.warnings) == 1

    def test_validate_port_config_invalid(self):
        """测试端口无效时返回错误"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"FLASK_PORT": "70000"}, clear=False):
            validator.validate_port_config()

        assert len(validator.errors) == 1

    def test_validate_env_consistency_debug_in_production(self):
        """测试生产环境启用DEBUG时返回错误"""

        validator = ConfigValidator()
        validator.flask_env = "production"
        with patch.dict(os.environ, {"FLASK_DEBUG": "true"}, clear=False):
            validator.validate_env_consistency()

        assert len(validator.errors) == 1

    def test_validate_rate_limit_config_inconsistent(self):
        """测试限流配置不一致时返回警告"""

        validator = ConfigValidator()
        with patch.dict(
            os.environ, {"RATE_LIMIT_PER_MINUTE": "10", "RATE_LIMIT_PER_HOUR": "1000"}, clear=False
        ):
            validator.validate_rate_limit_config()

        assert len(validator.warnings) == 1

    def test_validate_rate_limit_config_invalid(self):
        """测试限流配置值为负数时返回错误"""

        validator = ConfigValidator()
        with patch.dict(os.environ, {"RATE_LIMIT_PER_MINUTE": "-1"}, clear=False):
            validator.validate_rate_limit_config()

        assert len(validator.errors) == 1

    def test_validate_all(self):
        """测试完整验证流程"""

        validator = ConfigValidator()
        with patch.dict(
            os.environ,
            {
                "JWT_SECRET_KEY": "valid_key_32_characters_long",
                "FLASK_SECRET_KEY": "valid_flask_secret_key",
                "REDIS_DB": "0",
                "CELERY_BROKER_URL": "redis://localhost:6379/1",
                "CORS_ORIGINS": "http://localhost:3000",
                "DATABASE_URI": "sqlite:///test.db",
                "MQTT_PORT": "1883",
                "MQTT_SSL": "false",
                "FLASK_PORT": "5000",
                "FLASK_DEBUG": "false",
                "RATE_LIMIT_PER_MINUTE": "30",
                "RATE_LIMIT_PER_HOUR": "1000",
            },
            clear=False,
        ):
            result = validator.validate_all()

        assert isinstance(result, dict)
        assert "errors" in result
        assert "warnings" in result

    def test_is_valid(self):
        """测试is_valid方法"""

        validator = ConfigValidator()
        assert validator.is_valid() is True

        validator._add_error("test", "error")
        assert validator.is_valid() is False

    def test_print_report_routes_to_logger_by_severity(self):
        """测试报告经 logger 输出，且按严重程度选级别。

        原实现为 print 直出，2026-09-02 收口为 logger（P2 代码卫生）。
        方法名 print_report 保留以免破坏调用方，但输出通道已变更。
        """
        from utils.config_validator import ConfigValidator as _CV

        # 有错误 → log_error，且错误内容进入日志
        validator = _CV()
        validator._add_error("security", "JWT_SECRET_KEY 未设置")
        with patch("utils.config_validator.log_error") as mock_error:
            validator.print_report()
            assert mock_error.call_count == 1
            assert "JWT_SECRET_KEY 未设置" in mock_error.call_args[0][0]

        # 仅警告 → log_warning
        validator = _CV()
        validator._add_warning("database", "生产环境建议使用PostgreSQL")
        with patch("utils.config_validator.log_warning") as mock_warning:
            validator.print_report()
            assert mock_warning.call_count == 1
            assert "PostgreSQL" in mock_warning.call_args[0][0]

        # 无错误无警告 → log_info
        validator = _CV()
        with patch("utils.config_validator.log_info") as mock_info:
            validator.print_report()
            assert mock_info.call_count == 1

    def test_print_report_does_not_use_print(self):
        """防回归：报告不得再走 print 直出（统一由 logger 输出）。"""
        from utils.config_validator import ConfigValidator as _CV

        validator = _CV()
        validator._add_error("security", "测试用错误")
        with patch("builtins.print") as mock_print:
            validator.print_report()
            assert mock_print.call_count == 0

    def test_validate_config_function(self):
        """测试validate_config便捷函数"""
        from utils.config_validator import validate_config

        with patch.dict(
            os.environ,
            {
                "JWT_SECRET_KEY": "valid_key_32_characters_long",
                "FLASK_SECRET_KEY": "valid_flask_secret_key",
            },
            clear=False,
        ):
            result = validate_config()
            assert isinstance(result, bool)
