from flask_restx import Namespace, Resource, fields
from flask_wtf.csrf import generate_csrf
from models import db, SystemConfig
from utils.permission import requires_admin
from datetime import datetime
import os
import shutil

ns_system = Namespace('system', description='系统管理相关操作')

system_config_model = ns_system.model('SystemConfig', {
    'id': fields.Integer(readOnly=True, description='配置ID'),
    'system_name': fields.String(description='系统名称'),
    'system_logo': fields.String(description='系统Logo'),
    'default_score': fields.Integer(description='默认积分'),
    'min_score': fields.Integer(description='最低积分'),
    'max_score': fields.Integer(description='最高积分'),
    'enable_notifications': fields.Boolean(description='启用通知'),
    'notification_sound': fields.Boolean(description='通知声音'),
    'auto_save': fields.Boolean(description='自动保存'),
    'theme': fields.String(description='主题'),
    'language': fields.String(description='语言')
})

@ns_system.route('/config')
class SystemConfigResource(Resource):
    @ns_system.doc('get_system_config')
    def get(self):
        config = SystemConfig.query.first()
        if not config:
            config = SystemConfig()
            db.session.add(config)
            db.session.commit()
        return {
            'id': config.id,
            'system_name': config.system_name,
            'system_logo': config.system_logo,
            'default_score': config.default_score,
            'min_score': config.min_score,
            'max_score': config.max_score,
            'enable_notifications': config.enable_notifications,
            'notification_sound': config.notification_sound,
            'auto_save': config.auto_save,
            'theme': config.theme,
            'language': config.language,
            'updated_at': config.updated_at.isoformat() if config.updated_at else None
        }

    @ns_system.doc('update_system_config')
    @ns_system.expect(system_config_model)
    @requires_admin
    def put(self):
        config = SystemConfig.query.first()
        if not config:
            config = SystemConfig()
        
        data = ns_system.payload
        config.system_name = data.get('system_name', config.system_name)
        config.system_logo = data.get('system_logo', config.system_logo)
        config.default_score = data.get('default_score', config.default_score)
        config.min_score = data.get('min_score', config.min_score)
        config.max_score = data.get('max_score', config.max_score)
        config.enable_notifications = data.get('enable_notifications', config.enable_notifications)
        config.notification_sound = data.get('notification_sound', config.notification_sound)
        config.auto_save = data.get('auto_save', config.auto_save)
        config.theme = data.get('theme', config.theme)
        config.language = data.get('language', config.language)
        config.updated_at = datetime.now()
        
        db.session.add(config)
        db.session.commit()
        return {'success': True, 'message': '系统配置更新成功'}

@ns_system.route('/backup')
class SystemBackup(Resource):
    @ns_system.doc('backup_database')
    @requires_admin
    def post(self):
        try:
            basedir = os.path.abspath(os.path.dirname(__file__))
            backup_dir = os.path.join(basedir, '..', 'backups')
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_path = os.path.join(backup_dir, f'score_management_{timestamp}.db')
            source_path = os.path.join(basedir, '..', 'instance', 'score_management.db')
            
            os.makedirs(backup_dir, exist_ok=True)
            
            if os.path.exists(source_path):
                shutil.copy2(source_path, backup_path)
                
                backups = sorted([f for f in os.listdir(backup_dir) if f.startswith('score_management_')])
                if len(backups) > 10:
                    oldest = backups[0]
                    os.remove(os.path.join(backup_dir, oldest))
                
                return {'success': True, 'message': '数据库备份成功', 'filename': f'score_management_{timestamp}.db'}
            else:
                return {'success': False, 'message': '数据库文件不存在'}, 404
        except Exception as e:
            return {'success': False, 'message': f'备份失败: {str(e)}'}, 500

@ns_system.route('/backups')
class SystemBackupsList(Resource):
    @ns_system.doc('list_backups')
    @requires_admin
    def get(self):
        try:
            basedir = os.path.abspath(os.path.dirname(__file__))
            backup_dir = os.path.join(basedir, '..', 'backups')
            
            if not os.path.exists(backup_dir):
                return []
            
            backups = []
            for filename in sorted(os.listdir(backup_dir)):
                if filename.startswith('score_management_') and filename.endswith('.db'):
                    filepath = os.path.join(backup_dir, filename)
                    stat = os.stat(filepath)
                    backups.append({
                        'filename': filename,
                        'size': stat.st_size,
                        'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
            
            return sorted(backups, key=lambda x: x['created_at'], reverse=True)
        except Exception as e:
            return {'success': False, 'message': f'获取备份列表失败: {str(e)}'}, 500

@ns_system.route('/restore')
class SystemRestore(Resource):
    @ns_system.doc('restore_database')
    @requires_admin
    def post(self):
        try:
            data = ns_system.payload
            filename = data.get('filename')
            
            if not filename:
                return {'success': False, 'message': '请提供备份文件名'}, 400
            
            basedir = os.path.abspath(os.path.dirname(__file__))
            backup_dir = os.path.join(basedir, '..', 'backups')
            backup_path = os.path.join(backup_dir, filename)
            target_path = os.path.join(basedir, '..', 'instance', 'score_management.db')
            
            if not os.path.exists(backup_path):
                return {'success': False, 'message': '备份文件不存在'}, 404
            
            shutil.copy2(backup_path, target_path)
            return {'success': True, 'message': '数据库恢复成功'}
        except Exception as e:
            return {'success': False, 'message': f'恢复失败: {str(e)}'}, 500

@ns_system.route('/clear-cache')
class SystemClearCache(Resource):
    @ns_system.doc('clear_cache')
    @requires_admin
    def post(self):
        try:
            basedir = os.path.abspath(os.path.dirname(__file__))
            cache_dir = os.path.join(basedir, '..', '__pycache__')
            
            if os.path.exists(cache_dir):
                shutil.rmtree(cache_dir)
            
            for root, dirs, files in os.walk(os.path.join(basedir, '..')):
                for dir in dirs:
                    if dir == '__pycache__':
                        shutil.rmtree(os.path.join(root, dir))
            
            return {'success': True, 'message': '缓存清理成功'}
        except Exception as e:
            return {'success': False, 'message': f'清理失败: {str(e)}'}, 500

@ns_system.route('/csrf-token')
class SystemCsrfToken(Resource):
    @ns_system.doc('get_csrf_token')
    def get(self):
        """获取CSRF令牌"""
        csrf_token = generate_csrf()
        return {'csrf_token': csrf_token}