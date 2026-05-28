from flask import request, session
from flask_restx import Namespace, Resource, fields
from flask_wtf.csrf import generate_csrf
from models import db, Admin, AdminClass, ClassInfo
from utils.permission import requires_admin, requires_permission
from utils.logger import log_operation, log_login_attempt, log_security_event
from utils.security import hash_password, verify_password, generate_tokens, validate_token, is_strong_password
from datetime import datetime

ns_admins = Namespace('admins', description='管理员管理相关操作')

admin_model = ns_admins.model('Admin', {
    'id': fields.Integer(readOnly=True, description='管理员ID'),
    'username': fields.String(required=True, description='用户名'),
    'password': fields.String(description='密码'),
    'role': fields.String(description='角色'),
    'real_name': fields.String(description='真实姓名'),
    'phone': fields.String(description='联系电话'),
    'class_name': fields.String(description='班级')
})

@ns_admins.route('/')
class AdminList(Resource):
    @ns_admins.doc('list_admins')
    @requires_admin
    def get(self):
        admins = Admin.query.all()
        return {
            'admins': [{
                'id': a.id,
                'username': a.username,
                'role': a.role,
                'real_name': a.real_name,
                'phone': a.phone,
                'class_name': a.class_name,
                'created_at': a.created_at.isoformat() if a.created_at else None
            } for a in admins]
        }

    @ns_admins.doc('create_admin')
    @ns_admins.expect(admin_model)
    @requires_permission('admin')
    def post(self):
        data = ns_admins.payload
        password = data.get('password')
        
        # 密码强度验证
        if not password or not is_strong_password(password):
            return {'success': False, 'message': '密码强度不足：至少8位，包含字母和数字'}, 400
        
        admin = Admin(
            username=data.get('username'),
            password=hash_password(password),
            role=data.get('role', 'admin'),
            real_name=data.get('real_name'),
            phone=data.get('phone'),
            class_name=data.get('class_name')
        )
        db.session.add(admin)
        db.session.commit()
        return {'success': True, 'message': '管理员创建成功', 'admin_id': admin.id}, 201

@ns_admins.route('/<int:id>')
@ns_admins.param('id', '管理员ID')
class AdminResource(Resource):
    @ns_admins.doc('get_admin')
    @requires_admin
    def get(self, id):
        admin = Admin.query.get_or_404(id)
        return {
            'id': admin.id,
            'username': admin.username,
            'role': admin.role,
            'real_name': admin.real_name,
            'phone': admin.phone,
            'class_name': admin.class_name,
            'created_at': admin.created_at.isoformat() if admin.created_at else None,
            'updated_at': admin.updated_at.isoformat() if admin.updated_at else None
        }

    @ns_admins.doc('update_admin')
    @ns_admins.expect(admin_model)
    @requires_admin
    def put(self, id):
        admin = Admin.query.get_or_404(id)
        data = ns_admins.payload
        admin.username = data.get('username', admin.username)
        if data.get('password'):
            admin.password = data.get('password')
        admin.role = data.get('role', admin.role)
        admin.real_name = data.get('real_name', admin.real_name)
        admin.phone = data.get('phone', admin.phone)
        admin.class_name = data.get('class_name', admin.class_name)
        admin.updated_at = datetime.now()
        db.session.commit()
        return {'success': True, 'message': '管理员更新成功'}

    @ns_admins.doc('delete_admin')
    @requires_permission('admin')
    def delete(self, id):
        admin = Admin.query.get_or_404(id)
        db.session.delete(admin)
        db.session.commit()
        return {'success': True, 'message': '管理员删除成功'}

@ns_admins.route('/login')
class AdminLogin(Resource):
    @ns_admins.doc('admin_login')
    def post(self):
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        admin = Admin.query.filter_by(username=username).first()
        
        # 使用bcrypt验证密码
        if admin and verify_password(password, admin.password):
            log_operation(
                operation_type='login',
                target_type='admin',
                target_id=admin.id,
                description=f'管理员登录: {admin.username}',
                after_data={'username': username}
            )
            # 记录安全日志
            log_login_attempt(username, success=True)
            
            # 生成JWT令牌
            tokens = generate_tokens(admin.id, admin.username, admin.role)
            
            return {'success': True, 'message': '登录成功', **tokens, 'admin': {
                'id': admin.id,
                'username': admin.username,
                'role': admin.role,
                'real_name': admin.real_name
            }}

        log_operation(
            operation_type='login_failed',
            target_type='admin',
            description=f'登录失败: 用户名={username}',
            after_data={'username': username}
        )
        # 记录安全日志
        log_login_attempt(username, success=False, reason='用户名或密码错误')
        
        return {'success': False, 'message': '用户名或密码错误'}, 401

@ns_admins.route('/csrf-token')
class AdminCsrfToken(Resource):
    @ns_admins.doc('get_csrf_token')
    def get(self):
        """获取CSRF令牌"""
        csrf_token = generate_csrf()
        return {'success': True, 'csrf_token': csrf_token}

@ns_admins.route('/refresh-token')
class AdminRefreshToken(Resource):
    @ns_admins.doc('refresh_token')
    def post(self):
        data = request.get_json()
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            return {'success': False, 'message': '请提供refresh_token'}, 400
        
        # 验证refresh token
        payload = validate_token(refresh_token, 'refresh')
        
        if not payload:
            return {'success': False, 'message': '无效的refresh_token'}, 401
        
        admin_id = payload.get('admin_id')
        admin = Admin.query.get(admin_id)
        
        if not admin:
            return {'success': False, 'message': '管理员不存在'}, 401
        
        # 生成新的令牌
        tokens = generate_tokens(admin.id, admin.username, admin.role)
        
        log_operation(
            operation_type='token_refresh',
            target_type='admin',
            target_id=admin.id,
            description=f'管理员刷新令牌: {admin.username}'
        )
        
        return {'success': True, 'message': '令牌刷新成功', **tokens}

@ns_admins.route('/<int:id>/change-password')
@ns_admins.param('id', '管理员ID')
class AdminChangePassword(Resource):
    @ns_admins.doc('change_password')
    def post(self, id):
        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if not old_password or not new_password:
            return {'success': False, 'message': '请提供旧密码和新密码'}, 400

        # 新密码强度验证
        if not is_strong_password(new_password):
            return {'success': False, 'message': '新密码强度不足：至少8位，包含字母和数字'}, 400

        admin = Admin.query.get_or_404(id)

        # 使用bcrypt验证旧密码
        if not verify_password(old_password, admin.password):
            return {'success': False, 'message': '旧密码错误'}, 400

        admin.password = hash_password(new_password)
        admin.updated_at = datetime.now()
        db.session.commit()

        return {'success': True, 'message': '密码修改成功'}

@ns_admins.route('/<int:admin_id>/assign-class')
@ns_admins.param('admin_id', '管理员ID')
class AdminAssignClass(Resource):
    @ns_admins.doc('assign_class_to_admin')
    @requires_admin
    def post(self, admin_id):
        data = request.get_json()
        class_id = data.get('class_id')
        is_primary = data.get('is_primary', False)

        if not class_id:
            return {'success': False, 'message': '请提供班级ID'}, 400

        admin = Admin.query.get_or_404(admin_id)
        class_info = ClassInfo.query.get_or_404(class_id)

        existing_link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
        if existing_link:
            existing_link.is_primary = is_primary
        else:
            link = AdminClass(
                admin_id=admin_id,
                class_info_id=class_id,
                is_primary=is_primary,
                assigned_at=datetime.now()
            )
            db.session.add(link)

        db.session.commit()
        return {'success': True, 'message': '班级分配成功'}

@ns_admins.route('/<int:admin_id>/remove-class/<int:class_id>')
@ns_admins.param('admin_id', '管理员ID')
@ns_admins.param('class_id', '班级ID')
class AdminRemoveClass(Resource):
    @ns_admins.doc('remove_class_from_admin')
    @requires_admin
    def post(self, admin_id, class_id):
        link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
        if not link:
            return {'success': False, 'message': '未找到关联记录'}, 404

        db.session.delete(link)
        db.session.commit()
        return {'success': True, 'message': '班级移除成功'}
