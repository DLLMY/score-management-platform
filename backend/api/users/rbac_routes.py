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
        logger.warning("记录RBAC操作日志失败 action=%s: %s", action, e)


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
        result = []  # noqa: F841
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
        if current_admin.id != admin_id:
            if not has_permission(current_admin, "system.roles"):
                return APIResponse.forbidden(message="无权访问")
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
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
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
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
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
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
