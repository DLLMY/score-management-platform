from functools import wraps
from flask import request
from models import Admin, AdminClass, ClassInfo, Device, db
from datetime import datetime
from utils.security import validate_token
from utils.logger import log_access_denied

# 角色定义
ROLES = {
    'admin': '超级管理员',
    'teacher': '教师',
    'head_teacher': '班主任',
    'dashboard': '大屏管理员',
    'viewer': '查看员'
}

# 权限定义
PERMISSIONS = {
    'admin': ['all'],
    'teacher': [
        'view_users', 'edit_users',
        'view_devices', 'manage_devices',
        'view_records', 'create_records',
        'view_classes', 'view_dashboard',
        'manage_scores', 'import_scores',
        'view_exams', 'edit_scores',
        'view_score_records', 'view_score_analysis'
    ],
    'head_teacher': [
        'view_users', 'edit_users',
        'view_devices', 'manage_devices',
        'view_records', 'create_records',
        'view_classes', 'view_dashboard',
        'manage_exams', 'manage_scores',
        'import_scores', 'edit_scores',
        'view_score_records', 'view_score_analysis',
        'publish_exams'
    ],
    'dashboard': [
        'view_devices', 'view_dashboard',
        'view_records', 'view_users'
    ],
    'viewer': [
        'view_users', 'view_devices',
        'view_records', 'view_dashboard',
        'view_classes', 'view_exams',
        'view_score_records', 'view_score_analysis'
    ]
}

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
                elif admin_id:
                    admin = Admin.query.filter_by(id=int(admin_id)).first()
                else:
                    admin = None

                if not admin:
                    log_access_denied(request.path, reason='无效的认证令牌')
                    return {'success': False, 'message': '无效的认证令牌'}, 401

                # 检查权限
                if not has_permission(admin, permission):
                    log_access_denied(request.path, reason=f'权限不足，需要权限: {permission}')
                    return {'success': False, 'message': '权限不足'}, 403
            except Exception as e:
                log_access_denied(request.path, reason='认证失败')
                return {'success': False, 'message': '认证失败'}, 401

            return f(*args, **kwargs)
        return decorated_function
    return decorator

def requires_role(allowed_roles):
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
                elif admin_id:
                    admin = Admin.query.filter_by(id=int(admin_id)).first()
                else:
                    admin = None

                if not admin:
                    log_access_denied(request.path, reason='无效的认证令牌')
                    return {'success': False, 'message': '无效的认证令牌'}, 401

                if admin.role not in allowed_roles:
                    log_access_denied(request.path, reason=f'角色{admin.role}不允许访问此资源')
                    return {'success': False, 'message': '权限不足'}, 403
            except Exception as e:
                log_access_denied(request.path, reason='认证失败')
                return {'success': False, 'message': '认证失败'}, 401

            return f(*args, **kwargs)
        return decorated_function
    return decorator

def has_permission(admin, permission):
    """检查管理员是否有指定权限"""
    if not admin or not admin.role:
        return False
    
    if admin.role == 'admin':
        return True
    
    role_permissions = PERMISSIONS.get(admin.role, [])
    return permission in role_permissions or 'all' in role_permissions

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

def get_admin_class_ids(admin_id):
    """获取管理员关联的班级ID列表"""
    admin = Admin.query.get(admin_id)
    if not admin:
        return []

    if admin.role == 'admin':
        return []

    class_links = AdminClass.query.filter_by(admin_id=admin_id).all()
    return [link.class_info_id for link in class_links]

def can_access_device(admin, device_id):
    """检查管理员是否有权限访问指定设备"""
    if not admin:
        return False

    if admin.role == 'admin':
        return True

    device = Device.query.get(device_id)
    if not device:
        return False

    class_ids = get_admin_class_ids(admin.id)
    if device.class_info_id in class_ids:
        return True

    if device.admin_id == admin.id:
        return True

    return False
