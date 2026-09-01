import os
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
    db,
)
from utils.security import validate_token
from utils.logger import log_access_denied
from utils.response import APIResponse

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
        # Cookie 认证轨（十评 P2-1）：HttpOnly access_token cookie 无法被 JS 读取，
        # 无 Authorization 头时回退到 cookie（双轨共存，前端切 cookie 后兼容旧客户端）
        if (not auth_header or not auth_header.startswith("Bearer ")) and request.cookies.get("access_token"):
            auth_header = f"Bearer {request.cookies.get('access_token')}"

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


# 班主任工作台 P1：需要对班级/学生归属做写隔离的权限前缀
_CLASS_SCOPE_PREFIXES = {
    "committee", "duty", "seating", "parent", "homework", "attendance",
    "study_group", "mental_health", "activity", "culture", "study_guide", "comment",
}


def _check_class_scope(permission):
    """仅对班级管理工作台相关权限做归属校验；其余权限原样放行。

    从请求体/query 提取 class_id / student_id，调用 ensure_class_access /
    ensure_student_access 校验；越权返回 403 响应，否则返回 None。
    """
    prefix = permission.split(".", 1)[0]
    if prefix not in _CLASS_SCOPE_PREFIXES:
        return None
    data = request.get_json(silent=True) or {}
    class_id = data.get("class_id")
    if class_id is None:
        class_id = request.args.get("class_id", type=int)
    student_id = data.get("student_id")
    if student_id is None:
        student_id = request.args.get("student_id", type=int)
    deny = ensure_class_access(class_id)
    if deny is not None:
        return deny
    deny = ensure_student_access(student_id)
    if deny is not None:
        return deny
    return None


def requires_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            admin_id_header = request.headers.get("X-Admin-Id")
            # Cookie 认证轨（十评 P2-1）：HttpOnly access_token cookie 无法被 JS 读取，
            # 无 Authorization 头时回退到 cookie（双轨共存，前端切 cookie 后兼容旧客户端）
            if (not auth_header or not auth_header.startswith("Bearer ")) and request.cookies.get("access_token"):
                auth_header = f"Bearer {request.cookies.get('access_token')}"

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

                # 班主任工作台 P1：班级/学生归属校验（仅对工作台相关权限生效）
                scope_deny = _check_class_scope(permission)
                if scope_deny is not None:
                    return scope_deny
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
            # Cookie 认证轨（十评 P2-1）：HttpOnly access_token cookie 无法被 JS 读取，
            # 无 Authorization 头时回退到 cookie（双轨共存，前端切 cookie 后兼容旧客户端）
            if (not auth_header or not auth_header.startswith("Bearer ")) and request.cookies.get("access_token"):
                auth_header = f"Bearer {request.cookies.get('access_token')}"

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


# F9 修复: 权限码 TTL 缓存——原每次请求重查 AdminRole/mappings/继承，全接口必经 has_permission
# TTL 通过环境变量 PERMISSION_CACHE_TTL 可调，默认 30s（行为零变化，仅获得按环境可调能力）
_PERM_CACHE: dict = {}
try:
    _PERM_CACHE_TTL = int(os.getenv("PERMISSION_CACHE_TTL", "30"))
except (TypeError, ValueError):
    _PERM_CACHE_TTL = 30


def _get_admin_permission_codes(admin):
    """从数据库中获取管理员的所有有效权限码（带 30s TTL 缓存；角色变更最长 30s 生效）"""
    if not admin:
        return set()

    if admin.id is None:
        # 未持久化对象（id 未分配）：无法查询关联角色/权限，视为无权限
        return set()

    # 缓存 key 含 engine 标识：隔离不同数据库实例（测试每用例独立 :memory: 库，
    # admin.id 会重复；单库生产环境行为不变）
    cache_key = (id(db.engine), int(admin.id))
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
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
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
    if (not auth_header or not auth_header.startswith("Bearer ")) and request.cookies.get("access_token"):
        auth_header = f"Bearer {request.cookies.get('access_token')}"
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


def can_access_student(user_id):
    """检查当前管理员是否有权限访问/操作指定学生（B2 收敛：原 records/approvals/users
    三个路由各自的 _can_access_student/_can_access_approval_user/_can_access_user 统一）。

    语义：
    - user_id 为 None → False
    - 未登录管理员 → False
    - 管理员为 admin / super_admin（无班级约束）→ True
    - 学生不存在 → False
    - 学生所属 class_info_id ∈ 管理员关联班级列表（get_admin_class_ids）→ True，否则 False
    注：按班级 ID 比对（比按班级名稳健，班级名可能漂移；学生仅持有 class_info_id）。
    """
    if user_id is None:
        return False
    admin = get_current_admin()
    if not admin:
        return False
    # admin / super_admin 无班级约束，放行（与 ensure_class_access 语义一致）
    if admin.role in ("admin", "super_admin"):
        return True
    # 按班级 ID 比对
    allowed_ids = get_admin_class_ids(admin.id)
    if not allowed_ids:
        return False
    user = db.session.get(User, user_id)
    if not user:
        return False
    return user.class_info_id in allowed_ids


def requires_student(f):
    """学生自助端鉴权装饰器。

    校验 type=student 的 JWT（generate_student_token 签发），与 Admin 体系完全隔离：
    即使学生令牌误发到 Admin 端点，requires_permission 中的 validate_token(token, "access")
    也会因 type 不匹配而拒绝。鉴权通过后将学生对象挂在 g.current_student。
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        # Cookie 认证轨（十评 P2-1）：学生自助端登录后 token 走 HttpOnly student_token cookie
        if (not auth_header or not auth_header.startswith("Bearer ")) and request.cookies.get("student_token"):
            auth_header = f"Bearer {request.cookies.get('student_token')}"
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


def ensure_class_access(class_id):
    """路由层班级归属校验（班主任工作台 P1：修复越权写漏洞）。

    与 get_admin_class_ids / can_access_student 语义一致：
    - 当前管理员为 admin / super_admin（无班级约束）→ 放行
    - 未登录或无法解析管理员 → 拒绝 403
    - class_id 不在该管理员关联班级列表 → 拒绝 403（无权访问该班级）
    - class_id 为 None 或 0（未指定 / 前端「全部班级」哨兵 ALL_CLASSES=0）→ 放行，
      不在此拦截，交由 service 层做存在性校验并返回语义更准确的 400。

      ⚠️ 必须放行 0（不可用 `is None` 判断）：前端 hooks/useWorkbenchClass.ts:20
      约定 ALL_CLASSES = 0 表示「全部班级」，且 AttendanceManage.tsx:156
      `getStats(filterClassId || 0)` 会显式传 class_id=0；另有多个子页表单默认值
      `class_id: filterClassId > 0 ? filterClassId : 0`。若在此把 0 判为越权，
      班主任的「全部班级」视图会被整体误杀为 403。

    返回 None 表示放行；返回 Flask 响应对象表示拒绝，路由应直接 return。
    """
    admin = get_current_admin()
    if not admin:
        return APIResponse.error(message="未认证或会话已失效", status_code=403)
    if admin.role in ("admin", "super_admin"):
        return None
    if not class_id:
        return None
    allowed = get_admin_class_ids(admin.id)
    if class_id in allowed:
        return None
    log_access_denied(request.path, reason=f"班级 {class_id} 不在管理员允许范围内")
    return APIResponse.error(message="无权访问该班级的数据", status_code=403)


def ensure_student_access(student_id):
    """路由层学生归属校验，复用 can_access_student 语义；越权返 403。"""
    if student_id is None:
        return None
    if not can_access_student(student_id):
        log_access_denied(request.path, reason=f"学生 {student_id} 不在管理员允许范围内")
        return APIResponse.error(message="无权访问该学生的数据", status_code=403)
    return None


def ensure_class_scope(f):
    """写接口班级/学生归属校验装饰器（班主任工作台 P1）。

    从请求体 JSON / 路径参数 / query 中提取 class_id / student_id，
    调用 ensure_class_access / ensure_student_access 做归属校验；
    越权则直接返回 403 响应，路由无需再处理。
    适用于 post/put（class_id/student_id 在请求体中）等写方法。
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        data = request.get_json(silent=True) or {}
        class_id = data.get("class_id")
        if class_id is None:
            class_id = kwargs.get("class_id") or request.args.get("class_id", type=int)
        student_id = data.get("student_id")
        if student_id is None:
            student_id = kwargs.get("student_id") or request.args.get("student_id", type=int)

        deny = ensure_class_access(class_id)
        if deny is not None:
            return deny
        deny = ensure_student_access(student_id)
        if deny is not None:
            return deny
        return f(*args, **kwargs)

    return decorated_function
