from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flasgger import Swagger, LazyString, LazyJSONEncoder
from datetime import datetime, timedelta
import os
import shutil
import threading
import time
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from models import db

app = Flask(__name__)

# 全局MQTT管理器声明
mqtt_manager = None

# 配置Flasgger Swagger文档
app.json_encoder = LazyJSONEncoder
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "积分管理平台 API",
        "description": "积分管理平台的RESTful API文档，提供用户管理、积分规则、分类管理等功能",
        "version": "1.0.0",
        "contact": {
            "name": "开发团队",
            "email": "support@example.com"
        }
    },
    "host": LazyString(lambda: request.host),
    "basePath": "/api",
    "schemes": LazyString(lambda: ['http', 'https'] if request.is_secure else ['http']),
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT令牌格式: Bearer {token}"
        },
        "X-Admin-Id": {
            "type": "apiKey",
            "name": "X-Admin-Id",
            "in": "header",
            "description": "管理员ID"
        }
    },
    "security": [
        {
            "Bearer": []
        }
    ]
}

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'api_spec',
            "route": '/api/spec',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/swagger/"
}

swagger = Swagger(app, template=swagger_template, config=swagger_config)

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

# CSRF防护配置
# 注意：对于API应用，使用JWT token进行身份验证，CSRF保护不是必需的
# 如果你的前端不是浏览器表单，而是通过JS发送请求（携带Authorization头）
# 那么CSRF保护可以禁用
app.config['WTF_CSRF_ENABLED'] = False
app.config['WTF_CSRF_SECRET_KEY'] = os.getenv('CSRF_SECRET_KEY', app.config['SECRET_KEY'])
app.config['WTF_CSRF_TIME_LIMIT'] = 3600
# CSRF豁免视图列表
app.config['WTF_CSRF_EXEMPT_VIEWS'] = ['api.admins_admin_login', 'api.admins_admin_refresh_token']

# 初始化数据库
db.init_app(app)

CORS(app, 
     supports_credentials=True, 
     resources={r"/api/*": {"origins": "*"}},
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Admin-Id", "X-CSRFToken"])

# 初始化CSRF保护
csrf = CSRFProtect(app)
print(f"CSRF保护已 {'启用' if app.config.get('WTF_CSRF_ENABLED') else '禁用'}")

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

# 注册版本路由
from routes.version_routes import version_bp
app.register_blueprint(version_bp)

# 注册迁移路由
from routes.migration_routes import migration_bp
app.register_blueprint(migration_bp)

# 为登录和刷新令牌接口添加CSRF豁免
# 获取所有注册的端点并找到登录和刷新令牌接口
for rule in app.url_map.iter_rules():
    if rule.rule in ['/api/admins/login', '/api/admins/refresh-token']:
        view_func = app.view_functions[rule.endpoint]
        csrf.exempt(view_func)
        print(f"已为 {rule.rule} 添加CSRF豁免")
    elif rule.rule == '/api/devices/<int:id>/remote-control':
        view_func = app.view_functions[rule.endpoint]
        csrf.exempt(view_func)
        print(f"已为 {rule.rule} 添加CSRF豁免")
    elif rule.rule.startswith('/api/mqtt/'):
        view_func = app.view_functions[rule.endpoint]
        csrf.exempt(view_func)
        print(f"已为 {rule.rule} 添加CSRF豁免")
        limiter.exempt(view_func)
        print(f"已为 {rule.rule} 添加限流豁免")

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

def init_database():
    """异步初始化数据库和默认数据"""
    with app.app_context():
        db.create_all()
        print("数据库表创建完成")
        
        # 初始化默认管理员
        try:
            from models import Admin
            from utils.security import hash_password
            existing_admin = Admin.query.first()
            if not existing_admin:
                print("初始化默认管理员...")
                default_admin = Admin(
                    username='admin',
                    password=hash_password('admin123'),
                    role='admin',
                    real_name='系统管理员',
                    phone='13800138000'
                )
                db.session.add(default_admin)
                db.session.commit()
                print("默认管理员创建成功!")
        except Exception as e:
            print(f"初始化管理员失败: {e}")
        
        # 初始化MQTT配置
        try:
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
        except Exception as e:
            print(f"初始化MQTT配置失败: {e}")

def init_mqtt():
    """异步初始化MQTT连接"""
    try:
        # 延迟3秒后再连接MQTT，等待后端服务完全启动
        print("后台线程：等待3秒后连接MQTT...", flush=True)
        time.sleep(3)
        
        # 获取MQTT配置
        with app.app_context():
            from models import MQTTConfig
            mqtt_config = MQTTConfig.query.first()
            if not mqtt_config:
                print("MQTT配置未找到，跳过MQTT连接", flush=True)
                return
            
            # 配置1: WebSocket协议
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
            
            # 配置2: TCP协议
            tcp_mqtt_config = {
                'broker': mqtt_config.broker,
                'port': 8883,
                'client_id': mqtt_config.client_id + '_tcp',
                'username': mqtt_config.username,
                'password': mqtt_config.password,
                'ssl': True,
                'timeout': min(5, mqtt_config.timeout),  # 缩短超时时间
                'keepalive': mqtt_config.keepalive,
                'transport': 'tcp'
            }
        
        print("后台线程：导入mqtt_manager...", flush=True)
        from services.mqtt_manager import MQTTManager
        
        # 注册消息处理回调
        def on_mqtt_message_received(topic, message):
            try:
                with app.app_context():
                    from routes.mqtt_routes import handle_mqtt_message
                    handle_mqtt_message(None, topic, message)
            except Exception as e:
                print(f"处理MQTT消息失败: {e}")
        
        # 创建TCP连接（优先使用TCP）
        print("后台线程：创建TCP MQTT连接...", flush=True)
        tcp_manager = MQTTManager('tcp')
        tcp_manager.add_message_callback(on_mqtt_message_received)
        tcp_manager.connect(tcp_mqtt_config)
        
        # 创建WebSocket连接（备用）
        print("后台线程：创建WebSocket MQTT连接...", flush=True)
        ws_manager = MQTTManager('websocket')
        ws_manager.add_message_callback(on_mqtt_message_received)
        ws_manager.connect(ws_mqtt_config)
        
        # 设置默认使用的连接
        global mqtt_manager
        mqtt_manager = tcp_manager if tcp_manager.is_connected else ws_manager
        print(f"后台线程：默认MQTT管理器已设置: {mqtt_manager._instance_name}", flush=True)
        
    except Exception as e:
        print(f"MQTT启动失败: {e}", flush=True)

# 异步初始化数据库（非阻塞）
db_init_thread = threading.Thread(target=init_database, daemon=True)
db_init_thread.start()

# 异步初始化MQTT（非阻塞）
mqtt_init_thread = threading.Thread(target=init_mqtt, daemon=True)
mqtt_init_thread.start()

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

def init_cache_warmup():
    """异步初始化缓存预热"""
    try:
        from services.redis_cache_service import warmup_cache
        warmup_cache(app)
    except Exception as e:
        print(f"缓存预热失败: {e}")

if __name__ == '__main__':
    # 初始化Redis缓存服务
    from services.redis_cache_service import cache
    cache.init_app(app)
    print("Redis缓存服务初始化完成")

    # 异步启动缓存预热
    cache_warmup_thread = threading.Thread(target=init_cache_warmup, daemon=True)
    cache_warmup_thread.start()
    print("缓存预热线程已启动")

    # 初始化WebSocket服务
    from services.websocket_service import socketio
    from routes.websocket_routes import init_websocket
    init_websocket(app)
    print("WebSocket服务初始化完成")

    # 启动Flask-SocketIO服务器
    print("启动WebSocket服务器在 port 5000...")
    socketio.run(app, host='127.0.0.1', port=5000, debug=False, allow_unsafe_werkzeug=True)