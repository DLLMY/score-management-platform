from flask_restx import Namespace, Resource, fields
from flask_wtf.csrf import generate_csrf
from models import db, SystemConfig
from utils.permission import requires_admin
from services.cache_service import cache_service
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

backup_restore_model = ns_system.model('BackupRestore', {
    'filename': fields.String(required=True, description='备份文件名')
})

backup_info_model = ns_system.model('BackupInfo', {
    'filename': fields.String(description='文件名'),
    'size': fields.Integer(description='文件大小（字节）'),
    'created_at': fields.String(description='创建时间')
})

@ns_system.route('/config')
class SystemConfigResource(Resource):
    @ns_system.doc('get_system_config', description='获取系统配置')
    @ns_system.response(200, '成功')
    def get(self):
        """
        获取系统配置
        
        获取当前系统的配置信息。
        """
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

    @ns_system.doc('update_system_config', description='更新系统配置', security='Bearer')
    @ns_system.expect(system_config_model)
    @ns_system.response(200, '更新成功')
    @requires_admin
    def put(self):
        """
        更新系统配置
        
        更新系统配置信息，需要管理员权限。
        
        请求体：
        - system_name: 系统名称
        - system_logo: 系统Logo
        - default_score: 默认积分
        - min_score: 最低积分
        - max_score: 最高积分
        - enable_notifications: 启用通知
        - notification_sound: 通知声音
        - auto_save: 自动保存
        - theme: 主题
        - language: 语言
        """
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
    @ns_system.doc('backup_database', description='备份数据库', security='Bearer')
    @ns_system.response(200, '备份成功')
    @ns_system.response(404, '数据库文件不存在')
    @ns_system.response(500, '备份失败')
    @requires_admin
    def post(self):
        """
        备份数据库
        
        创建数据库的完整备份。备份文件保存在backups目录下，
        最多保留10个备份文件，超出后自动删除最旧的备份。
        """
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
    @ns_system.doc('list_backups', description='获取备份列表', security='Bearer')
    @ns_system.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取备份列表
        
        获取所有可用数据库备份文件的列表。
        """
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
    @ns_system.doc('restore_database', description='恢复数据库', security='Bearer')
    @ns_system.expect(backup_restore_model)
    @ns_system.response(200, '恢复成功')
    @ns_system.response(400, '请提供备份文件名')
    @ns_system.response(404, '备份文件不存在')
    @ns_system.response(500, '恢复失败')
    @requires_admin
    def post(self):
        """
        恢复数据库
        
        从备份文件恢复数据库，需要管理员权限。
        警告：此操作会覆盖当前的数据库内容。
        
        请求体：
        - filename: 备份文件名（必填）
        """
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
    @ns_system.doc('clear_cache', description='清理缓存', security='Bearer')
    @ns_system.response(200, '清理成功')
    @ns_system.response(500, '清理失败')
    @requires_admin
    def post(self):
        """
        清理缓存
        
        清理Python缓存文件（__pycache__），需要管理员权限。
        """
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

@ns_system.route('/cache-stats')
class SystemCacheStats(Resource):
    @ns_system.doc('get_cache_stats', description='获取缓存统计信息', security='Bearer')
    @ns_system.response(200, '成功')
    @requires_admin
    def get(self):
        """
        获取缓存统计信息
        
        获取Redis缓存的使用统计信息，包括命中率、操作次数等。
        """
        return cache_service.get_stats()

    @ns_system.doc('flush_cache', description='刷新缓存', security='Bearer')
    @ns_system.response(200, '成功')
    @requires_admin
    def post(self):
        """
        刷新缓存
        
        清空所有缓存数据，需要管理员权限。
        """
        result = cache_service.flush_all()
        return {'success': result, 'message': '缓存刷新成功' if result else '缓存刷新失败'}

@ns_system.route('/csrf-token')
class SystemCsrfToken(Resource):
    @ns_system.doc('get_csrf_token', description='获取CSRF令牌')
    @ns_system.response(200, '成功')
    def get(self):
        """
        获取CSRF令牌
        
        获取用于表单提交的CSRF防护令牌。
        """
        csrf_token = generate_csrf()
        return {'csrf_token': csrf_token}