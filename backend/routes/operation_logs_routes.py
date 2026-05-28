from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, OperationLog
from utils.permission import requires_admin
from datetime import datetime

ns_operation_logs = Namespace('operation-logs', description='操作日志相关操作')

@ns_operation_logs.route('/')
class OperationLogList(Resource):
    @ns_operation_logs.doc('list_operation_logs')
    @requires_admin
    def get(self):
        operation_type = request.args.get('operation_type')
        target_type = request.args.get('target_type')
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        operator = request.args.get('operator')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = OperationLog.query.order_by(OperationLog.created_at.desc())
        
        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if target_type:
            query = query.filter(OperationLog.target_type == target_type)
        if start_time:
            query = query.filter(OperationLog.created_at >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(OperationLog.created_at <= datetime.fromisoformat(end_time))
        if operator:
            query = query.filter(OperationLog.operator.ilike(f'%{operator}%'))
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'data': [{
                'id': log.id,
                'operation_type': log.operation_type,
                'target_type': log.target_type,
                'target_id': log.target_id,
                'operator': log.operator,
                'description': log.description,
                'before_data': log.before_data,
                'after_data': log.after_data,
                'ip_address': log.ip_address,
                'created_at': log.created_at.isoformat() if log.created_at else None
            } for log in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }
