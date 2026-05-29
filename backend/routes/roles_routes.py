from flask_restx import Namespace, Resource, fields
from models import db, Role
from utils.permission import requires_admin
from datetime import datetime

ns_roles = Namespace('roles', description='角色管理相关操作')

role_model = ns_roles.model('Role', {
    'id': fields.Integer(readOnly=True, description='角色ID'),
    'name': fields.String(required=True, description='角色名称'),
    'permissions': fields.String(description='权限列表（逗号分隔）')
})

role_list_response = ns_roles.model('RoleListResponse', {
    'roles': fields.List(fields.Nested(role_model), description='角色列表')
})

@ns_roles.route('/')
class RoleList(Resource):
    @ns_roles.doc('list_roles', description='获取角色列表', security='Bearer')
    @ns_roles.response(200, '成功', role_list_response)
    @requires_admin
    def get(self):
        """
        获取角色列表
        
        获取所有可用的角色列表，需要管理员权限。
        """
        roles = Role.query.all()
        return {
            'roles': [{
                'id': r.id,
                'name': r.name,
                'permissions': r.permissions
            } for r in roles]
        }

    @ns_roles.doc('create_role', description='创建角色', security='Bearer')
    @ns_roles.expect(role_model)
    @ns_roles.response(201, '创建成功')
    @ns_roles.response(400, '请求参数错误')
    @requires_admin
    def post(self):
        """
        创建角色
        
        创建新的角色，需要管理员权限。
        
        请求体：
        - name: 角色名称（必填）
        - permissions: 权限列表（可选，逗号分隔）
        """
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
    @ns_roles.doc('get_role', description='获取角色详情', security='Bearer')
    @ns_roles.response(200, '成功')
    @ns_roles.response(404, '角色不存在')
    @requires_admin
    def get(self, id):
        """
        获取角色详情
        
        根据角色ID获取角色的详细信息。
        """
        role = Role.query.get_or_404(id)
        return {
            'id': role.id,
            'name': role.name,
            'permissions': role.permissions
        }

    @ns_roles.doc('update_role', description='更新角色', security='Bearer')
    @ns_roles.expect(role_model)
    @ns_roles.response(200, '更新成功')
    @ns_roles.response(404, '角色不存在')
    @requires_admin
    def put(self, id):
        """
        更新角色
        
        更新指定角色的信息，需要管理员权限。
        """
        role = Role.query.get_or_404(id)
        data = ns_roles.payload
        role.name = data.get('name', role.name)
        role.permissions = data.get('permissions', role.permissions)
        db.session.commit()
        return {'success': True, 'message': '角色更新成功'}

    @ns_roles.doc('delete_role', description='删除角色', security='Bearer')
    @ns_roles.response(200, '删除成功')
    @ns_roles.response(404, '角色不存在')
    @requires_admin
    def delete(self, id):
        """
        删除角色
        
        删除指定角色，需要管理员权限。
        """
        role = Role.query.get_or_404(id)
        db.session.delete(role)
        db.session.commit()
        return {'success': True, 'message': '角色删除成功'}