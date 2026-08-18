"""全局异常处理模块 - 统一错误响应格式和异常处理"""

from flask import jsonify, request
import traceback
import logging

logger = logging.getLogger(__name__)

# 共享错误追踪器：诊断页 /api/diagnostics/errors 读取这里的记录
try:
    from .diagnostics import error_tracker
except Exception:  # pragma: no cover - 避免诊断模块导入失败影响主流程
    error_tracker = None


def _record_server_error(error_type, exc, stack):
    """把服务端异常写入共享 ErrorTracker，供诊断页展示（失败静默）。"""
    if error_tracker is None:
        return
    try:
        error_tracker.record_error(
            error_type=error_type,
            message=str(exc),
            traceback=stack,
        )
    except Exception:
        pass


# ==================== 自定义异常类 ====================


class APIError(Exception):
    """API通用异常"""

    def __init__(self, message, status_code=400, error_code=None, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details


class NotFoundError(APIError):
    """资源不存在异常"""

    def __init__(self, message="资源不存在", error_code="NOT_FOUND"):
        super().__init__(message, status_code=404, error_code=error_code)


class UnauthorizedError(APIError):
    """未授权异常"""

    def __init__(self, message="未授权访问", error_code="UNAUTHORIZED"):
        super().__init__(message, status_code=401, error_code=error_code)


class ForbiddenError(APIError):
    """禁止访问异常"""

    def __init__(self, message="禁止访问", error_code="FORBIDDEN"):
        super().__init__(message, status_code=403, error_code=error_code)


class ValidationError(APIError):
    """参数验证异常"""

    def __init__(self, message="参数验证失败", error_code="VALIDATION_ERROR", details=None):
        super().__init__(message, status_code=400, error_code=error_code, details=details)


class DatabaseError(APIError):
    """数据库操作异常"""

    def __init__(self, message="数据库操作失败", error_code="DATABASE_ERROR", details=None):
        super().__init__(message, status_code=500, error_code=error_code, details=details)


class BusinessError(APIError):
    """业务逻辑异常"""

    def __init__(self, message="业务逻辑错误", error_code="BUSINESS_ERROR", details=None):
        super().__init__(message, status_code=400, error_code=error_code, details=details)


class RateLimitError(APIError):
    """请求频率限制异常"""

    def __init__(self, message="请求过于频繁", error_code="RATE_LIMITED"):
        super().__init__(message, status_code=429, error_code=error_code)


# ==================== 错误响应生成器 ====================


def make_error_response(message, status_code=400, error_code=None, details=None):
    """生成标准化的错误响应"""
    response = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "timestamp": request.timestamp.isoformat() if hasattr(request, "timestamp") else None,
        "path": request.path if request else None,
    }

    if details:
        response["details"] = details

    return jsonify(response), status_code


# ==================== 异常处理器注册 ====================


def register_error_handlers(app):
    """注册全局异常处理器"""

    @app.errorhandler(APIError)
    def handle_api_error(e):
        """处理API自定义异常"""
        logger.error(f"API错误: {e.message} (状态码: {e.status_code}, 错误码: {e.error_code})")
        return make_error_response(
            message=e.message, status_code=e.status_code, error_code=e.error_code, details=e.details
        )

    @app.errorhandler(NotFoundError)
    def handle_not_found_error(e):
        """处理资源不存在异常"""
        logger.warning(f"资源不存在: {e.message}")
        return make_error_response(message=e.message, status_code=404, error_code=e.error_code)

    @app.errorhandler(UnauthorizedError)
    def handle_unauthorized_error(e):
        """处理未授权异常"""
        logger.warning(f"未授权访问: {e.message}")
        return make_error_response(message=e.message, status_code=401, error_code=e.error_code)

    @app.errorhandler(ForbiddenError)
    def handle_forbidden_error(e):
        """处理禁止访问异常"""
        logger.warning(f"禁止访问: {e.message}")
        return make_error_response(message=e.message, status_code=403, error_code=e.error_code)

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        """处理参数验证异常"""
        logger.warning(f"参数验证失败: {e.message}")
        return make_error_response(
            message=e.message, status_code=400, error_code=e.error_code, details=e.details
        )

    @app.errorhandler(400)
    def handle_bad_request(e):
        """处理400错误"""
        logger.warning(f"请求参数错误: {e}")
        return make_error_response(
            message="请求参数错误", status_code=400, error_code="BAD_REQUEST"
        )

    @app.errorhandler(404)
    def handle_not_found(e):
        """处理404错误"""
        logger.warning(f"资源不存在: {request.path}")
        return make_error_response(message="资源不存在", status_code=404, error_code="NOT_FOUND")

    @app.errorhandler(405)
    def handle_method_not_allowed(e):
        """处理405错误"""
        logger.warning(f"方法不允许: {request.method} {request.path}")
        return make_error_response(
            message=f"{request.method} 方法不允许", status_code=405, error_code="METHOD_NOT_ALLOWED"
        )

    @app.errorhandler(500)
    def handle_internal_error(e):
        """处理500错误"""
        error_trace = traceback.format_exc()
        logger.error(f"服务器内部错误: {e}\n{error_trace}")
        _record_server_error("INTERNAL_ERROR", e, error_trace)

        # 生产环境不返回详细错误信息
        return make_error_response(
            message="服务器内部错误", status_code=500, error_code="INTERNAL_ERROR"
        )

    @app.errorhandler(Exception)
    def handle_uncaught_exception(e):
        """处理未捕获的异常"""
        error_trace = traceback.format_exc()
        logger.error(f"未捕获异常: {e}\n{error_trace}")
        _record_server_error("UNCAUGHT_EXCEPTION", e, error_trace)

        return make_error_response(
            message="服务器内部错误", status_code=500, error_code="UNCAUGHT_EXCEPTION"
        )

    logger.info("全局异常处理器已注册")


# ==================== 导出 ====================

__all__ = [
    # 异常类
    "APIError",
    "NotFoundError",
    "UnauthorizedError",
    "ForbiddenError",
    "ValidationError",
    "DatabaseError",
    "BusinessError",
    "RateLimitError",
    # 函数
    "make_error_response",
    "register_error_handlers",
]
