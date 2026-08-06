import os
import sys
import json
import logging
import io
from datetime import datetime
from functools import wraps
from flask import request
from logging.handlers import RotatingFileHandler

"\n"
"安全审计日志增强模块"
"提供全面的安全事件监控和审计功能"
"\n"
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)


class SecurityEventType:
    """安全事件类型"""

    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    TOKEN_ISSUED = "token_issued"
    TOKEN_EXPIRED = "token_expired"
    TOKEN_INVALID = "token_invalid"
    TOKEN_REFRESH = "token_refresh"
    ACCESS_GRANTED = "access_granted"
    ACCESS_DENIED = "access_denied"
    PERMISSION_CHECK = "permission_check"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    CSRF_FAILURE = "csrf_failure"
    XSS_ATTEMPT = "xss_attempt"
    SQL_INJECTION_ATTEMPT = "sql_injection_attempt"
    BRUTE_FORCE_ATTEMPT = "brute_force_attempt"
    DATA_EXPORT = "data_export"
    DATA_IMPORT = "data_import"
    DATA_DELETE = "data_delete"
    DATA_MODIFY = "data_modify"
    SENSITIVE_DATA_ACCESS = "sensitive_data_access"
    SYSTEM_CONFIG_CHANGE = "system_config_change"
    USER_MANAGEMENT = "user_management"
    DEVICE_CONTROL = "device_control"
    FIRMWARE_UPGRADE = "firmware_upgrade"
    OTA_START = "ota_start"
    OTA_COMPLETE = "ota_complete"
    OTA_FAILED = "ota_failed"
    DEVICE_ONLINE = "device_online"
    DEVICE_OFFLINE = "device_offline"
    DEVICE_RESTART = "device_restart"
    DEVICE_UNLOCK_A = "device_unlock_a"
    DEVICE_UNLOCK_B = "device_unlock_b"
    DEVICE_UNLOCK_FAILED = "device_unlock_failed"
    SYSTEM_ERROR = "system_error"
    SECURITY_ALERT = "security_alert"


class SecurityLogger:
    """安全审计日志记录器"""

    def __init__(self):
        self.logger = self._setup_logger()
        self._setup_security_log_file()

    def _setup_logger(self):
        """设置安全日志记录器"""
        logger = logging.getLogger("security_audit")
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            security_handler = RotatingFileHandler(
                os.path.join(LOG_DIR, "security_audit.log"), maxBytes=20 * 1024 * 1024, backupCount=20, encoding="utf-8"
            )
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
            )
            security_handler.setFormatter(formatter)
            logger.addHandler(security_handler)
            if sys.platform == "win32":
                utf8_stream = io.TextIOWrapper(
                    sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True
                )
                console_handler = logging.StreamHandler(utf8_stream)
            else:
                console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)
            logger.propagate = False
        return logger

    def _setup_security_log_file(self):
        """设置额外的高危操作日志文件"""
        self.critical_logger = logging.getLogger("security_critical")
        self.critical_logger.setLevel(logging.WARNING)
        if not self.critical_logger.handlers:
            critical_handler = RotatingFileHandler(
                os.path.join(LOG_DIR, "security_critical.log"),
                maxBytes=10 * 1024 * 1024,
                backupCount=30,
                encoding="utf-8",
            )
            formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
            critical_handler.setFormatter(formatter)
            self.critical_logger.addHandler(critical_handler)
            self.critical_logger.propagate = False

    def log_event(self, event_type, description, **kwargs):
        """记录安全事件"""
        try:
            event_data = {
                "timestamp": datetime.now().isoformat(),
                "event_type": event_type,
                "description": description,
                **kwargs,
            }
            self._save_to_database(event_data)
            severity = kwargs.get("severity", "info")
            if severity == "critical":
                self.critical_logger.warning(json.dumps(event_data, ensure_ascii=False))
            else:
                self.logger.info(json.dumps(event_data, ensure_ascii=False))
            return True
        except Exception as e:
            logging.error(f"记录安全事件失败: {e}")
            return False

    def _save_to_database(self, event_data):
        """保存到数据库"""
        try:
            from models import db, OperationLog

            operator = event_data.get("operator", "system")
            ip_address = event_data.get("ip_address", request.remote_addr if request else "unknown")
            log = OperationLog(
                operation_type=event_data["event_type"],
                target_type="security_event",
                description=event_data["description"],
                operator=operator,
                ip_address=ip_address,
            )
            db.session.add(log)
            db.session.commit()
        except Exception as e:
            logging.error(f"保存安全事件到数据库失败: {e}")

    def log_authentication(self, event_type, username, success=True, **kwargs):
        """记录认证事件"""
        status = "成功" if success else "失败"
        description = f"用户认证{status}: {username}"
        if kwargs.get("reason"):
            description += f" - {kwargs['reason']}"
        return self.log_event(
            event_type,
            description,
            username=username,
            success=success,
            severity="critical" if not success else "info",
            **kwargs,
        )

    def log_authorization(self, event_type, resource, user_id=None, success=True, **kwargs):
        """记录授权事件"""
        status = "通过" if success else "拒绝"
        description = f"权限检查{status}: {resource}"
        return self.log_event(
            event_type,
            description,
            user_id=user_id,
            resource=resource,
            success=success,
            severity="warning" if not success else "debug",
            **kwargs,
        )

    def log_data_operation(self, event_type, data_type, record_id=None, **kwargs):
        """记录数据操作事件"""
        description = f"数据操作: {data_type}"
        if record_id:
            description += f" (ID: {record_id})"
        return self.log_event(
            event_type,
            description,
            data_type=data_type,
            record_id=record_id,
            severity="warning" if event_type in ["DATA_DELETE", "DATA_MODIFY"] else "info",
            **kwargs,
        )

    def log_device_control(self, event_type, device_id, action, success=True, **kwargs):
        """记录设备控制事件"""
        status = "成功" if success else "失败"
        description = f"设备控制{status}: {device_id} - {action}"
        return self.log_event(
            event_type,
            description,
            device_id=device_id,
            action=action,
            success=success,
            severity="critical" if not success else "info",
            **kwargs,
        )


security_logger = SecurityLogger()


def audit_log(event_type):
    """审计日志装饰器
    用法:
    @audit_log('user_login')
    def login(username, password):
        # 登录逻辑
        pass
    """

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = datetime.now()
            func_args = {"function": func.__name__, "args": str(args)[:200], "kwargs": str(kwargs)[:200]}
            try:
                result = func(*args, **kwargs)
                duration = (datetime.now() - start_time).total_seconds()
                security_logger.log_event(
                    event_type, f"函数执行成功: {func.__name__}", duration=duration, status="success", **func_args
                )
                return result
            except Exception as e:
                duration = (datetime.now() - start_time).total_seconds()
                security_logger.log_event(
                    event_type,
                    f"函数执行失败: {func.__name__}",
                    duration=duration,
                    status="error",
                    error=str(e),
                    **func_args,
                )
                raise

        return wrapper

    return decorator


def security_event(event_type, severity="info"):
    """安全事件装饰器
    用法:
    @security_event('sensitive_data_access')
    def get_user_sensitive_info(user_id):
        # 获取敏感信息
        pass
    """

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                admin_id = request.headers.get("X-Admin-Id", "unknown") if request else "unknown"
                security_logger.log_event(
                    event_type,
                    f"安全事件: {func.__name__}",
                    function=func.__name__,
                    admin_id=admin_id,
                    severity=severity,
                )
                return result
            except Exception:
                raise

        return wrapper

    return decorator


class SecurityMonitor:
    """安全监控器"""

    def __init__(self):
        self._failed_attempts = {}
        self._rate_limits = {}

    def check_brute_force(self, identifier, max_attempts=5, window=300):
        """检查暴力破解
        Args:
            identifier: 用户标识符（IP/用户名）
            max_attempts: 最大尝试次数
            window: 时间窗口（秒）
        Returns:
            bool: 是否为暴力破解
        """
        now = datetime.now()
        if identifier in self._failed_attempts:
            self._failed_attempts[identifier] = [
                t for t in self._failed_attempts[identifier] if (now - t).seconds < window
            ]
            if len(self._failed_attempts[identifier]) >= max_attempts:
                security_logger.log_event(
                    SecurityEventType.BRUTE_FORCE_ATTEMPT,
                    f"检测到暴力破解尝试: {identifier}",
                    attempts=len(self._failed_attempts[identifier]),
                    identifier=identifier,
                    severity="critical",
                )
                return True
        return False

    def record_failed_attempt(self, identifier):
        """记录失败尝试"""
        if identifier not in self._failed_attempts:
            self._failed_attempts[identifier] = []
        self._failed_attempts[identifier].append(datetime.now())

    def check_rate_limit(self, identifier, max_requests=100, window=60):
        """检查请求频率限制
        Args:
            identifier: 用户标识符
            max_requests: 最大请求数
            window: 时间窗口（秒）
        Returns:
            bool: 是否超出限制
        """
        now = datetime.now()
        if identifier in self._rate_limits:
            self._rate_limits[identifier] = [t for t in self._rate_limits[identifier] if (now - t).seconds < window]
            if len(self._rate_limits[identifier]) >= max_requests:
                security_logger.log_event(
                    SecurityEventType.RATE_LIMIT_EXCEEDED,
                    f"请求频率超限: {identifier}",
                    requests=len(self._rate_limits[identifier]),
                    identifier=identifier,
                    severity="warning",
                )
                return True
        return False

    def record_request(self, identifier):
        """记录请求"""
        if identifier not in self._rate_limits:
            self._rate_limits[identifier] = []
        self._rate_limits[identifier].append(datetime.now())


security_monitor = SecurityMonitor()


def log_login(username, success=True, reason=None, **kwargs):
    """记录登录事件"""
    event_type = SecurityEventType.LOGIN_SUCCESS if success else SecurityEventType.LOGIN_FAILED
    return security_logger.log_authentication(event_type, username, success, reason=reason, **kwargs)


def log_device_unlock(device_id, action, success=True, **kwargs):
    """记录设备开锁事件"""
    event_type_map = {"A": SecurityEventType.DEVICE_UNLOCK_A, "B": SecurityEventType.DEVICE_UNLOCK_B}
    event_type = event_type_map.get(action, SecurityEventType.DEVICE_CONTROL)
    if not success:
        event_type = SecurityEventType.DEVICE_UNLOCK_FAILED
    return security_logger.log_device_control(event_type, device_id, action, success, **kwargs)


def log_data_access(data_type, operation, record_id=None, **kwargs):
    """记录数据访问"""
    event_type_map = {
        "export": SecurityEventType.DATA_EXPORT,
        "import": SecurityEventType.DATA_IMPORT,
        "delete": SecurityEventType.DATA_DELETE,
        "modify": SecurityEventType.DATA_MODIFY,
        "query": SecurityEventType.SENSITIVE_DATA_ACCESS,
    }
    event_type = event_type_map.get(operation, SecurityEventType.SENSITIVE_DATA_ACCESS)
    return security_logger.log_data_operation(event_type, data_type, record_id, **kwargs)


def log_system_change(config_name, old_value, new_value, **kwargs):
    """记录系统配置变更"""
    description = f"系统配置变更: {config_name}"
    if old_value and new_value:
        description += f" ({old_value} -> {new_value})"
    return security_logger.log_event(
        SecurityEventType.SYSTEM_CONFIG_CHANGE,
        description,
        config_name=config_name,
        old_value=old_value,
        new_value=new_value,
        severity="warning",
        **kwargs,
    )


def log_security_alert(alert_type, description, **kwargs):
    """记录安全告警"""
    return security_logger.log_event(
        SecurityEventType.SECURITY_ALERT,
        f"安全告警 [{alert_type}]: {description}",
        alert_type=alert_type,
        severity="critical",
        **kwargs,
    )


def log_permission_denied(resource, reason=None, **kwargs):
    """记录权限拒绝"""
    description = f"权限不足: {resource}"
    if reason:
        description += f" - {reason}"
    return security_logger.log_event(
        SecurityEventType.UNAUTHORIZED_ACCESS,
        description,
        resource=resource,
        reason=reason,
        severity="warning",
        **kwargs,
    )


def register_security_middleware(app):
    """注册安全中间件"""

    @app.before_request
    def before_request_security_check():
        """请求前安全检查"""
        if request:
            client_ip = request.remote_addr
            security_monitor.record_request(client_ip)
            if security_monitor.check_rate_limit(client_ip):
                security_logger.log_event(
                    SecurityEventType.RATE_LIMIT_EXCEEDED,
                    f"IP请求频率超限: {client_ip}",
                    ip_address=client_ip,
                    path=request.path,
                    severity="warning",
                )

    @app.after_request
    def after_request_security_headers(response):
        """添加安全响应头"""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    return app
