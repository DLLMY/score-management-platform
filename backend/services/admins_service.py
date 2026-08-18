"""管理员账号写入/事务路径薄封装（F17 防腐层：从 api/system/admins_routes 收口）。

逐字节复刻原路由内联落库行为；路由保留 get_or_404 / 请求校验（密码强度、旧密码验证、
class_id 必填）/ 登录令牌 / CSRF / 响应构造。sync_admin_rbac_role(s) 为模块内部助手，
落库一并收口；log_permission_action 由路由保留同名委托函数（模块内 3 处调用）。
"""

from datetime import datetime

from models import db, Admin, AdminClass, PermissionLog, AdminRole, RolePermission, cascade_delete_related_records
from utils.security import hash_password


ROLE_MAPPING = {
    "admin": "admin",
    "teacher": "teacher",
    "dashboard": "dashboard_viewer",
    "head_teacher": "head_teacher",
    "viewer": "viewer",
}


def sync_admin_rbac_role(admin_id, role):
    """同步管理员角色到RBAC系统（兼容旧API，单个角色）。不提交，由调用方统一 commit。"""
    rbac_role_code = ROLE_MAPPING.get(role, role)
    existing_role = AdminRole.query.filter_by(admin_id=admin_id).first()
    if existing_role:
        if existing_role.role_code != rbac_role_code:
            existing_role.role_code = rbac_role_code
    else:
        rbac_role = RolePermission.query.filter_by(role_code=rbac_role_code).first()
        if rbac_role:
            admin_role = AdminRole(admin_id=admin_id, role_code=rbac_role_code)
            db.session.add(admin_role)


def sync_admin_rbac_roles(admin_id, roles):
    """同步管理员多角色到RBAC系统。不提交，由调用方统一 commit。"""
    if not roles:
        return
    current_roles = AdminRole.query.filter_by(admin_id=admin_id).all()
    current_role_codes = {ar.role_code for ar in current_roles}
    new_role_codes = set()
    for role in roles:
        rbac_role_code = ROLE_MAPPING.get(role, role)
        if RolePermission.query.filter_by(role_code=rbac_role_code).first():
            new_role_codes.add(rbac_role_code)
    for ar in current_roles:
        if ar.role_code not in new_role_codes:
            db.session.delete(ar)
    for role_code in new_role_codes:
        if role_code not in current_role_codes:
            admin_role = AdminRole(admin_id=admin_id, role_code=role_code)
            db.session.add(admin_role)


def log_admin_permission_action(
    action, target_type, target_id=None, description=None, operator_id=None, ip_address=None
):
    """复刻 log_permission_action 内联 PermissionLog 建模 + add + commit（失败回滚防脏 session）。"""
    try:
        log = PermissionLog(
            operator_id=operator_id,
            operator_type="admin",
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
            ip_address=ip_address,
            created_at=datetime.now(),
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()  # 失败回滚，防脏 session 污染后续请求
        pass


def create_admin(username, password, role, real_name, phone, class_name, roles=None):
    """复刻 AdminList.post 内联建模 + add + flush + RBAC 角色同步 + commit。返回 admin 实例。"""
    admin = Admin(
        username=username,
        password=hash_password(password),
        role=role,
        real_name=real_name,
        phone=phone,
        class_name=class_name,
    )
    db.session.add(admin)
    db.session.flush()
    if roles:
        sync_admin_rbac_roles(admin.id, roles)
    else:
        sync_admin_rbac_role(admin.id, role)
    db.session.commit()
    return admin


def update_admin(admin, data):
    """复刻 AdminResource.put 内联字段赋值 + RBAC 角色同步 + commit。返回 admin 实例。"""
    admin.username = data.get("username", admin.username)
    if data.get("password"):
        admin.password = hash_password(data.get("password"))
    admin.role = data.get("role", admin.role)
    admin.real_name = data.get("real_name", admin.real_name)
    admin.phone = data.get("phone", admin.phone)
    admin.class_name = data.get("class_name", admin.class_name)
    admin.updated_at = datetime.now()
    roles = data.get("roles")
    if roles:
        sync_admin_rbac_roles(admin.id, roles)
    else:
        sync_admin_rbac_role(admin.id, admin.role)
    db.session.commit()
    return admin


def delete_admin(admin):
    """复刻 AdminResource.delete 内联级联清理 + delete + commit。"""
    cascade_delete_related_records(Admin, admin.id)
    db.session.delete(admin)
    db.session.commit()


def change_admin_password(admin, new_password):
    """复刻 AdminChangePassword.post 内联改密字段赋值 + commit。"""
    admin.password = hash_password(new_password)
    admin.force_password_change = False
    admin.updated_at = datetime.now()
    db.session.commit()


def assign_class_link(admin_id, class_id, is_primary):
    """复刻 AdminAssignClass.post 内联 existing_link 更新或新建 + commit。"""
    existing_link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
    if existing_link:
        existing_link.is_primary = is_primary
    else:
        link = AdminClass(
            admin_id=admin_id, class_info_id=class_id, is_primary=is_primary, assigned_at=datetime.now()
        )
        db.session.add(link)
    db.session.commit()


def remove_class_link(link):
    """复刻 AdminRemoveClass.post 内联 delete + commit。"""
    db.session.delete(link)
    db.session.commit()
