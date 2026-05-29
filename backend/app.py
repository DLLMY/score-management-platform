from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from datetime import datetime, timedelta
import os
import shutil
import threading
import time
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from models import db

app = Flask(__name__)

# 加载环境变量
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

Compress(app)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[
        f"{os.getenv('RATE_LIMIT_PER_HOUR', '1000')} per hour",
        f"{os.getenv('RATE_LIMIT_PER_MINUTE', '30')} per minute"
    ],
    storage_uri="memory://",
)

app.config['COMPRESS_MIMETYPES'] = [
    'text/html',
    'text/css',
    'text/xml',
    'application/json',
    'application/javascript',
    'application/xml',
    'image/svg+xml'
]
app.config['COMPRESS_LEVEL'] = 6
app.config['COMPRESS_MIN_SIZE'] = 500

os.makedirs(os.path.join(basedir, 'instance'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'backups'), exist_ok=True)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URI',
    'sqlite:///' + os.path.join(basedir, 'instance', 'score_management.db')
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'connect_args': {
        'timeout': 30,
        'check_same_thread': False
    },
    'pool_size': 5,
    'max_overflow': 10,
    'pool_timeout': 30,
    'pool_recycle': 1800
}
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'your_secret_key_here_change_in_production')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.url_map.strict_slashes = False

# CSRF防护配置 - 生产环境建议启用
app.config['WTF_CSRF_ENABLED'] = True
app.config['WTF_CSRF_SECRET_KEY'] = os.getenv('CSRF_SECRET_KEY', app.config['SECRET_KEY'])
app.config['WTF_CSRF_TIME_LIMIT'] = 3600  # CSRF令牌有效期1小时
# CSRF豁免视图列表
app.config['WTF_CSRF_EXEMPT_VIEWS'] = ['api.admins_admin_login', 'api.admins_admin_refresh_token']

# 初始化数据库
db.init_app(app)

CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

# 初始化CSRF保护
csrf = CSRFProtect(app)

# 创建一个集合来存储需要豁免CSRF保护的视图函数
csrf_exempt_views = set()

def csrf_exempt(view_func):
    """装饰器：标记视图函数不需要CSRF保护"""
    csrf_exempt_views.add(view_func.__name__)
    return view_func

# 在CSRF保护之前检查是否需要豁免
@app.before_request
def check_csrf_exempt():
    if request.endpoint and request.endpoint.rsplit('.', 1)[-1] in csrf_exempt_views:
        # 跳过CSRF检查
        pass

from utils.logger import log_request_middleware, log_info
from utils.error_handler import register_error_handlers

# 注册日志中间件
log_request_middleware(app)

# 注册全局异常处理器
register_error_handlers(app)

from routes import register_routes
api = register_routes(app)

# 注册日志路由（使用普通Flask Blueprint）
from routes.logs_routes import register_logs_routes
register_logs_routes(app)

# 为登录和刷新令牌接口添加CSRF豁免
# 获取所有注册的端点并找到登录和刷新令牌接口
for rule in app.url_map.iter_rules():
    if rule.rule in ['/api/admins/login', '/api/admins/refresh-token']:
        view_func = app.view_functions[rule.endpoint]
        csrf.exempt(view_func)
        print(f"已为 {rule.rule} 添加CSRF豁免")

from services.mqtt_service import connect_mqtt

def scheduled_backup():
    """定时备份任务"""
    try:
        from utils.backup_utils import backup_manager
        result = backup_manager.create_backup('full')
        if result['success']:
            print(f"数据库定时备份成功: {result['filename']}")
            # 清理过期备份
            backup_manager.clean_old_backups()
        else:
            print(f"数据库定时备份失败: {result['message']}")
    except Exception as e:
        print(f"数据库定时备份异常: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_backup, 'cron', hour=2, minute=0)
scheduler.start()
print("定时备份任务已启动，每天凌晨2:00执行")

mqtt_started = False

def start_mqtt_in_background():
    """在后台线程中启动MQTT客户端"""
    global mqtt_started
    if mqtt_started:
        print("MQTT客户端已经启动过了，跳过")
        return
    mqtt_started = True
    
    print("正在启动MQTT客户端...")
    try:
        with app.app_context():
            result = connect_mqtt()
            if result:
                print("MQTT客户端启动线程执行完成")
            else:
                print("MQTT客户端启动失败（可能是网络问题）")
    except Exception as e:
        print(f"MQTT启动线程异常: {e}")

with app.app_context():
    db.create_all()
    
    # 初始化MQTT配置
    from models import MQTTConfig
    mqtt_config = MQTTConfig.query.first()
    if not mqtt_config:
        print("初始化MQTT配置...")
        mqtt_config = MQTTConfig(
            broker=os.getenv('MQTT_BROKER', 'nc5233fc.ala.cn-hangzhou.emqxsl.cn'),
            port=int(os.getenv('MQTT_PORT', 8084)),
            client_id=os.getenv('MQTT_CLIENT_ID', 'score_backend'),
            username=os.getenv('MQTT_USERNAME', 'phoneboxtest'),
            password=os.getenv('MQTT_PASSWORD', '123456'),
            ssl=os.getenv('MQTT_SSL', 'true').lower() == 'true',
            timeout=int(os.getenv('MQTT_TIMEOUT', 10)),
            keepalive=int(os.getenv('MQTT_KEEPALIVE', 60))
        )
        db.session.add(mqtt_config)
        db.session.commit()
        print(f"MQTT配置已初始化: broker={mqtt_config.broker}")
    
    # 准备MQTT配置（双协议支持）
    # 配置1: WebSocket协议（用于测试和调试，与mqtt-test-tool一致）
    ws_mqtt_config = {
        'broker': mqtt_config.broker,
        'port': 8084,
        'client_id': mqtt_config.client_id + '_ws',
        'username': mqtt_config.username,
        'password': mqtt_config.password,
        'ssl': True,
        'timeout': mqtt_config.timeout,
        'keepalive': mqtt_config.keepalive,
        'transport': 'websockets',
        'ws_path': '/mqtt'
    }
    
    # 配置2: TCP协议（用于生产环境，更稳定）
    tcp_mqtt_config = {
        'broker': mqtt_config.broker,
        'port': 8883,
        'client_id': mqtt_config.client_id + '_tcp',
        'username': mqtt_config.username,
        'password': mqtt_config.password,
        'ssl': True,
        'timeout': mqtt_config.timeout,
        'keepalive': mqtt_config.keepalive,
        'transport': 'tcp'
    }

    # 在后台线程中尝试连接MQTT（双协议支持）
    def try_connect_mqtt():
        try:
            # 延迟5秒后再连接MQTT，等待后端服务完全启动
            print("后台线程：等待5秒后连接MQTT...", flush=True)
            time.sleep(5)
            print("后台线程：等待完成，开始连接MQTT...", flush=True)
            
            print("后台线程：导入mqtt_manager...", flush=True)
            from services.mqtt_manager import MQTTManager
            print("后台线程：mqtt_manager导入成功", flush=True)
            
            # 注册消息处理回调
            print("后台线程：注册消息回调...", flush=True)
            def on_mqtt_message_received(topic, message):
                try:
                    from routes.mqtt_routes import handle_mqtt_message
                    handle_mqtt_message(None, topic, message)
                except Exception as e:
                    print(f"处理MQTT消息失败: {e}")
            
            # 创建WebSocket连接实例
            print("后台线程：创建WebSocket MQTT连接...", flush=True)
            ws_manager = MQTTManager('websocket')
            ws_manager.add_message_callback(on_mqtt_message_received)
            ws_manager.connect(ws_mqtt_config)
            print("后台线程：WebSocket MQTT连接调用完成", flush=True)
            
            # 创建TCP连接实例
            print("后台线程：创建TCP MQTT连接...", flush=True)
            tcp_manager = MQTTManager('tcp')
            tcp_manager.add_message_callback(on_mqtt_message_received)
            tcp_manager.connect(tcp_mqtt_config)
            print("后台线程：TCP MQTT连接调用完成", flush=True)
            
            # 设置默认使用的连接（优先使用TCP）
            print("后台线程：设置默认MQTT管理器...", flush=True)
            global mqtt_manager
            mqtt_manager = tcp_manager if tcp_manager.is_connected else ws_manager
            print(f"后台线程：默认MQTT管理器已设置: {mqtt_manager._instance_name}", flush=True)
            
        except Exception as e:
            print(f"MQTT启动失败: {e}", flush=True)
            import traceback
            traceback.print_exc()

    mqtt_thread = threading.Thread(target=try_connect_mqtt, daemon=True)
    mqtt_thread.start()

@app.route('/')
def index():
    return jsonify({'message': '积分管理平台 API', 'version': '1.0'})

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/test-auth')
def test_auth():
    auth_header = request.headers.get('Authorization')
    admin_id = request.headers.get('X-Admin-Id')
    return jsonify({
        'Authorization': auth_header,
        'X-Admin-Id': admin_id,
        'all_headers': dict(request.headers)
    })

if __name__ == '__main__':
    # 禁用调试模式以避免重复启动问题
    app.run(host='127.0.0.1', port=5000, debug=False)