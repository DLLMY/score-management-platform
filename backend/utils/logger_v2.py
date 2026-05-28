#!/usr/bin/env python3
"""
日志系统升级版 - 结构化日志和性能监控
"""

import logging
import os
import json
import time
import threading
from datetime import datetime
from flask import request, g
from logging.handlers import RotatingFileHandler
from functools import wraps

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

class JSONFormatter(logging.Formatter):
    """JSON格式日志格式化器"""
    
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        if hasattr(record, 'extra_data'):
            log_data['data'] = record.extra_data
        
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_data, ensure_ascii=False)


class PerformanceLogger:
    """性能日志记录器"""
    
    def __init__(self):
        self.slow_query_threshold = 1.0  # 秒
        self.slow_request_threshold = 2.0  # 秒
        self.logger = logging.getLogger('performance')
    
    def log_query(self, query, duration):
        """记录数据库查询性能"""
        if duration > self.slow_query_threshold:
            self.logger.warning(
                f"Slow query detected: {duration:.3f}s",
                extra={'extra_data': {'query': query, 'duration': duration}}
            )
    
    def log_request(self, endpoint, method, duration, status_code):
        """记录API请求性能"""
        if duration > self.slow_request_threshold:
            self.logger.warning(
                f"Slow request detected: {method} {endpoint} took {duration:.3f}s",
                extra={'extra_data': {
                    'endpoint': endpoint,
                    'method': method,
                    'duration': duration,
                    'status': status_code
                }}
            )


class SecurityLogger:
    """安全日志记录器"""
    
    def __init__(self):
        self.logger = logging.getLogger('security')
        self.failed_login_threshold = 5
        self.failed_logins = {}
    
    def log_login_attempt(self, username, success, ip_address):
        """记录登录尝试"""
        self.logger.info(
            f"Login attempt: {'SUCCESS' if success else 'FAILED'} - {username}",
            extra={'extra_data': {
                'username': username,
                'success': success,
                'ip': ip_address
            }}
        )
        
        if not success:
            if username not in self.failed_logins:
                self.failed_logins[username] = []
            self.failed_logins[username].append(datetime.now())
            
            # 清理超过5分钟的记录
            cutoff = datetime.now().timestamp() - 300
            self.failed_logins[username] = [
                t for t in self.failed_logins[username] 
                if t.timestamp() > cutoff
            ]
            
            if len(self.failed_logins[username]) >= self.failed_login_threshold:
                self.logger.warning(
                    f"Multiple failed login attempts detected for {username}",
                    extra={'extra_data': {
                        'username': username,
                        'attempts': len(self.failed_logins[username]),
                        'ip': ip_address
                    }}
                )
    
    def log_auth_failure(self, reason, ip_address, username=None):
        """记录认证失败"""
        self.logger.warning(
            f"Authentication failure: {reason}",
            extra={'extra_data': {
                'reason': reason,
                'ip': ip_address,
                'username': username
            }}
        )
    
    def log_permission_denied(self, resource, username, ip_address):
        """记录权限拒绝"""
        self.logger.warning(
            f"Permission denied: {resource}",
            extra={'extra_data': {
                'resource': resource,
                'username': username,
                'ip': ip_address
            }}
        )


class MQTTLogger:
    """MQTT日志记录器"""
    
    def __init__(self):
        self.logger = logging.getLogger('mqtt')
        self.message_count = 0
        self.last_stats_time = datetime.now()
        self.stats_lock = threading.Lock()
    
    def log_message(self, topic, direction, qos=0, payload_size=0):
        """记录MQTT消息"""
        self.logger.debug(
            f"MQTT {direction}: {topic}",
            extra={'extra_data': {
                'topic': topic,
                'direction': direction,
                'qos': qos,
                'payload_size': payload_size
            }}
        )
        
        with self.stats_lock:
            self.message_count += 1
            now = datetime.now()
            elapsed = (now - self.last_stats_time).total_seconds()
            
            if elapsed >= 60:
                msg_rate = self.message_count / elapsed if elapsed > 0 else 0
                self.logger.info(
                    f"MQTT Stats: {self.message_count} messages in {elapsed:.1f}s ({msg_rate:.2f} msg/s)",
                    extra={'extra_data': {
                        'message_count': self.message_count,
                        'elapsed': elapsed,
                        'rate': msg_rate
                    }}
                )
                self.message_count = 0
                self.last_stats_time = now
    
    def log_connection(self, broker, status, error=None):
        """记录MQTT连接状态"""
        if error:
            self.logger.error(
                f"MQTT connection {status}: {broker} - {error}",
                extra={'extra_data': {
                    'broker': broker,
                    'status': status,
                    'error': str(error)
                }}
            )
        else:
            self.logger.info(
                f"MQTT connection {status}: {broker}",
                extra={'extra_data': {
                    'broker': broker,
                    'status': status
                }}
            )


performance_logger = PerformanceLogger()
security_logger = SecurityLogger()
mqtt_logger = MQTTLogger()


def setup_logging(app):
    """配置增强版日志系统"""
    
    # 主日志器
    main_logger = logging.getLogger('score_management')
    main_logger.setLevel(logging.DEBUG)
    
    # 控制台处理器 - 彩色输出
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    ))
    main_logger.addHandler(console_handler)
    
    # 文件处理器 - JSON格式
    json_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, 'app.json.log'),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    json_handler.setLevel(logging.DEBUG)
    json_handler.setFormatter(JSONFormatter())
    main_logger.addHandler(json_handler)
    
    # 错误日志处理器
    error_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, 'error.log'),
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s\n%(pathname)s:%(lineno)d\n'
    ))
    main_logger.addHandler(error_handler)
    
    # 性能日志处理器
    perf_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, 'performance.log'),
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding='utf-8'
    )
    perf_handler.setLevel(logging.WARNING)
    perf_logger.logger.addHandler(perf_handler)
    
    # 安全日志处理器
    sec_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, 'security.log'),
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    sec_handler.setLevel(logging.INFO)
    security_logger.logger.addHandler(sec_handler)
    security_logger.logger.setLevel(logging.INFO)
    
    # MQTT日志处理器
    mqtt_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, 'mqtt.log'),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    mqtt_handler.setLevel(logging.DEBUG)
    mqtt_logger.logger.addHandler(mqtt_handler)
    mqtt_logger.logger.setLevel(logging.DEBUG)
    
    # 注册请求日志中间件
    @app.before_request
    def before_request():
        g.start_time = time.time()
        request_ip = request.remote_addr if request else 'unknown'
        main_logger.debug(
            f"Request started: {request.method} {request.path}",
            extra={'extra_data': {
                'method': request.method,
                'path': request.path,
                'ip': request_ip
            }}
        )
    
    @app.after_request
    def after_request(response):
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            
            # 记录性能日志
            performance_logger.log_request(
                request.path,
                request.method,
                duration,
                response.status_code
            )
            
            # 记录访问日志
            main_logger.info(
                f"API访问: {request.method} {request.path} | 状态: {response.status_code} | 耗时: {duration*1000:.0f}ms",
                extra={'extra_data': {
                    'method': request.method,
                    'path': request.path,
                    'status': response.status_code,
                    'duration_ms': round(duration * 1000, 2),
                    'ip': request.remote_addr
                }}
            )
        
        return response
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        main_logger.error(
            f"Unhandled exception: {str(e)}",
            extra={'extra_data': {
                'path': request.path if request else 'unknown',
                'method': request.method if request else 'unknown',
                'exception': str(e)
            }}
        )
        return {'error': 'Internal server error'}, 500
    
    return main_logger


def log_performance(query_type):
    """性能日志装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            
            performance_logger.logger.debug(
                f"{query_type} completed in {duration:.3f}s",
                extra={'extra_data': {
                    'query_type': query_type,
                    'duration': duration,
                    'function': func.__name__
                }}
            )
            
            return result
        return wrapper
    return decorator
