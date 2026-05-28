from flask_restx import Namespace, Resource, fields
from models import db, Role
from utils.permission import requires_admin
from datetime import datetime

ns_roles = Namespace('roles', description='角色管理相关操作')

role_model = ns_roles.model('Role', {
    'id': fields.Integer(readOnly=True, description='角色ID'),
    'name': fields.String(required=True, description='角色名称'),
    'permissions': fields.String(description='权限列表')
})

@ns_roles.route('/')
class RoleList(Resource):
    @ns_roles.doc('list_roles')
    @requires_admin
    def get(self):
        roles = Role.query.all()
        return {
            'roles': [{
                'id': r.id,
                'name': r.name,
                'permissions': r.permissions
            } for r in roles]
        }

    @ns_roles.doc('create_role')
    @ns_roles.expect(role_model)
    @requires_admin
    def post(self):
        data = ns_roles.payload
        role = Role(
            name=data.get('name'),
            permissions=data.get('permissions', '')
        )
        db.session.add(role)
        db.session.commit()
        return {'success': True, 'message': '角色创建成功', 'role_id': role.id}, 201

@ns_roles.route('/<int:id>')
@ns_roles.param('id', '角色ID')
class RoleResource(Resource):
    @ns_roles.doc('get_role')
    @requires_admin
    def get(self, id):
        role = Role.query.get_or_404(id)
        return {
            'id': role.id,
            'name': role.name,
            'permissions': role.permissions
        }

    @ns_roles.doc('update_role')
    @ns_roles.expect(role_model)
    @requires_admin
    def put(self, id):
        role = Role.query.get_or_404(id)
        data = ns_roles.payload
        role.name = data.get('name', role.name)
        role.permissions = data.get('permissions', role.permissions)
        db.session.commit()
        return {'success': True, 'message': '角色更新成功'}

    @ns_roles.doc('delete_role')
    @requires_admin
    def delete(self, id):
        role = Role.query.get_or_404(id)
        db.session.delete(role)
        db.session.commit()
        return {'success': True, 'message': '角色删除成功'}