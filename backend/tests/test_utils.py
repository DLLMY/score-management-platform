try:
    from utils.logger import log_info, log_error, log_debug, log_warning
except ImportError:
    pass

try:
    from utils.structured_logger import StructuredLogger, LogCategory
except ImportError:
    pass

try:
    from utils.backup_utils import backup_manager
except ImportError:
    pass

try:
    from utils.query_optimizer import QueryOptimizer, CacheManager
except ImportError:
    pass

try:
    from utils.permission import PERMISSIONS, _get_inherited_permissions
except ImportError:
    pass

try:
    from utils.security import generate_tokens, decode_token
except ImportError:
    pass

try:
    from utils.validation import validate_email, validate_phone
except ImportError:
    pass

try:
    from utils.cache import ResponseCache
except ImportError:
    pass

try:
    from utils.email_utils import EmailService
except ImportError:
    pass

try:
    from utils.sms_utils import SMSService
except ImportError:
    pass

try:
    from utils.wechat_utils import WechatService
except ImportError:
    pass


class TestUtils:

    def test_logger(self, app):
        from utils.logger import log_info, log_error, log_debug, log_warning

        log_info("Test info message")
        log_error("Test error message")
        log_debug("Test debug message")
        log_warning("Test warning message")

    def test_structured_logger(self, app):
        from utils.structured_logger import StructuredLogger, LogCategory

        logger = StructuredLogger()
        logger.info(LogCategory.SYSTEM, "Test structured info", extra={"key": "value"})
        logger.error(LogCategory.SYSTEM, "Test structured error", exc_info=True)

    def test_backup_utils(self, app):
        with app.app_context():
            from utils.backup_utils import backup_manager

            assert backup_manager is not None
            result = backup_manager.create_backup("test")
            assert "success" in result

    def test_query_optimizer(self, app):
        with app.app_context():
            from utils.query_optimizer import QueryOptimizer, CacheManager

            optimizer = QueryOptimizer()
            assert optimizer is not None

            cache_manager = CacheManager()
            cache_manager.set("test_key", "test_value")
            assert cache_manager.get("test_key") == "test_value"
            cache_manager.delete("test_key")
            assert cache_manager.get("test_key") is None
            cache_manager.clear()

    def test_permission_utils(self, app):
        from utils.permission import PERMISSIONS, _get_inherited_permissions

        with app.app_context():
            assert "admin" in PERMISSIONS
            assert _get_inherited_permissions("admin") == {"all"}
            assert _get_inherited_permissions("teacher") is not None

    def test_security_utils(self):
        from utils.security import generate_tokens, decode_token

        token_data = generate_tokens(1, "test", "admin")
        assert "access_token" in token_data
        assert "refresh_token" in token_data

        decoded = decode_token(token_data["access_token"])
        assert decoded is not None
        assert int(decoded.get("sub")) == 1

    def test_validation_utils(self):
        from utils.validation import validate_email, validate_phone

        assert validate_email("test@example.com")[0] is True
        assert validate_email("invalid")[0] is False
        assert validate_phone("13800138000")[0] is True
        assert validate_phone("123")[0] is False

    def test_cache_utils(self, app):
        with app.app_context():
            from utils.cache import ResponseCache

            cache = ResponseCache()
            cache.set("test_key", "test_value", ttl=60)
            assert cache.get("test_key") == "test_value"
            cache.delete("test_key")
            assert cache.get("test_key") is None

    def test_email_utils(self):
        from utils.email_utils import EmailService

        email_service = EmailService()
        assert email_service is not None

    def test_sms_utils(self):
        from utils.sms_utils import SMSService

        sms_service = SMSService()
        assert sms_service is not None

    def test_wechat_utils(self):
        from utils.wechat_utils import WechatService

        wechat_service = WechatService()
        assert wechat_service is not None
