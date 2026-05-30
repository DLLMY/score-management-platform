#!/usr/bin/env python3
"""
安全中间件 - 添加安全响应头和防护措施
"""

from flask import request, g
from functools import wraps
import time
import re

class SecurityMiddleware:
    """安全中间件类"""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """初始化安全中间件"""
        self.app = app
        
        app.after_request(self.add_security_headers)
        app.before_request(self.request_validation)
    
    @staticmethod
    def add_security_headers(response):
        """添加安全响应头"""
        security_headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
        }
        
        for header, value in security_headers.items():
            response.headers[header] = value
        
        response.headers['Server'] = 'ScoreManagementPlatform'
        
        return response
    
    @staticmethod
    def request_validation():
        """请求验证和日志"""
        g.request_start_time = time.time()
        
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            content_type = request.content_type or ''
            if 'application/json' in content_type and request.data:
                try:
                    data = request.get_json(silent=True)
                    if data is None and request.data:
                        from utils.logger import log_error
                        log_error(f"无效的JSON请求体: {request.data[:200]}")
                except Exception:
                    pass
        
        return None

def rate_limit_exempt(f):
    """装饰器：标记视图函数不受速率限制"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return f(*args, **kwargs)
    decorated_function._rate_limit_exempt = True
    return decorated_function

def require_json(f):
    """装饰器：要求请求必须是JSON格式"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            from flask import jsonify
            return jsonify({'success': False, 'message': '请求必须是JSON格式'}), 400
        return f(*args, **kwargs)
    return decorated_function

def validate_pagination(f):
    """装饰器：验证分页参数"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)
        
        if limit is not None and (limit < 1 or limit > 1000):
            from flask import jsonify
            return jsonify({'success': False, 'message': 'limit参数必须在1-1000之间'}), 400
        
        if offset is not None and offset < 0:
            from flask import jsonify
            return jsonify({'success': False, 'message': 'offset参数不能为负数'}), 400
        
        return f(*args, **kwargs)
    return decorated_function

def sanitize_input(unsafe_str, max_length=500):
    """清理输入字符串，防止注入攻击"""
    if not isinstance(unsafe_str, str):
        return unsafe_str
    
    sanitized = re.sub(r'[<>\'\"%;()&+]', '', unsafe_str)
    sanitized = re.sub(r'\s+', ' ', sanitized)
    
    return sanitized[:max_length].strip()

def check_sql_injection(input_str):
    """检测SQL注入特征"""
    if not isinstance(input_str, str):
        return False, None
    
    sql_patterns = [
        r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)',
        r'(--|/\*|\*/|;--)',
        r'(OR|AND)\s+\d+\s*=\s*\d+',
        r'\'\s*(OR|AND)\s*\'',
        r'1\s*=\s*1',
        r'NULL\s*=\s*NULL'
    ]
    
    for pattern in sql_patterns:
        if re.search(pattern, input_str, re.IGNORECASE):
            return True, pattern
    
    return False, None

def log_security_event(event_type, details):
    """记录安全事件"""
    from utils.logger import log_error, log_info
    from flask import request
    
    client_ip = request.remote_addr if request else 'unknown'
    user_agent = request.headers.get('User-Agent', 'unknown') if request else 'unknown'
    
    message = f"[SECURITY] {event_type} | IP: {client_ip} | UA: {user_agent[:50]} | Details: {details}"
    
    if event_type in ['SQL_INJECTION', 'XSS_ATTEMPT', 'INVALID_JSON', 'RATE_LIMIT_EXCEEDED']:
        log_error(message)
    else:
        log_info(message)