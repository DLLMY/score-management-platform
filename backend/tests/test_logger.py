try:
    from utils.logger import log_debug
except ImportError:
    pass

try:
    from utils.logger import log_info
except ImportError:
    pass

try:
    from utils.logger import log_warning
except ImportError:
    pass

try:
    from utils.logger import log_error
except ImportError:
    pass

try:
    from utils.logger import log_critical
except ImportError:
    pass

try:
    from utils.logger import log_operation
except ImportError:
    pass

try:
    from utils.logger import log_access
except ImportError:
    pass

try:
    from utils.logger import log_frontend_error
except ImportError:
    pass

try:
    from utils.logger import log_security_event
except ImportError:
    pass

try:
    from utils.logger import log_login_attempt
except ImportError:
    pass

try:
    from utils.logger import log_access_denied
except ImportError:
    pass

try:
    from utils.logger import log_token_issue
except ImportError:
    pass

try:
    from utils.logger import log_data_access
except ImportError:
    pass


class TestLogger:

    def test_log_debug(self, app):
        with app.app_context():
            from utils.logger import log_debug

            log_debug("test debug message", key="value")

    def test_log_info(self, app):
        with app.app_context():
            from utils.logger import log_info

            log_info("test info message", key="value")

    def test_log_warning(self, app):
        with app.app_context():
            from utils.logger import log_warning

            log_warning("test warning message", key="value")

    def test_log_error(self, app):
        with app.app_context():
            from utils.logger import log_error

            log_error("test error message")

            try:
                raise ValueError("test exception")
            except ValueError as e:
                log_error("test error with exception", exception=e)

    def test_log_critical(self, app):
        with app.app_context():
            from utils.logger import log_critical

            log_critical("test critical message")

            try:
                raise RuntimeError("test runtime error")
            except RuntimeError as e:
                log_critical("test critical with exception", exception=e)

    def test_log_operation(self, app):
        with app.app_context():
            from utils.logger import log_operation

            log_operation("create", target_type="user", target_id=1, description="创建用户")
            log_operation(
                "update",
                target_type="score",
                target_id=2,
                before_data={"score": 100},
                after_data={"score": 105},
            )

    def test_log_access(self, app):
        with app.app_context():
            from utils.logger import log_access

            log_access(endpoint="/api/test", method="GET", status_code=200, duration=0.1)

    def test_log_frontend_error(self, app):
        with app.app_context():
            from utils.logger import log_frontend_error

            log_frontend_error(
                {
                    "message": "test error",
                    "stack": "test stack",
                    "url": "/test",
                    "userAgent": "test",
                }
            )

    def test_log_security_event(self, app):
        with app.app_context():
            from utils.logger import log_security_event

            log_security_event("login_failure", "登录失败", username="test", ip="127.0.0.1")

    def test_log_login_attempt(self, app):
        with app.app_context():
            from utils.logger import log_login_attempt

            log_login_attempt("test_user", success=True)
            log_login_attempt("test_user", success=False, reason="密码错误")

    def test_log_access_denied(self, app):
        with app.app_context():
            from utils.logger import log_access_denied

            log_access_denied("/api/admin", reason="权限不足")

    def test_log_token_issue(self, app):
        with app.app_context():
            from utils.logger import log_token_issue

            log_token_issue("access_token", admin_id=1, success=True)
            log_token_issue("refresh_token", success=False, reason="验证失败")

    def test_log_data_access(self, app):
        with app.app_context():
            from utils.logger import log_data_access

            log_data_access("read", "user", record_count=10, admin_id=1)
            log_data_access("export", "score", record_count=100)

    def test_log_warning_with_exception(self, app):
        """回归守卫：log_warning 曾无 exception 参数，误传会被 json.dumps 致 TypeError 崩溃。

        加固后所有级别（含 debug/info/warning）均接受 exception 且不崩。
        """
        with app.app_context():
            from utils.logger import log_warning

            try:
                raise ValueError("boom")
            except ValueError as e:
                log_warning("warning with exception", exception=e)

    def test_log_info_with_exception(self, app):
        with app.app_context():
            from utils.logger import log_info

            try:
                raise KeyError("missing")
            except KeyError as e:
                log_info("info with exception", exception=e)

    def test_log_debug_with_exception(self, app):
        with app.app_context():
            from utils.logger import log_debug

            try:
                raise RuntimeError("dbg")
            except RuntimeError as e:
                log_debug("debug with exception", exception=e)

    def test_log_non_serializable_extra(self, app):
        """回归守卫：extra 含不可序列化对象（如函数）不得让日志崩溃。

        依赖 _dump_extra 的 json default=str 兜底。
        """
        with app.app_context():
            from utils.logger import log_warning

            def unserializable():
                return 1

            log_warning(
                "extra has function",
                cb=unserializable,
                nested={"fn": unserializable},
            )
