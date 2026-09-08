from flask_restx import Namespace, Resource, fields
from models import RolePermission
from utils.permission import requires_admin

# 角色权限定义响应字段子集（list 用；detail 用全量 to_dict()）
ROLE_PERMISSION_FIELDS = [
    "id",
    "role_code",
    "role_name",
    "description",
    "is_active",
    "created_at",
]

ns_role_permissions = Namespace("role-permissions", description="角色权限定义相关操作")

role_permission_model = ns_role_permissions.model(
    "RolePermission",
    {
        "id": fields.Integer(readOnly=True, description="权限定义ID"),
        "role_code": fields.String(required=True, description="角色代码"),
        "role_name": fields.String(required=True, description="角色名称"),
        "description": fields.String(description="角色描述"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

role_permission_list_response = ns_role_permissions.model(
    "RolePermissionListResponse",
    {
        "role_permissions": fields.List(
            fields.Nested(role_permission_model), description="权限定义列表"
        )
    },
)


@ns_role_permissions.route("/")
class RolePermissionList(Resource):
    @ns_role_permissions.doc(
        "list_role_permissions", description="获取权限定义列表", security="Bearer"
    )
    @ns_role_permissions.response(200, "成功")
    @requires_admin
    def get(self):
        """
        获取权限定义列表

        获取系统中所有角色权限定义的列表。
        """
        permissions = RolePermission.query.all()
        return [p.to_dict(ROLE_PERMISSION_FIELDS) for p in permissions]


@ns_role_permissions.route("/<int:id>")
@ns_role_permissions.param("id", "权限定义ID")
class RolePermissionResource(Resource):
    @ns_role_permissions.doc(
        "get_role_permission", description="获取权限定义详情", security="Bearer"
    )
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
        return permission.to_dict()
