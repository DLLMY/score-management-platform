"""
安全配置模块 - 集中管理安全相关配置
"""

import os
from typing import Dict

from utils.logger import log_warning


class SecurityConfig:
    """安全配置类"""

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    if "*" in CORS_ORIGINS:
        log_warning(
            "安全警告: CORS配置允许所有来源('*')！"
            "生产环境建议通过 CORS_ORIGINS 环境变量设置具体域名"
        )
    CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    CORS_HEADERS = [
        "Content-Type",
        "Authorization",
        "X-Admin-Id",
        "X-CSRFToken",
        "X-Requested-With",
    ]
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
    RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", "1000"))
    PASSWORD_MIN_LENGTH = 6
    PASSWORD_MAX_LENGTH = 128
    PASSWORD_REQUIRE_UPPERCASE = True
    PASSWORD_REQUIRE_LOWERCASE = True
    PASSWORD_REQUIRE_DIGIT = True
    PASSWORD_REQUIRE_SPECIAL = False
    JWT_ACCESS_TOKEN_EXPIRES = 3600
    JWT_REFRESH_TOKEN_EXPIRES = 604800
    JWT_ALGORITHM = "HS256"
    # Cookie Secure：显式 SESSION_COOKIE_SECURE 键优先（本机 http 部署可显式 false），
    # 未设置时按 FLASK_ENV 自动判断（production=True）。
    SESSION_COOKIE_SECURE = os.getenv(
        "SESSION_COOKIE_SECURE", "true" if os.getenv("FLASK_ENV") == "production" else "false"
    ).strip().lower() in ("true", "1", "yes")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_ENABLED = True
    CSRF_TOKEN_LENGTH = 32
    SQL_INJECTION_PATTERNS = [
        "(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\\b)",
        "(--|/\\*|\\*/|;--)",
        "(OR|AND)\\s+\\d+\\s*=\\s*\\d+",
        "\\'\\s*(OR|AND)\\s*\\'",
        "1\\s*=\\s*1",
    ]  # noqa: E501
    XSS_PATTERNS = ["<script[^>]*>.*?</script>", "javascript:", "onerror=", "onload=", "onclick="]
    FORBIDDEN_FILENAMES = ["..", ".htaccess", ".htpasswd", "web.config", "httpd.conf"]
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gi", "image/webp"]
    MAX_IMAGE_SIZE = 5 * 1024 * 1024

    @classmethod
    def get_cors_config(cls) -> Dict:
        """获取CORS配置"""
        return {
            "origins": cls.CORS_ORIGINS,
            "methods": cls.CORS_METHODS,
            "allow_headers": cls.CORS_HEADERS,
            "supports_credentials": True,
        }

    @classmethod
    def get_security_headers(cls) -> Dict[str, str]:
        """获取安全响应头"""
        return {
            "X-Content-Type-Options": "nosnif",
            "X-Frame-Options": "SAMEORIGIN",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        }

    @classmethod
    def get_csp_header(cls) -> str:
        """获取Content Security Policy头"""
        return "default-src 'sel'; script-src 'sel'; style-src 'sel' 'unsafe-inline'; img-src 'sel' data:; font-src 'self'"

    @classmethod
    def validate_file_upload(cls, filename: str, content_type: str, size: int) -> tuple[bool, str]:
        """验证文件上传"""
        if any((pattern in filename for pattern in cls.FORBIDDEN_FILENAMES)):
            return (False, "文件名包含非法字符")
        if content_type not in cls.ALLOWED_IMAGE_TYPES:
            return (False, "不支持的文件类型")
        if size > cls.MAX_IMAGE_SIZE:
            return (False, f"文件大小不能超过{cls.MAX_IMAGE_SIZE // 1024 // 1024}MB")
        return (True, "")

    @classmethod
    def get_password_requirements(cls) -> Dict:
        """获取密码要求"""
        return {
            "min_length": cls.PASSWORD_MIN_LENGTH,
            "max_length": cls.PASSWORD_MAX_LENGTH,
            "require_uppercase": cls.PASSWORD_REQUIRE_UPPERCASE,
            "require_lowercase": cls.PASSWORD_REQUIRE_LOWERCASE,
            "require_digit": cls.PASSWORD_REQUIRE_DIGIT,
            "require_special": cls.PASSWORD_REQUIRE_SPECIAL,
        }
