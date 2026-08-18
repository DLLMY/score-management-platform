import os
import sys
import json
import logging
import io
import traceback
from datetime import datetime, timezone
from flask import request, has_request_context
from logging.handlers import TimedRotatingFileHandler
from functools import wraps
from typing import Dict, Any
from enum import Enum

import uuid

"""
统一结构化JSON日志系统
所有日志统一使用JSON格式输出，便于日志收集和分析
特性：
1. 所有日志统一JSON格式
2. 支持日志级别：DEBUG, INFO, WARNING, ERROR, CRITICAL
3. 支持日志分类：系统、API、MQTT、安全、操作、设备
4. 支持请求追踪ID
5. 支持日志轮转和压缩
6. 支持日志发送到外部系统（可选）
"""
try:
    from concurrent_log_handler import ConcurrentRotatingFileHandler

    HAS_CONCURRENT_HANDLER = True
except ImportError:
    HAS_CONCURRENT_HANDLER = False


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogCategory(Enum):
    SYSTEM = "system"
    API = "api"
    MQTT = "mqtt"
    SECURITY = "security"
    OPERATION = "operation"
    DEVICE = "device"
    DATABASE = "database"
    WEBSOCKET = "websocket"
    APPROVAL = "approval"
    NOTIFICATION = "notification"
    USER = "user"
    SCORE = "score"


class StructuredLogFormatter(logging.Formatter):
    """结构化JSON日志格式化器"""

    def format(self, record: logging.LogRecord) -> str:
        # 基础字段
        log_data = {
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        # 添加额外字段（从record中提取）
        if hasattr(record, "category"):
            log_data["category"] = record.category
        if hasattr(record, "trace_id"):
            log_data["trace_id"] = record.trace_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "device_id"):
            log_data["device_id"] = record.device_id
        if hasattr(record, "extra_data"):
            log_data["data"] = record.extra_data
        if hasattr(record, "error_type"):
            log_data["error_type"] = record.error_type
        if hasattr(record, "stack_trace"):
            log_data["stack_trace"] = record.stack_trace
        # 请求上下文信息
        if has_request_context():
            log_data["request"] = {
                "method": request.method,
                "path": request.path,
                "endpoint": request.endpoint,
                "ip": request.remote_addr,
                "user_agent": request.headers.get("User-Agent", ""),
            }
            # 请求参数（仅DEBUG级别）
            if record.levelno == logging.DEBUG:
                log_data["request"]["args"] = dict(request.args)
                if request.is_json:
                    try:
                        log_data["request"]["body"] = request.get_json(silent=True)
                    except Exception:
                        pass
        # 异常信息
        if record.exc_info:
            exc_type, exc_value, exc_tb = record.exc_info
            log_data["exception"] = {
                "type": exc_type.__name__ if exc_type else None,
                "message": str(exc_value) if exc_value else None,
                "traceback": (
                    traceback.format_exception(exc_type, exc_value, exc_tb) if exc_tb else None
                ),
            }
        return json.dumps(log_data, ensure_ascii=False, default=str)


class StructuredLogger:
    """结构化日志记录器"""

    _instance = None  # noqa: F841
    _initialized = False  # noqa: F841

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, log_dir: str = None, log_level: str = "INFO"):
        if self._initialized:
            return
        self._initialized = True
        # 日志目录
        if log_dir is None:
            log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
        # 日志级别
        self.log_level = getattr(logging, log_level.upper(), logging.INFO)
        # 创建主日志记录器
        self.logger = logging.getLogger("structured")
        self.logger.setLevel(self.log_level)
        self.logger.handlers = []  # 清除现有处理器
        # JSON格式化器
        json_formatter = StructuredLogFormatter()
        # 控制台处理器（开发环境）
        if sys.platform == "win32":
            utf8_stream = io.TextIOWrapper(
                sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True
            )
            console_handler = logging.StreamHandler(utf8_stream)
        else:
            console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(json_formatter)
        self.logger.addHandler(console_handler)
        # 主日志文件处理器（按大小轮转，使用ConcurrentRotatingFileHandler解决Windows文件锁问题）
        main_file_handler = ConcurrentRotatingFileHandler(
            os.path.join(log_dir, "app.json.log"),
            maxBytes=50 * 1024 * 1024,
            backupCount=10,
            encoding="utf-8",  # 50MB
        )
        main_file_handler.setLevel(logging.DEBUG)
        main_file_handler.setFormatter(json_formatter)
        self.logger.addHandler(main_file_handler)
        # 错误日志文件处理器（使用ConcurrentRotatingFileHandler）
        error_file_handler = ConcurrentRotatingFileHandler(
            os.path.join(log_dir, "error.json.log"),
            maxBytes=20 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",  # 20MB
        )
        error_file_handler.setLevel(logging.ERROR)
        error_file_handler.setFormatter(json_formatter)
        self.logger.addHandler(error_file_handler)
        # 按日期轮转的日志处理器（使用ConcurrentTimedRotatingFileHandler解决Windows文件锁问题）
        try:
            from concurrent_log_handler import ConcurrentTimedRotatingFileHandler

            daily_file_handler = ConcurrentTimedRotatingFileHandler(
                os.path.join(log_dir, "daily.json.log"),
                when="midnight",
                interval=1,
                backupCount=30,  # 保留30天
                encoding="utf-8",
            )
        except ImportError:
            # 如果不可用，使用标准的TimedRotatingFileHandler
            daily_file_handler = TimedRotatingFileHandler(
                os.path.join(log_dir, "daily.json.log"),
                when="midnight",
                interval=1,
                backupCount=30,  # 保留30天
                encoding="utf-8",
            )
        daily_file_handler.setLevel(logging.INFO)
        daily_file_handler.setFormatter(json_formatter)
        self.logger.addHandler(daily_file_handler)
        # 创建分类日志记录器
        self._category_loggers = {}
        for category in LogCategory:
            self._create_category_logger(category)

    def _create_category_logger(self, category: LogCategory):
        """创建分类日志记录器"""
        category_logger = logging.getLogger(f"structured.{category.value}")
        category_logger.setLevel(self.log_level)
        category_logger.handlers = []
        json_formatter = StructuredLogFormatter()
        # 分类日志文件（使用ConcurrentRotatingFileHandler）
        category_file_handler = ConcurrentRotatingFileHandler(
            os.path.join(self.log_dir, f"{category.value}.json.log"),
            maxBytes=20 * 1024 * 1024,  # 20MB
            backupCount=5,
            encoding="utf-8",
        )
        category_file_handler.setLevel(logging.DEBUG)
        category_file_handler.setFormatter(json_formatter)
        category_logger.addHandler(category_file_handler)
        # 同时输出到主日志
        category_logger.propagate = True
        self._category_loggers[category.value] = category_logger

    def _get_trace_id(self) -> str:
        """获取或生成请求追踪ID"""
        if has_request_context():
            if not hasattr(request, "trace_id"):
                request.trace_id = str(uuid.uuid4())
            return request.trace_id
        return str(uuid.uuid4())

    def _log(
        self,
        level: LogLevel,
        category: LogCategory,
        message: str,
        extra_data: Dict[str, Any] = None,
        exc_info: bool = False,
        user_id: str = None,
        device_id: str = None,
    ):
        """内部日志记录方法"""
        logger = self._category_loggers.get(category.value, self.logger)
        # 创建LogRecord额外属性
        extra = {
            "category": category.value,
            "trace_id": self._get_trace_id(),
            "extra_data": extra_data or {},
        }
        if user_id:
            extra["user_id"] = user_id
        if device_id:
            extra["device_id"] = device_id
        # 记录日志
        log_level = getattr(logging, level.value)
        logger.log(log_level, message, exc_info=exc_info, extra=extra)

    # ============================================
    # 公共日志方法
    # ============================================
    def debug(self, category: LogCategory, message: str, **kwargs):
        """记录DEBUG级别日志"""
        self._log(LogLevel.DEBUG, category, message, kwargs)

    def info(self, category: LogCategory, message: str, **kwargs):
        """记录INFO级别日志"""
        self._log(LogLevel.INFO, category, message, kwargs)

    def warning(self, category: LogCategory, message: str, **kwargs):
        """记录WARNING级别日志"""
        self._log(LogLevel.WARNING, category, message, kwargs)

    def error(self, category: LogCategory, message: str, exc_info: bool = False, **kwargs):
        """记录ERROR级别日志"""
        self._log(LogLevel.ERROR, category, message, kwargs, exc_info=exc_info)

    def critical(self, category: LogCategory, message: str, exc_info: bool = False, **kwargs):
        """记录CRITICAL级别日志"""
        self._log(LogLevel.CRITICAL, category, message, kwargs, exc_info=exc_info)

    # ============================================
    # 便捷方法
    # ============================================
    def system(self, level: LogLevel, message: str, **kwargs):
        """系统日志"""
        self._log(level, LogCategory.SYSTEM, message, kwargs)

    def api(self, level: LogLevel, message: str, **kwargs):
        """API日志"""
        self._log(level, LogCategory.API, message, kwargs)

    def mqtt(self, level: LogLevel, message: str, **kwargs):
        """MQTT日志"""
        self._log(level, LogCategory.MQTT, message, kwargs)

    def security(self, level: LogLevel, message: str, **kwargs):
        """安全日志"""
        self._log(level, LogCategory.SECURITY, message, kwargs)

    def operation(self, level: LogLevel, message: str, **kwargs):
        """操作日志"""
        self._log(level, LogCategory.OPERATION, message, kwargs)

    def device(self, level: LogLevel, message: str, device_id: str = None, **kwargs):
        """设备日志"""
        self._log(level, LogCategory.DEVICE, message, kwargs, device_id=device_id)

    def database(self, level: LogLevel, message: str, **kwargs):
        """数据库日志"""
        self._log(level, LogCategory.DATABASE, message, kwargs)

    def websocket(self, level: LogLevel, message: str, **kwargs):
        """WebSocket日志"""
        self._log(level, LogCategory.WEBSOCKET, message, kwargs)

    def approval(self, level: LogLevel, message: str, **kwargs):
        """审批日志"""
        self._log(level, LogCategory.APPROVAL, message, kwargs)

    def notification(self, level: LogLevel, message: str, **kwargs):
        """通知日志"""
        self._log(level, LogCategory.NOTIFICATION, message, kwargs)

    def user(self, level: LogLevel, message: str, user_id: str = None, **kwargs):
        """用户日志"""
        self._log(level, LogCategory.USER, message, kwargs, user_id=user_id)

    def score(self, level: LogLevel, message: str, **kwargs):
        """积分日志"""
        self._log(level, LogCategory.SCORE, message, kwargs)

    # ============================================
    # 特殊日志方法
    # ============================================
    def log_api_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: int,
        ip: str = None,
        user_id: str = None,
    ):
        """记录API请求"""
        self.api(
            LogLevel.INFO,
            f"API请求: {method} {path}",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            ip=ip,
            user_id=user_id,
        )

    def log_mqtt_message(self, topic: str, direction: str, message: str, device_id: str = None):
        """记录MQTT消息"""
        self.mqtt(
            LogLevel.DEBUG,
            f"MQTT消息: {topic}",
            topic=topic,
            direction=direction,  # 'send' or 'receive'
            message=message,
            device_id=device_id,
        )

    def log_device_event(
        self, device_id: str, event: str, status: str, details: Dict[str, Any] = None
    ):
        """记录设备事件"""
        self.device(
            LogLevel.INFO,
            f"设备事件: {event}",
            device_id=device_id,
            event=event,
            status=status,
            details=details or {},
        )

    def log_score_change(
        self,
        user_id: str,
        user_name: str,
        score_change: int,
        new_score: int,
        reason: str = None,
        operator: str = None,
    ):
        """记录积分变更"""
        self.score(
            LogLevel.INFO,
            f"积分变更: {user_name} {score_change}分",
            user_id=user_id,
            user_name=user_name,
            score_change=score_change,
            new_score=new_score,
            reason=reason,
            operator=operator,
        )

    def log_approval_event(
        self, approval_id: str, event: str, status: str, user_name: str = None, approver: str = None
    ):
        """记录审批事件"""
        self.approval(
            LogLevel.INFO,
            f"审批事件: {event}",
            approval_id=approval_id,
            event=event,
            status=status,
            user_name=user_name,
            approver=approver,
        )

    def log_security_event(
        self,
        event_type: str,
        description: str,
        ip: str = None,
        user_id: str = None,
        details: Dict = None,
    ):
        """记录安全事件"""
        level = (
            LogLevel.WARNING if "failed" in event_type or "denied" in event_type else LogLevel.INFO
        )
        self.security(
            level,
            f"安全事件: {event_type}",
            event_type=event_type,
            description=description,
            ip=ip,
            user_id=user_id,
            details=details or {},
        )

    def log_exception(self, category: LogCategory, message: str, exception: Exception, **kwargs):
        """记录异常"""
        self._log(
            LogLevel.ERROR,
            category,
            message,
            kwargs,
            exc_info=True,
            error_type=type(exception).__name__,
        )


structured_logger = StructuredLogger()


def get_logger() -> StructuredLogger:
    """获取日志实例"""
    return structured_logger


def log_debug(category: LogCategory, message: str, **kwargs):
    """记录DEBUG日志"""
    structured_logger.debug(category, message, **kwargs)


def log_info(category: LogCategory, message: str, **kwargs):
    """记录INFO日志"""
    structured_logger.info(category, message, **kwargs)


def log_warning(category: LogCategory, message: str, **kwargs):
    """记录WARNING日志"""
    structured_logger.warning(category, message, **kwargs)


def log_error(category: LogCategory, message: str, exc_info: bool = False, **kwargs):
    """记录ERROR日志"""
    structured_logger.error(category, message, exc_info=exc_info, **kwargs)


def log_critical(category: LogCategory, message: str, exc_info: bool = False, **kwargs):
    """记录CRITICAL日志"""
    structured_logger.critical(category, message, exc_info=exc_info, **kwargs)


def log_exception(category: LogCategory, message: str, exception: Exception, **kwargs):
    """记录异常"""
    structured_logger.log_exception(category, message, exception, **kwargs)


def log_function_call(category: LogCategory = LogCategory.SYSTEM):
    """函数调用日志装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            func_name = func.__name__
            structured_logger.debug(
                category,
                f"函数调用: {func_name}",
                function=func_name,
                args_count=len(args),
                kwargs_keys=list(kwargs.keys()),
            )
            try:
                result = func(*args, **kwargs)  # noqa: F841
                structured_logger.debug(
                    category, f"函数返回: {func_name}", function=func_name, success=True
                )
                return result
            except Exception as e:
                structured_logger.log_exception(
                    category, f"函数异常: {func_name}", e, function=func_name
                )
                raise

        return wrapper

    return decorator


def log_api_endpoint(category: LogCategory = LogCategory.API):
    """API端点日志装饰器"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = datetime.now(timezone.utc).replace(tzinfo=None)
            func_name = func.__name__
            try:
                result = func(*args, **kwargs)  # noqa: F841
                duration = (
                    datetime.now(timezone.utc).replace(tzinfo=None) - start_time
                ).total_seconds() * 1000
                # 获取响应状态码
                status_code = getattr(result, "status_code", 200) if result else 200
                structured_logger.log_api_request(
                    method=request.method if has_request_context() else "UNKNOWN",
                    path=request.path if has_request_context() else func_name,
                    status_code=status_code,
                    duration_ms=int(duration),
                )
                return result
            except Exception as e:
                duration = (
                    datetime.now(timezone.utc).replace(tzinfo=None) - start_time
                ).total_seconds() * 1000
                structured_logger.log_exception(
                    category, f"API异常: {func_name}", e, duration_ms=int(duration)
                )
                raise

        return wrapper

    return decorator


def setup_request_logging(app):
    """设置Flask请求日志中间件"""

    @app.before_request
    def before_request():
        if has_request_context():
            request.trace_id = str(uuid.uuid4())
            request.start_time = datetime.now(timezone.utc).replace(tzinfo=None)
            structured_logger.api(
                LogLevel.DEBUG,
                f"请求开始: {request.method} {request.path}",
                method=request.method,
                path=request.path,
                endpoint=request.endpoint,
                ip=request.remote_addr,
            )

    @app.after_request
    def after_request(response):
        if has_request_context() and hasattr(request, "start_time"):
            duration = (
                datetime.now(timezone.utc).replace(tzinfo=None) - request.start_time
            ).total_seconds() * 1000
            structured_logger.log_api_request(
                method=request.method,
                path=request.path,
                status_code=response.status_code,
                duration_ms=int(duration),
                ip=request.remote_addr,
            )
            # 添加追踪ID到响应头
            if hasattr(request, "trace_id"):
                response.headers["X-Trace-Id"] = request.trace_id
        return response

    @app.errorhandler(Exception)
    def handle_exception(e):
        if has_request_context():
            structured_logger.log_exception(
                LogCategory.SYSTEM, "未处理异常", e, path=request.path, method=request.method
            )
        raise e


__all__ = [
    "StructuredLogger",
    "LogLevel",
    "LogCategory",
    "structured_logger",
    "get_logger",
    "log_debug",
    "log_info",
    "log_warning",
    "log_error",
    "log_critical",
    "log_exception",
    "log_function_call",
    "log_api_endpoint",
    "setup_request_logging",
]
