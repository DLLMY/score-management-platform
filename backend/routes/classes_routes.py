from flask_restx import Namespace, Resource, fields
from models import db, ClassInfo, User
from utils.permission import requires_admin
from datetime import datetime

ns_classes = Namespace('classes', description='班级管理相关操作')

class_model = ns_classes.model('ClassInfo', {
    'id': fields.Integer(readOnly=True, description='班级ID'),
    'name': fields.String(required=True, description='班级名称'),
    'grade': fields.String(description='年级'),
    'description': fields.String(description='描述'),
    'is_active': fields.Boolean(description='是否启用')
})

@ns_classes.route('/')
class ClassList(Resource):
    @ns_classes.doc('list_classes')
    def get(self):
        classes = ClassInfo.query.all()
        return {
            'classes': [{
                'id': c.id,
                'name': c.name,
                'grade': c.grade,
                'description': c.description,
                'is_active': c.is_active,
                'created_at': c.created_at.isoformat() if c.created_at else None
            } for c in classes]
        }

    @ns_classes.doc('create_class')
    @ns_classes.expect(class_model)
    @requires_admin
    def post(self):
        data = ns_classes.payload
        class_info = ClassInfo(
            name=data.get('name'),
            grade=data.get('grade'),
            description=data.get('description'),
            is_active=data.get('is_active', True)
        )
        db.session.add(class_info)
        db.session.commit()
        return {'success': True, 'message': '班级创建成功', 'class_id': class_info.id}, 201

@ns_classes.route('/<int:id>')
@ns_classes.param('id', '班级ID')
class ClassResource(Resource):
    @ns_classes.doc('get_class')
    def get(self, id):
        class_info = ClassInfo.query.get_or_404(id)
        student_count = User.query.filter_by(class_name=class_info.name).count()
        return {
            'id': class_info.id,
            'name': class_info.name,
            'grade': class_info.grade,
            'description': class_info.description,
            'is_active': class_info.is_active,
            'student_count': student_count,
            'created_at': class_info.created_at.isoformat() if class_info.created_at else None,
            'updated_at': class_info.updated_at.isoformat() if class_info.updated_at else None
        }

    @ns_classes.doc('update_class')
    @ns_classes.expect(class_model)
    @requires_admin
    def put(self, id):
        class_info = ClassInfo.query.get_or_404(id)
        data = ns_classes.payload
        old_name = class_info.name
        class_info.name = data.get('name', class_info.name)
        class_info.grade = data.get('grade', class_info.grade)
        class_info.description = data.get('description', class_info.description)
        class_info.is_active = data.get('is_active', class_info.is_active)
        class_info.updated_at = datetime.now()
        
        if old_name != class_info.name:
            User.query.filter_by(class_name=old_name).update({'class_name': class_info.name})
        
        db.session.commit()
        return {'success': True, 'message': '班级更新成功'}

    @ns_classes.doc('delete_class')
    @requires_admin
    def delete(self, id):
        class_info = ClassInfo.query.get_or_404(id)
        db.session.delete(class_info)
        db.session.commit()
        return {'success': True, 'message': '班级删除成功'}