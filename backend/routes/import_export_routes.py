from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import db, User, ScoreRule, ScoreCategory, ScoreRecord, AdminClass
from utils.permission import requires_admin
from utils.excel_utils import ExcelUtils, ExcelTemplateGenerator
from utils.backup_utils import BackupManager, BackupScheduler
from datetime import datetime
import io

ns_import_export = Namespace('import_export', description='数据导入导出相关操作')

# 响应模型
export_response = ns_import_export.model('ExportResponse', {
    'success': fields.Boolean(required=True),
    'message': fields.String(required=True),
    'filename': fields.String(),
    'record_count': fields.Integer()
})

import_response = ns_import_export.model('ImportResponse', {
    'success': fields.Boolean(required=True),
    'message': fields.String(required=True),
    'imported_count': fields.Integer(),
    'failed_count': fields.Integer(),
    'errors': fields.List(fields.String)
})

backup_response = ns_import_export.model('BackupResponse', {
    'success': fields.Boolean(required=True),
    'message': fields.String(required=True),
    'filename': fields.String(),
    'path': fields.String(),
    'size': fields.Integer(),
    'type': fields.String(),
    'timestamp': fields.String()
})

backup_list_response = ns_import_export.model('BackupListResponse', {
    'filename': fields.String(),
    'path': fields.String(),
    'size': fields.Integer(),
    'created_at': fields.String(),
    'type': fields.String()
})

# 初始化备份管理器和调度器
backup_manager = BackupManager()
backup_scheduler = BackupScheduler(backup_manager)

# ==================== 导出API ====================

@ns_import_export.route('/export/users')
class ExportUsers(Resource):
    @ns_import_export.doc('export_users', params={'format': '导出格式: excel 或 csv，默认excel'})
    @requires_admin
    def get(self):
        """导出用户数据"""
        export_format = request.args.get('format', 'excel').lower()
        
        users = User.query.all()
        headers = ['ID', '姓名', '性别', '班级', '联系电话', '饭卡号', '当前积分', '创建时间']
        
        data = []
        for user in users:
            data.append([
                user.id,
                user.name,
                user.gender,
                user.class_name,
                user.phone,
                user.card_id,
                user.current_score,
                user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else ''
            ])
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if export_format == 'csv':
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype='text/csv',
                as_attachment=True,
                attachment_filename=f'users_{timestamp}.csv'
            )
        else:
            sheets = [{
                'name': '用户数据',
                'headers': headers,
                'data': data
            }]
            content = ExcelUtils.export_to_excel(sheets)
            return send_file(
                io.BytesIO(content),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                attachment_filename=f'users_{timestamp}.xlsx'
            )

@ns_import_export.route('/export/records')
class ExportRecords(Resource):
    @ns_import_export.doc('export_records', params={'format': '导出格式', 'user_id': '按用户ID筛选'})
    @requires_admin
    def get(self):
        """导出积分记录"""
        export_format = request.args.get('format', 'excel').lower()
        user_id = request.args.get('user_id')
        
        query = ScoreRecord.query
        if user_id:
            query = query.filter_by(user_id=int(user_id))
        
        records = query.all()
        headers = ['ID', '学生ID', '学生姓名', '规则ID', '规则名称', '积分变化', '描述', '操作人', '创建时间']
        
        data = []
        for record in records:
            data.append([
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
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if export_format == 'csv':
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype='text/csv',
                as_attachment=True,
                attachment_filename=f'records_{timestamp}.csv'
            )
        else:
            sheets = [{
                'name': '积分记录',
                'headers': headers,
                'data': data
            }]
            content = ExcelUtils.export_to_excel(sheets)
            return send_file(
                io.BytesIO(content),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                attachment_filename=f'records_{timestamp}.xlsx'
            )

@ns_import_export.route('/export/rules')
class ExportRules(Resource):
    @ns_import_export.doc('export_rules', params={'format': '导出格式'})
    @requires_admin
    def get(self):
        """导出规则数据"""
        export_format = request.args.get('format', 'excel').lower()
        
        rules = ScoreRule.query.all()
        headers = ['ID', '规则名称', '描述', '分类ID', '分类名称', '分数', '是否启用', '每日上限', '最小间隔', '创建时间']
        
        data = []
        for rule in rules:
            data.append([
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
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if export_format == 'csv':
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype='text/csv',
                as_attachment=True,
                attachment_filename=f'rules_{timestamp}.csv'
            )
        else:
            sheets = [{
                'name': '积分规则',
                'headers': headers,
                'data': data
            }]
            content = ExcelUtils.export_to_excel(sheets)
            return send_file(
                io.BytesIO(content),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                attachment_filename=f'rules_{timestamp}.xlsx'
            )

@ns_import_export.route('/export/categories')
class ExportCategories(Resource):
    @ns_import_export.doc('export_categories', params={'format': '导出格式'})
    @requires_admin
    def get(self):
        """导出分类数据"""
        export_format = request.args.get('format', 'excel').lower()
        
        categories = ScoreCategory.query.all()
        headers = ['ID', '分类名称', '描述', '颜色', '创建时间']
        
        data = []
        for category in categories:
            data.append([
                category.id,
                category.name,
                category.description,
                category.color,
                category.created_at.strftime('%Y-%m-%d %H:%M:%S') if category.created_at else ''
            ])
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if export_format == 'csv':
            content = ExcelUtils.export_to_csv(data, headers)
            return send_file(
                io.BytesIO(content),
                mimetype='text/csv',
                as_attachment=True,
                attachment_filename=f'categories_{timestamp}.csv'
            )
        else:
            sheets = [{
                'name': '积分分类',
                'headers': headers,
                'data': data
            }]
            content = ExcelUtils.export_to_excel(sheets)
            return send_file(
                io.BytesIO(content),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                attachment_filename=f'categories_{timestamp}.xlsx'
            )

# ==================== 模板下载API ====================

@ns_import_export.route('/template/user')
class DownloadUserTemplate(Resource):
    @ns_import_export.doc('download_user_template')
    @requires_admin
    def get(self):
        """下载用户导入模板"""
        content = ExcelTemplateGenerator.generate_template('user')
        return send_file(
            io.BytesIO(content),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            attachment_filename='user_import_template.xlsx'
        )

@ns_import_export.route('/template/rule')
class DownloadRuleTemplate(Resource):
    @ns_import_export.doc('download_rule_template')
    @requires_admin
    def get(self):
        """下载规则导入模板"""
        content = ExcelTemplateGenerator.generate_template('rule')
        return send_file(
            io.BytesIO(content),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            attachment_filename='rule_import_template.xlsx'
        )

@ns_import_export.route('/template/category')
class DownloadCategoryTemplate(Resource):
    @ns_import_export.doc('download_category_template')
    @requires_admin
    def get(self):
        """下载分类导入模板"""
        content = ExcelTemplateGenerator.generate_template('category')
        return send_file(
            io.BytesIO(content),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            attachment_filename='category_import_template.xlsx'
        )

# ==================== 导入API ====================

@ns_import_export.route('/import/users')
class ImportUsers(Resource):
    @ns_import_export.doc('import_users', params={'file': 'Excel或CSV文件'})
    @requires_admin
    def post(self):
        """导入用户数据"""
        if 'file' not in request.files:
            return {'success': False, 'message': '请选择要导入的文件', 'imported_count': 0, 'failed_count': 0, 'errors': ['未上传文件']}
        
        file = request.files['file']
        if file.filename == '':
            return {'success': False, 'message': '请选择要导入的文件', 'imported_count': 0, 'failed_count': 0, 'errors': ['文件名为空']}
        
        try:
            file_bytes = file.read()
            file_type = ExcelUtils.detect_file_type(file_bytes, file.filename)
            
            if file_type == 'csv':
                result = ExcelUtils.read_csv(file_bytes)
            elif file_type in ['xlsx', 'xls']:
                result = ExcelUtils.read_excel(file_bytes)
            else:
                return {'success': False, 'message': '不支持的文件格式', 'imported_count': 0, 'failed_count': 0, 'errors': ['仅支持.xlsx、.xls和.csv格式']}
            
            # 验证数据
            validation = ExcelTemplateGenerator.validate_import_data('user', result['headers'], result['data'])
            if not validation['valid']:
                return {'success': False, 'message': '数据格式验证失败', 'imported_count': 0, 'failed_count': 0, 'errors': validation['errors']}
            
            # 执行导入
            imported_count = 0
            failed_count = 0
            errors = []
            
            for row_idx, row in enumerate(result['data'], start=2):
                try:
                    name = str(row[0]).strip() if row[0] else ''
                    gender = str(row[1]).strip() if row[1] else ''
                    class_name = str(row[2]).strip() if row[2] else ''
                    phone = str(row[3]).strip() if row[3] else ''
                    card_id = str(row[4]).strip() if row[4] else ''
                    remark = str(row[5]).strip() if row[5] else ''
                    
                    if not name:
                        errors.append(f'第{row_idx}行：姓名不能为空')
                        failed_count += 1
                        continue
                    
                    # 检查饭卡号是否已存在
                    if User.query.filter_by(card_id=card_id).first():
                        errors.append(f'第{row_idx}行：饭卡号 {card_id} 已存在')
                        failed_count += 1
                        continue
                    
                    new_user = User(
                        name=name,
                        gender=gender,
                        class_name=class_name,
                        phone=phone,
                        card_id=card_id,
                        current_score=0
                    )
                    db.session.add(new_user)
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f'第{row_idx}行导入失败: {str(e)}')
                    failed_count += 1
            
            db.session.commit()
            
            message = f'导入完成！成功导入 {imported_count} 条记录，失败 {failed_count} 条'
            return {'success': True, 'message': message, 'imported_count': imported_count, 'failed_count': failed_count, 'errors': errors}
        
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'导入失败: {str(e)}', 'imported_count': 0, 'failed_count': 0, 'errors': [str(e)]}

@ns_import_export.route('/import/rules')
class ImportRules(Resource):
    @ns_import_export.doc('import_rules', params={'file': 'Excel或CSV文件'})
    @requires_admin
    def post(self):
        """导入规则数据"""
        if 'file' not in request.files:
            return {'success': False, 'message': '请选择要导入的文件', 'imported_count': 0, 'failed_count': 0, 'errors': ['未上传文件']}
        
        file = request.files['file']
        if file.filename == '':
            return {'success': False, 'message': '请选择要导入的文件', 'imported_count': 0, 'failed_count': 0, 'errors': ['文件名为空']}
        
        try:
            file_bytes = file.read()
            file_type = ExcelUtils.detect_file_type(file_bytes, file.filename)
            
            if file_type == 'csv':
                result = ExcelUtils.read_csv(file_bytes)
            elif file_type in ['xlsx', 'xls']:
                result = ExcelUtils.read_excel(file_bytes)
            else:
                return {'success': False, 'message': '不支持的文件格式', 'imported_count': 0, 'failed_count': 0, 'errors': ['仅支持.xlsx、.xls和.csv格式']}
            
            # 验证数据
            validation = ExcelTemplateGenerator.validate_import_data('rule', result['headers'], result['data'])
            if not validation['valid']:
                return {'success': False, 'message': '数据格式验证失败', 'imported_count': 0, 'failed_count': 0, 'errors': validation['errors']}
            
            # 执行导入
            imported_count = 0
            failed_count = 0
            errors = []
            
            for row_idx, row in enumerate(result['data'], start=2):
                try:
                    name = str(row[0]).strip() if row[0] else ''
                    description = str(row[1]).strip() if row[1] else ''
                    category_name = str(row[2]).strip() if row[2] else ''
                    score = int(row[3]) if row[3] else 0
                    is_active = str(row[4]).strip() == '是' if row[4] else True
                    daily_limit = int(row[5]) if row[5] else 0
                    min_interval = int(row[6]) if row[6] else 0
                    
                    if not name:
                        errors.append(f'第{row_idx}行：规则名称不能为空')
                        failed_count += 1
                        continue
                    
                    # 查找分类
                    category = ScoreCategory.query.filter_by(name=category_name).first()
                    if not category:
                        errors.append(f'第{row_idx}行：分类 "{category_name}" 不存在')
                        failed_count += 1
                        continue
                    
                    # 检查规则名称是否已存在
                    if ScoreRule.query.filter_by(name=name).first():
                        errors.append(f'第{row_idx}行：规则名称 "{name}" 已存在')
                        failed_count += 1
                        continue
                    
                    new_rule = ScoreRule(
                        name=name,
                        description=description,
                        category_id=category.id,
                        score=score,
                        is_active=is_active,
                        daily_limit=daily_limit,
                        min_interval=min_interval
                    )
                    db.session.add(new_rule)
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f'第{row_idx}行导入失败: {str(e)}')
                    failed_count += 1
            
            db.session.commit()
            
            message = f'导入完成！成功导入 {imported_count} 条记录，失败 {failed_count} 条'
            return {'success': True, 'message': message, 'imported_count': imported_count, 'failed_count': failed_count, 'errors': errors}
        
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'导入失败: {str(e)}', 'imported_count': 0, 'failed_count': 0, 'errors': [str(e)]}

@ns_import_export.route('/import/categories')
class ImportCategories(Resource):
    @ns_import_export.doc('import_categories', params={'file': 'Excel或CSV文件'})
    @requires_admin
    def post(self):
        """导入分类数据"""
        if 'file' not in request.files:
            return {'success': False, 'message': '请选择要导入的文件', 'imported_count': 0, 'failed_count': 0, 'errors': ['未上传文件']}
        
        file = request.files['file']
        if file.filename == '':
            return {'success': False, 'message': '请选择要导入的文件', 'imported_count': 0, 'failed_count': 0, 'errors': ['文件名为空']}
        
        try:
            file_bytes = file.read()
            file_type = ExcelUtils.detect_file_type(file_bytes, file.filename)
            
            if file_type == 'csv':
                result = ExcelUtils.read_csv(file_bytes)
            elif file_type in ['xlsx', 'xls']:
                result = ExcelUtils.read_excel(file_bytes)
            else:
                return {'success': False, 'message': '不支持的文件格式', 'imported_count': 0, 'failed_count': 0, 'errors': ['仅支持.xlsx、.xls和.csv格式']}
            
            # 验证数据
            validation = ExcelTemplateGenerator.validate_import_data('category', result['headers'], result['data'])
            if not validation['valid']:
                return {'success': False, 'message': '数据格式验证失败', 'imported_count': 0, 'failed_count': 0, 'errors': validation['errors']}
            
            # 执行导入
            imported_count = 0
            failed_count = 0
            errors = []
            
            for row_idx, row in enumerate(result['data'], start=2):
                try:
                    name = str(row[0]).strip() if row[0] else ''
                    description = str(row[1]).strip() if row[1] else ''
                    color = str(row[2]).strip() if row[2] else '#3B82F6'
                    
                    if not name:
                        errors.append(f'第{row_idx}行：分类名称不能为空')
                        failed_count += 1
                        continue
                    
                    # 检查分类名称是否已存在
                    if ScoreCategory.query.filter_by(name=name).first():
                        errors.append(f'第{row_idx}行：分类名称 "{name}" 已存在')
                        failed_count += 1
                        continue
                    
                    new_category = ScoreCategory(
                        name=name,
                        description=description,
                        color=color
                    )
                    db.session.add(new_category)
                    imported_count += 1
                    
                except Exception as e:
                    errors.append(f'第{row_idx}行导入失败: {str(e)}')
                    failed_count += 1
            
            db.session.commit()
            
            message = f'导入完成！成功导入 {imported_count} 条记录，失败 {failed_count} 条'
            return {'success': True, 'message': message, 'imported_count': imported_count, 'failed_count': failed_count, 'errors': errors}
        
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'导入失败: {str(e)}', 'imported_count': 0, 'failed_count': 0, 'errors': [str(e)]}

# ==================== 备份API ====================

@ns_import_export.route('/backup/create')
class CreateBackup(Resource):
    @ns_import_export.doc('create_backup', params={'type': '备份类型: full, incremental, data_only'})
    @requires_admin
    def post(self):
        """创建手动备份"""
        backup_type = request.args.get('type', 'full').lower()
        result = backup_manager.create_backup(backup_type)
        return result

@ns_import_export.route('/backup/list')
class ListBackups(Resource):
    @ns_import_export.doc('list_backups')
    @requires_admin
    def get(self):
        """获取备份文件列表"""
        backups = backup_manager.list_backups()
        return {'success': True, 'data': backups}

@ns_import_export.route('/backup/restore/<filename>')
class RestoreBackup(Resource):
    @ns_import_export.doc('restore_backup')
    @requires_admin
    def post(self, filename):
        """恢复备份"""
        result = backup_manager.restore_backup(filename)
        return result

@ns_import_export.route('/backup/delete/<filename>')
class DeleteBackup(Resource):
    @ns_import_export.doc('delete_backup')
    @requires_admin
    def delete(self, filename):
        """删除备份文件"""
        try:
            backup_path = backup_manager.backup_dir / filename
            if backup_path.exists():
                backup_path.unlink()
                return {'success': True, 'message': '备份文件已删除'}
            else:
                return {'success': False, 'message': '备份文件不存在'}
        except Exception as e:
            return {'success': False, 'message': f'删除失败: {str(e)}'}

@ns_import_export.route('/backup/stats')
class GetBackupStats(Resource):
    @ns_import_export.doc('get_backup_stats')
    @requires_admin
    def get(self):
        """获取备份统计信息"""
        stats = backup_manager.get_backup_stats()
        return {'success': True, 'data': stats}

@ns_import_export.route('/backup/schedule/enable')
class EnableBackupSchedule(Resource):
    @ns_import_export.doc('enable_backup_schedule')
    @requires_admin
    def post(self):
        """启用定时备份"""
        backup_scheduler.enable()
        return {'success': True, 'message': '定时备份已启用'}

@ns_import_export.route('/backup/schedule/disable')
class DisableBackupSchedule(Resource):
    @ns_import_export.doc('disable_backup_schedule')
    @requires_admin
    def post(self):
        """禁用定时备份"""
        backup_scheduler.disable()
        return {'success': True, 'message': '定时备份已禁用'}

@ns_import_export.route('/backup/schedule/status')
class GetBackupScheduleStatus(Resource):
    @ns_import_export.doc('get_backup_schedule_status')
    @requires_admin
    def get(self):
        """获取定时备份状态"""
        return {
            'success': True,
            'enabled': backup_scheduler.enabled,
            'schedule_time': backup_scheduler.schedule_time,
            'last_run_time': backup_scheduler.last_run_time.isoformat() if backup_scheduler.last_run_time else None
        }

@ns_import_export.route('/backup/schedule/set_time')
class SetBackupScheduleTime(Resource):
    @ns_import_export.doc('set_backup_schedule_time', params={'time': '定时时间，格式HH:MM'})
    @requires_admin
    def post(self):
        """设置定时备份时间"""
        time_str = request.args.get('time', '02:00')
        success = backup_scheduler.set_schedule_time(time_str)
        if success:
            return {'success': True, 'message': f'定时备份时间已设置为 {time_str}'}
        else:
            return {'success': False, 'message': '无效的时间格式，请使用HH:MM格式'}

@ns_import_export.route('/backup/clean_old')
class CleanOldBackups(Resource):
    @ns_import_export.doc('clean_old_backups')
    @requires_admin
    def post(self):
        """清理过期备份"""
        result = backup_manager.clean_old_backups()
        return result