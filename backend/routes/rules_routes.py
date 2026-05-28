from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, ScoreRule, ScoreCategory
from utils.permission import requires_admin
from services.cache_service import cache_service
from datetime import datetime
import io
import csv

ns_rules = Namespace('rules', description='积分规则相关操作')

rule_model = ns_rules.model('ScoreRule', {
    'id': fields.Integer(readOnly=True, description='规则ID'),
    'name': fields.String(required=True, description='规则名称'),
    'description': fields.String(description='规则描述'),
    'category_id': fields.Integer(description='分类ID'),
    'score': fields.Float(required=True, description='分数'),
    'is_active': fields.Boolean(description='是否启用'),
    'daily_limit': fields.Integer(description='每日上限'),
    'min_interval': fields.Integer(description='最小间隔')
})

@ns_rules.route('/')
class RuleList(Resource):
    @ns_rules.doc('list_rules')
    def get(self):
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 100, type=int)
        category_id = request.args.get('category_id', type=int)
        is_active = request.args.get('is_active')

        cache_key = f"rules_list:{page}:{per_page}:{category_id}:{is_active}"
        cached_result = cache_service.get(cache_key)
        if cached_result is not None:
            return cached_result

        query = ScoreRule.query
        if category_id:
            query = query.filter(ScoreRule.category_id == category_id)
        if is_active is not None:
            query = query.filter(ScoreRule.is_active == (is_active.lower() == 'true'))

        pagination = query.order_by(ScoreRule.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        result = {
            'rules': [{
                'id': r.id,
                'name': r.name,
                'description': r.description,
                'category_id': r.category_id,
                'category_name': r.category.name if r.category else None,
                'score': r.score,
                'is_active': r.is_active,
                'daily_limit': r.daily_limit,
                'min_interval': r.min_interval,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }

        cache_service.set(cache_key, result, ttl=300)
        return result

    @ns_rules.doc('create_rule')
    @ns_rules.expect(rule_model)
    @requires_admin
    def post(self):
        data = ns_rules.payload
        rule = ScoreRule(
            name=data.get('name'),
            description=data.get('description'),
            category_id=data.get('category_id'),
            score=data.get('score'),
            is_active=data.get('is_active', True),
            daily_limit=data.get('daily_limit', 0),
            min_interval=data.get('min_interval', 0)
        )
        db.session.add(rule)
        db.session.commit()
        
        cache_service.flush_all()
        
        return {'success': True, 'message': '规则创建成功', 'rule_id': rule.id}, 201

@ns_rules.route('/<int:id>')
@ns_rules.param('id', '规则ID')
class RuleResource(Resource):
    @ns_rules.doc('get_rule')
    def get(self, id):
        rule = ScoreRule.query.get_or_404(id)
        return {
            'id': rule.id,
            'name': rule.name,
            'description': rule.description,
            'category_id': rule.category_id,
            'category_name': rule.category.name if rule.category else None,
            'score': rule.score,
            'is_active': rule.is_active,
            'daily_limit': rule.daily_limit,
            'min_interval': rule.min_interval,
            'created_at': rule.created_at.isoformat() if rule.created_at else None,
            'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
        }

    @ns_rules.doc('update_rule')
    @ns_rules.expect(rule_model)
    @requires_admin
    def put(self, id):
        rule = ScoreRule.query.get_or_404(id)
        data = ns_rules.payload
        rule.name = data.get('name', rule.name)
        rule.description = data.get('description', rule.description)
        rule.category_id = data.get('category_id', rule.category_id)
        rule.score = data.get('score', rule.score)
        rule.is_active = data.get('is_active', rule.is_active)
        rule.daily_limit = data.get('daily_limit', rule.daily_limit)
        rule.min_interval = data.get('min_interval', rule.min_interval)
        rule.updated_at = datetime.now()
        db.session.commit()
        
        cache_service.flush_all()
        
        return {'success': True, 'message': '规则更新成功'}

    @ns_rules.doc('delete_rule')
    @requires_admin
    def delete(self, id):
        rule = ScoreRule.query.get_or_404(id)
        db.session.delete(rule)
        db.session.commit()
        
        cache_service.flush_all()
        
        return {'success': True, 'message': '规则删除成功'}

@ns_rules.route('/export')
class RuleExport(Resource):
    @ns_rules.doc('export_rules')
    @requires_admin
    def get(self):
        rules = ScoreRule.query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['规则名称', '描述', '分类', '分数', '是否启用', '每日上限', '最小间隔'])

        for rule in rules:
            writer.writerow([
                rule.name,
                rule.description,
                rule.category.name if rule.category else '',
                rule.score,
                '是' if rule.is_active else '否',
                rule.daily_limit,
                rule.min_interval
            ])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename=f'rules_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

@ns_rules.route('/import')
class RuleImport(Resource):
    @ns_rules.doc('import_rules')
    @requires_admin
    def post(self):
        data = request.get_json()
        rules_data = data.get('rules', [])

        if not rules_data:
            return {'success': False, 'message': '没有导入数据'}, 400

        imported_count = 0
        error_count = 0
        errors = []

        for idx, rule_data in enumerate(rules_data):
            try:
                rule = ScoreRule(
                    name=rule_data.get('name'),
                    description=rule_data.get('description', ''),
                    category_id=rule_data.get('category_id'),
                    score=rule_data.get('score', 0),
                    is_active=rule_data.get('is_active', True),
                    daily_limit=rule_data.get('daily_limit', 0),
                    min_interval=rule_data.get('min_interval', 0)
                )
                db.session.add(rule)
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

@ns_rules.route('/template/download')
class RuleTemplate(Resource):
    @ns_rules.doc('download_rule_template')
    def get(self):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['规则名称', '描述', '分类ID', '分数', '是否启用', '每日上限', '最小间隔'])
        writer.writerow(['作业完成', '完成家庭作业', '1', '5', '是', '3', '60'])
        writer.writerow(['迟到', '上学迟到', '2', '-2', '是', '0', '0'])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename='rule_import_template.csv'
        )
