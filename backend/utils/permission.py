from functools import wraps
from flask import request
from models import Admin, AdminClass, ClassInfo, db
from datetime import datetime
from utils.security import validate_token
from utils.logger import log_access_denied

def requires_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        admin_id = request.headers.get('X-Admin-Id')

        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.replace('Bearer ', '')
        elif admin_id:
            token = admin_id

        if not token:
            log_access_denied(request.path, reason='未提供认证信息')
            return {'success': False, 'message': '未提供认证信息'}, 401

        try:
            payload = validate_token(token, 'access')
            if payload:
                admin = Admin.query.filter_by(id=int(payload['sub'])).first()
            else:
                admin = Admin.query.filter_by(id=token).first()

            if not admin:
                log_access_denied(request.path, reason='无效的认证令牌')
                return {'success': False, 'message': '无效的认证令牌'}, 401
        except Exception as e:
            log_access_denied(request.path, reason='认证失败')
            return {'success': False, 'message': '认证失败'}, 401

        return f(*args, **kwargs)
    return decorated_function

def requires_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            admin_id = request.headers.get('X-Admin-Id')

            token = None
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.replace('Bearer ', '')
            elif admin_id:
                token = admin_id

            if not token:
                log_access_denied(request.path, reason='未提供认证信息')
                return {'success': False, 'message': '未提供认证信息'}, 401

            try:
                payload = validate_token(token, 'access')
                if payload:
                    admin = Admin.query.filter_by(id=int(payload['sub'])).first()
                else:
                    admin = Admin.query.filter_by(id=token).first()

                if not admin:
                    log_access_denied(request.path, reason='无效的认证令牌')
                    return {'success': False, 'message': '无效的认证令牌'}, 401

                if admin.role != 'admin':
                    log_access_denied(request.path, reason='权限不足')
                    return {'success': False, 'message': '权限不足'}, 403
            except Exception as e:
                log_access_denied(request.path, reason='认证失败')
                return {'success': False, 'message': '认证失败'}, 401

            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_current_admin():
    auth_header = request.headers.get('Authorization')
    admin_id = request.headers.get('X-Admin-Id')

    token = None
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '')
    elif admin_id:
        token = admin_id

    if not token:
        return None

    try:
        payload = validate_token(token, 'access')
        if payload:
            return Admin.query.filter_by(id=int(payload['sub'])).first()
        else:
            return Admin.query.filter_by(id=token).first()
    except Exception:
        return None

def get_allowed_classes(admin_id):
    """获取管理员允许访问的班级列表"""
    admin = Admin.query.get(admin_id)
    if not admin:
        return None

    if admin.role == 'admin':
        return None

    class_links = AdminClass.query.filter_by(admin_id=admin_id).all()
    class_ids = [link.class_info_id for link in class_links]
    classes = ClassInfo.query.filter(ClassInfo.id.in_(class_ids), ClassInfo.is_active == True).all()

    return [c.name for c in classes]
