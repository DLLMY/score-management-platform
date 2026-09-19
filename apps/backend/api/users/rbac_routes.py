from flask import request
from flask_restx import Namespace, Resource, fields
from models import (
    Admin,
    AdminRole,
    Permission,
    RolePermission,
    RolePermissionMapping,
    RoleHierarchy,
    get_by_id,
)
from utils.permission import requires_permission, has_permission, get_current_admin
from utils.api_cache_middleware import cached_api, invalidate_cache
from utils.response import APIResponse
from services.rbac_service import (
    log_rbac_permission_action,
    create_permission,
    update_permission,
    delete_permission,
    create_role,
    update_role,
    delete_role,
    assign_admin_roles,
    add_admin_role,
    remove_admin_role,
    set_role_permissions,
    add_role_permission,
    remove_role_permission,
    init_default_permissions as _service_init_default_permissions,
    init_default_roles as _service_init_default_roles,
)
from utils.logger import logger

"""RBAC权限管理系统路由"""
ns_rbac = Namespace("rbac", description="RBAC权限管理")

def log_permission_action(action, target_type, target_id=None, description=None):
    """记录权限操作日志（F17：落库委托 services.rbac_service）"""
    try:
        admin = get_current_admin()  # F6: 从真实认证取操作人（原 X-Admin-Id 前端已不发）
        admin_id = admin.id if admin else None
        log_rbac_permission_action(
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
            operator_id=admin_id,
            ip_address=request.remote_addr if request else None,
        )
    except Exception as e:
        logger.warning("记录RBAC操作日志失败 action=%s: %s", action, e, exc_info=True)

permission_model = ns_rbac.model(
    "Permission",
    {
        "id": fields.Integer(readOnly=True, description="权限ID"),
        "code": fields.String(required=True, description="权限代码"),
        "name": fields.String(required=True, description="权限名称"),
        "description": fields.String(description="权限描述"),
        "category": fields.String(description="权限分类"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)
admin_role_model = ns_rbac.model(
    "AdminRole",
    {
        "id": fields.Integer(readOnly=True, description="关联ID"),
        "admin_id": fields.Integer(required=True, description="管理员ID"),
        "role_code": fields.String(required=True, description="角色代码"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
    },
)
role_permission_mapping_model = ns_rbac.model(
    "RolePermissionMapping",
    {
        "id": fields.Integer(readOnly=True, description="映射ID"),
        "role_code": fields.String(required=True, description="角色代码"),
        "permission_code": fields.String(required=True, description="权限代码"),
        "created_at": fields.String(description="创建时间"),
    },
)
role_hierarchy_model = ns_rbac.model(
    "RoleHierarchy",
    {
        "id": fields.Integer(readOnly=True, description="层级ID"),
        "parent_role_code": fields.String(required=True, description="父角色代码"),
        "child_role_code": fields.String(required=True, description="子角色代码"),
        "created_at": fields.String(description="创建时间"),
    },
)
role_with_permissions_model = ns_rbac.model(
    "RoleWithPermissions",
    {
        "role_code": fields.String(required=True, description="角色代码"),
        "role_name": fields.String(description="角色名称"),
        "description": fields.String(description="角色描述"),
        "permissions": fields.List(fields.String, description="权限列表"),
        "parent_roles": fields.List(fields.String, description="父角色列表"),
        "child_roles": fields.List(fields.String, description="子角色列表"),
        "is_active": fields.Boolean(description="是否启用"),
    },
)
admin_with_roles_model = ns_rbac.model(
    "AdminWithRoles",
    {
        "id": fields.Integer(description="管理员ID"),
        "username": fields.String(description="用户名"),
        "real_name": fields.String(description="真实姓名"),
        "roles": fields.List(fields.String, description="角色列表"),
        "permissions": fields.List(fields.String, description="权限列表（包含继承）"),
    },
)

def get_inherited_permissions(role_code, visited=None):
    """递归获取继承的权限"""
    if visited is None:
        visited = set()
    if role_code in visited:
        return set()
    visited.add(role_code)
    permissions = set()
    # 获取直接分配的权限
    role = RolePermission.query.filter_by(role_code=role_code).first()
    if role:
        mappings = RolePermissionMapping.query.filter_by(role_code=role_code).all()
        for mapping in mappings:
            permissions.add(mapping.permission_code)
    # 获取父角色
    hierarchies = RoleHierarchy.query.filter_by(child_role_code=role_code).all() if role else []
    for h in hierarchies:
        parent_role = RolePermission.query.filter_by(role_code=h.parent_role_code).first()
        if parent_role:
            parent_perms = get_inherited_permissions(parent_role.role_code, visited)
            permissions.update(parent_perms)
    return permissions

def check_admin_permission(admin, permission_code):
    """检查管理员是否有指定权限"""
    # 超级管理员拥有所有权限
    if admin.role in ["admin", "super_admin"]:
        return True
    # 获取用户的角色
    admin_roles = AdminRole.query.filter_by(admin_id=admin.id).all()
    role_codes = [ar.role_code for ar in admin_roles]
    # 如果没有通过AdminRole关联，使用admin.role作为备用
    if not role_codes and admin.role:
        role_codes = [admin.role]
    # 超级管理员角色
    if "admin" in role_codes or "super_admin" in role_codes:
        return True
    # 检查每个角色是否有该权限
    for role_code in role_codes:
        # 直接权限
        direct_perm = RolePermissionMapping.query.filter_by(
            role_code=role_code, permission_code=permission_code
        ).first()
        if direct_perm:
            return True
        # 继承权限
        inherited = get_inherited_permissions(role_code)
        if permission_code in inherited:
            return True
    return False

def init_default_permissions():
    """初始化默认权限数据（F17：落库委托 services.rbac_service；scripts/fix_permissions_catalog 导入本函数）"""
    _service_init_default_permissions()

def init_default_roles():
    """初始化默认角色数据（F17：落库委托 services.rbac_service）"""
    _service_init_default_roles()

import api.users._rbac_part1
import api.users._rbac_part2
