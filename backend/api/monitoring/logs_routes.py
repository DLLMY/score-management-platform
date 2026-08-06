from flask import Blueprint, request
from utils.logger import log_frontend_error, log_info, log_error
from utils.response import APIResponse

logs_bp = Blueprint("logs", __name__)


@logs_bp.route("/api/logs/error", methods=["POST"])
def log_error_endpoint():
    """记录前端错误日志"""
    try:
        error_data = request.get_json()
        if not error_data:
            return APIResponse.error(message="Missing error data"), 400

        success = log_frontend_error(error_data)
        if success:
            return APIResponse.success(message="Error log recorded")
        else:
            return APIResponse.error(message="Failed to record error log"), 500
    except Exception as e:
        log_error(f"Failed to process frontend error log request: {e}", exception=e)
        return APIResponse.error(message="Internal server error"), 500


@logs_bp.route("/api/logs/info", methods=["POST"])
def log_info_endpoint():
    """记录前端信息日志"""
    try:
        log_data = request.get_json()
        if not log_data or "message" not in log_data:
            return APIResponse.error(message="Missing log data"), 400

        message = log_data.get("message", "")
        extra_data = {k: v for k, v in log_data.items() if k != "message"}
        log_info(message, **extra_data)

        return APIResponse.success(message="Info log recorded")
    except Exception as e:
        log_error(f"Failed to process frontend info log request: {e}", exception=e)
        return APIResponse.error(message="Internal server error"), 500


def register_logs_routes(app):
    """注册日志路由"""
    app.register_blueprint(logs_bp)
