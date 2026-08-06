from flask_restx import Namespace, Resource, fields
from models import RolePermission
from utils.permission import requires_admin

ns_role_permissions = Namespace("role-permissions", description="角色权限定义相关操作")

role_permission_model = ns_role_permissions.model(
    "RolePermission",
    {
        "id": fields.Integer(readOnly=True, description="权限定义ID"),
        "role_code": fields.String(required=True, description="角色代码"),
        "role_name": fields.String(required=True, description="角色名称"),
        "description": fields.String(description="角色描述"),
        "permissions": fields.String(description="权限列表（逗号分隔）"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

role_permission_list_response = ns_role_permissions.model(
    "RolePermissionListResponse",
    {"role_permissions": fields.List(fields.Nested(role_permission_model), description="权限定义列表")},
)


@ns_role_permissions.route("/")
class RolePermissionList(Resource):
    @ns_role_permissions.doc("list_role_permissions", description="获取权限定义列表", security="Bearer")
    @ns_role_permissions.response(200, "成功")
    @requires_admin
    def get(self):
        """
        获取权限定义列表

        获取系统中所有角色权限定义的列表。
        """
        permissions = RolePermission.query.all()
        return [
            {
                "id": p.id,
                "role_code": p.role_code,
                "role_name": p.role_name,
                "description": p.description,
                "permissions": p.permissions,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in permissions
        ]


@ns_role_permissions.route("/<int:id>")
@ns_role_permissions.param("id", "权限定义ID")
class RolePermissionResource(Resource):
    @ns_role_permissions.doc("get_role_permission", description="获取权限定义详情", security="Bearer")
    @ns_role_permissions.response(200, "成功")
    @ns_role_permissions.response(404, "权限定义不存在")
    @requires_admin
    def get(self, id):
        """
        获取权限定义详情

        根据ID获取角色权限定义的详细信息。

        参数：
        - id: 权限定义ID（路径参数）
        """
        permission = RolePermission.query.get_or_404(id)
        return {
            "id": permission.id,
            "role_code": permission.role_code,
            "role_name": permission.role_name,
            "description": permission.description,
            "permissions": permission.permissions,
            "is_active": permission.is_active,
            "created_at": permission.created_at.isoformat() if permission.created_at else None,
            "updated_at": permission.updated_at.isoformat() if permission.updated_at else None,
        }
