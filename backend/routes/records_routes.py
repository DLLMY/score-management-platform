from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, ScoreRecord, User, ScoreRule
from utils.permission import requires_admin
from utils.logger import log_operation
from datetime import datetime, timedelta

ns_records = Namespace('records', description='积分记录相关操作')

record_model = ns_records.model('ScoreRecord', {
    'id': fields.Integer(readOnly=True, description='记录ID'),
    'user_id': fields.Integer(required=True, description='学生ID'),
    'rule_id': fields.Integer(description='规则ID'),
    'score_change': fields.Float(required=True, description='积分变化'),
    'description': fields.String(description='操作说明'),
    'operator': fields.String(description='操作人'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间')
})

@ns_records.route('/')
class RecordList(Resource):
    @ns_records.doc('list_records')
    def get(self):
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        user_id = request.args.get('user_id', type=int)
        rule_id = request.args.get('rule_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = ScoreRecord.query
        if user_id:
            query = query.filter(ScoreRecord.user_id == user_id)
        if rule_id:
            query = query.filter(ScoreRecord.rule_id == rule_id)
        if start_date:
            query = query.filter(ScoreRecord.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(ScoreRecord.created_at <= datetime.fromisoformat(end_date))

        pagination = query.order_by(ScoreRecord.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            'records': [{
                'id': r.id,
                'user_id': r.user_id,
                'user_name': r.user.name if r.user else None,
                'rule_id': r.rule_id,
                'rule_name': r.rule.name if r.rule else None,
                'score_change': r.score_change,
                'description': r.description,
                'operator': r.operator,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }

    @ns_records.doc('create_record')
    @ns_records.expect(record_model)
    @requires_admin
    def post(self):
        data = request.get_json() or ns_records.payload
        record = ScoreRecord(
            user_id=data.get('user_id'),
            rule_id=data.get('rule_id'),
            score_change=data.get('score_change'),
            description=data.get('description'),
            operator=data.get('operator', 'system')
        )

        user = User.query.get(data.get('user_id'))
        if user:
            user.current_score = (user.current_score or 0) + data.get('score_change', 0)
            user_name = user.name
        else:
            user_name = '未知用户'

        db.session.add(record)
        db.session.commit()
        
        log_operation(
            operation_type='score_change',
            target_type='record',
            target_id=record.id,
            description=f'积分变动: {user_name} {"+" if data.get("score_change", 0) > 0 else ""}{data.get("score_change", 0)}分',
            after_data=data
        )
        
        return {'success': True, 'message': '记录创建成功', 'record_id': record.id}, 201

@ns_records.route('/user/<int:user_id>')
@ns_records.param('user_id', '用户ID')
class RecordByUser(Resource):
    @ns_records.doc('get_records_by_user')
    def get(self, user_id):
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        pagination = ScoreRecord.query.filter_by(user_id=user_id).order_by(
            ScoreRecord.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)

        return {
            'records': [{
                'id': r.id,
                'user_id': r.user_id,
                'user_name': r.user.name if r.user else None,
                'rule_id': r.rule_id,
                'rule_name': r.rule.name if r.rule else None,
                'score_change': r.score_change,
                'description': r.description,
                'operator': r.operator,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }

@ns_records.route('/statistics')
class RecordStatistics(Resource):
    @ns_records.doc('get_record_statistics')
    def get(self):
        user_id = request.args.get('user_id', type=int)
        class_name = request.args.get('class_name')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = ScoreRecord.query
        if user_id:
            query = query.filter(ScoreRecord.user_id == user_id)
        elif class_name:
            query = query.join(User).filter(User.class_name == class_name)
        if start_date:
            query = query.filter(ScoreRecord.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(ScoreRecord.created_at <= datetime.fromisoformat(end_date))

        total_records = query.count()
        total_add = sum(r.score_change for r in query.all() if r.score_change > 0)
        total_subtract = sum(r.score_change for r in query.all() if r.score_change < 0)

        today = datetime.now().date()
        today_records = ScoreRecord.query.filter(
            ScoreRecord.created_at >= datetime.combine(today, datetime.min.time())
        )
        if user_id:
            today_records = today_records.filter(ScoreRecord.user_id == user_id)
        today_count = today_records.count()

        return {
            'total_records': total_records,
            'total_add': total_add,
            'total_subtract': abs(total_subtract),
            'net_change': total_add + total_subtract,
            'today_count': today_count
        }

@ns_records.route('/<int:id>')
@ns_records.param('id', '记录ID')
class RecordResource(Resource):
    @ns_records.doc('get_record')
    def get(self, id):
        record = ScoreRecord.query.get_or_404(id)
        return {
            'id': record.id,
            'user_id': record.user_id,
            'user_name': record.user.name if record.user else None,
            'rule_id': record.rule_id,
            'rule_name': record.rule.name if record.rule else None,
            'score_change': record.score_change,
            'description': record.description,
            'operator': record.operator,
            'created_at': record.created_at.isoformat() if record.created_at else None
        }

    @ns_records.doc('delete_record')
    @requires_admin
    def delete(self, id):
        record = ScoreRecord.query.get_or_404(id)
        
        before_data = {
            'id': record.id,
            'user_id': record.user_id,
            'user_name': record.user.name if record.user else None,
            'score_change': record.score_change,
            'description': record.description,
            'operator': record.operator
        }

        user = User.query.get(record.user_id)
        if user:
            user.current_score = (user.current_score or 0) - record.score_change
            user_name = user.name
        else:
            user_name = '未知用户'

        db.session.delete(record)
        db.session.commit()
        
        log_operation(
            operation_type='delete',
            target_type='record',
            target_id=id,
            description=f'删除积分记录: {user_name} {"+" if record.score_change > 0 else ""}{record.score_change}分',
            before_data=before_data
        )
        
        return {'success': True, 'message': '记录删除成功'}
