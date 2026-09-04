from typing import Dict, Any, List
from flask import request, jsonify
from functools import wraps
from datetime import datetime

import re

"""
Global Input Validation Middleware
Function: Add unified input validation for all API endpoints
"""


from utils.logger import log_info, log_warning, log_debug
class InputValidationMiddleware:
    """Global input validation middleware"""

    def __init__(self, app=None):
        self.app = app
        self.whitelist = set()
        self.validators = {}
        if app:
            self.init_app(app)

    def init_app(self, app):
        """Initialize application"""
        self.app = app
        app.before_request(self.validate_request)

        @app.errorhandler(400)
        def validation_error(e):
            return (
                jsonify(
                    {"success": False, "message": "Invalid request parameters", "error": str(e)}
                ),
                400,
            )

    def add_whitelist(self, endpoints: List[str]):
        """Add whitelist endpoints"""
        self.whitelist.update(endpoints)

    def add_validator(self, endpoint: str, validator):
        """Add custom validator for specific endpoint"""
        self.validators[endpoint] = validator

    def validate_request(self):
        """Validate request"""
        if request.endpoint and request.endpoint in self.whitelist:
            return None

        if request.method == "GET":
            return None

        # 跳过文件上传请求（multipart/form-data）
        content_type = request.content_type or ""
        if "multipart/form-data" in content_type:
            return None

        try:
            data = request.get_json(silent=True)
        except Exception:
            return self.error_response("Request body is not valid JSON")

        if data is None and request.method in ("POST", "PUT", "PATCH"):
            return self.error_response("Request body cannot be empty")

        data = data or {}

        content_length = request.content_length or 0
        if content_length > 10 * 1024 * 1024:
            return self.error_response("Request body size exceeds limit (max 10MB)")

        errors = self._validate_data(data)

        if request.endpoint and request.endpoint in self.validators:
            custom_errors = self.validators[request.endpoint](data)
            errors.extend(custom_errors)

        if errors:
            return self.error_response("Parameter validation failed", errors)

        return None

    def _validate_data(self, data: Dict[str, Any]) -> List[str]:
        """Validate data"""
        errors = []

        for key, value in data.items():
            if isinstance(value, str):
                if len(value) > 10000:
                    errors.append(f"Field '{key}' exceeds length limit")
                if self._contains_special_chars(value):
                    errors.append(f"Field '{key}' contains invalid characters")

            elif isinstance(value, int):
                if value < -2147483648 or value > 2147483647:
                    errors.append(f"Field '{key}' value exceeds integer range")

            elif isinstance(value, list):
                if len(value) > 1000:
                    errors.append(f"Field '{key}' array length exceeds limit")

            elif isinstance(value, dict):
                if self._check_nested_depth(value, 5):
                    errors.append(f"Field '{key}' nested depth exceeds limit")

        return errors

    def _contains_special_chars(self, value: str) -> bool:
        """Check for special characters"""
        dangerous_patterns = [
            r"<script[^>]*>.*?</script>",
            r"on\w+\s*=",
            r"javascript:",
            r"vbscript:",
            r"expression\s*\(",
            r"eval\s*\(",
            r"alert\s*\(",
            r"\bSELECT\b.*\bFROM\b",
            r"\bINSERT\b.*\bINTO\b",
            r"\bDELETE\b.*\bFROM\b",
            r"\bUPDATE\b.*\bSET\b",
            r"\bDROP\b.*\bTABLE\b",
            r"\bUNION\b.*\bSELECT\b",
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return True

        return False

    def _check_nested_depth(self, data: Dict, max_depth: int, current_depth: int = 0) -> bool:
        """Check nested depth"""
        if current_depth >= max_depth:
            return True

        for value in data.values():
            if isinstance(value, dict):
                if self._check_nested_depth(value, max_depth, current_depth + 1):
                    return True
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        if self._check_nested_depth(item, max_depth, current_depth + 1):
                            return True

        return False

    def error_response(self, message: str, errors: List[str] = None):
        """Error response"""
        response = {"success": False, "message": message, "timestamp": datetime.now().isoformat()}
        if errors:
            response["errors"] = errors[:20]

        return jsonify(response), 400


def validate_json(*required_fields):
    """
    Validate JSON request body contains required fields

    Args:
        required_fields: List of required fields

    Returns:
        Decorator
    """

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json(silent=True) or {}
            except Exception:
                return jsonify({"success": False, "message": "Request body is not valid JSON"}), 400

            missing_fields = [field for field in required_fields if field not in data]

            if missing_fields:
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": "Missing required fields",
                            "missing_fields": missing_fields,
                        }
                    ),
                    400,
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


def validate_fields(**validators):
    """
    Validate field values

    Args:
        validators: Mapping of field names to validation functions

    Returns:
        Decorator
    """

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                data = request.get_json(silent=True) or {}
            except Exception:
                return jsonify({"success": False, "message": "Request body is not valid JSON"}), 400

            errors = {}

            for field, validator in validators.items():
                if field in data:
                    is_valid, error_msg = validator(data[field])
                    if not is_valid:
                        errors[field] = error_msg

            if errors:
                return (
                    jsonify(
                        {"success": False, "message": "Field validation failed", "errors": errors}
                    ),
                    400,
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


def validate_pagination(func):
    """
    Validate pagination parameters

    Returns:
        Decorator
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        page = request.args.get("page", 1)
        per_page = request.args.get("per_page", 20)

        try:
            page = max(1, int(page))
            per_page = max(1, min(100, int(per_page)))
        except ValueError:
            return (
                jsonify({"success": False, "message": "Pagination parameters must be integers"}),
                400,
            )

        request.args = request.args.copy()
        request.args["page"] = str(page)
        request.args["per_page"] = str(per_page)

        return func(*args, **kwargs)

    return wrapper


validation_middleware = InputValidationMiddleware()


def setup_validation(app):
    """
    Configure global validation middleware

    Args:
        app: Flask application instance
    """
    validation_middleware.init_app(app)

    validation_middleware.add_whitelist(
        [
            "api.auth_login",
            "api.admins_login",
            "api.admins_refresh_token",
            "api.box_verify",
            "api.devices_device_heartbeats",
            "api.mqtt_publish",
            "api.mqtt_message",
            "scheduled_notify_scheduled_trigger",
            "scheduled_notify_scheduled_cancel",
            "remote_notify_remote_notify_test",
            "health",
            "index",
            "test_auth",
        ]
    )

    log_info("Global input validation middleware enabled")
