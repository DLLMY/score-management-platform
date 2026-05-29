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
    'score_change': fields.Float(required=True, description='积分变化（正数加分，负数扣分）'),
    'description': fields.String(description='操作说明'),
    'operator': fields.String(description='操作人'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间')
})

record_list_response = ns_records.model('RecordListResponse', {
    'records': fields.List(fields.Nested(record_model), description='记录列表'),
    'total': fields.Integer(description='总记录数'),
    'page': fields.Integer(description='当前页码'),
    'per_page': fields.Integer(description='每页数量'),
    'pages': fields.Integer(description='总页数')
})

record_statistics_response = ns_records.model('RecordStatistics', {
    'total_records': fields.Integer(description='总记录数'),
    'total_add': fields.Float(description='累计加分'),
    'total_subtract': fields.Float(description='累计扣分'),
    'net_change': fields.Float(description='净变化'),
    'today_count': fields.Integer(description='今日记录数')
})

@ns_records.route('/')
class RecordList(Resource):
    @ns_records.doc('list_records', description='获取积分记录列表', params={
        'page': '页码（默认1）',
        'per_page': '每页数量（默认50）',
        'user_id': '学生ID筛选',
        'rule_id': '规则ID筛选',
        'start_date': '开始日期（ISO格式）',
        'end_date': '结束日期（ISO格式）'
    })
    @ns_records.response(200, '成功', record_list_response)
    def get(self):
        """
        获取积分记录列表
        
        支持分页、学生筛选、规则筛选和日期范围筛选。
        """
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

    @ns_records.doc('create_record', description='创建积分记录', security='Bearer')
    @ns_records.expect(record_model)
    @ns_records.response(201, '创建成功')
    @ns_records.response(400, '请求参数错误')
    @requires_admin
    def post(self):
        """
        创建积分记录
        
        创建新的积分变动记录，需要管理员权限。同时会更新学生的当前积分。
        
        请求体：
        - user_id: 学生ID（必填）
        - rule_id: 规则ID
        - score_change: 积分变化（必填，正数加分，负数扣分）
        - description: 操作说明
        - operator: 操作人（默认system）
        """
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
    @ns_records.doc('get_records_by_user', description='获取指定学生的积分记录', params={
        'page': '页码（默认1）',
        'per_page': '每页数量（默认50）'
    })
    @ns_records.response(200, '成功', record_list_response)
    def get(self, user_id):
        """
        获取指定学生的积分记录
        
        根据学生ID获取该学生的所有积分变动记录。
        """
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
    @ns_records.doc('get_record_statistics', description='获取积分统计信息', params={
        'user_id': '学生ID筛选',
        'class_name': '班级名称筛选',
        'start_date': '开始日期（ISO格式）',
        'end_date': '结束日期（ISO格式）'
    })
    @ns_records.response(200, '成功', record_statistics_response)
    def get(self):
        """
        获取积分统计信息
        
        获取积分记录的统计数据，包括总记录数、累计加分、累计扣分等。
        """
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
    @ns_records.doc('get_record', description='获取单个记录详情')
    @ns_records.response(200, '成功', record_model)
    @ns_records.response(404, '记录不存在')
    def get(self, id):
        """
        获取单个记录详情
        
        根据记录ID获取积分记录的详细信息。
        """
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

    @ns_records.doc('delete_record', description='删除积分记录', security='Bearer')
    @ns_records.response(200, '删除成功')
    @ns_records.response(404, '记录不存在')
    @requires_admin
    def delete(self, id):
        """
        删除积分记录
        
        删除指定的积分记录，需要管理员权限。删除时会回滚学生的积分。
        """
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
