from flask import Blueprint, request, jsonify
from utils.logger import log_frontend_error, log_info, log_error

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('/api/logs/error', methods=['POST'])
def log_error_endpoint():
    """记录前端错误日志"""
    try:
        error_data = request.get_json()
        if not error_data:
            return jsonify({'success': False, 'message': '缺少错误数据'}), 400
        
        success = log_frontend_error(error_data)
        if success:
            return jsonify({'success': True, 'message': '错误日志已记录'})
        else:
            return jsonify({'success': False, 'message': '记录错误日志失败'}), 500
    except Exception as e:
        log_error(f"处理前端错误日志请求失败: {e}", exception=e)
        return jsonify({'success': False, 'message': '服务器内部错误'}), 500


@logs_bp.route('/api/logs/info', methods=['POST'])
def log_info_endpoint():
    """记录前端信息日志"""
    try:
        log_data = request.get_json()
        if not log_data or 'message' not in log_data:
            return jsonify({'success': False, 'message': '缺少日志数据'}), 400
        
        message = log_data.get('message', '')
        extra_data = {k: v for k, v in log_data.items() if k != 'message'}
        log_info(message, **extra_data)
        
        return jsonify({'success': True, 'message': '信息日志已记录'})
    except Exception as e:
        log_error(f"处理前端信息日志请求失败: {e}", exception=e)
        return jsonify({'success': False, 'message': '服务器内部错误'}), 500


def register_logs_routes(app):
    """注册日志路由"""
    app.register_blueprint(logs_bp)
