import logging
import os
import json
from datetime import datetime
from flask import request, g
from logging.handlers import RotatingFileHandler

# 创建日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# 配置日志格式
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# 创建主日志记录器
logger = logging.getLogger("score_management")
logger.setLevel(logging.DEBUG)

# 创建控制台处理器
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))

# 创建文件处理器（带轮转）
file_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "app.log"),
    maxBytes=10 * 1024 * 1024,
    backupCount=5,
    encoding="utf-8",  # 10MB  # 保留5个备份
)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))

# 创建错误日志处理器
error_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "error.log"),
    maxBytes=5 * 1024 * 1024,
    backupCount=3,
    encoding="utf-8",  # 5MB
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))

# 添加处理器到日志记录器
logger.addHandler(console_handler)
logger.addHandler(file_handler)
logger.addHandler(error_handler)


def log_debug(message, **kwargs):
    """记录DEBUG级别日志"""
    extra_info = json.dumps(kwargs, ensure_ascii=False) if kwargs else ""
    if extra_info:
        logger.debug(f"{message} | {extra_info}")
    else:
        logger.debug(message)


def log_info(message, **kwargs):
    """记录INFO级别日志"""
    extra_info = json.dumps(kwargs, ensure_ascii=False) if kwargs else ""
    if extra_info:
        logger.info(f"{message} | {extra_info}")
    else:
        logger.info(message)


def log_warning(message, **kwargs):
    """记录WARNING级别日志"""
    extra_info = json.dumps(kwargs, ensure_ascii=False) if kwargs else ""
    if extra_info:
        logger.warning(f"{message} | {extra_info}")
    else:
        logger.warning(message)


def log_error(message, exception=None, **kwargs):
    """记录ERROR级别日志"""
    extra_info = json.dumps(kwargs, ensure_ascii=False) if kwargs else ""
    if exception:
        import traceback

        stack_trace = traceback.format_exc()
        if extra_info:
            logger.error(f"{message} | Exception: {exception} | {extra_info}\n{stack_trace}")
        else:
            logger.error(f"{message} | Exception: {exception}\n{stack_trace}")
    else:
        if extra_info:
            logger.error(f"{message} | {extra_info}")
        else:
            logger.error(message)


def log_critical(message, exception=None, **kwargs):
    """记录CRITICAL级别日志"""
    extra_info = json.dumps(kwargs, ensure_ascii=False) if kwargs else ""
    if exception:
        import traceback

        stack_trace = traceback.format_exc()
        if extra_info:
            logger.critical(f"{message} | Exception: {exception} | {extra_info}\n{stack_trace}")
        else:
            logger.critical(f"{message} | Exception: {exception}\n{stack_trace}")
    else:
        if extra_info:
            logger.critical(f"{message} | {extra_info}")
        else:
            logger.critical(message)


def log_operation(
    operation_type,
    target_type=None,
    target_id=None,
    description=None,
    before_data=None,
    after_data=None,
    operator=None,
):
    """记录操作日志到数据库。

    operator 缺省时优先取 Bearer 登录用户（g.current_user），再回退
    X-Admin-Id/X-Admin-Name 头，最后兜底 "system"（适配新旧两套鉴权体系）。
    before/after 序列化带 default=str 兜底（datetime/ORM 对象不再导致审计丢失）。
    """
    try:
        from models import db, OperationLog

        user_id = None
        if operator is None:
            user = getattr(g, "current_user", None)
            if user is not None:
                try:
                    user_id = getattr(user, "id", None)
                    operator = (
                        getattr(user, "username", None)
                        or getattr(user, "name", None)
                        or f"管理员_{user_id}"
                    )
                except Exception:
                    # detached/expired 实例（请求级 session 已被销毁）→ 属性访问会触发
                    # refresh 抛 DetachedInstanceError（非 AttributeError，getattr 兜底失效）。
                    # 降级从 __dict__ 读已加载值，避免操作日志整条丢失。
                    user_attrs = getattr(user, "__dict__", {})
                    user_id = user_attrs.get("id")
                    operator = (
                        user_attrs.get("username")
                        or user_attrs.get("name")
                        or f"管理员_{user_id}"
                    )
            if operator is None:
                admin_id = request.headers.get("X-Admin-Id")
                admin_name = request.headers.get("X-Admin-Name")
                if admin_name:
                    operator = admin_name
                elif admin_id:
                    operator = f"管理员_{admin_id}"
                else:
                    operator = "system"

        ip_address = request.remote_addr if request else None

        log = OperationLog(
            operation_type=operation_type,
            target_type=target_type,
            target_id=target_id,
            description=description,
            before_data=(
                json.dumps(before_data, ensure_ascii=False, default=str) if before_data else None
            ),
            after_data=(
                json.dumps(after_data, ensure_ascii=False, default=str) if after_data else None
            ),
            operator=operator,
            user_id=user_id,
            ip_address=ip_address,
        )
        db.session.add(log)
        db.session.commit()

        # 同时记录到日志文件
        log_info(
            f"操作日志: {operation_type} | {target_type} | {target_id} | {description}",
            operator=operator,
            ip=ip_address,
        )

        return True
    except Exception as e:
        log_error(f"记录操作日志失败: {e}", exception=e)
        return False


def log_access(endpoint=None, method=None, status_code=None, duration=None):
    """记录API访问日志"""
    try:
        if endpoint is None:
            endpoint = request.path if request else "unknown"
        if method is None:
            method = request.method if request else "unknown"
        if status_code is None:
            status_code = "unknown"

        client_ip = request.remote_addr if request else "unknown"
        user_agent = request.headers.get("User-Agent", "unknown") if request else "unknown"

        log_info(
            f"API访问: {method} {endpoint} | 状态: {status_code} | 耗时: {duration}ms",
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except Exception as e:
        log_error(f"记录访问日志失败: {e}", exception=e)


def log_frontend_error(error_data):
    """记录前端上报的错误"""
    try:
        error = error_data.get("error", "未知错误")
        stack = error_data.get("stack", "")
        component_stack = error_data.get("componentStack", "")
        timestamp = error_data.get("timestamp", datetime.now().isoformat())
        url = error_data.get("url", "unknown")

        log_error(
            f"前端错误: {error}",
            stack=stack,
            component_stack=component_stack,
            url=url,
            timestamp=timestamp,
        )
        return True
    except Exception as e:
        log_error(f"记录前端错误日志失败: {e}", exception=e)
        return False


# ==================== 安全审计日志 ====================


def log_security_event(event_type, description, **kwargs):
    """记录安全事件日志"""
    try:
        # 安全事件类型分类
        security_types = {
            "login_success": "登录成功",
            "login_failed": "登录失败",
            "logout": "登出",
            "access_denied": "访问拒绝",
            "token_expired": "令牌过期",
            "token_invalid": "无效令牌",
            "csrf_failure": "CSRF验证失败",
            "rate_limit_exceeded": "请求限流",
            "brute_force_attempt": "暴力破解尝试",
            "privilege_escalation": "权限提升尝试",
            "data_export": "数据导出",
            "data_import": "数据导入",
            "configuration_change": "配置变更",
            "system_startup": "系统启动",
            "system_shutdown": "系统关闭",
        }

        event_label = security_types.get(event_type, event_type)

        # 获取请求信息
        client_ip = request.remote_addr if request else "unknown"
        user_agent = request.headers.get("User-Agent", "unknown") if request else "unknown"
        endpoint = request.path if request else "unknown"
        method = request.method if request else "unknown"

        # 记录到安全日志文件
        security_logger = logging.getLogger("security")
        security_logger.setLevel(logging.INFO)

        # 创建安全日志处理器（如果不存在）
        if not security_logger.handlers:
            security_handler = RotatingFileHandler(
                os.path.join(LOG_DIR, "security.log"),
                maxBytes=10 * 1024 * 1024,
                backupCount=10,
                encoding="utf-8",
            )
            security_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
            security_logger.addHandler(security_handler)
            security_logger.propagate = False  # 避免重复记录

        # 记录日志
        security_logger.info(
            f"安全事件: {event_label} | {description}",
            extra={
                "event_type": event_type,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "endpoint": endpoint,
                "method": method,
                **kwargs,
            },
        )

        # 同时记录到操作日志表
        log_operation(
            operation_type="security_event",
            target_type=event_type,
            description=f"{event_label}: {description}",
            after_data={**kwargs, "client_ip": client_ip, "endpoint": endpoint},
        )

        return True
    except Exception as e:
        log_error(f"记录安全事件日志失败: {e}", exception=e)
        return False


def log_login_attempt(username, success=False, reason=None):
    """记录登录尝试"""
    event_type = "login_success" if success else "login_failed"
    description = f"用户登录尝试: {username}"
    if reason:
        description += f" | 原因: {reason}"

    log_security_event(event_type, description, username=username, success=success)


def log_access_denied(endpoint, reason=None):
    """记录访问拒绝事件"""
    description = f"访问被拒绝: {endpoint}"
    if reason:
        description += f" | 原因: {reason}"

    log_security_event("access_denied", description)


def log_token_issue(token_type, admin_id=None, success=True, reason=None):
    """记录令牌发放事件"""
    event_type = "token_expired" if not success else "token_invalid" if reason else "login_success"
    description = f"令牌{token_type}处理: {'成功' if success else '失败'}"
    if admin_id:
        description += f" | 管理员ID: {admin_id}"
    if reason:
        description += f" | 原因: {reason}"

    log_security_event(
        event_type, description, token_type=token_type, admin_id=admin_id, success=success
    )


def log_data_access(operation, data_type, record_count=0, admin_id=None):
    """记录数据访问事件"""
    event_type = {
        "export": "data_export",
        "import": "data_import",
        "query": "data_query",
        "update": "data_update",
        "delete": "data_delete",
    }.get(operation, "data_access")

    description = f"数据{operation}: {data_type} | 记录数: {record_count}"
    log_security_event(
        event_type,
        description,
        operation=operation,
        data_type=data_type,
        record_count=record_count,
        admin_id=admin_id,
    )


# 请求日志中间件
def log_request_middleware(app):
    """注册请求日志中间件"""

    @app.before_request
    def before_request():
        request.start_time = datetime.now()
        log_debug(
            f"请求开始: {request.method} {request.path}",
            query=dict(request.args),
            client_ip=request.remote_addr,
        )

    @app.after_request
    def after_request(response):
        if hasattr(request, "start_time"):
            duration = (datetime.now() - request.start_time).microseconds // 1000
        else:
            duration = None
        log_access(
            endpoint=request.path,
            method=request.method,
            status_code=response.status_code,
            duration=duration,
        )
        return response

    @app.errorhandler(Exception)
    def handle_exception(e):
        log_error(
            f"未处理异常: {e}",
            exception=e,
            path=request.path if request else "unknown",
            method=request.method if request else "unknown",
        )
        return e
