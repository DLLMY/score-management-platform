from flask_restx import Namespace, Resource, fields
from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from models import db, User, ClassInfo, AdminClass
from utils.permission import requires_admin, get_current_admin, get_admin_class_ids
from utils.logger import log_operation
from utils.security import generate_student_token, verify_password
from services.cache_service import cache_service, cached
from datetime import datetime
import io
import csv
import json

limiter = Limiter(get_remote_address)

ns_users = Namespace('users', description='学生管理相关操作')

# 学生登录模型
login_model = ns_users.model('StudentLogin', {
    'username': fields.String(required=True, description='用户名'),
    'password': fields.String(required=True, description='密码')
})

user_model = ns_users.model('User', {
    'id': fields.Integer(readOnly=True, description='学生ID'),
    'name': fields.String(required=True, description='学生姓名'),
    'gender': fields.String(description='性别'),
    'class_name': fields.String(description='班级'),
    'phone': fields.String(description='联系电话'),
    'father_name': fields.String(description='父亲姓名'),
    'father_phone': fields.String(description='父亲电话'),
    'mother_name': fields.String(description='母亲姓名'),
    'mother_phone': fields.String(description='母亲电话'),
    'guardian_name': fields.String(description='监护人姓名'),
    'guardian_phone': fields.String(description='监护人电话'),
    'guardian_relation': fields.String(description='监护关系'),
    'card_id': fields.String(description='卡片ID'),
    'current_score': fields.Float(description='当前积分')
})

user_list_response = ns_users.model('UserListResponse', {
    'users': fields.List(fields.Nested(user_model), description='用户列表'),
    'total': fields.Integer(description='总记录数'),
    'page': fields.Integer(description='当前页码'),
    'per_page': fields.Integer(description='每页数量'),
    'pages': fields.Integer(description='总页数')
})

batch_score_model = ns_users.model('BatchScoreRequest', {
    'ids': fields.List(fields.Integer, required=True, description='用户ID列表'),
    'score_change': fields.Integer(required=True, description='积分变化量'),
    'description': fields.String(description='操作描述')
})

def get_classes_for_admin(admin):
    """获取管理员可以访问的班级名称列表"""
    if not admin or admin.role == 'admin':
        return None
    
    class_ids = get_admin_class_ids(admin.id)
    if class_ids:
        classes = ClassInfo.query.filter(ClassInfo.id.in_(class_ids)).all()
        return [c.name for c in classes]
    
    return []

@ns_users.route('/')
class UserList(Resource):
    @ns_users.doc('list_users', description='获取学生列表', security='Bearer', params={
        'page': '页码，默认1',
        'per_page': '每页数量，默认100',
        'search': '搜索关键词（姓名、学号、电话）',
        'class_name': '班级名称筛选'
    })
    @ns_users.response(200, '成功', user_list_response)
    @requires_admin
    def get(self):
        """
        获取学生列表
        
        根据权限返回学生列表。超级管理员可以查看所有学生，教师只能查看所属班级的学生。
        
        查询参数：
        - page: 页码（默认1）
        - per_page: 每页数量（默认100）
        - search: 搜索关键词，匹配姓名、卡号、电话
        - class_name: 班级名称筛选
        
        返回分页结果，包含用户列表和分页信息。
        """
        admin = get_current_admin()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 100, type=int)
        search = request.args.get('search', '')
        class_name = request.args.get('class_name', '')

        # 缓存键包含管理员角色，确保不同角色看到不同的结果
        cache_key = f"users_list:{admin.role}:{page}:{per_page}:{search}:{class_name}"
        cached_result = cache_service.get(cache_key)
        if cached_result is not None:
            return cached_result

        query = User.query
        
        # 根据管理员权限过滤班级
        allowed_classes = get_classes_for_admin(admin)
        # 如果不是超级管理员且没有分配班级，返回空结果
        if allowed_classes == []:
            return {'users': [], 'total': 0, 'page': page, 'per_page': per_page, 'pages': 0}
        # 如果不是超级管理员，只显示允许的班级
        if allowed_classes is not None:
            if class_name:
                if class_name not in allowed_classes:
                    return {'users': [], 'total': 0, 'page': page, 'per_page': per_page, 'pages': 0}
            else:
                query = query.filter(User.class_name.in_(allowed_classes))
        
        if search:
            query = query.filter(
                (User.name.like(f'%{search}%')) |
                (User.card_id.like(f'%{search}%')) |
                (User.phone.like(f'%{search}%'))
            )
        if class_name:
            query = query.filter(User.class_name == class_name)

        pagination = query.order_by(User.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        result = {
            'users': [{
                'id': u.id,
                'name': u.name,
                'gender': u.gender,
                'class_name': u.class_name,
                'phone': u.phone,
                'father_name': u.father_name,
                'father_phone': u.father_phone,
                'mother_name': u.mother_name,
                'mother_phone': u.mother_phone,
                'guardian_name': u.guardian_name,
                'guardian_phone': u.guardian_phone,
                'guardian_relation': u.guardian_relation,
                'card_id': u.card_id,
                'current_score': u.current_score,
                'role': 'student',
                'created_at': u.created_at.isoformat() if u.created_at else None
            } for u in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }

        cache_service.set(cache_key, result, ttl=300)
        return result

    @ns_users.doc('create_user', description='创建学生', security='Bearer')
    @ns_users.expect(user_model)
    @ns_users.response(201, '创建成功')
    @ns_users.response(400, '参数错误')
    @requires_admin
    def post(self):
        """
        创建新学生
        
        创建一个新的学生账户。需要管理员权限。
        
        请求体：
        - name: 学生姓名（必填）
        - gender: 性别（可选）
        - class_name: 班级（可选）
        - phone: 联系电话（可选）
        - father_name: 父亲姓名（可选）
        - father_phone: 父亲电话（可选）
        - mother_name: 母亲姓名（可选）
        - mother_phone: 母亲电话（可选）
        - guardian_name: 监护人姓名（可选）
        - guardian_phone: 监护人电话（可选）
        - guardian_relation: 监护关系（可选）
        - card_id: 学号（必填）
        - current_score: 当前积分（可选，默认0）
        """
        data = ns_users.payload
        user = User(
            name=data.get('name'),
            gender=data.get('gender'),
            class_name=data.get('class_name'),
            phone=data.get('phone'),
            father_name=data.get('father_name'),
            father_phone=data.get('father_phone'),
            mother_name=data.get('mother_name'),
            mother_phone=data.get('mother_phone'),
            guardian_name=data.get('guardian_name'),
            guardian_phone=data.get('guardian_phone'),
            guardian_relation=data.get('guardian_relation'),
            card_id=data.get('card_id'),
            current_score=data.get('current_score', 0)
        )
        db.session.add(user)
        db.session.commit()
        
        log_operation(
            operation_type='create',
            target_type='user',
            target_id=user.id,
            description=f'创建学生: {user.name}',
            after_data=data
        )
        
        cache_service.flush_all()
        
        return {
            'success': True,
            'message': '用户创建成功',
            'user': {
                'id': user.id,
                'name': user.name,
                'gender': user.gender,
                'class_name': user.class_name,
                'phone': user.phone,
                'father_name': user.father_name,
                'father_phone': user.father_phone,
                'mother_name': user.mother_name,
                'mother_phone': user.mother_phone,
                'guardian_name': user.guardian_name,
                'guardian_phone': user.guardian_phone,
                'guardian_relation': user.guardian_relation,
                'card_id': user.card_id,
                'current_score': user.current_score,
                'role': 'student',
                'created_at': user.created_at.isoformat() if user.created_at else None
            }
        }, 201

@ns_users.route('/<int:id>')
@ns_users.param('id', '用户ID')
class UserResource(Resource):
    @ns_users.doc('get_user', description='获取单个学生信息')
    @ns_users.response(200, '成功', user_model)
    @ns_users.response(404, '学生不存在')
    def get(self, id):
        """
        获取单个学生详细信息
        
        根据学生ID获取详细信息。
        """
        user = User.query.get_or_404(id)
        return {
            'id': user.id,
            'name': user.name,
            'gender': user.gender,
            'class_name': user.class_name,
            'phone': user.phone,
            'father_name': user.father_name,
            'father_phone': user.father_phone,
            'mother_name': user.mother_name,
            'mother_phone': user.mother_phone,
            'guardian_name': user.guardian_name,
            'guardian_phone': user.guardian_phone,
            'guardian_relation': user.guardian_relation,
            'card_id': user.card_id,
            'current_score': user.current_score,
            'role': 'student',
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'updated_at': user.updated_at.isoformat() if user.updated_at else None
        }

    @ns_users.doc('update_user', description='更新学生信息', security='Bearer')
    @ns_users.expect(user_model)
    @ns_users.response(200, '更新成功')
    @ns_users.response(404, '学生不存在')
    @requires_admin
    def put(self, id):
        """
        更新学生信息
        
        更新指定学生的信息。需要管理员权限。
        
        请求体参数均为可选，只更新提供的字段。
        """
        user = User.query.get_or_404(id)
        
        before_data = {
            'name': user.name,
            'gender': user.gender,
            'class_name': user.class_name,
            'phone': user.phone,
            'card_id': user.card_id,
            'current_score': user.current_score
        }
        
        data = ns_users.payload
        user.name = data.get('name', user.name)
        user.gender = data.get('gender', user.gender)
        user.class_name = data.get('class_name', user.class_name)
        user.phone = data.get('phone', user.phone)
        user.father_name = data.get('father_name', user.father_name)
        user.father_phone = data.get('father_phone', user.father_phone)
        user.mother_name = data.get('mother_name', user.mother_name)
        user.mother_phone = data.get('mother_phone', user.mother_phone)
        user.guardian_name = data.get('guardian_name', user.guardian_name)
        user.guardian_phone = data.get('guardian_phone', user.guardian_phone)
        user.guardian_relation = data.get('guardian_relation', user.guardian_relation)
        user.card_id = data.get('card_id', user.card_id)
        user.current_score = data.get('current_score', user.current_score)
        user.updated_at = datetime.now()
        db.session.commit()
        
        log_operation(
            operation_type='update',
            target_type='user',
            target_id=user.id,
            description=f'更新学生信息: {user.name}',
            before_data=before_data,
            after_data=data
        )
        
        cache_service.flush_all()
        
        return {
            'success': True,
            'message': '用户更新成功',
            'user': {
                'id': user.id,
                'name': user.name,
                'gender': user.gender,
                'class_name': user.class_name,
                'phone': user.phone,
                'father_name': user.father_name,
                'father_phone': user.father_phone,
                'mother_name': user.mother_name,
                'mother_phone': user.mother_phone,
                'guardian_name': user.guardian_name,
                'guardian_phone': user.guardian_phone,
                'guardian_relation': user.guardian_relation,
                'card_id': user.card_id,
                'current_score': user.current_score,
                'role': 'student',
                'created_at': user.created_at.isoformat() if user.created_at else None
            }
        }

    @ns_users.doc('delete_user', description='删除学生', security='Bearer')
    @ns_users.response(200, '删除成功')
    @ns_users.response(404, '学生不存在')
    @requires_admin
    def delete(self, id):
        """
        删除学生
        
        删除指定的学生账户。需要管理员权限。
        """
        user = User.query.get_or_404(id)
        
        before_data = {
            'name': user.name,
            'class_name': user.class_name,
            'card_id': user.card_id,
            'current_score': user.current_score
        }
        
        db.session.delete(user)
        db.session.commit()
        
        log_operation(
            operation_type='delete',
            target_type='user',
            target_id=id,
            description=f'删除学生: {before_data["name"]}',
            before_data=before_data
        )
        
        cache_service.flush_all()
        
        return {'success': True, 'message': '用户删除成功'}

@ns_users.route('/by-card/<string:cardId>')
@ns_users.param('cardId', '卡片ID')
class UserByCard(Resource):
    @ns_users.doc('get_user_by_card', description='通过卡片ID获取学生信息')
    @ns_users.response(200, '成功')
    @ns_users.response(404, '未找到用户')
    def get(self, cardId):
        """
        通过卡片ID获取学生信息
        
        根据学生的卡片ID查询学生信息。
        """
        user = User.query.filter_by(card_id=cardId).first()
        if not user:
            return {'success': False, 'message': '未找到用户'}, 404
        return {
            'id': user.id,
            'name': user.name,
            'gender': user.gender,
            'class_name': user.class_name,
            'phone': user.phone,
            'card_id': user.card_id,
            'current_score': user.current_score
        }

@ns_users.route('/import')
class UserImport(Resource):
    @ns_users.doc('import_users', description='批量导入学生（JSON格式）', security='Bearer')
    @ns_users.expect(ns_users.model('UserImportRequest', {
        'users': fields.List(fields.Nested(user_model), required=True, description='学生列表')
    }))
    @ns_users.response(200, '导入完成')
    @ns_users.response(400, '没有导入数据')
    @requires_admin
    def post(self):
        """
        批量导入学生（JSON格式）
        
        通过JSON格式批量导入学生数据。需要管理员权限。
        
        请求体：
        - users: 学生列表数组
        
        返回导入结果，包含成功和失败数量。
        """
        data = request.get_json()
        users_data = data.get('users', [])

        if not users_data:
            return {'success': False, 'message': '没有导入数据'}, 400

        imported_count = 0
        error_count = 0
        errors = []

        for idx, user_data in enumerate(users_data):
            try:
                existing = User.query.filter_by(card_id=user_data.get('card_id')).first()
                if existing:
                    error_count += 1
                    errors.append(f'第{idx+1}行: 学号 {user_data.get("card_id")} 已存在')
                    continue

                user = User(
                    name=user_data.get('name'),
                    gender=user_data.get('gender', ''),
                    class_name=user_data.get('class_name', ''),
                    phone=user_data.get('phone', ''),
                    father_name=user_data.get('father_name', ''),
                    father_phone=user_data.get('father_phone', ''),
                    mother_name=user_data.get('mother_name', ''),
                    mother_phone=user_data.get('mother_phone', ''),
                    guardian_name=user_data.get('guardian_name', ''),
                    guardian_phone=user_data.get('guardian_phone', ''),
                    guardian_relation=user_data.get('guardian_relation', ''),
                    card_id=user_data.get('card_id'),
                    current_score=user_data.get('current_score', 0)
                )
                db.session.add(user)
                imported_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f'第{idx+1}行: {str(e)}')

        db.session.commit()
        return {
            'success': True,
            'message': f'导入完成: 成功{imported_count}条, 失败{error_count}条',
            'imported': imported_count,
            'errors': errors
        }

@ns_users.route('/batch-delete')
class UserBatchDelete(Resource):
    @ns_users.doc('batch_delete_users', description='批量删除学生', security='Bearer')
    @ns_users.expect(ns_users.model('BatchDeleteRequest', {
        'ids': fields.List(fields.Integer, required=True, description='用户ID列表')
    }))
    @ns_users.response(200, '删除完成')
    @ns_users.response(400, '没有提供删除ID')
    @requires_admin
    def post(self):
        """
        批量删除学生
        
        批量删除指定的学生。需要管理员权限。
        
        请求体：
        - ids: 用户ID列表
        
        返回删除结果。
        """
        data = request.get_json()
        ids = data.get('ids', [])

        if not ids:
            return {'success': False, 'message': '没有提供删除ID'}, 400

        deleted_count = 0
        for user_id in ids:
            user = User.query.get(user_id)
            if user:
                db.session.delete(user)
                deleted_count += 1

        db.session.commit()
        return {'success': True, 'message': f'批量删除完成: 成功{deleted_count}条'}

@ns_users.route('/batch-score')
class UserBatchScore(Resource):
    @ns_users.doc('batch_update_user_score', description='批量调整学生积分', security='Bearer')
    @ns_users.expect(batch_score_model)
    @ns_users.response(200, '调整完成')
    @ns_users.response(400, '没有提供用户ID')
    @requires_admin
    def post(self):
        """
        批量调整学生积分
        
        为多个学生同时调整积分。需要管理员权限。
        
        请求体：
        - ids: 用户ID列表（必填）
        - score_change: 积分变化量（必填，正数加分，负数扣分）
        - description: 操作描述（可选）
        
        返回调整结果。
        """
        data = request.get_json()
        ids = data.get('ids', [])
        score_change = data.get('score_change', 0)
        description = data.get('description', '批量积分调整')

        if not ids:
            return {'success': False, 'message': '没有提供用户ID'}, 400

        from models import ScoreRecord
        updated_count = 0
        for user_id in ids:
            user = User.query.get(user_id)
            if user:
                user.current_score += score_change
                user.updated_at = datetime.now()

                record = ScoreRecord(
                    user_id=user_id,
                    score_change=score_change,
                    description=description,
                    operator='batch_operation'
                )
                db.session.add(record)
                updated_count += 1

        db.session.commit()
        return {'success': True, 'message': f'批量积分调整完成: 成功{updated_count}条'}

@ns_users.route('/template/download')
class UserTemplate(Resource):
    @ns_users.doc('download_user_template', description='下载导入模板')
    def get(self):
        """
        下载CSV导入模板
        
        下载学生批量导入的CSV模板文件。
        """
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['姓名', '性别', '班级', '联系电话', '卡片ID', '父亲姓名', '父亲电话', '母亲姓名', '母亲电话', '监护人姓名', '监护人电话', '监护关系', '初始积分'])

        writer.writerow(['张三', '男', '一年一班', '13800138000', 'CARD001', '张父', '13900139000', '张母', '13700137000', '', '', '', '60'])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='user_import_template.csv'
        )

def detect_encoding(content_bytes):
    encodings = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'gb18030']
    
    for encoding in encodings:
        try:
            content = content_bytes.decode(encoding)
            return content, encoding
        except UnicodeDecodeError:
            continue
    
    return None, None

@ns_users.route('/import-file', methods=['POST'])
class UserImportFile(Resource):
    @ns_users.doc('import_users_file', description='通过CSV文件批量导入学生', security='Bearer')
    @ns_users.response(200, '导入完成')
    @ns_users.response(400, '文件错误')
    @requires_admin
    def post(self):
        """
        通过CSV文件批量导入学生
        
        上传CSV文件批量导入学生数据。支持UTF-8和GBK编码。需要管理员权限。
        
        请求：multipart/form-data
        - file: CSV文件
        
        CSV文件格式：
        姓名,性别,班级,联系电话,卡片ID,父亲姓名,父亲电话,母亲姓名,母亲电话,监护人姓名,监护人电话,监护关系,初始积分
        
        返回导入结果，包含新增、更新数量和错误信息。
        """
        from flask import request
        if 'file' not in request.files:
            return {'success': False, 'message': '请选择文件'}, 400
        
        file = request.files['file']
        
        if file.filename == '':
            return {'success': False, 'message': '请选择文件'}, 400
        
        if not file.filename.lower().endswith('.csv'):
            return {'success': False, 'message': '请选择CSV格式的文件'}, 400
        
        imported = 0
        updated = 0
        errors = []
        
        try:
            content_bytes = file.read()
            content, encoding = detect_encoding(content_bytes)
            
            if content is None:
                return {'success': False, 'message': '无法识别文件编码，请使用UTF-8或GBK编码保存文件'}, 400
            
            lines = content.split('\n')
            
            if len(lines) == 0:
                return {'success': False, 'message': '文件为空'}, 400
            
            reader = csv.reader(lines)
            rows = list(reader)
            
            if len(rows) < 2:
                return {'success': False, 'message': '文件没有数据'}, 400
            
            headers = [h.strip() for h in rows[0]]
            
            mapping = {
                '姓名': 'name',
                '性别': 'gender',
                '班级': 'class_name',
                '电话': 'phone',
                '联系电话': 'phone',
                '家长信息': 'parent_info',
                '父亲姓名': 'father_name',
                '父亲电话': 'father_phone',
                '母亲姓名': 'mother_name',
                '母亲电话': 'mother_phone',
                '监护人姓名': 'guardian_name',
                '监护人电话': 'guardian_phone',
                '监护关系': 'guardian_relation',
                '卡片ID': 'card_id',
                '饭卡号': 'card_id',
                '学号': 'card_id',
                '初始积分': 'current_score',
                '积分': 'current_score'
            }
            
            for idx, row in enumerate(rows[1:]):
                try:
                    row_dict = {}
                    for i, header in enumerate(headers):
                        if header in mapping and i < len(row):
                            row_dict[mapping[header]] = row[i].strip() if row[i] else ''
                    
                    card_id = row_dict.get('card_id', '').strip()
                    row_number = idx + 2
                    
                    if not card_id:
                        errors.append(f'第{row_number}行：缺少学号')
                        continue
                    
                    existing = User.query.filter_by(card_id=card_id).first()
                    
                    name = row_dict.get('name', '').strip()
                    if not name:
                        errors.append(f'第{row_number}行：缺少姓名')
                        continue
                    
                    gender = row_dict.get('gender', '').strip()
                    class_name = row_dict.get('class_name', '').strip()
                    phone = row_dict.get('phone', '').strip()
                    parent_info = row_dict.get('parent_info', '').strip()
                    father_name = row_dict.get('father_name', '').strip()
                    father_phone = row_dict.get('father_phone', '').strip()
                    mother_name = row_dict.get('mother_name', '').strip()
                    mother_phone = row_dict.get('mother_phone', '').strip()
                    guardian_name = row_dict.get('guardian_name', '').strip()
                    guardian_phone = row_dict.get('guardian_phone', '').strip()
                    guardian_relation = row_dict.get('guardian_relation', '').strip()
                    
                    current_score = row_dict.get('current_score', '0').strip()
                    try:
                        current_score = int(current_score)
                    except ValueError:
                        current_score = 0
                    
                    if existing:
                        existing.name = name if name else existing.name
                        existing.gender = gender if gender else existing.gender
                        existing.class_name = class_name if class_name else existing.class_name
                        existing.phone = phone if phone else existing.phone
                        existing.parent_info = parent_info if parent_info else existing.parent_info
                        existing.father_name = father_name if father_name else existing.father_name
                        existing.father_phone = father_phone if father_phone else existing.father_phone
                        existing.mother_name = mother_name if mother_name else existing.mother_name
                        existing.mother_phone = mother_phone if mother_phone else existing.mother_phone
                        existing.guardian_name = guardian_name if guardian_name else existing.guardian_name
                        existing.guardian_phone = guardian_phone if guardian_phone else existing.guardian_phone
                        existing.guardian_relation = guardian_relation if guardian_relation else existing.guardian_relation
                        existing.current_score = current_score
                        existing.updated_at = datetime.now()
                        updated += 1
                    else:
                        user = User(
                            name=name,
                            gender=gender,
                            class_name=class_name,
                            phone=phone,
                            parent_info=parent_info,
                            father_name=father_name,
                            father_phone=father_phone,
                            mother_name=mother_name,
                            mother_phone=mother_phone,
                            guardian_name=guardian_name,
                            guardian_phone=guardian_phone,
                            guardian_relation=guardian_relation,
                            card_id=card_id,
                            current_score=current_score
                        )
                        db.session.add(user)
                        imported += 1
                except Exception as e:
                    errors.append(f'第{idx+2}行：{str(e)}')
        
        except Exception as e:
            return {'success': False, 'message': f'导入失败: {str(e)}'}, 500
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'导入完成: 新增{imported}条, 更新{updated}条',
            'imported': imported,
            'updated': updated,
            'errors': errors
        }
