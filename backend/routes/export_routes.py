from flask_restx import Namespace, Resource, fields
from models import db, User, ScoreRecord, ScoreRule
from utils.permission import requires_admin
from datetime import datetime
import csv
import io

ns_export = Namespace('export', description='数据导出相关操作')

@ns_export.route('/users')
class ExportUsers(Resource):
    @ns_export.doc('export_users')
    @requires_admin
    def get(self):
        users = User.query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '姓名', '性别', '班级', '联系电话', '饭卡号', '当前积分', '创建时间'])

        for user in users:
            writer.writerow([
                user.id,
                user.name,
                user.gender,
                user.class_name,
                user.phone,
                user.card_id,
                user.current_score,
                user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else ''
            ])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename=f'users_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

@ns_export.route('/users/excel')
class ExportUsersExcel(Resource):
    @ns_export.doc('export_users_excel')
    def get(self):
        users = User.query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '姓名', '性别', '班级', '联系电话', '饭卡号', '当前积分', '创建时间'])

        for user in users:
            writer.writerow([
                user.id,
                user.name,
                user.gender,
                user.class_name,
                user.phone,
                user.card_id,
                user.current_score,
                user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else ''
            ])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename=f'users_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

@ns_export.route('/records')
class ExportRecords(Resource):
    @ns_export.doc('export_records')
    @requires_admin
    def get(self):
        records = ScoreRecord.query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '学生ID', '学生姓名', '规则ID', '规则名称', '积分变化', '描述', '操作人', '创建时间'])

        for record in records:
            writer.writerow([
                record.id,
                record.user_id,
                record.user.name if record.user else '',
                record.rule_id,
                record.rule.name if record.rule else '',
                record.score_change,
                record.description,
                record.operator,
                record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else ''
            ])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename=f'records_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

@ns_export.route('/records/excel')
class ExportRecordsExcel(Resource):
    @ns_export.doc('export_records_excel')
    def get(self):
        from flask import request
        user_id = request.args.get('user_id')

        query = ScoreRecord.query
        if user_id:
            query = query.filter_by(user_id=int(user_id))

        records = query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '学生ID', '学生姓名', '规则ID', '规则名称', '积分变化', '描述', '操作人', '创建时间'])

        for record in records:
            writer.writerow([
                record.id,
                record.user_id,
                record.user.name if record.user else '',
                record.rule_id,
                record.rule.name if record.rule else '',
                record.score_change,
                record.description,
                record.operator,
                record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else ''
            ])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename=f'records_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

@ns_export.route('/rules')
class ExportRules(Resource):
    @ns_export.doc('export_rules')
    @requires_admin
    def get(self):
        rules = ScoreRule.query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '规则名称', '描述', '分类ID', '分类名称', '分数', '是否启用', '每日上限', '最小间隔', '创建时间'])

        for rule in rules:
            writer.writerow([
                rule.id,
                rule.name,
                rule.description,
                rule.category_id,
                rule.category.name if rule.category else '',
                rule.score,
                '是' if rule.is_active else '否',
                rule.daily_limit,
                rule.min_interval,
                rule.created_at.strftime('%Y-%m-%d %H:%M:%S') if rule.created_at else ''
            ])

        output.seek(0)
        from flask import send_file
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            mimetype='text/csv',
            as_attachment=True,
            attachment_filename=f'rules_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )