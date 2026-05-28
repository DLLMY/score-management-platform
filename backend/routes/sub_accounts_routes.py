from flask_restx import Namespace, Resource, fields
from models import db, SubAccount
from utils.permission import requires_admin
from datetime import datetime

ns_sub_accounts = Namespace('sub-accounts', description='子账号管理相关操作')

sub_account_model = ns_sub_accounts.model('SubAccount', {
    'id': fields.Integer(readOnly=True, description='子账号ID'),
    'parent_admin_id': fields.Integer(required=True, description='父管理员ID'),
    'username': fields.String(required=True, description='用户名'),
    'password': fields.String(description='密码'),
    'real_name': fields.String(description='真实姓名'),
    'phone': fields.String(description='联系电话'),
    'role_type': fields.String(description='角色类型'),
    'permissions': fields.String(description='权限列表'),
    'is_active': fields.Boolean(description='是否启用')
})

@ns_sub_accounts.route('/')
class SubAccountList(Resource):
    @ns_sub_accounts.doc('list_sub_accounts')
    @requires_admin
    def get(self):
        accounts = SubAccount.query.all()
        return {
            'accounts': [{
                'id': a.id,
                'parent_admin_id': a.parent_admin_id,
                'username': a.username,
                'real_name': a.real_name,
                'phone': a.phone,
                'role_type': a.role_type,
                'permissions': a.permissions,
                'is_active': a.is_active,
                'created_at': a.created_at.isoformat() if a.created_at else None
            } for a in accounts]
        }

    @ns_sub_accounts.doc('create_sub_account')
    @ns_sub_accounts.expect(sub_account_model)
    @requires_admin
    def post(self):
        data = ns_sub_accounts.payload
        account = SubAccount(
            parent_admin_id=data.get('parent_admin_id'),
            username=data.get('username'),
            password=data.get('password'),
            real_name=data.get('real_name'),
            phone=data.get('phone'),
            role_type=data.get('role_type', 'dashboard_viewer'),
            permissions=data.get('permissions', ''),
            is_active=data.get('is_active', True)
        )
        db.session.add(account)
        db.session.commit()
        return {'success': True, 'message': '子账号创建成功', 'account_id': account.id}, 201

@ns_sub_accounts.route('/<int:id>')
@ns_sub_accounts.param('id', '子账号ID')
class SubAccountResource(Resource):
    @ns_sub_accounts.doc('get_sub_account')
    @requires_admin
    def get(self, id):
        account = SubAccount.query.get_or_404(id)
        return {
            'id': account.id,
            'parent_admin_id': account.parent_admin_id,
            'username': account.username,
            'real_name': account.real_name,
            'phone': account.phone,
            'role_type': account.role_type,
            'permissions': account.permissions,
            'is_active': account.is_active,
            'created_at': account.created_at.isoformat() if account.created_at else None,
            'updated_at': account.updated_at.isoformat() if account.updated_at else None
        }

    @ns_sub_accounts.doc('update_sub_account')
    @ns_sub_accounts.expect(sub_account_model)
    @requires_admin
    def put(self, id):
        account = SubAccount.query.get_or_404(id)
        data = ns_sub_accounts.payload
        account.username = data.get('username', account.username)
        if data.get('password'):
            account.password = data.get('password')
        account.real_name = data.get('real_name', account.real_name)
        account.phone = data.get('phone', account.phone)
        account.role_type = data.get('role_type', account.role_type)
        account.permissions = data.get('permissions', account.permissions)
        account.is_active = data.get('is_active', account.is_active)
        account.updated_at = datetime.now()
        db.session.commit()
        return {'success': True, 'message': '子账号更新成功'}

    @ns_sub_accounts.doc('delete_sub_account')
    @requires_admin
    def delete(self, id):
        account = SubAccount.query.get_or_404(id)
        db.session.delete(account)
        db.session.commit()
        return {'success': True, 'message': '子账号删除成功'}

@ns_sub_accounts.route('/login')
class SubAccountLogin(Resource):
    @ns_sub_accounts.doc('sub_account_login')
    def post(self):
        data = ns_sub_accounts.payload
        username = data.get('username')
        password = data.get('password')
        
        account = SubAccount.query.filter_by(username=username).first()
        if account and account.password == password and account.is_active:
            return {'success': True, 'message': '登录成功', 'token': str(account.id), 'account': {
                'id': account.id,
                'username': account.username,
                'role_type': account.role_type,
                'real_name': account.real_name
            }}
        
        return {'success': False, 'message': '用户名或密码错误'}, 401