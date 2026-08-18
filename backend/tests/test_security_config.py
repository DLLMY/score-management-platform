try:
    from utils.security_config import SecurityConfig
except ImportError:
    pass


class TestSecurityConfig:

    def test_cors_config(self, app):
        with app.app_context():
            from utils.security_config import SecurityConfig

            config = SecurityConfig.get_cors_config()
            assert config is not None
            assert isinstance(config, dict)

    def test_security_headers(self, app):
        with app.app_context():
            headers = SecurityConfig.get_security_headers()
            assert headers is not None
            assert isinstance(headers, dict)

    def test_csp_header(self, app):
        with app.app_context():
            csp = SecurityConfig.get_csp_header()
            assert csp is not None
            assert isinstance(csp, str)

    def test_password_requirements(self, app):
        with app.app_context():
            reqs = SecurityConfig.get_password_requirements()
            assert reqs is not None
            assert isinstance(reqs, dict)

    def test_validate_file_upload(self, app):
        with app.app_context():
            valid, msg = SecurityConfig.validate_file_upload("test.png", "image/png", 1024)
            assert valid is True

            valid, msg = SecurityConfig.validate_file_upload("test.exe", "application/exe", 1024)
            assert valid is False
