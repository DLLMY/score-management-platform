from flask_restx import Namespace, Resource, fields
from models import db, ScoreCategory, ScoreRule
from utils.permission import requires_admin
from datetime import datetime

ns_categories = Namespace('categories', description='分类管理相关操作')

category_model = ns_categories.model('ScoreCategory', {
    'id': fields.Integer(readOnly=True, description='分类ID'),
    'name': fields.String(required=True, description='分类名称'),
    'description': fields.String(description='分类描述'),
    'is_active': fields.Boolean(description='是否启用'),
    'color': fields.String(description='颜色')
})

@ns_categories.route('/')
class CategoryList(Resource):
    @ns_categories.doc('list_categories')
    def get(self):
        categories = ScoreCategory.query.all()
        return {
            'categories': [{
                'id': c.id,
                'name': c.name,
                'description': c.description,
                'color': c.color,
                'is_active': c.is_active,
                'created_at': c.created_at.isoformat() if c.created_at else None
            } for c in categories]
        }

    @ns_categories.doc('create_category')
    @ns_categories.expect(category_model)
    @requires_admin
    def post(self):
        data = ns_categories.payload
        category = ScoreCategory(
            name=data.get('name'),
            description=data.get('description'),
            color=data.get('color', '#3B82F6'),
            is_active=data.get('is_active', True)
        )
        db.session.add(category)
        db.session.commit()
        return {'success': True, 'message': '分类创建成功', 'category_id': category.id}, 201

@ns_categories.route('/<int:id>')
@ns_categories.param('id', '分类ID')
class CategoryResource(Resource):
    @ns_categories.doc('get_category')
    def get(self, id):
        category = ScoreCategory.query.get_or_404(id)
        return {
            'id': category.id,
            'name': category.name,
            'description': category.description,
            'color': category.color,
            'is_active': category.is_active,
            'created_at': category.created_at.isoformat() if category.created_at else None
        }

    @ns_categories.doc('update_category')
    @ns_categories.expect(category_model)
    @requires_admin
    def put(self, id):
        category = ScoreCategory.query.get_or_404(id)
        data = ns_categories.payload
        category.name = data.get('name', category.name)
        category.description = data.get('description', category.description)
        category.color = data.get('color', category.color)
        category.is_active = data.get('is_active', category.is_active)
        db.session.commit()
        return {'success': True, 'message': '分类更新成功'}

    @ns_categories.doc('delete_category')
    @requires_admin
    def delete(self, id):
        category = ScoreCategory.query.get_or_404(id)
        rules = ScoreRule.query.filter_by(category_id=id).all()
        for rule in rules:
            rule.category_id = None
        db.session.delete(category)
        db.session.commit()
        return {'success': True, 'message': '分类删除成功'}