# -*- coding: utf-8 -*-
# part of api/users/rbac_routes.py (D2 split)

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

from api.users.rbac_routes import ns_rbac, log_permission_action, permission_model, admin_role_model, role_permission_mapping_model, role_hierarchy_model, role_with_permissions_model, admin_with_roles_model, get_inherited_permissions, check_admin_permission, init_default_permissions, init_default_roles

@ns_rbac.route("/admin-roles/<int:admin_id>")
@ns_rbac.param("admin_id", "管理员ID")
class AdminRoleList(Resource):
    @ns_rbac.doc("get_admin_roles", description="获取管理员的角色", security="Bearer")
    @ns_rbac.response(200, "成功")
    @requires_permission("student.view")
    def get(self, admin_id):
        """获取管理员的所有角色"""
        current_admin = get_current_admin()
        if not current_admin:
            return APIResponse.unauthorized(message="未登录")
        if current_admin.id != admin_id and not has_permission(current_admin, "system.roles"):
            return APIResponse.forbidden(message="无权访问")
        _admin = Admin.query.get_or_404(admin_id)
        admin_roles = AdminRole.query.filter_by(admin_id=admin_id).all()
        role_codes = [ar.role_code for ar in admin_roles]
        if not role_codes and _admin.role:
            role_codes = [_admin.role]
        if (
            _admin.role in ["admin", "super_admin"]
            or "admin" in role_codes
            or "super_admin" in role_codes
        ):
            all_permissions = {"all"}
        else:
            all_permissions = set()
            for role_code in role_codes:
                role = RolePermission.query.filter_by(role_code=role_code).first()
                if role:
                    mappings = RolePermissionMapping.query.filter_by(role_code=role_code).all()
                    for mapping in mappings:
                        all_permissions.add(mapping.permission_code)
                inherited = get_inherited_permissions(role_code)
                all_permissions.update(inherited)
        return APIResponse.success(
            data={
                "id": admin_id,
                "username": _admin.username,
                "real_name": _admin.real_name,
                "roles": role_codes,
                "permissions": list(all_permissions),
            }
        )

    @ns_rbac.doc("assign_roles", description="为管理员分配角色", security="Bearer")
    @ns_rbac.expect(
        ns_rbac.model(
            "AssignRoles",
            {"role_codes": fields.List(fields.String, required=True, description="角色代码列表")},
        )
    )
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def put(self, admin_id):
        """为管理员分配角色（覆盖式）"""
        _admin = Admin.query.get_or_404(admin_id)
        data = request.json
        role_codes = data.get("role_codes", [])
        assign_admin_roles(admin_id, role_codes)
        log_permission_action(
            "分配角色",
            "admin_role",
            admin_id,
            f"为用户 {_admin.username} 分配角色: {', '.join(role_codes) if role_codes else '无'}",
        )
        return APIResponse.success(message="角色分配成功")

@ns_rbac.route("/admin-roles/<int:admin_id>/<string:role_code>")
@ns_rbac.param("admin_id", "管理员ID")
@ns_rbac.param("role_code", "角色代码")
class AdminRoleResource(Resource):
    @ns_rbac.doc("add_admin_role", description="为管理员添加角色", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "管理员或角色不存在")
    @requires_permission("system.roles")
    def post(self, admin_id, role_code):
        """为管理员添加单个角色"""
        _admin = Admin.query.get_or_404(admin_id)
        RolePermission.query.filter_by(role_code=role_code).first_or_404()
        existing = AdminRole.query.filter_by(admin_id=admin_id, role_code=role_code).first()
        if existing:
            return APIResponse.success(message="角色已分配")
        add_admin_role(admin_id, role_code)
        return APIResponse.success(message="角色添加成功")

    @ns_rbac.doc("remove_admin_role", description="移除管理员的角色", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "关联不存在")
    @requires_permission("system.roles")
    def delete(self, admin_id, role_code):
        """移除管理员的单个角色"""
        admin_role = AdminRole.query.filter_by(
            admin_id=admin_id, role_code=role_code
        ).first_or_404()
        remove_admin_role(admin_role)
        return APIResponse.success(message="角色移除成功")

@ns_rbac.route("/role-hierarchy/<string:role_code>")
@ns_rbac.param("role_code", "角色代码")
class RoleHierarchyResource(Resource):
    @ns_rbac.doc("get_role_hierarchy", description="获取角色的层级关系", security="Bearer")
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def get(self, role_code):
        """获取角色的父角色和子角色"""
        parents = RoleHierarchy.query.filter_by(child_role_code=role_code).all()
        children = RoleHierarchy.query.filter_by(parent_role_code=role_code).all()
        return APIResponse.success(
            data={
                "role_code": role_code,
                "parent_roles": [p.parent_role_code for p in parents],
                "child_roles": [c.child_role_code for c in children],
            }
        )

@ns_rbac.route("/check")
class CheckPermission(Resource):
    @ns_rbac.doc("check_permission", description="检查当前用户的权限", security="Bearer")
    @ns_rbac.param("permission", "权限代码")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(403, "权限不足")
    @requires_permission("system.roles")
    def get(self):
        """检查当前管理员是否有指定权限"""
        permission = request.args.get("permission")
        if not permission:
            return APIResponse.error(message="权限代码不能为空", status_code=400)
        auth_header = request.headers.get("Authorization")
        token = auth_header.replace("Bearer ", "")
        from utils.security import validate_token

        payload = validate_token(token, "access")
        admin_id = int(payload["sub"])
        admin = get_by_id(Admin, admin_id)
        if not admin:
            return APIResponse.error(message="管理员不存在", status_code=404)
        has_perm = check_admin_permission(admin, permission)
        return APIResponse.success(
            data={"has_permission": has_perm, "admin_id": admin_id, "permission": permission}
        )
