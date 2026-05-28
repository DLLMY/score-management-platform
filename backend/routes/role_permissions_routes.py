from flask_restx import Namespace, Resource, fields
from models import db, RolePermission
from utils.permission import requires_admin

ns_role_permissions = Namespace('role-permissions', description='角色权限定义相关操作')

@ns_role_permissions.route('/')
class RolePermissionList(Resource):
    @ns_role_permissions.doc('list_role_permissions')
    @requires_admin
    def get(self):
        permissions = RolePermission.query.all()
        return [{
            'id': p.id,
            'role_code': p.role_code,
            'role_name': p.role_name,
            'description': p.description,
            'permissions': p.permissions,
            'is_active': p.is_active,
            'created_at': p.created_at.isoformat() if p.created_at else None
        } for p in permissions]

@ns_role_permissions.route('/<int:id>')
@ns_role_permissions.param('id', '权限定义ID')
class RolePermissionResource(Resource):
    @ns_role_permissions.doc('get_role_permission')
    @requires_admin
    def get(self, id):
        permission = RolePermission.query.get_or_404(id)
        return {
            'id': permission.id,
            'role_code': permission.role_code,
            'role_name': permission.role_name,
            'description': permission.description,
            'permissions': permission.permissions,
            'is_active': permission.is_active,
            'created_at': permission.created_at.isoformat() if permission.created_at else None,
            'updated_at': permission.updated_at.isoformat() if permission.updated_at else None
        }