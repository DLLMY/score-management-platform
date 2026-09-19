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

@ns_rbac.route("/permissions")
class PermissionList(Resource):
    @ns_rbac.doc("list_permissions", description="获取权限列表", security="Bearer")
    @ns_rbac.param("category", "按分类筛选")
    @ns_rbac.param("is_active", "按状态筛选")
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    @cached_api(ttl=60)
    def get(self):
        """获取所有权限定义"""
        category = request.args.get("category")
        is_active = request.args.get("is_active")
        query = Permission.query
        if category:
            query = query.filter_by(category=category)
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == "true")
        permissions = query.order_by(Permission.category, Permission.code).all()
        return APIResponse.success(data=[p.to_dict() for p in permissions])

    @ns_rbac.doc("create_permission", description="创建权限", security="Bearer")
    @ns_rbac.expect(permission_model)
    @ns_rbac.response(201, "创建成功")
    @ns_rbac.response(400, "参数错误")
    @ns_rbac.response(409, "权限已存在")
    @requires_permission("system.roles")
    def post(self):
        """创建新的权限定义"""
        data = request.json
        if not data.get("code") or not data.get("name"):
            return APIResponse.error(message="权限代码和名称不能为空", status_code=400)
        if Permission.query.filter_by(code=data["code"]).first():
            return APIResponse.error(message="权限代码已存在", status_code=409)
        permission = create_permission(data)
        log_permission_action(
            "创建权限", "permission", permission.id, f"创建权限: {data['code']} ({data['name']})"
        )
        invalidate_cache("api:/api/rbac/*")
        return APIResponse.success(
            data={"id": permission.id}, message="权限创建成功", status_code=201
        )

@ns_rbac.route("/permissions/<string:code>")
@ns_rbac.param("code", "权限代码")
class PermissionResource(Resource):
    @ns_rbac.doc("get_permission", description="获取权限详情", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "权限不存在")
    @requires_permission("system.roles")
    def get(self, code):
        """获取权限详情"""
        permission = Permission.query.filter_by(code=code).first_or_404()
        return APIResponse.success(data=permission.to_dict())

    @ns_rbac.doc("update_permission", description="更新权限", security="Bearer")
    @ns_rbac.expect(permission_model)
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "权限不存在")
    @requires_permission("system.roles")
    def put(self, code):
        """更新权限信息"""
        permission = Permission.query.filter_by(code=code).first_or_404()
        data = request.json
        update_permission(permission, data)
        log_permission_action("更新权限", "permission", permission.id, f"更新权限: {code}")
        invalidate_cache("api:/api/rbac/*")
        return APIResponse.success(message="权限更新成功")

    @ns_rbac.doc("delete_permission", description="删除权限", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "权限不存在")
    @ns_rbac.response(409, "权限正在使用中")
    @requires_permission("system.roles")
    def delete(self, code):
        """删除权限"""
        permission = Permission.query.filter_by(code=code).first_or_404()
        # 检查是否被角色使用
        used_by = RolePermissionMapping.query.filter_by(permission_code=code).first()
        if used_by:
            return APIResponse.error(message="该权限正在被角色使用，无法删除", status_code=409)
        delete_permission(permission)
        log_permission_action("删除权限", "permission", permission.id, f"删除权限: {code}")
        invalidate_cache("api:/api/rbac/*")
        return APIResponse.success(message="权限删除成功")

@ns_rbac.route("/roles")
class RoleList(Resource):
    @ns_rbac.doc(
        "list_roles_with_permissions", description="获取角色列表（含权限）", security="Bearer"
    )
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    @cached_api(ttl=30)
    def get(self):
        """获取所有角色及其权限信息"""
        # 获取所有角色（1次查询）
        role_permissions = RolePermission.query.all()
        if not role_permissions:
            return APIResponse.success(data=[])
        # 获取所有角色代码
        role_codes = [rp.role_code for rp in role_permissions]
        # 批量获取权限映射（1次查询）
        permission_mappings = RolePermissionMapping.query.filter(
            RolePermissionMapping.role_code.in_(role_codes)
        ).all()
        # 构建权限映射字典
        perm_map = {}
        for pm in permission_mappings:
            if pm.role_code not in perm_map:
                perm_map[pm.role_code] = []
            perm_map[pm.role_code].append(pm.permission_code)
        # 批量获取角色层级关系（1次查询）
        hierarchies = RoleHierarchy.query.filter(
            (RoleHierarchy.parent_role_code.in_(role_codes))
            | (RoleHierarchy.child_role_code.in_(role_codes))
        ).all()
        # 构建父子角色映射
        parent_map = {}
        child_map = {}
        for h in hierarchies:
            if h.child_role_code not in parent_map:
                parent_map[h.child_role_code] = []
            parent_map[h.child_role_code].append(h.parent_role_code)
            if h.parent_role_code not in child_map:
                child_map[h.parent_role_code] = []
            child_map[h.parent_role_code].append(h.child_role_code)
        # 构建结果（无额外查询）
        result = []
        for rp in role_permissions:
            result.append(
                {
                    "role_code": rp.role_code,
                    "role_name": rp.role_name,
                    "description": rp.description,
                    "permissions": perm_map.get(rp.role_code, []),
                    "parent_roles": parent_map.get(rp.role_code, []),
                    "child_roles": child_map.get(rp.role_code, []),
                    "is_active": rp.is_active,
                }
            )
        return APIResponse.success(data=result)

    @ns_rbac.doc("create_role", description="创建角色", security="Bearer")
    @ns_rbac.expect(role_with_permissions_model)
    @ns_rbac.response(201, "创建成功")
    @ns_rbac.response(400, "参数错误")
    @ns_rbac.response(409, "角色已存在")
    @requires_permission("system.roles")
    def post(self):
        """创建新的角色"""
        data = request.json
        if not data.get("role_code"):
            return APIResponse.error(message="角色代码不能为空", status_code=400)
        existing = RolePermission.query.filter_by(role_code=data["role_code"]).first()
        if existing:
            return APIResponse.error(message="角色代码已存在", status_code=409)
        _ = create_role(data)
        log_permission_action(
            "创建角色",
            "role",
            None,
            f"创建角色: {data['role_code']} ({data.get('role_name', data['role_code'])})",
        )
        invalidate_cache("api:/api/rbac/*")
        return APIResponse.success(message="角色创建成功", status_code=201)

@ns_rbac.route("/roles/<string:role_code>")
@ns_rbac.param("role_code", "角色代码")
class RoleResource(Resource):
    @ns_rbac.doc(
        "get_role_with_permissions", description="获取角色详情（含权限）", security="Bearer"
    )
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "角色不存在")
    @requires_permission("system.roles")
    def get(self, role_code):
        """获取角色详情"""
        rp = RolePermission.query.filter_by(role_code=role_code).first_or_404()
        perms = RolePermissionMapping.query.filter_by(role_code=role_code).all()
        permission_codes = [p.permission_code for p in perms]
        parents = RoleHierarchy.query.filter_by(child_role_code=role_code).all()
        parent_codes = [p.parent_role_code for p in parents]
        children = RoleHierarchy.query.filter_by(parent_role_code=role_code).all()
        child_codes = [c.child_role_code for c in children]
        return APIResponse.success(
            data={
                "role_code": rp.role_code,
                "role_name": rp.role_name,
                "description": rp.description,
                "permissions": permission_codes,
                "parent_roles": parent_codes,
                "child_roles": child_codes,
                "is_active": rp.is_active,
                "created_at": rp.created_at.isoformat() if rp.created_at else None,
                "updated_at": rp.updated_at.isoformat() if rp.updated_at else None,
            }
        )

    @ns_rbac.doc("update_role", description="更新角色", security="Bearer")
    @ns_rbac.expect(role_with_permissions_model)
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "角色不存在")
    @requires_permission("system.roles")
    def put(self, role_code):
        """更新角色信息"""
        rp = RolePermission.query.filter_by(role_code=role_code).first_or_404()
        data = request.json
        update_role(rp, data)
        log_permission_action("更新角色", "role", None, f"更新角色: {role_code}")
        invalidate_cache("api:/api/rbac/*")
        return APIResponse.success(message="角色更新成功")

    @ns_rbac.doc("delete_role", description="删除角色", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "角色不存在")
    @ns_rbac.response(409, "角色正在使用中")
    @requires_permission("system.roles")
    def delete(self, role_code):
        """删除角色"""
        rp = RolePermission.query.filter_by(role_code=role_code).first_or_404()
        # 检查是否有子角色
        has_children = RoleHierarchy.query.filter_by(parent_role_code=role_code).first()
        if has_children:
            return APIResponse.error(message="该角色存在子角色，无法删除", status_code=409)
        # 检查是否有用户使用
        has_users = AdminRole.query.filter_by(role_code=role_code).first()
        if has_users:
            return APIResponse.error(message="该角色正在被用户使用，无法删除", status_code=409)
        # 删除角色权限关联/层级关联/角色本身
        delete_role(rp)
        log_permission_action("删除角色", "role", None, f"删除角色: {role_code}")
        invalidate_cache("api:/api/rbac/*")
        return APIResponse.success(message="角色删除成功")

@ns_rbac.route("/role-permissions/<string:role_code>")
@ns_rbac.param("role_code", "角色代码")
class RolePermissionList(Resource):
    @ns_rbac.doc("get_role_permissions", description="获取角色的权限", security="Bearer")
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def get(self, role_code):
        """获取角色的所有权限"""
        mappings = RolePermissionMapping.query.filter_by(role_code=role_code).all()
        return APIResponse.success(
            data={"role_code": role_code, "permissions": [m.permission_code for m in mappings]}
        )

    @ns_rbac.doc("set_role_permissions", description="设置角色的权限", security="Bearer")
    @ns_rbac.expect(
        ns_rbac.model(
            "SetPermissions",
            {"permissions": fields.List(fields.String, required=True, description="权限代码列表")},
        )
    )
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def put(self, role_code):
        """设置角色的权限（覆盖式）"""
        rp = RolePermission.query.filter_by(role_code=role_code).first_or_404()
        data = request.json
        set_role_permissions(rp, data.get("permissions", []))
        return APIResponse.success(message="权限设置成功")

@ns_rbac.route("/role-permissions/<string:role_code>/<string:permission_code>")
@ns_rbac.param("role_code", "角色代码")
@ns_rbac.param("permission_code", "权限代码")
class RolePermissionResource(Resource):
    @ns_rbac.doc("add_role_permission", description="为角色添加权限", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "角色或权限不存在")
    @requires_permission("system.roles")
    def post(self, role_code, permission_code):
        """为角色添加单个权限"""
        RolePermission.query.filter_by(role_code=role_code).first_or_404()
        Permission.query.filter_by(code=permission_code).first_or_404()
        existing = RolePermissionMapping.query.filter_by(
            role_code=role_code, permission_code=permission_code
        ).first()
        if existing:
            return APIResponse.success(message="权限已分配")
        add_role_permission(role_code, permission_code)
        return APIResponse.success(message="权限添加成功")

    @ns_rbac.doc("remove_role_permission", description="移除角色的权限", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "关联不存在")
    @requires_permission("system.roles")
    def delete(self, role_code, permission_code):
        """移除角色的单个权限"""
        mapping = RolePermissionMapping.query.filter_by(
            role_code=role_code, permission_code=permission_code
        ).first_or_404()
        remove_role_permission(mapping)
        return APIResponse.success(message="权限移除成功")
