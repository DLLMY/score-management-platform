import time
from functools import wraps
from flask import request, g
from models import (
    Admin,
    AdminClass,
    ClassInfo,
    Device,
    AdminRole,
    RolePermissionMapping,
    RoleHierarchy,
    User,
)
from utils.security import validate_token
from utils.logger import log_access_denied

# 角色定义
ROLES = {
    "admin": "超级管理员",
    "super_admin": "超级管理员",
    "teacher": "教师",
    "head_teacher": "班主任",
    "dashboard": "大屏管理员",
    "viewer": "查看员",
}

# 权限定义
PERMISSIONS = {
    "admin": ["all"],
    "super_admin": ["all"],
    "teacher": [
        "view_users",
        "edit_users",
        "view_devices",
        "manage_devices",
        "view_records",
        "create_records",
        "view_classes",
        "view_dashboard",
        "manage_scores",
        "import_scores",
        "view_exams",
        "edit_scores",
        "view_score_records",
        "view_score_analysis",
        "phonebox.unlock.manage",
    ],
    "head_teacher": [
        "view_users",
        "edit_users",
        "view_devices",
        "manage_devices",
        "view_records",
        "create_records",
        "view_classes",
        "view_dashboard",
        "manage_exams",
        "manage_scores",
        "import_scores",
        "edit_scores",
        "view_score_records",
        "view_score_analysis",
        "publish_exams",
    ],
    "dashboard": ["view_devices", "view_dashboard", "view_records", "view_users"],
    "viewer": [
        "view_users",
        "view_devices",
        "view_records",
        "view_dashboard",
        "view_classes",
        "view_exams",
        "view_score_records",
        "view_score_analysis",
    ],
}


def requires_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        admin_id_header = request.headers.get("X-Admin-Id")

        if not auth_header or not auth_header.startswith("Bearer "):
            log_access_denied(request.path, reason="未提供有效的认证令牌")
            return {"success": False, "message": "未提供有效的认证令牌"}, 401

        token = auth_header.replace("Bearer ", "")

        try:
            payload = validate_token(token, "access")
            if not payload:
                log_access_denied(request.path, reason="无效或过期的认证令牌")
                return {"success": False, "message": "无效或过期的认证令牌"}, 401

            token_admin_id = int(payload["sub"])
            if admin_id_header and int(admin_id_header) != token_admin_id:
                log_access_denied(request.path, reason="X-Admin-Id与令牌不匹配")
                return {"success": False, "message": "请求头中的X-Admin-Id与认证令牌不匹配"}, 401

            admin = Admin.query.filter_by(id=token_admin_id).first()
            if not admin:
                log_access_denied(request.path, reason="管理员不存在")
                return {"success": False, "message": "管理员不存在"}, 401
        except Exception:
            log_access_denied(request.path, reason="认证失败")
            return {"success": False, "message": "认证失败"}, 401

        return f(*args, **kwargs)

    return decorated_function


def requires_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            admin_id_header = request.headers.get("X-Admin-Id")

            if not auth_header or not auth_header.startswith("Bearer "):
                log_access_denied(request.path, reason="未提供有效的认证令牌")
                return {"success": False, "message": "未提供有效的认证令牌"}, 401

            token = auth_header.replace("Bearer ", "")

            try:
                payload = validate_token(token, "access")
                if not payload:
                    log_access_denied(request.path, reason="无效或过期的认证令牌")
                    return {"success": False, "message": "无效或过期的认证令牌"}, 401

                token_admin_id = int(payload["sub"])
                if admin_id_header and int(admin_id_header) != token_admin_id:
                    log_access_denied(request.path, reason="X-Admin-Id与令牌不匹配")
                    return {
                        "success": False,
                        "message": "请求头中的X-Admin-Id与认证令牌不匹配",
                    }, 401

                admin = Admin.query.filter_by(id=token_admin_id).first()
                if not admin:
                    log_access_denied(request.path, reason="管理员不存在")
                    return {"success": False, "message": "管理员不存在"}, 401

                g.current_user = admin

                if not has_permission(admin, permission):
                    log_access_denied(request.path, reason=f"权限不足，需要权限: {permission}")
                    return {"success": False, "message": "权限不足"}, 403
            except Exception:
                log_access_denied(request.path, reason="认证失败")
                return {"success": False, "message": "认证失败"}, 401

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def requires_role(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            admin_id_header = request.headers.get("X-Admin-Id")

            if not auth_header or not auth_header.startswith("Bearer "):
                log_access_denied(request.path, reason="未提供有效的认证令牌")
                return {"success": False, "message": "未提供有效的认证令牌"}, 401

            token = auth_header.replace("Bearer ", "")

            try:
                payload = validate_token(token, "access")
                if not payload:
                    log_access_denied(request.path, reason="无效或过期的认证令牌")
                    return {"success": False, "message": "无效或过期的认证令牌"}, 401

                token_admin_id = int(payload["sub"])
                if admin_id_header and int(admin_id_header) != token_admin_id:
                    log_access_denied(request.path, reason="X-Admin-Id与令牌不匹配")
                    return {
                        "success": False,
                        "message": "请求头中的X-Admin-Id与认证令牌不匹配",
                    }, 401

                admin = Admin.query.filter_by(id=token_admin_id).first()
                if not admin:
                    log_access_denied(request.path, reason="管理员不存在")
                    return {"success": False, "message": "管理员不存在"}, 401

                g.current_user = admin

                if admin.role not in allowed_roles:
                    log_access_denied(request.path, reason=f"角色{admin.role}不允许访问此资源")
                    return {"success": False, "message": "权限不足"}, 403
            except Exception:
                log_access_denied(request.path, reason="认证失败")
                return {"success": False, "message": "认证失败"}, 401

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def _get_inherited_permissions(role_code, visited=None):
    """递归获取角色的继承权限（从数据库RoleHierarchy表）"""
    if visited is None:
        visited = set()
    if role_code in visited:
        return set()
    visited.add(role_code)

    permissions = set()
    # 获取直接分配的权限
    mappings = RolePermissionMapping.query.filter_by(role_code=role_code).all()
    for m in mappings:
        permissions.add(m.permission_code)

    # 获取父角色的权限
    hierarchies = RoleHierarchy.query.filter_by(child_role_code=role_code).all()
    for h in hierarchies:
        if h.parent_role_code:
            permissions.update(_get_inherited_permissions(h.parent_role_code, visited))

    return permissions


# F9 修复: 权限码 TTL 缓存（30s）——原每次请求重查 AdminRole/mappings/继承，全接口必经 has_permission
_PERM_CACHE: dict = {}
_PERM_CACHE_TTL = 30


def _get_admin_permission_codes(admin):
    """从数据库中获取管理员的所有有效权限码（带 30s TTL 缓存；角色变更最长 30s 生效）"""
    if not admin:
        return set()

    cache_key = int(admin.id)
    cached = _PERM_CACHE.get(cache_key)
    if cached and time.time() - cached[0] < _PERM_CACHE_TTL:
        return set(cached[1])

    permissions = set()
    # 通过AdminRole获取管理员的角色
    admin_roles = AdminRole.query.filter_by(admin_id=admin.id).all()
    role_codes = [ar.role_code for ar in admin_roles]

    for role_code in role_codes:
        # 获取直接权限
        mappings = RolePermissionMapping.query.filter_by(role_code=role_code).all()
        for m in mappings:
            permissions.add(m.permission_code)
        # 获取继承权限
        permissions.update(_get_inherited_permissions(role_code))

    # 若数据库中无该管理员的角色记录，则回退到静态角色权限定义，
    # 保证未落库的角色也能按 PERMISSIONS 字典正确鉴权。
    if not role_codes and getattr(admin, "role", None):
        permissions.update(PERMISSIONS.get(admin.role, []))

    _PERM_CACHE[cache_key] = (time.time(), frozenset(permissions))
    return permissions


def has_permission(admin, permission):
    """检查管理员是否有指定权限（从数据库RBAC表查询）"""
    if not admin:
        return False

    # 获取该管理员的权限码集合
    perm_codes = _get_admin_permission_codes(admin)

    # 拥有 "all" 权限的管理员拥有所有权限
    if "all" in perm_codes:
        return True

    return permission in perm_codes


def get_admin_permissions(admin):
    """返回指定管理员拥有的权限列表（从数据库RBAC表查询）"""
    return list(_get_admin_permission_codes(admin))


def get_access_token():
    """从请求头提取 Bearer token，无则返回 None。"""
    from flask import request

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "")
    return request.headers.get("X-Admin-Id")


def is_admin_or_super_admin(admin):
    """判断给定管理员是否为超级管理员（通过RBAC权限检查）"""
    if not admin:
        return False
    return has_permission(admin, "all")


def get_current_admin():
    # F6 修复: 仅接受 Authorization: Bearer <token>。
    # 原实现允许 X-Admin-Id 头作 token 回退，且 token 校验失败后直接按 id 查库返回 Admin——
    # 知道 admin id 即可伪造身份（CRITICAL）。现彻底移除该通道，校验失败一律返回 None。
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        return None

    try:
        payload = validate_token(token, "access")
        if payload:
            return Admin.query.filter_by(id=int(payload["sub"])).first()
        return None
    except Exception:
        return None


def get_allowed_classes(admin_id):
    """获取管理员允许访问的班级列表"""
    admin = Admin.query.get(admin_id)
    if not admin:
        return None

    if admin.role in ("admin", "super_admin"):
        return None

    class_links = AdminClass.query.filter_by(admin_id=admin_id).all()
    class_ids = [link.class_info_id for link in class_links]
    classes = ClassInfo.query.filter(
        ClassInfo.id.in_(class_ids), ClassInfo.is_active == True
    ).all()  # noqa: E712

    return [c.name for c in classes]


def get_admin_class_ids(admin_id):
    """获取管理员关联的班级ID列表"""
    admin = Admin.query.get(admin_id)
    if not admin:
        return []

    if admin.role in ("admin", "super_admin"):
        return []

    class_links = AdminClass.query.filter_by(admin_id=admin_id).all()
    return [link.class_info_id for link in class_links]


def can_access_device(admin, device_id):
    """检查管理员是否有权限访问指定设备"""
    if not admin:
        return False

    if admin.role in ("admin", "super_admin"):
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


def requires_student(f):
    """学生自助端鉴权装饰器。

    校验 type=student 的 JWT（generate_student_token 签发），与 Admin 体系完全隔离：
    即使学生令牌误发到 Admin 端点，requires_permission 中的 validate_token(token, "access")
    也会因 type 不匹配而拒绝。鉴权通过后将学生对象挂在 g.current_student。
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            log_access_denied(request.path, reason="未提供有效的学生认证令牌")
            return {"success": False, "message": "未提供有效的认证令牌"}, 401

        token = auth_header.replace("Bearer ", "")
        payload = validate_token(token, "student")
        if not payload:
            log_access_denied(request.path, reason="无效或过期的学号令牌")
            return {"success": False, "message": "无效或过期的认证令牌"}, 401

        try:
            user_id = int(payload["sub"])
        except (KeyError, ValueError, TypeError):
            return {"success": False, "message": "令牌格式错误"}, 401

        user = User.query.filter_by(id=user_id, is_active=True).first()
        if not user:
            log_access_denied(request.path, reason="学生不存在或已停用")
            return {"success": False, "message": "学生不存在或已停用"}, 401

        g.current_student = user
        return f(*args, **kwargs)

    return decorated_function
