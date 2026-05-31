from flask_restx import Namespace, Resource, fields
from models import db, ScoreRankRule
from utils.permission import requires_admin
from datetime import datetime

ns_rank = Namespace('rank-rules', description='排名规则相关操作')

rank_rule_model = ns_rank.model('ScoreRankRule', {
    'id': fields.Integer(readOnly=True, description='规则ID'),
    'name': fields.String(required=True, description='规则名称'),
    'min_score': fields.Integer(required=True, description='最低分数'),
    'max_score': fields.Integer(description='最高分数'),
    'color': fields.String(description='颜色'),
    'icon': fields.String(description='图标'),
    'description': fields.String(description='描述'),
    'is_active': fields.Boolean(description='是否启用'),
    'unlock_min_score': fields.Integer(description='开门最低分数要求（NULL使用全局默认值）'),
    'weekly_unlock_limit': fields.Integer(description='每周开门次数限制（NULL使用全局默认值）')
})

@ns_rank.route('/')
class RankRuleList(Resource):
    @ns_rank.doc('list_rank_rules')
    def get(self):
        rules = ScoreRankRule.query.all()
        return {
            'rules': [{
                'id': r.id,
                'name': r.name,
                'min_score': r.min_score,
                'max_score': r.max_score,
                'color': r.color,
                'icon': r.icon,
                'description': r.description,
                'is_active': r.is_active,
                'unlock_min_score': r.unlock_min_score,
                'weekly_unlock_limit': r.weekly_unlock_limit,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in rules]
        }

    @ns_rank.doc('create_rank_rule')
    @ns_rank.expect(rank_rule_model)
    @requires_admin
    def post(self):
        data = ns_rank.payload
        rule = ScoreRankRule(
            name=data.get('name'),
            min_score=data.get('min_score'),
            max_score=data.get('max_score'),
            color=data.get('color', '#0ea5e9'),
            icon=data.get('icon', 'Award'),
            description=data.get('description'),
            is_active=data.get('is_active', True),
            unlock_min_score=data.get('unlock_min_score'),
            weekly_unlock_limit=data.get('weekly_unlock_limit')
        )
        db.session.add(rule)
        db.session.commit()
        return {'success': True, 'message': '排名规则创建成功', 'rule_id': rule.id}, 201

@ns_rank.route('/<int:id>')
@ns_rank.param('id', '规则ID')
class RankRuleResource(Resource):
    @ns_rank.doc('get_rank_rule')
    def get(self, id):
        rule = ScoreRankRule.query.get_or_404(id)
        return {
            'id': rule.id,
            'name': rule.name,
            'min_score': rule.min_score,
            'max_score': rule.max_score,
            'color': rule.color,
            'icon': rule.icon,
            'description': rule.description,
            'is_active': rule.is_active,
            'unlock_min_score': rule.unlock_min_score,
            'weekly_unlock_limit': rule.weekly_unlock_limit,
            'created_at': rule.created_at.isoformat() if rule.created_at else None,
            'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
        }

    @ns_rank.doc('update_rank_rule')
    @ns_rank.expect(rank_rule_model)
    @requires_admin
    def put(self, id):
        rule = ScoreRankRule.query.get_or_404(id)
        data = ns_rank.payload
        rule.name = data.get('name', rule.name)
        rule.min_score = data.get('min_score', rule.min_score)
        rule.max_score = data.get('max_score', rule.max_score)
        rule.color = data.get('color', rule.color)
        rule.icon = data.get('icon', rule.icon)
        rule.description = data.get('description', rule.description)
        rule.is_active = data.get('is_active', rule.is_active)
        if 'unlock_min_score' in data:
            rule.unlock_min_score = data['unlock_min_score']
        if 'weekly_unlock_limit' in data:
            rule.weekly_unlock_limit = data['weekly_unlock_limit']
        rule.updated_at = datetime.now()
        db.session.commit()
        return {'success': True, 'message': '排名规则更新成功'}

    @ns_rank.doc('delete_rank_rule')
    @requires_admin
    def delete(self, id):
        rule = ScoreRankRule.query.get_or_404(id)
        db.session.delete(rule)
        db.session.commit()
        return {'success': True, 'message': '排名规则删除成功'}

@ns_rank.route('/get-rank/<int:score>')
@ns_rank.param('score', '分数')
class RankByScore(Resource):
    @ns_rank.doc('get_rank_by_score')
    def get(self, score):
        rules = ScoreRankRule.query.filter_by(is_active=True).order_by(ScoreRankRule.min_score.desc()).all()

        for rule in rules:
            if score >= rule.min_score:
                if rule.max_score is None or score <= rule.max_score:
                    return {
                        'rank': {
                            'id': rule.id,
                            'name': rule.name,
                            'min_score': rule.min_score,
                            'max_score': rule.max_score,
                            'color': rule.color,
                            'icon': rule.icon,
                            'description': rule.description,
                            'unlock_min_score': rule.unlock_min_score,
                            'weekly_unlock_limit': rule.weekly_unlock_limit
                        }
                    }

        return {
            'rank': {
                'name': '无等级',
                'min_score': 0,
                'max_score': 0,
                'color': '#9CA3AF',
                'icon': 'Minus',
                'description': '暂无等级'
            }
        }