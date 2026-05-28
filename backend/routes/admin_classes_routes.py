from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Admin, AdminClass, ClassInfo
from utils.permission import requires_admin
from datetime import datetime

ns_admin_classes = Namespace('admin-classes', description='管理员班级关联相关操作')

@ns_admin_classes.route('/<int:admin_id>')
@ns_admin_classes.param('admin_id', '管理员ID')
class AdminClasses(Resource):
    @ns_admin_classes.doc('get_admin_classes')
    @requires_admin
    def get(self, admin_id):
        admin = Admin.query.get_or_404(admin_id)
        class_links = AdminClass.query.filter_by(admin_id=admin_id).all()
        classes = []
        for link in class_links:
            class_info = ClassInfo.query.get(link.class_info_id)
            if class_info:
                classes.append({
                    'class_id': class_info.id,
                    'class_name': class_info.name,
                    'grade': class_info.grade,
                    'is_primary': link.is_primary,
                    'assigned_at': link.assigned_at.isoformat() if link.assigned_at else None
                })
        return classes

@ns_admin_classes.route('/<int:admin_id>/assign-class')
@ns_admin_classes.param('admin_id', '管理员ID')
class AdminAssignClass(Resource):
    @ns_admin_classes.doc('assign_class_to_admin')
    @requires_admin
    def post(self, admin_id):
        data = request.get_json()
        class_id = data.get('class_id')
        is_primary = data.get('is_primary', False)
        
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

@ns_admin_classes.route('/<int:admin_id>/remove-class/<int:class_id>')
@ns_admin_classes.param('admin_id', '管理员ID')
@ns_admin_classes.param('class_id', '班级ID')
class AdminRemoveClass(Resource):
    @ns_admin_classes.doc('remove_class_from_admin')
    @requires_admin
    def post(self, admin_id, class_id):
        link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
        if not link:
            return {'success': False, 'message': '未找到关联记录'}, 404
        
        db.session.delete(link)
        db.session.commit()
        return {'success': True, 'message': '班级移除成功'}
