from utils.structured_logger import LogCategory
try:
    from utils.structured_logger import StructuredLogger
except ImportError:
    pass



class TestStructuredLogger:

    def test_logger_init(self, app):
        with app.app_context():
            from utils.structured_logger import StructuredLogger
            logger = StructuredLogger()
            assert logger is not None

    def test_log_info(self, app):
        with app.app_context():
            logger = StructuredLogger()
            logger.info(LogCategory.SYSTEM, 'test message', key='value')

    def test_log_error(self, app):
        with app.app_context():
            logger = StructuredLogger()
            logger.error(LogCategory.SYSTEM, 'error message', key='value')

    def test_log_warning(self, app):
        with app.app_context():
            logger = StructuredLogger()
            logger.warning(LogCategory.SYSTEM, 'warning message')

    def test_log_debug(self, app):
        with app.app_context():
            logger = StructuredLogger()
            logger.debug(LogCategory.SYSTEM, 'debug message')
