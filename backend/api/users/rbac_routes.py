from flask import request
import logging
from flask_restx import Namespace, Resource, fields
from models import (
    db,
    Admin,
    AdminRole,
    Permission,
    PermissionLog,
    RolePermission,
    RolePermissionMapping,
    RoleHierarchy,
    get_by_id,
)
from utils.permission import requires_permission, has_permission, get_current_admin
from utils.response import APIResponse
from datetime import datetime

"""RBAC权限管理系统路由"""
ns_rbac = Namespace("rbac", description="RBAC权限管理")


def log_permission_action(action, target_type, target_id=None, description=None):
    """记录权限操作日志"""
    try:
        admin_id = request.headers.get("X-Admin-Id")
        log = PermissionLog(
            operator_id=admin_id,
            operator_type="admin",
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
            ip_address=request.remote_addr if request else None,
            created_at=datetime.now(),
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()  # 失败回滚，防脏 session 污染后续请求
        pass


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
        return APIResponse.success(
            data=[
                {
                    "id": p.id,
                    "code": p.code,
                    "name": p.name,
                    "description": p.description,
                    "category": p.category,
                    "is_active": p.is_active,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in permissions
            ]
        )

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
        permission = Permission(
            code=data["code"],
            name=data["name"],
            description=data.get("description", ""),
            category=data.get("category", "general"),
            is_active=data.get("is_active", True),
        )
        db.session.add(permission)
        db.session.commit()
        log_permission_action("创建权限", "permission", permission.id, f"创建权限: {data['code']} ({data['name']})")
        return APIResponse.success(data={"id": permission.id}, message="权限创建成功", status_code=201)


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
        return APIResponse.success(
            data={
                "id": permission.id,
                "code": permission.code,
                "name": permission.name,
                "description": permission.description,
                "category": permission.category,
                "is_active": permission.is_active,
                "created_at": permission.created_at.isoformat() if permission.created_at else None,
                "updated_at": permission.updated_at.isoformat() if permission.updated_at else None,
            }
        )

    @ns_rbac.doc("update_permission", description="更新权限", security="Bearer")
    @ns_rbac.expect(permission_model)
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "权限不存在")
    @requires_permission("system.roles")
    def put(self, code):
        """更新权限信息"""
        permission = Permission.query.filter_by(code=code).first_or_404()
        data = request.json
        if "name" in data:
            permission.name = data["name"]
        if "description" in data:
            permission.description = data["description"]
        if "category" in data:
            permission.category = data["category"]
        if "is_active" in data:
            permission.is_active = data["is_active"]
        permission.updated_at = datetime.now()
        db.session.commit()
        log_permission_action("更新权限", "permission", permission.id, f"更新权限: {code}")
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
        db.session.delete(permission)
        db.session.commit()
        log_permission_action("删除权限", "permission", permission.id, f"删除权限: {code}")
        return APIResponse.success(message="权限删除成功")


@ns_rbac.route("/roles")
class RoleList(Resource):
    @ns_rbac.doc("list_roles_with_permissions", description="获取角色列表（含权限）", security="Bearer")
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def get(self):
        """获取所有角色及其权限信息"""
        # 获取所有角色（1次查询）
        role_permissions = RolePermission.query.all()
        if not role_permissions:
            return APIResponse.success(data=[])
        # 获取所有角色代码
        role_codes = [rp.role_code for rp in role_permissions]
        # 批量获取权限映射（1次查询）
        permission_mappings = RolePermissionMapping.query.filter(RolePermissionMapping.role_code.in_(role_codes)).all()
        # 构建权限映射字典
        perm_map = {}
        for pm in permission_mappings:
            if pm.role_code not in perm_map:
                perm_map[pm.role_code] = []
            perm_map[pm.role_code].append(pm.permission_code)
        # 批量获取角色层级关系（1次查询）
        hierarchies = RoleHierarchy.query.filter(
            (RoleHierarchy.parent_role_code.in_(role_codes)) | (RoleHierarchy.child_role_code.in_(role_codes))
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
        role = RolePermission(
            role_code=data["role_code"],
            role_name=data.get("role_name", data["role_code"]),
            description=data.get("description", ""),
            permissions=",".join(data.get("permissions", [])),
            is_active=data.get("is_active", True),
        )
        db.session.add(role)
        # 添加权限关联
        for perm_code in data.get("permissions", []):
            mapping = RolePermissionMapping(role_code=data["role_code"], permission_code=perm_code)
            db.session.add(mapping)
        # 添加父角色关联
        for parent_code in data.get("parent_roles", []):
            hierarchy = RoleHierarchy(parent_role_code=parent_code, child_role_code=data["role_code"])
            db.session.add(hierarchy)
        db.session.commit()
        log_permission_action(
            "创建角色", "role", None, f"创建角色: {data['role_code']} ({data.get('role_name', data['role_code'])})"
        )
        return APIResponse.success(message="角色创建成功", status_code=201)


@ns_rbac.route("/roles/<string:role_code>")
@ns_rbac.param("role_code", "角色代码")
class RoleResource(Resource):
    @ns_rbac.doc("get_role_with_permissions", description="获取角色详情（含权限）", security="Bearer")
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
        if "role_name" in data:
            rp.role_name = data["role_name"]
        if "description" in data:
            rp.description = data["description"]
        if "is_active" in data:
            rp.is_active = data["is_active"]
        # 更新权限列表
        if "permissions" in data:
            # 删除旧权限
            RolePermissionMapping.query.filter_by(role_code=role_code).delete()
            # 添加新权限
            for perm_code in data["permissions"]:
                mapping = RolePermissionMapping(role_code=role_code, permission_code=perm_code)
                db.session.add(mapping)
        # 更新父角色列表
        if "parent_roles" in data:
            # 删除旧父角色
            RoleHierarchy.query.filter_by(child_role_code=role_code).delete()
            # 添加新父角色
            for parent_code in data["parent_roles"]:
                hierarchy = RoleHierarchy(parent_role_code=parent_code, child_role_code=role_code)
                db.session.add(hierarchy)
        rp.updated_at = datetime.now()
        db.session.commit()
        log_permission_action("更新角色", "role", None, f"更新角色: {role_code}")
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
        # 删除角色权限关联
        RolePermissionMapping.query.filter_by(role_code=role_code).delete()
        # 删除角色层级关联（作为子角色）
        RoleHierarchy.query.filter_by(child_role_code=role_code).delete()
        # 删除角色
        db.session.delete(rp)
        db.session.commit()
        log_permission_action("删除角色", "role", None, f"删除角色: {role_code}")
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
        if _admin.role in ["admin", "super_admin"] or "admin" in role_codes or "super_admin" in role_codes:
            all_permissions = {"all"}
        else:
            all_permissions = set()
            for role_code in role_codes:
                role = RolePermission.query.filter_by(role_code=role_code).first()
                if role:
                    if role.permissions:
                        if isinstance(role.permissions, str):
                            perms = role.permissions.split(",")
                            for perm in perms:
                                if perm.strip():
                                    all_permissions.add(perm.strip().replace("_", "."))
                        else:
                            logging.warning(
                                "角色 %s 的 permissions 字段格式异常（期望字符串，实际 %s），已跳过",
                                role_code,
                                type(role.permissions).__name__,
                            )
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
            "AssignRoles", {"role_codes": fields.List(fields.String, required=True, description="角色代码列表")}
        )
    )
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def put(self, admin_id):
        """为管理员分配角色（覆盖式）"""
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
        data = request.json
        role_codes = data.get("role_codes", [])
        # 删除旧的角色关联
        AdminRole.query.filter_by(admin_id=admin_id).delete()
        # 添加新的角色关联
        for role_code in role_codes:
            # 检查角色是否存在
            rp = RolePermission.query.filter_by(role_code=role_code).first()
            if not rp:
                continue
            admin_role = AdminRole(admin_id=admin_id, role_code=role_code)
            db.session.add(admin_role)
        db.session.commit()
        log_permission_action(
            "分配角色",
            "admin_role",
            admin_id,
            f"为用户 {admin.username} 分配角色: {', '.join(role_codes) if role_codes else '无'}",
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
        admin_role = AdminRole(admin_id=admin_id, role_code=role_code)
        db.session.add(admin_role)
        db.session.commit()
        return APIResponse.success(message="角色添加成功")

    @ns_rbac.doc("remove_admin_role", description="移除管理员的角色", security="Bearer")
    @ns_rbac.response(200, "成功")
    @ns_rbac.response(404, "关联不存在")
    @requires_permission("system.roles")
    def delete(self, admin_id, role_code):
        """移除管理员的单个角色"""
        admin_role = AdminRole.query.filter_by(admin_id=admin_id, role_code=role_code).first_or_404()
        db.session.delete(admin_role)
        db.session.commit()
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
        return APIResponse.success(data={"role_code": role_code, "permissions": [m.permission_code for m in mappings]})

    @ns_rbac.doc("set_role_permissions", description="设置角色的权限", security="Bearer")
    @ns_rbac.expect(
        ns_rbac.model(
            "SetPermissions", {"permissions": fields.List(fields.String, required=True, description="权限代码列表")}
        )
    )
    @ns_rbac.response(200, "成功")
    @requires_permission("system.roles")
    def put(self, role_code):
        """设置角色的权限（覆盖式）"""
        rp = RolePermission.query.filter_by(role_code=role_code).first_or_404()
        data = request.json
        # 删除旧权限
        RolePermissionMapping.query.filter_by(role_code=role_code).delete()
        # 添加新权限
        for perm_code in data.get("permissions", []):
            mapping = RolePermissionMapping(role_code=role_code, permission_code=perm_code)
            db.session.add(mapping)
        rp.updated_at = datetime.now()
        db.session.commit()
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
        existing = RolePermissionMapping.query.filter_by(role_code=role_code, permission_code=permission_code).first()
        if existing:
            return APIResponse.success(message="权限已分配")
        mapping = RolePermissionMapping(role_code=role_code, permission_code=permission_code)
        db.session.add(mapping)
        db.session.commit()
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
        db.session.delete(mapping)
        db.session.commit()
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
        return APIResponse.success(data={"has_permission": has_perm, "admin_id": admin_id, "permission": permission})


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
        if role.permissions:
            try:
                perms = role.permissions.split(",")
                for perm in perms:
                    permissions.add(perm.strip().replace("_", "."))
            except Exception:
                pass
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
    """初始化默认权限数据"""
    default_permissions = [
        # 系统管理
        {"code": "system.settings", "name": "系统设置", "category": "system"},
        {"code": "system.users", "name": "用户管理", "category": "system"},
        {"code": "system.roles", "name": "角色管理", "category": "system"},
        {"code": "system.logs", "name": "日志查看", "category": "system"},
        {"code": "system.backup", "name": "备份恢复", "category": "system"},
        {"code": "system.cache", "name": "缓存管理", "category": "system"},
        {"code": "system.monitor", "name": "系统监控", "category": "system"},
        # 设备管理
        {"code": "device.view", "name": "查看设备", "category": "device"},
        {"code": "device.create", "name": "创建设备", "category": "device"},
        {"code": "device.edit", "name": "编辑设备", "category": "device"},
        {"code": "device.delete", "name": "删除设备", "category": "device"},
        {"code": "device.groups", "name": "设备分组管理", "category": "device"},
        # 学生管理
        {"code": "student.view", "name": "查看学生", "category": "academic"},
        {"code": "student.create", "name": "添加学生", "category": "academic"},
        {"code": "student.edit", "name": "编辑学生", "category": "academic"},
        {"code": "student.delete", "name": "删除学生", "category": "academic"},
        # 成绩管理
        {"code": "score.view", "name": "查看成绩", "category": "academic"},
        {"code": "score.entry", "name": "录入成绩", "category": "academic"},
        {"code": "score.edit", "name": "修改成绩", "category": "academic"},
        {"code": "score.delete", "name": "删除成绩", "category": "academic"},
        {"code": "score.approve", "name": "审批成绩", "category": "academic"},
        # 班级管理
        {"code": "class.view", "name": "查看班级", "category": "academic"},
        {"code": "class.manage", "name": "管理班级", "category": "academic"},
        # 班主任工作台（座次/值日/班委/家长联系 共用 class.edit 把关写操作）
        {"code": "class.edit", "name": "编辑班级事务(座次/值日/班委/家长联系)", "category": "班主任工作台"},
        {"code": "homework.view", "name": "查看作业", "category": "班主任工作台"},
        {"code": "homework.edit", "name": "布置作业", "category": "班主任工作台"},
        {"code": "homework.check", "name": "检查作业", "category": "班主任工作台"},
        {"code": "attendance.view", "name": "查看考勤", "category": "班主任工作台"},
        {"code": "attendance.edit", "name": "登记考勤", "category": "班主任工作台"},
        {"code": "attendance.approve", "name": "审批请假", "category": "班主任工作台"},
        {"code": "study_group.view", "name": "查看学习小组", "category": "班主任工作台"},
        {"code": "study_group.edit", "name": "管理学习小组", "category": "班主任工作台"},
        {"code": "mental_health.view", "name": "查看心理健康", "category": "班主任工作台"},
        {"code": "mental_health.edit", "name": "记录心理健康", "category": "班主任工作台"},
        {"code": "activity.view", "name": "查看文体活动", "category": "班主任工作台"},
        {"code": "activity.edit", "name": "管理文体活动", "category": "班主任工作台"},
        {"code": "culture.view", "name": "查看班级文化", "category": "班主任工作台"},
        {"code": "culture.edit", "name": "编辑班级文化", "category": "班主任工作台"},
        {"code": "study_guide.view", "name": "查看学法指导", "category": "班主任工作台"},
        {"code": "study_guide.edit", "name": "管理学法指导", "category": "班主任工作台"},
        # 考试管理
        {"code": "exam.view", "name": "查看考试", "category": "academic"},
        {"code": "exam.manage", "name": "管理考试", "category": "academic"},
        # 评分规则
        {"code": "rule.view", "name": "查看规则", "category": "academic"},
        {"code": "rule.manage", "name": "管理规则", "category": "academic"},
        # 时段管理
        {"code": "period.view", "name": "查看时段", "category": "academic"},
        {"code": "period.manage", "name": "管理时段", "category": "academic"},
        # 课表管理
        {"code": "schedule.view", "name": "查看课表", "category": "academic"},
        {"code": "schedule.manage", "name": "管理课表", "category": "academic"},
        # 科目管理
        {"code": "subject.view", "name": "查看科目", "category": "academic"},
        {"code": "subject.manage", "name": "管理科目", "category": "academic"},
        # 通知管理
        {"code": "notification.view", "name": "查看通知", "category": "communication"},
        {"code": "notification.send", "name": "发送通知", "category": "communication"},
        {"code": "notification.force_send", "name": "强制发送通知", "category": "communication"},
        {"code": "timetable.rule.manage", "name": "管理时间规则", "category": "academic"},
        {"code": "phonebox.unlock.manage", "name": "管理本班手机箱开箱策略", "category": "device"},
        # 数据分析
        {"code": "algorithm.view", "name": "查看分析", "category": "analysis"},
        {"code": "algorithm.manage", "name": "管理分析", "category": "analysis"},
        # 报表管理
        {"code": "report.export", "name": "导出报表", "category": "data"},
        {"code": "report.import", "name": "导入数据", "category": "data"},
        # 数据查看（保留兼容）
        {"code": "data.view", "name": "查看数据", "category": "data"},
        {"code": "data.export", "name": "导出数据", "category": "data"},
        {"code": "data.import", "name": "导入数据", "category": "data"},
        {"code": "data_analysis", "name": "数据分析", "category": "data"},
        # 管理权限
        {"code": "admin_manage", "name": "管理员管理", "category": "system"},
        {"code": "all", "name": "全部权限", "category": "system"},
    ]
    for perm_data in default_permissions:
        existing = Permission.query.filter_by(code=perm_data["code"]).first()
        if not existing:
            permission = Permission(**perm_data)
            db.session.add(permission)
    db.session.commit()


def init_default_roles():
    """初始化默认角色数据"""
    default_roles = [
        {
            "role_code": "super_admin",
            "role_name": "超级管理员",
            "description": "拥有所有权限",
            "permissions": ["all", "system.backup", "system.cache", "system.monitor", "notification.force_send"],
        },
        {
            "role_code": "admin",
            "role_name": "管理员",
            "description": "系统管理权限",
            "permissions": [
                "system.users",
                "system.roles",
                "system.settings",
                "system.logs",
                "system.backup",
                "system.cache",
                "system.monitor",
                "admin_manage",
                "student.view",
                "student.create",
                "student.edit",
                "student.delete",
                "score.view",
                "score.entry",
                "score.edit",
                "score.delete",
                "score.approve",
                "class.view",
                "class.manage",
                "exam.view",
                "exam.manage",
                "rule.view",
                "rule.manage",
                "period.view",
                "period.manage",
                "schedule.view",
                "schedule.manage",
                "subject.view",
                "subject.manage",
                "notification.send",
                "notification.view",
                "timetable.rule.manage",
                "algorithm.view",
                "algorithm.manage",
                "report.export",
                "report.import",
                "device.view",
                "device.edit",
                "device.delete",
            ],
        },
        {
            "role_code": "teacher",
            "role_name": "班主任",
            "description": "管理班级学生和成绩",
            "permissions": [
                "student.view",
                "student.create",
                "student.edit",
                "student.delete",
                "score.view",
                "score.entry",
                "score.edit",
                "score.delete",
                "class.view",
                "exam.view",
                "rule.view",
                "period.view",
                "schedule.view",
                "subject.view",
                "notification.send",
                "notification.view",
                "report.export",
                "algorithm.view",
                "phonebox.unlock.manage",
                # 班主任工作台 12 个模块。class.edit 覆盖座次表/值日生/班委/家长联系
                # 4 个模块的全部写端点，缺了这条这 4 个页面点新增就 403。
                "class.edit",
                "homework.view",
                "homework.edit",
                "homework.check",
                "attendance.view",
                "attendance.edit",
                "attendance.approve",
                "study_group.view",
                "study_group.edit",
                "mental_health.view",
                "mental_health.edit",
                "activity.view",
                "activity.edit",
                "culture.view",
                "culture.edit",
                "study_guide.view",
                "study_guide.edit",
            ],
        },
        {
            "role_code": "subject_teacher",
            "role_name": "任课教师",
            "description": "查看授课班级成绩和数据",
            "permissions": [
                "student.view",
                "score.view",
                "score.entry",
                "score.edit",
                "class.view",
                "exam.view",
                "schedule.view",
                "subject.view",
                "notification.view",
            ],
        },
        {
            "role_code": "head_teacher",
            "role_name": "年级组长",
            "description": "管理年级多个班级",
            "permissions": [
                "student.view",
                "student.create",
                "student.edit",
                "student.delete",
                "score.view",
                "score.entry",
                "score.edit",
                "score.delete",
                "score.approve",
                "class.view",
                "exam.view",
                "exam.manage",
                "rule.view",
                "rule.manage",
                "period.view",
                "period.manage",
                "schedule.view",
                "schedule.manage",
                "subject.view",
                "subject.manage",
                "notification.send",
                "notification.view",
                "report.export",
                "report.import",
                "algorithm.view",
            ],
        },
        {
            "role_code": "dashboard_viewer",
            "role_name": "数据大屏用户",
            "description": "查看数据大屏展示",
            "permissions": [
                "student.view",
                "score.view",
                "class.view",
                "exam.view",
                "schedule.view",
                "subject.view",
                "algorithm.view",
                "notification.view",
            ],
        },
        {
            "role_code": "operator",
            "role_name": "运维人员",
            "description": "负责设备运维管理",
            "permissions": [
                "device.view",
                "device.edit",
                "device.groups",
                "system.logs",
                "system.cache",
                "system.monitor",
                "notification.view",
            ],
        },
        {
            "role_code": "viewer",
            "role_name": "查看者",
            "description": "仅可查看数据",
            "permissions": [
                "student.view",
                "score.view",
                "class.view",
                "exam.view",
                "schedule.view",
                "subject.view",
                "rule.view",
                "period.view",
                "notification.view",
            ],
        },
    ]
    for role_data in default_roles:
        existing = RolePermission.query.filter_by(role_code=role_data["role_code"]).first()
        if not existing:
            role = RolePermission(
                role_code=role_data["role_code"],
                role_name=role_data["role_name"],
                description=role_data["description"],
                permissions=",".join(role_data["permissions"]),
                is_active=True,
            )
            db.session.add(role)
        else:
            existing.permissions = ",".join(role_data["permissions"])
            existing.is_active = True
        for perm_code in role_data["permissions"]:
            mapping_exists = RolePermissionMapping.query.filter_by(
                role_code=role_data["role_code"], permission_code=perm_code
            ).first()
            if not mapping_exists:
                mapping = RolePermissionMapping(role_code=role_data["role_code"], permission_code=perm_code)
                db.session.add(mapping)
    db.session.commit()
