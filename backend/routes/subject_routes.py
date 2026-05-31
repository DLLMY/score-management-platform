from flask_restx import Namespace, Resource, fields
from flask import request
from models import db, Subject
from utils.permission import requires_admin
from datetime import datetime

ns_subjects = Namespace('subjects', description='科目管理')

subject_model = ns_subjects.model('Subject', {
    'id': fields.Integer(readOnly=True, description='科目ID'),
    'name': fields.String(required=True, description='科目名称'),
    'description': fields.String(description='科目描述'),
    'color': fields.String(description='科目颜色'),
    'is_active': fields.Boolean(description='是否启用'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间'),
    'updated_at': fields.DateTime(readOnly=True, description='更新时间')
})

@ns_subjects.route('/')
class SubjectList(Resource):
    @ns_subjects.doc('list_subjects', description='获取所有科目列表')
    @ns_subjects.marshal_list_with(subject_model)
    @requires_admin
    def get(self):
        """获取所有科目"""
        subjects = Subject.query.filter_by(is_active=True).order_by(Subject.name).all()
        return subjects

    @ns_subjects.doc('create_subject', description='创建新科目')
    @ns_subjects.expect(subject_model)
    @ns_subjects.marshal_with(subject_model, code=201)
    @requires_admin
    def post(self):
        """创建新科目"""
        data = request.json
        if Subject.query.filter_by(name=data['name']).first():
            return {'success': False, 'message': '科目已存在'}, 400
        
        subject = Subject(
            name=data['name'],
            description=data.get('description'),
            color=data.get('color', '#10B981'),
            is_active=data.get('is_active', True)
        )
        db.session.add(subject)
        db.session.commit()
        return subject, 201

@ns_subjects.route('/<int:id>')
@ns_subjects.param('id', '科目ID')
class SubjectResource(Resource):
    @ns_subjects.doc('get_subject', description='获取科目详情')
    @ns_subjects.marshal_with(subject_model)
    @requires_admin
    def get(self, id):
        """获取科目详情"""
        subject = Subject.query.get_or_404(id)
        return subject

    @ns_subjects.doc('update_subject', description='更新科目信息')
    @ns_subjects.expect(subject_model)
    @ns_subjects.marshal_with(subject_model)
    @requires_admin
    def put(self, id):
        """更新科目信息"""
        subject = Subject.query.get_or_404(id)
        data = request.json
        
        # 检查名称是否重复
        if data.get('name') and data['name'] != subject.name:
            if Subject.query.filter_by(name=data['name']).first():
                return {'success': False, 'message': '科目名称已存在'}, 400
        
        subject.name = data.get('name', subject.name)
        subject.description = data.get('description', subject.description)
        subject.color = data.get('color', subject.color)
        subject.is_active = data.get('is_active', subject.is_active)
        subject.updated_at = datetime.now()
        
        db.session.commit()
        return subject

    @ns_subjects.doc('delete_subject', description='删除科目')
    @requires_admin
    def delete(self, id):
        """删除科目"""
        subject = Subject.query.get_or_404(id)
        subject.is_active = False
        subject.updated_at = datetime.now()
        db.session.commit()
        return {'success': True, 'message': '科目已删除'}
