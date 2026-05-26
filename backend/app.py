from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_restx import Api, Resource, fields, Namespace
from datetime import datetime, timedelta
import json
import paho.mqtt.client as mqtt
import threading
import os
import shutil
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
import os
basedir = os.path.abspath(os.path.dirname(__file__))

# 确保 instance 目录存在
os.makedirs(os.path.join(basedir, 'instance'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'backups'), exist_ok=True)

# 数据库配置
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'instance', 'score_management.db')
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
app.config['SECRET_KEY'] = 'your_secret_key_here'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
app.url_map.strict_slashes = False

db = SQLAlchemy(app)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

# 全局请求日志记录器
@app.before_request
def log_request_info():
    print(f"\n[GLOBAL] {'='*60}")
    print(f"[GLOBAL] {request.method} {request.path}")
    print(f"[GLOBAL] Remote: {request.remote_addr}")
    print(f"[GLOBAL] Headers: {dict(request.headers)}")
    if request.data:
        try:
            print(f"[GLOBAL] Body: {request.get_json()}")
        except:
            print(f"[GLOBAL] Body (raw): {request.data}")
    print(f"[GLOBAL] {'='*60}\n")

api = Api(app, version='1.0', title='积分管理平台 API',
          description='积分管理平台的 RESTful API 文档',
          doc='/api/docs/',
          prefix='/api')

ns_users = api.namespace('users', description='学生管理相关操作')
ns_rules = api.namespace('rules', description='积分规则相关操作')
ns_records = api.namespace('records', description='积分记录相关操作')
ns_categories = api.namespace('categories', description='分类管理相关操作')
ns_rank = api.namespace('rank-rules', description='排名规则相关操作')
ns_mqtt = api.namespace('mqtt', description='MQTT相关操作')
ns_export = api.namespace('export', description='数据导出相关操作')
ns_admins = api.namespace('admins', description='管理员管理相关操作')
ns_notifications = api.namespace('notifications', description='通知相关操作')
ns_approvals = api.namespace('approvals', description='审批相关操作')
ns_time_rules = api.namespace('time-rules', description='时间规则相关操作')
ns_devices = api.namespace('devices', description='设备管理相关操作')

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    gender = db.Column(db.String(10))
    class_name = db.Column(db.String(50), index=True)
    phone = db.Column(db.String(20), index=True)
    parent_info = db.Column(db.String(500))
    father_name = db.Column(db.String(100))
    father_phone = db.Column(db.String(20))
    mother_name = db.Column(db.String(100))
    mother_phone = db.Column(db.String(20))
    guardian_name = db.Column(db.String(100))
    guardian_phone = db.Column(db.String(20))
    guardian_relation = db.Column(db.String(50))
    card_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    current_score = db.Column(db.Integer, default=0, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class ScoreCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(200))
    color = db.Column(db.String(20), default='#3B82F6')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

class ScoreRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.String(500))
    category_id = db.Column(db.Integer, db.ForeignKey('score_category.id'), index=True)
    score = db.Column(db.Float, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    daily_limit = db.Column(db.Integer, default=0)
    min_interval = db.Column(db.Integer, default=0)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now)
    
    category = db.relationship('ScoreCategory', backref='rules')

class ScoreRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('score_rule.id'), index=True)
    score_change = db.Column(db.Integer, nullable=False, index=True)
    description = db.Column(db.String(500))
    operator = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    
    user = db.relationship('User', backref='records')
    rule = db.relationship('ScoreRule', backref='records')

class ScoreRankRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    min_score = db.Column(db.Integer, nullable=False)
    max_score = db.Column(db.Integer)
    color = db.Column(db.String(20), default='#0ea5e9')
    icon = db.Column(db.String(50), default='Award')
    description = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    permissions = db.Column(db.Text)

class MQTTLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(200))
    message = db.Column(db.Text)
    direction = db.Column(db.String(10))
    timestamp = db.Column(db.DateTime, default=datetime.now)

class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(db.String(50), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    operator = db.Column(db.String(100), default='system')
    description = db.Column(db.Text)
    before_data = db.Column(db.Text)
    after_data = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)

class MQTTConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    broker = db.Column(db.String(200), default='nc5233fc.ala.cn-hangzhou.emqxsl.cn')
    port = db.Column(db.Integer, default=8883)
    client_id = db.Column(db.String(100), default='score_backend')
    username = db.Column(db.String(100), default='phoneboxtest')
    password = db.Column(db.String(100), default='123456')
    ssl = db.Column(db.Boolean, default=True)
    timeout = db.Column(db.Integer, default=10)
    keepalive = db.Column(db.Integer, default=60)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class SystemConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    system_name = db.Column(db.String(100), default='积分管理平台')
    system_logo = db.Column(db.String(500), default='')
    default_score = db.Column(db.Integer, default=60)
    min_score = db.Column(db.Integer, default=0)
    max_score = db.Column(db.Integer, default=100)
    enable_notifications = db.Column(db.Boolean, default=True)
    notification_sound = db.Column(db.Boolean, default=True)
    auto_save = db.Column(db.Boolean, default=True)
    theme = db.Column(db.String(20), default='light')
    language = db.Column(db.String(20), default='zh-CN')
    updated_at = db.Column(db.DateTime, default=datetime.now)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(100))
    content = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.now)
    sent_at = db.Column(db.DateTime)
    
    user = db.relationship('User', backref='notifications')

class Approval(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(100))
    description = db.Column(db.Text)
    score_change = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')
    approver_id = db.Column(db.Integer)
    approve_time = db.Column(db.DateTime)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)
    
    user = db.relationship('User', backref='approvals')

class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='admin')
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    class_name = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class ProcessedMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.String(100), unique=True, nullable=False)
    record_id = db.Column(db.Integer)
    new_score = db.Column(db.Integer)
    client_id = db.Column(db.String(100))
    processed_at = db.Column(db.DateTime, default=datetime.now)

class TimeRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    day_of_week = db.Column(db.Integer, default=-1)  # -1=每天, 0=周一~6=周日
    start_hour = db.Column(db.Integer, nullable=False)
    start_minute = db.Column(db.Integer, nullable=False)
    end_hour = db.Column(db.Integer, nullable=False)
    end_minute = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    allow_unlock = db.Column(db.Boolean, default=False)  # False=禁止开锁
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100))
    status = db.Column(db.String(20), default='offline')
    last_heartbeat = db.Column(db.DateTime)
    wifi_signal = db.Column(db.Integer)
    uptime = db.Column(db.Integer)
    box_a_status = db.Column(db.String(20), default='closed')
    box_b_status = db.Column(db.String(20), default='closed')
    system_state = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)

class DeviceHeartbeat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20))
    wifi_signal = db.Column(db.Integer)
    uptime = db.Column(db.Integer)
    box_a_status = db.Column(db.String(20))
    box_b_status = db.Column(db.String(20))
    system_state = db.Column(db.Integer)
    received_at = db.Column(db.DateTime, default=datetime.now)


class ClassInfo(db.Model):
    """班级信息表 - 独立班级管理"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    grade = db.Column(db.String(50))
    description = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)
    

class SubAccount(db.Model):
    """子账号表 - 数据大屏用户等子账号"""
    id = db.Column(db.Integer, primary_key=True)
    parent_admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), nullable=False, index=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    real_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    role_type = db.Column(db.String(30), default='dashboard_viewer', index=True)
    permissions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)
    
    parent_admin = db.relationship('Admin', backref=db.backref('sub_accounts', lazy=True))


class RolePermission(db.Model):
    """角色权限定义表"""
    id = db.Column(db.Integer, primary_key=True)
    role_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    role_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    permissions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now)


class AdminClass(db.Model):
    """管理员-班级关联表（多对多）"""
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), nullable=False, index=True)
    class_info_id = db.Column(db.Integer, db.ForeignKey('class_info.id'), nullable=False, index=True)
    is_primary = db.Column(db.Boolean, default=False)
    assigned_at = db.Column(db.DateTime, default=datetime.now)
    
    admin = db.relationship('Admin', backref=db.backref('class_links', lazy=True))
    class_info = db.relationship('ClassInfo', backref=db.backref('admin_links', lazy=True))


class PermissionLog(db.Model):
    """权限操作日志表"""
    id = db.Column(db.Integer, primary_key=True)
    operator_id = db.Column(db.Integer)
    operator_type = db.Column(db.String(30))
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

user_model = api.model('User', {
    'id': fields.Integer(readOnly=True, description='学生ID'),
    'name': fields.String(required=True, description='学生姓名'),
    'gender': fields.String(description='性别'),
    'class_name': fields.String(description='班级'),
    'phone': fields.String(description='联系电话'),
    'father_name': fields.String(description='父亲姓名'),
    'father_phone': fields.String(description='父亲电话'),
    'mother_name': fields.String(description='母亲姓名'),
    'mother_phone': fields.String(description='母亲电话'),
    'guardian_name': fields.String(description='监护人姓名'),
    'guardian_phone': fields.String(description='监护人电话'),
    'guardian_relation': fields.String(description='监护关系'),
    'card_id': fields.String(description='饭卡号'),
    'current_score': fields.Float(description='当前积分')
})

rule_model = api.model('ScoreRule', {
    'id': fields.Integer(readOnly=True, description='规则ID'),
    'name': fields.String(required=True, description='规则名称'),
    'description': fields.String(description='规则描述'),
    'category_id': fields.Integer(description='分类ID'),
    'score': fields.Float(required=True, description='分数'),
    'is_active': fields.Boolean(description='是否启用'),
    'daily_limit': fields.Integer(description='每日上限'),
    'min_interval': fields.Integer(description='最小间隔(秒)')
})

record_model = api.model('ScoreRecord', {
    'id': fields.Integer(readOnly=True, description='记录ID'),
    'user_id': fields.Integer(required=True, description='学生ID'),
    'rule_id': fields.Integer(description='规则ID'),
    'score_change': fields.Float(required=True, description='积分变化'),
    'description': fields.String(description='操作说明'),
    'operator': fields.String(description='操作人'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间')
})

category_model = api.model('ScoreCategory', {
    'id': fields.Integer(readOnly=True, description='分类ID'),
    'name': fields.String(required=True, description='分类名称'),
    'description': fields.String(description='分类描述'),
    'is_active': fields.Boolean(description='是否启用'),
    'color': fields.String(description='颜色')
})

approval_model = api.model('Approval', {
    'id': fields.Integer(readOnly=True, description='审批ID'),
    'user_id': fields.Integer(required=True, description='学生ID'),
    'type': fields.String(required=True, description='审批类型'),
    'score_change': fields.Float(description='积分变化'),
    'reason': fields.String(description='申请理由'),
    'status': fields.String(readOnly=True, description='状态'),
    'operator': fields.String(description='操作人'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间')
})

notification_model = api.model('Notification', {
    'id': fields.Integer(readOnly=True, description='通知ID'),
    'user_id': fields.Integer(description='用户ID'),
    'title': fields.String(description='标题'),
    'content': fields.String(description='内容'),
    'type': fields.String(description='类型'),
    'status': fields.String(readOnly=True, description='状态'),
    'created_at': fields.DateTime(readOnly=True, description='创建时间')
})

admin_model = api.model('Admin', {
    'id': fields.Integer(readOnly=True, description='管理员ID'),
    'username': fields.String(required=True, description='用户名'),
    'password': fields.String(description='密码'),
    'role': fields.String(description='角色'),
    'real_name': fields.String(description='真实姓名'),
    'phone': fields.String(description='联系电话'),
    'class_name': fields.String(description='班级')
})

time_rule_model = api.model('TimeRule', {
    'id': fields.Integer(readOnly=True, description='规则ID'),
    'name': fields.String(required=True, description='规则名称'),
    'description': fields.String(description='规则描述'),
    'day_of_week': fields.Integer(description='星期(-1=每天, 0=周一~6=周日)'),
    'start_hour': fields.Integer(required=True, description='开始小时'),
    'start_minute': fields.Integer(required=True, description='开始分钟'),
    'end_hour': fields.Integer(required=True, description='结束小时'),
    'end_minute': fields.Integer(required=True, description='结束分钟'),
    'is_active': fields.Boolean(description='是否启用'),
    'allow_unlock': fields.Boolean(description='是否允许开锁')
})

def log_mqtt_message(client, topic, data, qos=1):
    try:
        with app.app_context():
            log = MQTTLog(
                topic=topic, 
                message=json.dumps(data), 
                direction='send',
                qos=qos
            )
            db.session.add(log)
            db.session.commit()
        
        mqtt_logs.append({
            'topic': topic,
            'message': json.dumps(data),
            'direction': 'send',
            'qos': qos,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"记录MQTT消息失败: {e}")

def log_operation_detail(operation_type, details, success=True):
    try:
        with app.app_context():
            log = OperationLog(
                operation_type=f'mqtt_{operation_type}',
                target_type='mqtt',
                description=details.get('message', ''),
                before_data=json.dumps(details.get('before', {})),
                after_data=json.dumps(details.get('after', {})),
                operator=details.get('operator', 'MQTT系统')
            )
            db.session.add(log)
            db.session.commit()
    except Exception as e:
        print(f"记录操作日志失败: {e}")

mqtt_client = None
mqtt_connected = False
subscribed_topics = [
    ('phonebox/status', 1),
    ('phonebox/log', 1), 
    ('phonebox/query', 1),
    ('phonebox/heartbeat', 1),
    ('score/add', 1),
    ('score/undo', 1),
    ('score/rules/query', 1)
]

def on_mqtt_connect(client, userdata, flags, rc):
    global mqtt_connected
    mqtt_connected = True
    print(f"MQTT连接成功, rc={rc}")
    for topic, qos in subscribed_topics:
        client.subscribe(topic, qos=qos)
    print(f"已订阅主题: {[t[0] for t in subscribed_topics]}")

def on_mqtt_disconnect(client, userdata, rc):
    global mqtt_connected
    mqtt_connected = False
    print(f"MQTT断开连接, rc={rc}")
    if rc != 0:
        print("MQTT意外断开，将在5秒后尝试重新连接...")
        import threading
        threading.Timer(5.0, reconnect_mqtt).start()

def on_mqtt_message(client, userdata, msg):
    message = msg.payload.decode()
    topic = msg.topic
    print(f"收到消息: {topic} -> {message}")
    
    with app.app_context():
        log = MQTTLog(topic=topic, message=message, direction='receive')
        db.session.add(log)
        db.session.commit()
    
    mqtt_logs.append({
        'topic': topic,
        'message': message,
        'direction': 'receive',
        'timestamp': datetime.now().isoformat()
    })
    
    if topic == 'phonebox/query':
        try:
            data = json.loads(message)
            box_id = data.get('box_id', 'A')
            card_id = data.get('card_id')
            hour = data.get('hour')
            minute = data.get('minute')
            
            print(f"收到查询请求: box_id={box_id}, card_id={card_id}, hour={hour}, minute={minute}")
            
            with app.app_context():
                if not check_time_valid(box_id, hour, minute):
                    print(f"时间验证失败，拒绝开锁")
                    publish_unlock_result(box_id, False, 'not_in_time')
                elif not card_id:
                    print(f"卡号为空")
                    publish_unlock_result(box_id, False, 'card_not_found')
                else:
                    user = User.query.filter_by(card_id=card_id).first()
                    if not user:
                        print(f"未找到用户: {card_id}")
                        publish_unlock_result(box_id, False, 'card_not_found')
                    elif user.current_score < 60:
                        print(f"积分不足: {user.name} ({user.current_score}分)")
                        publish_unlock_result(box_id, False, 'score_low', user.current_score)
                    else:
                        print(f"开锁成功: {user.name} ({user.current_score}分)")
                        publish_unlock_result(box_id, True, 'score_ok', user.current_score)
        except Exception as e:
            print(f"处理查询消息错误: {e}")
    elif topic == 'phonebox/heartbeat':
        try:
            data = json.loads(message)
            device_id = data.get('device_id')
            timestamp = data.get('timestamp')
            status = data.get('status')
            wifi_signal = data.get('wifi_signal')
            uptime = data.get('uptime')
            box_a_status = data.get('box_a_status')
            box_b_status = data.get('box_b_status')
            system_state = data.get('system_state')
            
            with app.app_context():
                heartbeat_record = DeviceHeartbeat(
                    device_id=device_id,
                    timestamp=timestamp,
                    status=status,
                    wifi_signal=wifi_signal,
                    uptime=uptime,
                    box_a_status=box_a_status,
                    box_b_status=box_b_status,
                    system_state=system_state
                )
                db.session.add(heartbeat_record)
                
                device = Device.query.filter_by(device_id=device_id).first()
                if device:
                    device.status = status
                    device.last_heartbeat = datetime.now()
                    device.wifi_signal = wifi_signal
                    device.uptime = uptime
                    device.box_a_status = box_a_status
                    device.box_b_status = box_b_status
                    device.system_state = system_state
                    device.updated_at = datetime.now()
                else:
                    device = Device(
                        device_id=device_id,
                        name=f'设备 {device_id}',
                        status=status,
                        last_heartbeat=datetime.now(),
                        wifi_signal=wifi_signal,
                        uptime=uptime,
                        box_a_status=box_a_status,
                        box_b_status=box_b_status,
                        system_state=system_state
                    )
                    db.session.add(device)
                
                db.session.commit()
                print(f"设备心跳更新成功: {device_id}")
        except Exception as e:
            print(f"处理心跳消息错误: {e}")
    elif topic == 'score/add':
        try:
            data = json.loads(message)
            msg_id = data.get('msg_id')
            client_id = data.get('client_id')
            user_id = data.get('user_id')
            rule_id = data.get('rule_id')
            rule_name = data.get('rule_name')
            score_change = data.get('score_change')
            description = data.get('description')
            operator = data.get('operator', 'MQTT系统')
            
            response_topic = f'score/add/result/{client_id}' if client_id else 'score/add/result'
            
            with app.app_context():
                if msg_id and ProcessedMessage.query.filter_by(message_id=msg_id).first():
                    record = ProcessedMessage.query.filter_by(message_id=msg_id).first()
                    response = {
                        'success': True, 
                        'message': '消息已处理（幂等）', 
                        'msg_id': msg_id,
                        'new_score': record.new_score,
                        'record_id': record.record_id
                    }
                    client.publish(response_topic, json.dumps(response), qos=1)
                    log_mqtt_message(client, response_topic, response, qos=1)
                    return
                
                user = User.query.get(user_id)
                if not user:
                    response = {'success': False, 'message': '用户不存在', 'msg_id': msg_id}
                    client.publish(response_topic, json.dumps(response), qos=1)
                    log_mqtt_message(client, response_topic, response, qos=1)
                    log_operation_detail('add', {
                        'success': False,
                        'message': '用户不存在',
                        'user_id': user_id,
                        'operator': operator
                    })
                else:
                    if rule_id:
                        rule = ScoreRule.query.get(rule_id)
                        if not rule or not rule.is_active:
                            response = {'success': False, 'message': '规则无效或未启用', 'msg_id': msg_id}
                            client.publish(response_topic, json.dumps(response), qos=1)
                            log_mqtt_message(client, response_topic, response, qos=1)
                        else:
                            limit_check = check_rule_limit(user_id, rule_id)
                            if not limit_check['allow']:
                                response = {'success': False, 'message': limit_check['message'], 'msg_id': msg_id}
                                client.publish(response_topic, json.dumps(response), qos=1)
                                log_mqtt_message(client, response_topic, response, qos=1)
                            else:
                                before_score = user.current_score
                                actual_change = rule.score
                                new_score = apply_score_limit(user.current_score + actual_change)
                                actual_change = new_score - user.current_score
                                
                                record = ScoreRecord(
                                    user_id=user_id,
                                    rule_id=rule_id,
                                    score_change=actual_change,
                                    description=description or rule.name,
                                    operator=operator
                                )
                                user.current_score = new_score
                                db.session.add(record)
                                db.session.commit()
                                
                                if msg_id:
                                    processed = ProcessedMessage(
                                        message_id=msg_id,
                                        record_id=record.id,
                                        new_score=new_score,
                                        client_id=client_id
                                    )
                                    db.session.add(processed)
                                    db.session.commit()
                                
                                response = {
                                    'success': True, 
                                    'message': f'加分成功: {rule.name} (+{actual_change}分)', 
                                    'msg_id': msg_id,
                                    'new_score': new_score,
                                    'record_id': record.id,
                                    'undo_code': f'UNDO_{record.id}'
                                }
                                client.publish(response_topic, json.dumps(response), qos=1)
                                log_mqtt_message(client, response_topic, response, qos=1)
                                log_operation_detail('add', {
                                    'success': True,
                                    'message': f'加分成功: {rule.name} (+{actual_change}分)',
                                    'before': {'score': before_score},
                                    'after': {'score': new_score},
                                    'user_id': user_id,
                                    'rule_name': rule.name,
                                    'operator': operator
                                })
                    elif rule_name:
                        rule = ScoreRule.query.filter(
                            ScoreRule.name.like(f'%{rule_name}%'),
                            ScoreRule.is_active == True
                        ).first()
                        if not rule:
                            matching_rules = ScoreRule.query.filter(
                                ScoreRule.name.like(f'%{rule_name}%')
                            ).all()
                            if matching_rules:
                                rule_names = [r.name for r in matching_rules]
                                response = {'success': False, 'message': f'未找到启用的规则 "{rule_name}"，可能需要启用: {rule_names}', 'msg_id': msg_id}
                            else:
                                response = {'success': False, 'message': f'未找到包含 "{rule_name}" 的规则', 'msg_id': msg_id}
                            client.publish(response_topic, json.dumps(response), qos=1)
                            log_mqtt_message(client, response_topic, response, qos=1)
                        else:
                            limit_check = check_rule_limit(user_id, rule.id)
                            if not limit_check['allow']:
                                response = {'success': False, 'message': limit_check['message'], 'msg_id': msg_id}
                                client.publish(response_topic, json.dumps(response), qos=1)
                                log_mqtt_message(client, response_topic, response, qos=1)
                            else:
                                before_score = user.current_score
                                actual_change = rule.score
                                new_score = apply_score_limit(user.current_score + actual_change)
                                actual_change = new_score - user.current_score
                                
                                record = ScoreRecord(
                                    user_id=user_id,
                                    rule_id=rule.id,
                                    score_change=actual_change,
                                    description=description or rule.name,
                                    operator=operator
                                )
                                user.current_score = new_score
                                db.session.add(record)
                                db.session.commit()
                                
                                if msg_id:
                                    processed = ProcessedMessage(
                                        message_id=msg_id,
                                        record_id=record.id,
                                        new_score=new_score,
                                        client_id=client_id
                                    )
                                    db.session.add(processed)
                                    db.session.commit()
                                
                                response = {
                                    'success': True, 
                                    'message': f'加分成功: {rule.name} (+{actual_change}分)', 
                                    'msg_id': msg_id,
                                    'new_score': new_score,
                                    'rule_name': rule.name,
                                    'record_id': record.id,
                                    'undo_code': f'UNDO_{record.id}'
                                }
                                client.publish(response_topic, json.dumps(response), qos=1)
                                log_mqtt_message(client, response_topic, response, qos=1)
                                log_operation_detail('add', {
                                    'success': True,
                                    'message': f'加分成功: {rule.name} (+{actual_change}分)',
                                    'before': {'score': before_score},
                                    'after': {'score': new_score},
                                    'user_id': user_id,
                                    'rule_name': rule.name,
                                    'operator': operator
                                })
                    elif score_change is not None:
                        before_score = user.current_score
                        actual_change = int(score_change)
                        new_score = apply_score_limit(user.current_score + actual_change)
                        actual_change = new_score - user.current_score
                        
                        record = ScoreRecord(
                            user_id=user_id,
                            score_change=actual_change,
                            description=description or 'MQTT积分调整',
                            operator=operator
                        )
                        user.current_score = new_score
                        db.session.add(record)
                        db.session.commit()
                        
                        if msg_id:
                            processed = ProcessedMessage(
                                message_id=msg_id,
                                record_id=record.id,
                                new_score=new_score,
                                client_id=client_id
                            )
                            db.session.add(processed)
                            db.session.commit()
                        
                        response = {
                            'success': True, 
                            'message': f'积分调整成功 ({actual_change:+d}分)', 
                            'msg_id': msg_id,
                            'new_score': new_score,
                            'record_id': record.id,
                            'undo_code': f'UNDO_{record.id}'
                        }
                        client.publish(response_topic, json.dumps(response), qos=1)
                        log_mqtt_message(client, response_topic, response, qos=1)
                        log_operation_detail('add', {
                            'success': True,
                            'message': f'积分调整成功 ({actual_change:+d}分)',
                            'before': {'score': before_score},
                            'after': {'score': new_score},
                            'user_id': user_id,
                            'score_change': actual_change,
                            'operator': operator
                        })
                    else:
                        response = {'success': False, 'message': '需要提供 rule_id、rule_name 或 score_change', 'msg_id': msg_id}
                        client.publish(response_topic, json.dumps(response), qos=1)
                        log_mqtt_message(client, response_topic, response, qos=1)
        except Exception as e:
            print(f"处理加分消息错误: {e}")
            error_response = {'success': False, 'message': f'处理失败: {str(e)}'}
            try:
                client.publish(response_topic, json.dumps(error_response), qos=1)
                log_mqtt_message(client, response_topic, error_response, qos=1)
            except:
                pass
    
    elif topic == 'score/undo':
        try:
            data = json.loads(message)
            undo_code = data.get('undo_code')
            client_id = data.get('client_id')
            reason = data.get('reason', 'MQTT撤销')
            
            response_topic = f'score/undo/result/{client_id}' if client_id else 'score/undo/result'
            
            if not undo_code or not undo_code.startswith('UNDO_'):
                response = {'success': False, 'message': '无效的撤销代码'}
                client.publish(response_topic, json.dumps(response), qos=1)
                log_mqtt_message(client, response_topic, response, qos=1)
                return
            
            record_id = int(undo_code.replace('UNDO_', ''))
            
            with app.app_context():
                record = ScoreRecord.query.get(record_id)
                if not record:
                    response = {'success': False, 'message': f'找不到记录 ID: {record_id}'}
                elif '已撤销' in (record.description or ''):
                    response = {'success': False, 'message': '该记录已被撤销'}
                else:
                    before_score = User.query.get(record.user_id).current_score
                    user = User.query.get(record.user_id)
                    user.current_score -= record.score_change
                    user.current_score = max(0, user.current_score)
                    
                    record.description = f'{record.description} [已撤销: {reason}]'
                    record.operator = 'MQTT撤销'
                    db.session.commit()
                    
                    response = {
                        'success': True, 
                        'message': f'撤销成功 ({record.score_change:+d}分已回滚)', 
                        'user_id': user.id,
                        'new_score': user.current_score
                    }
                    log_operation_detail('undo', {
                        'success': True,
                        'message': f'撤销成功 ({record.score_change:+d}分已回滚)',
                        'before': {'score': before_score},
                        'after': {'score': user.current_score},
                        'record_id': record_id,
                        'undo_code': undo_code,
                        'operator': operator
                    })
                
                client.publish(response_topic, json.dumps(response), qos=1)
                log_mqtt_message(client, response_topic, response, qos=1)
        except Exception as e:
            print(f"处理撤销消息错误: {e}")
            error_response = {'success': False, 'message': f'撤销失败: {str(e)}'}
            try:
                client.publish(response_topic, json.dumps(error_response), qos=1)
                log_mqtt_message(client, response_topic, error_response, qos=1)
            except:
                pass
    
    elif topic == 'score/rules/query':
        try:
            data = json.loads(message)
            category = data.get('category')
            search = data.get('search')
            client_id = data.get('client_id')
            
            response_topic = f'score/rules/result/{client_id}' if client_id else 'score/rules/result'
            
            with app.app_context():
                query = ScoreRule.query.filter(ScoreRule.is_active == True)
                
                if category:
                    cat = ScoreCategory.query.filter(ScoreCategory.name.like(f'%{category}%')).first()
                    if cat:
                        query = query.filter(ScoreRule.category_id == cat.id)
                
                if search:
                    query = query.filter(ScoreRule.name.like(f'%{search}%'))
                
                rules = query.all()
                
                rules_data = []
                for rule in rules:
                    cat_name = ''
                    if rule.category_id:
                        cat = ScoreCategory.query.get(rule.category_id)
                        if cat:
                            cat_name = cat.name
                    
                    rules_data.append({
                        'id': rule.id,
                        'name': rule.name,
                        'score': rule.score,
                        'category': cat_name,
                        'description': rule.description
                    })
                
                response = {'success': True, 'rules': rules_data}
                
                client.publish(response_topic, json.dumps(response), qos=1)
                log_mqtt_message(client, response_topic, response, qos=1)
                log_operation_detail('query', {
                    'success': True,
                    'message': f'查询到 {len(rules_data)} 条规则',
                    'query': {'category': category, 'search': search},
                    'result_count': len(rules_data),
                    'operator': 'MQTT系统'
                })
        except Exception as e:
            print(f"处理规则查询错误: {e}")
            error_response = {'success': False, 'message': f'查询失败: {str(e)}'}
            try:
                client.publish(response_topic, json.dumps(error_response), qos=1)
                log_mqtt_message(client, response_topic, error_response, qos=1)
            except:
                pass

def start_mqtt_client():
    global mqtt_client
    with app.app_context():
        config = MQTTConfig.query.first()
        if not config:
            config = MQTTConfig()
            db.session.add(config)
            db.session.commit()
    
    client_id = f"{config.client_id}_{int(datetime.now().timestamp())}"
    mqtt_client = mqtt.Client(client_id=client_id, clean_session=True)
    mqtt_client.username_pw_set(config.username, config.password)
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_disconnect = on_mqtt_disconnect
    mqtt_client.on_message = on_mqtt_message
    mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)
    
    try:
        if config.ssl:
            import ssl
            mqtt_client.tls_set(
                cert_reqs=ssl.CERT_NONE,
                tls_version=ssl.PROTOCOL_TLSv1_2
            )
            mqtt_client.tls_insecure_set(True)
        mqtt_client.connect(config.broker, config.port, config.keepalive)
        mqtt_client.loop_start()
        print(f"MQTT客户端启动成功，client_id: {client_id}")
    except Exception as e:
        print(f"MQTT连接失败: {e}")

def reconnect_mqtt():
    global mqtt_client, mqtt_connected
    if mqtt_client:
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except:
            pass
    
    with app.app_context():
        config = MQTTConfig.query.first()
        if not config:
            config = MQTTConfig()
            db.session.add(config)
            db.session.commit()
    
    client_id = f"{config.client_id}_{int(datetime.now().timestamp())}"
    mqtt_client = mqtt.Client(client_id=client_id, clean_session=True)
    mqtt_client.username_pw_set(config.username, config.password)
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_disconnect = on_mqtt_disconnect
    mqtt_client.on_message = on_mqtt_message
    mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)
    
    try:
        if config.ssl:
            import ssl
            mqtt_client.tls_set(
                cert_reqs=ssl.CERT_NONE,
                tls_version=ssl.PROTOCOL_TLSv1_2
            )
            mqtt_client.tls_insecure_set(True)
        mqtt_client.connect(config.broker, config.port, config.keepalive)
        mqtt_client.loop_start()
        print(f"MQTT重新连接成功，client_id: {client_id}")
    except Exception as e:
        print(f"MQTT重新连接失败: {e}")

@ns_users.route('/')
class UserList(Resource):
    @ns_users.doc('list_users', description='获取学生列表（支持分页，根据权限过滤）')
    def get(self):
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        class_name = request.args.get('class_name', '')
        
        # 获取当前登录管理员
        admin = get_current_admin()
        
        query = User.query
        
        # 根据权限过滤班级（超级管理员可以看到所有班级）
        allowed_classes = None
        if admin and admin.role != 'admin':
            allowed_classes = get_allowed_classes(admin.id)
        
        if allowed_classes is not None:
            if not allowed_classes:
                query = query.filter(False)
            else:
                query = query.filter(User.class_name.in_(allowed_classes))
        
        if search:
            query = query.filter(
                db.or_(
                    User.name.like(f'%{search}%'),
                    User.card_id.like(f'%{search}%'),
                    User.phone.like(f'%{search}%')
                )
            )
        
        if class_name:
            # 检查请求的班级是否在允许范围内
            if allowed_classes is not None and class_name not in allowed_classes:
                query = query.filter(False)
            else:
                query = query.filter(User.class_name == class_name)
        
        total = query.count()
        users = query.order_by(User.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return {
            'users': [{
                'id': u.id,
                'name': u.name,
                'gender': u.gender,
                'class_name': u.class_name,
                'phone': u.phone,
                'parent_info': u.parent_info,
                'father_name': u.father_name,
                'father_phone': u.father_phone,
                'mother_name': u.mother_name,
                'mother_phone': u.mother_phone,
                'guardian_name': u.guardian_name,
                'guardian_phone': u.guardian_phone,
                'guardian_relation': u.guardian_relation,
                'card_id': u.card_id,
                'current_score': u.current_score,
                'created_at': u.created_at.isoformat()
            } for u in users.items],
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': users.pages
        }

    @ns_users.doc('create_user', description='创建新学生')
    @ns_users.expect(user_model)
    def post(self):
        data = api.payload
        if User.query.filter_by(card_id=data.get('card_id')).first():
            return {'error': '饭卡号已存在'}, 400
        
        user = User(
            name=data['name'],
            gender=data.get('gender'),
            class_name=data.get('class_name'),
            phone=data.get('phone'),
            parent_info=data.get('parent_info'),
            father_name=data.get('father_name'),
            father_phone=data.get('father_phone'),
            mother_name=data.get('mother_name'),
            mother_phone=data.get('mother_phone'),
            guardian_name=data.get('guardian_name'),
            guardian_phone=data.get('guardian_phone'),
            guardian_relation=data.get('guardian_relation'),
            card_id=data.get('card_id'),
            current_score=data.get('current_score', 0)
        )
        db.session.add(user)
        db.session.commit()
        return {'id': user.id, 'message': '创建成功'}, 201

@app.route('/api/users/<int:id>', methods=['GET'])
def get_user(id):
    user = User.query.get_or_404(id)
    
    # 权限检查
    admin = get_current_admin()
    if admin:
        allowed_classes = get_allowed_classes(admin.id)
        if allowed_classes is not None and user.class_name not in allowed_classes:
            return jsonify({'error': '无权访问此学生信息'}), 403
    
    records = ScoreRecord.query.filter_by(user_id=id).order_by(ScoreRecord.created_at.desc()).all()
    return jsonify({
        'id': user.id,
        'name': user.name,
        'gender': user.gender,
        'class_name': user.class_name,
        'phone': user.phone,
        'parent_info': user.parent_info,
        'father_name': user.father_name,
        'father_phone': user.father_phone,
        'mother_name': user.mother_name,
        'mother_phone': user.mother_phone,
        'guardian_name': user.guardian_name,
        'guardian_phone': user.guardian_phone,
        'guardian_relation': user.guardian_relation,
        'card_id': user.card_id,
        'current_score': user.current_score,
        'created_at': user.created_at.isoformat(),
        'records': [{
            'id': r.id,
            'score_change': r.score_change,
            'description': r.description,
            'operator': r.operator,
            'created_at': r.created_at.isoformat()
        } for r in records]
    })

@app.route('/api/users/<int:id>', methods=['PUT'])
def update_user(id):
    user = User.query.get_or_404(id)
    data = request.json
    if 'card_id' in data and data['card_id'] != user.card_id:
        if User.query.filter_by(card_id=data['card_id']).first():
            return jsonify({'error': '饭卡号已存在'}), 400
        user.card_id = data['card_id']
    
    # 更新基本信息
    user.name = data.get('name', user.name)
    user.gender = data.get('gender', user.gender)
    user.class_name = data.get('class_name', user.class_name)
    user.phone = data.get('phone', user.phone)
    user.parent_info = data.get('parent_info', user.parent_info)
    user.father_name = data.get('father_name', user.father_name)
    user.father_phone = data.get('father_phone', user.father_phone)
    user.mother_name = data.get('mother_name', user.mother_name)
    user.mother_phone = data.get('mother_phone', user.mother_phone)
    user.guardian_name = data.get('guardian_name', user.guardian_name)
    user.guardian_phone = data.get('guardian_phone', user.guardian_phone)
    user.guardian_relation = data.get('guardian_relation', user.guardian_relation)
    
    # 更新积分
    if 'current_score' in data:
        new_score = int(data['current_score'])
        if new_score != user.current_score:
            score_change = new_score - user.current_score
            user.current_score = new_score
            # 记录积分变动
            record = ScoreRecord(
                user_id=user.id,
                score_change=score_change,
                description='管理员修改初始积分',
                operator='系统'
            )
            db.session.add(record)
    
    user.updated_at = datetime.now()
    db.session.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    user = User.query.get_or_404(id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': '删除成功'})

@app.route('/api/users/import', methods=['POST'])
def import_users():
    data = request.json
    
    if not data or 'users' not in data:
        return jsonify({'error': '请求数据格式错误'}), 400
    
    users_data = data.get('users', [])
    
    if not isinstance(users_data, list) or len(users_data) == 0:
        return jsonify({'error': '没有找到用户数据'}), 400
    
    imported = 0
    updated = 0
    errors = []
    
    for idx, item in enumerate(users_data):
        try:
            card_id = item.get('card_id', '').strip()
            row_number = item.get('rowNumber', idx + 2)
            
            if not card_id:
                errors.append(f'第{row_number}行：缺少饭卡号')
                continue
                
            existing = User.query.filter_by(card_id=card_id).first()
            
            name = item.get('name', '').strip()
            if not name:
                errors.append(f'第{row_number}行：缺少姓名')
                continue
                
            gender = item.get('gender', '').strip()
            class_name = item.get('class_name', '').strip()
            phone = item.get('phone', '').strip()
            parent_info = item.get('parent_info', '').strip()
            father_name = item.get('father_name', '').strip()
            father_phone = item.get('father_phone', '').strip()
            mother_name = item.get('mother_name', '').strip()
            mother_phone = item.get('mother_phone', '').strip()
            guardian_name = item.get('guardian_name', '').strip()
            guardian_phone = item.get('guardian_phone', '').strip()
            guardian_relation = item.get('guardian_relation', '').strip()
            
            current_score = item.get('current_score', '0').strip()
            try:
                current_score = int(current_score)
            except ValueError:
                current_score = 0
            
            if existing:
                existing.name = name if name else existing.name
                existing.gender = gender if gender else existing.gender
                existing.class_name = class_name if class_name else existing.class_name
                existing.phone = phone if phone else existing.phone
                existing.parent_info = parent_info if parent_info else existing.parent_info
                existing.father_name = father_name if father_name else existing.father_name
                existing.father_phone = father_phone if father_phone else existing.father_phone
                existing.mother_name = mother_name if mother_name else existing.mother_name
                existing.mother_phone = mother_phone if mother_phone else existing.mother_phone
                existing.guardian_name = guardian_name if guardian_name else existing.guardian_name
                existing.guardian_phone = guardian_phone if guardian_phone else existing.guardian_phone
                existing.guardian_relation = guardian_relation if guardian_relation else existing.guardian_relation
                existing.current_score = current_score
                existing.updated_at = datetime.now()
                updated += 1
            else:
                user = User(
                    name=name,
                    gender=gender,
                    class_name=class_name,
                    phone=phone,
                    parent_info=parent_info,
                    father_name=father_name,
                    father_phone=father_phone,
                    mother_name=mother_name,
                    mother_phone=mother_phone,
                    guardian_name=guardian_name,
                    guardian_phone=guardian_phone,
                    guardian_relation=guardian_relation,
                    card_id=card_id,
                    current_score=current_score
                )
                db.session.add(user)
                imported += 1
        except Exception as e:
            row_number = item.get('rowNumber', idx + 2)
            errors.append(f'第{row_number}行：{str(e)}')
    
    db.session.commit()
    
    message = f'成功导入{imported}条，更新{updated}条'
    if errors:
        message += f'，{len(errors)}条错误'
    
    return jsonify({
        'imported': imported,
        'updated': updated,
        'errors': errors,
        'message': message
    })

def detect_encoding(content_bytes):
    encodings = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'gb18030']
    
    for encoding in encodings:
        try:
            content = content_bytes.decode(encoding)
            return content, encoding
        except UnicodeDecodeError:
            continue
    
    return None, None

@app.route('/api/users/import-file', methods=['POST'])
def import_users_file():
    if 'file' not in request.files:
        return jsonify({'error': '请选择文件'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': '请选择文件'}), 400
    
    if not file.filename.lower().endswith('.csv'):
        return jsonify({'error': '请选择CSV格式的文件'}), 400
    
    imported = 0
    updated = 0
    errors = []
    
    try:
        import csv
        
        content_bytes = file.read()
        content, encoding = detect_encoding(content_bytes)
        
        if content is None:
            return jsonify({'error': '无法识别文件编码，请使用UTF-8或GBK编码保存文件'}), 400
        
        lines = content.split('\n')
        
        if len(lines) == 0:
            return jsonify({'error': '文件为空'}), 400
        
        reader = csv.reader(lines)
        rows = list(reader)
        
        if len(rows) < 2:
            return jsonify({'error': '文件没有数据'}), 400
        
        headers = [h.strip() for h in rows[0]]
        
        mapping = {
            '姓名': 'name',
            '性别': 'gender',
            '班级': 'class_name',
            '电话': 'phone',
            '家长信息': 'parent_info',
            '父亲姓名': 'father_name',
            '父亲电话': 'father_phone',
            '母亲姓名': 'mother_name',
            '母亲电话': 'mother_phone',
            '监护人姓名': 'guardian_name',
            '监护人电话': 'guardian_phone',
            '监护关系': 'guardian_relation',
            '饭卡号': 'card_id',
            '初始积分': 'current_score'
        }
        
        for row_idx, row in enumerate(rows[1:], start=2):
            try:
                user_data = {}
                for idx, header in enumerate(headers):
                    field_name = mapping.get(header)
                    if field_name and idx < len(row):
                        user_data[field_name] = row[idx].strip() if row[idx] else ''
                
                card_id = user_data.get('card_id', '').strip()
                if not card_id:
                    errors.append(f'第{row_idx}行：缺少饭卡号')
                    continue
                
                name = user_data.get('name', '').strip()
                if not name:
                    errors.append(f'第{row_idx}行：缺少姓名')
                    continue
                
                gender = user_data.get('gender', '').strip()
                class_name = user_data.get('class_name', '').strip()
                phone = user_data.get('phone', '').strip()
                parent_info = user_data.get('parent_info', '').strip()
                father_name = user_data.get('father_name', '').strip()
                father_phone = user_data.get('father_phone', '').strip()
                mother_name = user_data.get('mother_name', '').strip()
                mother_phone = user_data.get('mother_phone', '').strip()
                guardian_name = user_data.get('guardian_name', '').strip()
                guardian_phone = user_data.get('guardian_phone', '').strip()
                guardian_relation = user_data.get('guardian_relation', '').strip()
                
                current_score = user_data.get('current_score', '0').strip()
                try:
                    current_score = int(current_score)
                except ValueError:
                    current_score = 0
                
                existing = User.query.filter_by(card_id=card_id).first()
                
                if existing:
                    existing.name = name if name else existing.name
                    existing.gender = gender if gender else existing.gender
                    existing.class_name = class_name if class_name else existing.class_name
                    existing.phone = phone if phone else existing.phone
                    existing.parent_info = parent_info if parent_info else existing.parent_info
                    existing.father_name = father_name if father_name else existing.father_name
                    existing.father_phone = father_phone if father_phone else existing.father_phone
                    existing.mother_name = mother_name if mother_name else existing.mother_name
                    existing.mother_phone = mother_phone if mother_phone else existing.mother_phone
                    existing.guardian_name = guardian_name if guardian_name else existing.guardian_name
                    existing.guardian_phone = guardian_phone if guardian_phone else existing.guardian_phone
                    existing.guardian_relation = guardian_relation if guardian_relation else existing.guardian_relation
                    existing.current_score = current_score
                    existing.updated_at = datetime.now()
                    updated += 1
                else:
                    user = User(
                        name=name,
                        gender=gender,
                        class_name=class_name,
                        phone=phone,
                        parent_info=parent_info,
                        father_name=father_name,
                        father_phone=father_phone,
                        mother_name=mother_name,
                        mother_phone=mother_phone,
                        guardian_name=guardian_name,
                        guardian_phone=guardian_phone,
                        guardian_relation=guardian_relation,
                        card_id=card_id,
                        current_score=current_score
                    )
                    db.session.add(user)
                    imported += 1
            except Exception as e:
                errors.append(f'第{row_idx}行：{str(e)}')
        
        db.session.commit()
        
        message = f'成功导入{imported}条，更新{updated}条'
        if errors:
            message += f'，{len(errors)}条错误'
        
        return jsonify({
            'imported': imported,
            'updated': updated,
            'errors': errors,
            'message': message
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'文件处理失败: {str(e)}'}), 500

@app.route('/api/users/batch-delete', methods=['POST'])
def batch_delete_users():
    data = request.json
    ids = data.get('ids', [])
    
    if not ids:
        return jsonify({'error': '请选择要删除的学生'}), 400
    
    deleted = 0
    for user_id in ids:
        user = User.query.get(user_id)
        if user:
            db.session.delete(user)
            deleted += 1
    
    db.session.commit()
    return jsonify({'deleted': deleted, 'message': f'成功删除{deleted}条记录'})

@app.route('/api/users/batch-score', methods=['POST'])
def batch_update_score():
    data = request.json
    ids = data.get('ids', [])
    score_change = int(data.get('score_change', 0))
    description = data.get('description', '批量调整')
    
    if not ids:
        return jsonify({'error': '请选择要调整的学生'}), 400
    
    try:
        updated = 0
        for user_id in ids:
            user = User.query.get(user_id)
            if user:
                new_score = apply_score_limit(user.current_score + score_change)
                actual_change = new_score - user.current_score
                user.current_score = new_score
                record = ScoreRecord(
                    user_id=user_id,
                    score_change=actual_change,
                    description=description,
                    operator='管理员'
                )
                db.session.add(record)
                updated += 1
        
        db.session.commit()
        return jsonify({'updated': updated, 'message': f'成功调整{updated}条记录的积分'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': '操作失败: ' + str(e)}), 500

@app.route('/api/users/template/download', methods=['GET'])
def download_user_template():
    import csv
    from io import StringIO
    from flask import Response
    
    template = [
        ['姓名', '性别', '班级', '电话', '父亲姓名', '父亲电话', '母亲姓名', '母亲电话', '监护人姓名', '监护人电话', '监护关系', '饭卡号', '初始积分'],
        ['张三', '男', '高三(1)班', '13800138001', '张伟', '13900139001', '李华', '13900139002', '', '', '', 'STU101', '60'],
        ['李小红', '女', '高三(1)班', '13800138002', '李明', '13900139003', '王芳', '13900139004', '', '', '', 'STU102', '60'],
    ]
    
    output = StringIO()
    writer = csv.writer(output)
    for row in template:
        writer.writerow(row)
    
    output.seek(0)
    content = '\ufeff' + output.getvalue()
    
    import urllib.parse
    filename = urllib.parse.quote('学生导入模板.csv')
    response = Response(
        content,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"; filename*=UTF-8''"{filename}"'
        }
    )
    return response

@app.route('/api/users/by-card/<card_id>', methods=['GET'])
def get_user_by_card(card_id):
    user = User.query.filter_by(card_id=card_id).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    return jsonify({
        'id': user.id,
        'name': user.name,
        'card_id': user.card_id,
        'current_score': user.current_score
    })

@app.route('/api/categories', methods=['GET'])
def get_categories():
    categories = ScoreCategory.query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'description': c.description,
        'color': c.color,
        'is_active': c.is_active,
        'created_at': c.created_at.isoformat()
    } for c in categories])

@app.route('/api/categories', methods=['POST'])
def create_category():
    data = request.json
    if ScoreCategory.query.filter_by(name=data['name']).first():
        return jsonify({'error': '分类已存在'}), 400
    
    category = ScoreCategory(
        name=data['name'],
        description=data.get('description'),
        color=data.get('color', '#3B82F6'),
        is_active=data.get('is_active', True)
    )
    db.session.add(category)
    db.session.commit()
    return jsonify({'id': category.id, 'message': '创建成功'}), 201

@app.route('/api/categories/<int:id>', methods=['PUT'])
def update_category(id):
    category = ScoreCategory.query.get_or_404(id)
    data = request.json
    if 'name' in data and data['name'] != category.name:
        if ScoreCategory.query.filter_by(name=data['name']).first():
            return jsonify({'error': '分类已存在'}), 400
        category.name = data['name']
    
    category.description = data.get('description', category.description)
    category.color = data.get('color', category.color)
    category.is_active = data.get('is_active', category.is_active)
    db.session.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/categories/<int:id>', methods=['DELETE'])
def delete_category(id):
    category = ScoreCategory.query.get_or_404(id)
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': '删除成功'})

@app.route('/api/rules', methods=['GET'])
def get_rules():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    category_id = request.args.get('category_id', type=int)
    is_active = request.args.get('is_active')
    
    query = ScoreRule.query
    
    if category_id:
        query = query.filter_by(category_id=category_id)
    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == 'true')
    
    total = query.count()
    rules = query.order_by(ScoreRule.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'rules': [{
            'id': r.id,
            'name': r.name,
            'description': r.description,
            'category_id': r.category_id,
            'category_name': r.category.name if r.category else None,
            'score': r.score,
            'is_active': r.is_active,
            'daily_limit': r.daily_limit,
            'min_interval': r.min_interval,
            'start_time': r.start_time.isoformat() if r.start_time else None,
            'end_time': r.end_time.isoformat() if r.end_time else None,
            'created_at': r.created_at.isoformat()
        } for r in rules.items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': rules.pages
    })

@app.route('/api/rules', methods=['POST'])
def create_rule():
    data = request.json
    rule = ScoreRule(
        name=data['name'],
        description=data.get('description'),
        category_id=data.get('category_id'),
        score=data['score'],
        is_active=data.get('is_active', True),
        daily_limit=data.get('daily_limit', 0),
        min_interval=data.get('min_interval', 0),
        start_time=datetime.fromisoformat(data['start_time']) if data.get('start_time') else None,
        end_time=datetime.fromisoformat(data['end_time']) if data.get('end_time') else None
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify({'id': rule.id, 'message': '创建成功'}), 201

@app.route('/api/rules/<int:id>', methods=['PUT'])
def update_rule(id):
    rule = ScoreRule.query.get_or_404(id)
    data = request.json
    rule.name = data.get('name', rule.name)
    rule.description = data.get('description', rule.description)
    rule.category_id = data.get('category_id', rule.category_id)
    rule.score = data.get('score', rule.score)
    rule.is_active = data.get('is_active', rule.is_active)
    rule.daily_limit = data.get('daily_limit', rule.daily_limit)
    rule.min_interval = data.get('min_interval', rule.min_interval)
    if 'start_time' in data:
        rule.start_time = datetime.fromisoformat(data['start_time']) if data['start_time'] else None
    if 'end_time' in data:
        rule.end_time = datetime.fromisoformat(data['end_time']) if data['end_time'] else None
    rule.updated_at = datetime.now()
    db.session.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/rules/<int:id>', methods=['DELETE'])
def delete_rule(id):
    rule = ScoreRule.query.get_or_404(id)
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'message': '删除成功'})

@app.route('/api/rules/import', methods=['POST'])
def import_rules():
    data = request.json
    imported = 0
    updated = 0
    errors = []
    
    for idx, item in enumerate(data.get('rules', [])):
        try:
            name = item.get('name')
            if not name:
                errors.append(f'第{idx+1}行：缺少规则名称')
                continue
            
            category_id = None
            category_name = item.get('category_name')
            if category_name:
                category = ScoreCategory.query.filter_by(name=category_name).first()
                if category:
                    category_id = category.id
                else:
                    category = ScoreCategory(name=category_name)
                    db.session.add(category)
                    db.session.flush()
                    category_id = category.id
            elif 'category_id' in item:
                category_id = int(item['category_id'])
            
            existing = ScoreRule.query.filter_by(name=name).first()
            if existing:
                existing.description = item.get('description', existing.description)
                existing.category_id = category_id if category_id else existing.category_id
                existing.score = int(item.get('score', existing.score))
                existing.is_active = item.get('is_active', existing.is_active)
                existing.daily_limit = int(item.get('daily_limit', existing.daily_limit))
                existing.min_interval = int(item.get('min_interval', existing.min_interval))
                updated += 1
            else:
                rule = ScoreRule(
                    name=name,
                    description=item.get('description', ''),
                    category_id=category_id,
                    score=int(item.get('score', 0)),
                    is_active=item.get('is_active', True),
                    daily_limit=int(item.get('daily_limit', 0)),
                    min_interval=int(item.get('min_interval', 0))
                )
                db.session.add(rule)
                imported += 1
        except Exception as e:
            errors.append(f'第{idx+1}行：{str(e)}')
    
    db.session.commit()
    
    return jsonify({
        'imported': imported,
        'updated': updated,
        'errors': errors,
        'message': f'成功导入{imported}条，更新{updated}条' + (f'，{len(errors)}条错误' if errors else '')
    })

@app.route('/api/rules/template/download', methods=['GET'])
def download_rule_template():
    import csv
    from io import StringIO
    from flask import Response
    
    template = [
        ['规则名称', '描述', '分类名称', '分数', '是否启用', '每日上限', '最小间隔(秒)'],
        ['按时完成作业', '学生按时完成作业获得积分', '学习表现', '10', '是', '3', '30'],
        ['课堂积极发言', '课堂上积极回答问题', '学习表现', '5', '是', '5', '60'],
        ['迟到早退', '迟到或早退扣分', '纪律表现', '-5', '是', '3', '0'],
        ['卫生检查优秀', '教室卫生检查获得优秀', '日常表现', '15', '是', '1', '86400'],
    ]
    
    output = StringIO()
    writer = csv.writer(output)
    for row in template:
        writer.writerow(row)
    
    output.seek(0)
    content = '\ufeff' + output.getvalue()
    
    import urllib.parse
    filename = urllib.parse.quote('积分规则导入模板.csv')
    response = Response(
        content,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"; filename*=UTF-8''"{filename}"'
        }
    )
    return response

@app.route('/api/rules/export', methods=['GET'])
def export_rules():
    rules = ScoreRule.query.all()
    data = [{
        'id': r.id,
        'name': r.name,
        'description': r.description,
        'category_id': r.category_id,
        'score': r.score,
        'is_active': r.is_active,
        'start_time': r.start_time.isoformat() if r.start_time else None,
        'end_time': r.end_time.isoformat() if r.end_time else None
    } for r in rules]
    return jsonify({'data': data, 'count': len(data)})

@app.route('/api/rank-rules', methods=['GET'])
def get_rank_rules():
    rules = ScoreRankRule.query.order_by(ScoreRankRule.min_score).all()
    return jsonify([{
        'id': r.id,
        'name': r.name,
        'min_score': r.min_score,
        'max_score': r.max_score,
        'color': r.color,
        'icon': r.icon,
        'description': r.description,
        'is_active': r.is_active,
        'created_at': r.created_at.isoformat()
    } for r in rules])

@app.route('/api/rank-rules', methods=['POST'])
def create_rank_rule():
    data = request.json
    rule = ScoreRankRule(
        name=data['name'],
        min_score=data['min_score'],
        max_score=data.get('max_score'),
        color=data.get('color', '#0ea5e9'),
        icon=data.get('icon', 'Award'),
        description=data.get('description'),
        is_active=data.get('is_active', True)
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify({'id': rule.id, 'message': '创建成功'}), 201

@app.route('/api/rank-rules/<int:id>', methods=['PUT'])
def update_rank_rule(id):
    rule = ScoreRankRule.query.get_or_404(id)
    data = request.json
    rule.name = data.get('name', rule.name)
    rule.min_score = data.get('min_score', rule.min_score)
    rule.max_score = data.get('max_score', rule.max_score)
    rule.color = data.get('color', rule.color)
    rule.icon = data.get('icon', rule.icon)
    rule.description = data.get('description', rule.description)
    rule.is_active = data.get('is_active', rule.is_active)
    rule.updated_at = datetime.now()
    db.session.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/rank-rules/<int:id>', methods=['DELETE'])
def delete_rank_rule(id):
    rule = ScoreRankRule.query.get_or_404(id)
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'message': '删除成功'})

@app.route('/api/rank-rules/get-rank/<int:score>', methods=['GET'])
def get_rank_by_score(score):
    rules = ScoreRankRule.query.filter(ScoreRankRule.is_active == True).order_by(ScoreRankRule.min_score).all()
    for rule in rules:
        if rule.max_score is None:
            if score >= rule.min_score:
                return jsonify({
                    'name': rule.name,
                    'color': rule.color,
                    'icon': rule.icon,
                    'min_score': rule.min_score,
                    'max_score': rule.max_score
                })
        else:
            if score >= rule.min_score and score <= rule.max_score:
                return jsonify({
                    'name': rule.name,
                    'color': rule.color,
                    'icon': rule.icon,
                    'min_score': rule.min_score,
                    'max_score': rule.max_score
                })
    return jsonify({'name': '未知', 'color': '#64748b', 'icon': 'HelpCircle', 'min_score': 0, 'max_score': None})

def apply_score_limit(score):
    MIN_SCORE = 0
    MAX_SCORE = 100
    return max(MIN_SCORE, min(score, MAX_SCORE))

def log_operation(operation_type, target_type=None, target_id=None, description=None, before_data=None, after_data=None, operator='system'):
    try:
        log = OperationLog(
            operation_type=operation_type,
            target_type=target_type,
            target_id=target_id,
            description=description,
            before_data=json.dumps(before_data) if before_data else None,
            after_data=json.dumps(after_data) if after_data else None,
            operator=operator
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f'Failed to log operation: {e}')

def check_rule_limit(user_id, rule_id):
    if not rule_id:
        return {'allow': True, 'message': ''}
    
    rule = ScoreRule.query.get(rule_id)
    if not rule:
        return {'allow': True, 'message': ''}
    
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_count = ScoreRecord.query.filter(
        ScoreRecord.user_id == user_id,
        ScoreRecord.rule_id == rule_id,
        ScoreRecord.created_at >= today_start
    ).count()
    
    if rule.daily_limit > 0 and today_count >= rule.daily_limit:
        return {'allow': False, 'message': f'今日已达到上限({rule.daily_limit}次)'}
    
    last_record = ScoreRecord.query.filter(
        ScoreRecord.user_id == user_id,
        ScoreRecord.rule_id == rule_id
    ).order_by(ScoreRecord.created_at.desc()).first()
    
    if rule.min_interval > 0 and last_record:
        time_diff = (now - last_record.created_at).total_seconds()
        if time_diff < rule.min_interval:
            return {'allow': False, 'message': f'操作过于频繁，请等待{rule.min_interval}秒'}
    
    return {'allow': True, 'message': ''}

@ns_records.route('/')
class RecordList(Resource):
    @ns_records.doc('add_record', description='添加积分记录')
    @ns_records.expect(record_model)
    def post(self):
        data = api.payload
        user = User.query.get_or_404(data['user_id'])
        
        rule_id = data.get('rule_id')
        limit_check = check_rule_limit(data['user_id'], rule_id)
        if not limit_check['allow']:
            return {'error': limit_check['message']}, 400
        
        if rule_id:
            rule = ScoreRule.query.get(rule_id)
            if not rule or not rule.is_active:
                return {'error': '规则无效或未启用'}, 400
            score_change = rule.score
        else:
            score_change = float(data.get('score_change', 0))
        
        new_score = apply_score_limit(user.current_score + score_change)
        actual_change = new_score - user.current_score
        
        try:
            record = ScoreRecord(
                user_id=data['user_id'],
                rule_id=rule_id,
                score_change=actual_change,
                description=data.get('description'),
                operator=data.get('operator', 'system')
            )
            
            user.current_score = new_score
            db.session.add(record)
            db.session.commit()
            
            message = '操作成功'
            if actual_change != score_change:
                message += f'（积分已达{"上限" if score_change > 0 else "下限"}，实际调整{actual_change}分）'
            
            return {
                'id': record.id, 
                'current_score': user.current_score, 
                'actual_change': actual_change,
                'message': message
            }
        except Exception as e:
            db.session.rollback()
            return {'error': '操作失败: ' + str(e)}, 500

@app.route('/api/operation-logs', methods=['GET'])
def get_operation_logs():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    operation_type = request.args.get('type')
    target_type = request.args.get('target_type')
    operator = request.args.get('operator')
    
    query = OperationLog.query.order_by(OperationLog.created_at.desc())
    
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    if target_type:
        query = query.filter(OperationLog.target_type == target_type)
    if operator:
        query = query.filter(OperationLog.operator.ilike(f'%{operator}%'))
    
    total = query.count()
    logs = query.offset((page - 1) * per_page).limit(per_page).all()
    
    return jsonify({
        'data': [{
            'id': log.id,
            'operation_type': log.operation_type,
            'target_type': log.target_type,
            'target_id': log.target_id,
            'operator': log.operator,
            'description': log.description,
            'created_at': log.created_at.isoformat()
        } for log in logs],
        'total': total,
        'page': page,
        'per_page': per_page
    })

@app.route('/api/analysis/user/<int:user_id>', methods=['GET'])
def get_user_analysis(user_id):
    records = ScoreRecord.query.filter_by(user_id=user_id).order_by(ScoreRecord.created_at).all()
    trend = []
    current = 0
    for r in records:
        current += r.score_change
        trend.append({
            'date': r.created_at.strftime('%Y-%m-%d'),
            'score': current
        })
    return jsonify({'trend': trend, 'total_records': len(records)})

@app.route('/api/records', methods=['GET'])
def get_records():
    user_id = request.args.get('user_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    rule_id = request.args.get('rule_id', type=int)
    score_type = request.args.get('score_type')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    query = ScoreRecord.query
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    if rule_id:
        query = query.filter_by(rule_id=rule_id)
    if score_type == 'positive':
        query = query.filter(ScoreRecord.score_change > 0)
    elif score_type == 'negative':
        query = query.filter(ScoreRecord.score_change < 0)
    if start_date:
        query = query.filter(ScoreRecord.created_at >= start_date)
    if end_date:
        query = query.filter(ScoreRecord.created_at <= end_date)
    
    total = query.count()
    records = query.order_by(ScoreRecord.created_at.desc()).offset((page-1)*per_page).limit(per_page).all()
    
    result = []
    for record in records:
        user = User.query.get(record.user_id)
        rule = ScoreRule.query.get(record.rule_id) if record.rule_id else None
        result.append({
            'id': record.id,
            'user_id': record.user_id,
            'user_name': user.name if user else '',
            'user_class': user.class_name if user else '',
            'rule_id': record.rule_id,
            'rule_name': rule.name if rule else '',
            'score_change': record.score_change,
            'description': record.description,
            'operator': record.operator,
            'created_at': record.created_at.isoformat()
        })
    
    return jsonify({
        'records': result,
        'total': total,
        'page': page,
        'per_page': per_page
    })

@app.route('/api/records/statistics', methods=['GET'])
def get_record_statistics():
    user_id = request.args.get('user_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = ScoreRecord.query
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    if start_date:
        query = query.filter(ScoreRecord.created_at >= start_date)
    if end_date:
        query = query.filter(ScoreRecord.created_at <= end_date)
    
    records = query.all()
    
    total_add = sum(r.score_change for r in records if r.score_change > 0)
    total_sub = sum(r.score_change for r in records if r.score_change < 0)
    total_count = len(records)
    
    return jsonify({
        'total_add': total_add,
        'total_sub': total_sub,
        'total_count': total_count,
        'date_range': {
            'start': start_date,
            'end': end_date
        }
    })

@app.route('/api/records/user/<int:user_id>', methods=['GET'])
def get_user_records(user_id):
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    query = ScoreRecord.query.filter_by(user_id=user_id)
    
    total = query.count()
    records = query.order_by(ScoreRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    result = []
    for record in records.items:
        rule = ScoreRule.query.get(record.rule_id) if record.rule_id else None
        result.append({
            'id': record.id,
            'rule_name': rule.name if rule else '',
            'score_change': record.score_change,
            'description': record.description,
            'operator': record.operator,
            'created_at': record.created_at.isoformat()
        })
    
    return jsonify({
        'records': result, 
        'user_id': user_id,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': records.pages
    })

@app.route('/api/analysis/class/<class_name>', methods=['GET'])
def get_class_analysis(class_name):
    users = User.query.filter_by(class_name=class_name).all()
    result = []
    for u in users:
        result.append({
            'name': u.name,
            'card_id': u.card_id,
            'current_score': u.current_score
        })
    return jsonify({'class_name': class_name, 'students': result, 'count': len(result)})

@app.route('/api/box/verify', methods=['POST'])
def verify_box_access():
    data = request.json
    card_id = data.get('card_id')
    box_id = data.get('box_id', 'B')
    
    user = User.query.filter_by(card_id=card_id).first()
    if not user:
        return jsonify({'result': 'false', 'reason': 'user_not_found', 'current_score': 0})
    
    if user.current_score < 60:
        return jsonify({'result': 'false', 'reason': 'score_low', 'current_score': user.current_score})
    
    return jsonify({'result': 'true', 'reason': 'score_ok', 'current_score': user.current_score, 'user_name': user.name})

@app.route('/api/mqtt/config', methods=['GET'])
def get_mqtt_config():
    config = MQTTConfig.query.first()
    if not config:
        config = MQTTConfig()
        db.session.add(config)
        db.session.commit()
    return jsonify({
        'broker': config.broker,
        'port': config.port,
        'client_id': config.client_id,
        'username': config.username,
        'password': config.password,
        'ssl': config.ssl,
        'timeout': config.timeout,
        'keepalive': config.keepalive
    })

@app.route('/api/mqtt/config', methods=['PUT'])
def update_mqtt_config():
    config = MQTTConfig.query.first()
    if not config:
        config = MQTTConfig()
        db.session.add(config)
    
    data = request.json
    config.broker = data.get('broker', config.broker)
    config.port = data.get('port', config.port)
    config.client_id = data.get('client_id', config.client_id)
    config.username = data.get('username', config.username)
    config.password = data.get('password', config.password)
    config.ssl = data.get('ssl', config.ssl)
    config.timeout = data.get('timeout', config.timeout)
    config.keepalive = data.get('keepalive', config.keepalive)
    config.updated_at = datetime.now()
    db.session.commit()
    return jsonify({'message': '配置已更新'})

@app.route('/api/mqtt/status', methods=['GET'])
def get_mqtt_status():
    return jsonify({
        'connected': mqtt_connected,
        'subscribed_topics': subscribed_topics
    })

@app.route('/api/mqtt/connect', methods=['POST'])
def mqtt_connect_api():
    global mqtt_client, mqtt_connected
    try:
        if mqtt_client and mqtt_connected:
            return jsonify({'message': '已连接'})
        
        with app.app_context():
            config = MQTTConfig.query.first()
            if not config:
                config = MQTTConfig()
                db.session.add(config)
                db.session.commit()
        
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        
        client_id = f"{config.client_id}_{int(datetime.now().timestamp())}"
        mqtt_client = mqtt.Client(client_id=client_id, clean_session=True)
        mqtt_client.username_pw_set(config.username, config.password)
        mqtt_client.on_connect = on_mqtt_connect
        mqtt_client.on_disconnect = on_mqtt_disconnect
        mqtt_client.on_message = on_mqtt_message
        mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)
        
        if config.ssl:
            import ssl
            mqtt_client.tls_set(
                cert_reqs=ssl.CERT_NONE,
                tls_version=ssl.PROTOCOL_TLSv1_2
            )
            mqtt_client.tls_insecure_set(True)
        
        mqtt_client.connect(config.broker, config.port, config.keepalive)
        mqtt_client.loop_start()
        return jsonify({'message': '连接请求已发送', 'client_id': client_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mqtt/disconnect', methods=['POST'])
def mqtt_disconnect_api():
    global mqtt_client, mqtt_connected
    try:
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
            mqtt_connected = False
            return jsonify({'message': '已断开连接'})
        return jsonify({'message': '未连接'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mqtt/publish', methods=['POST'])
def mqtt_publish():
    global mqtt_client
    data = request.json
    topic = data.get('topic')
    message = data.get('message', '')
    qos = data.get('qos', 0)
    
    if not mqtt_client or not mqtt_connected:
        return jsonify({'error': 'MQTT未连接'}), 503
    
    mqtt_client.publish(topic, message, qos=qos)
    
    with app.app_context():
        log = MQTTLog(topic=topic, message=message, direction='send')
        db.session.add(log)
        db.session.commit()
    
    mqtt_logs.append({
        'topic': topic,
        'message': message,
        'direction': 'send',
        'timestamp': datetime.now().isoformat()
    })
    
    return jsonify({'message': '消息已发布'})

@app.route('/api/mqtt/subscribe', methods=['POST'])
def mqtt_subscribe():
    global mqtt_client, subscribed_topics
    data = request.json
    topic = data.get('topic')
    qos = data.get('qos', 0)
    
    if not mqtt_client or not mqtt_connected:
        return jsonify({'error': 'MQTT未连接'}), 503
    
    if topic not in subscribed_topics:
        subscribed_topics.append(topic)
        mqtt_client.subscribe(topic, qos=qos)
    
    return jsonify({'message': '订阅成功', 'topic': topic, 'subscribed_topics': subscribed_topics})

@app.route('/api/mqtt/unsubscribe', methods=['POST'])
def mqtt_unsubscribe():
    global mqtt_client, subscribed_topics
    data = request.json
    topic = data.get('topic')
    
    if not mqtt_client or not mqtt_connected:
        return jsonify({'error': 'MQTT未连接'}), 503
    
    if topic in subscribed_topics:
        subscribed_topics.remove(topic)
        mqtt_client.unsubscribe(topic)
    
    return jsonify({'message': '取消订阅成功', 'topic': topic, 'subscribed_topics': subscribed_topics})

@app.route('/api/mqtt/logs', methods=['GET'])
def get_mqtt_logs():
    limit = request.args.get('limit', 100)
    logs = MQTTLog.query.order_by(MQTTLog.timestamp.desc()).limit(limit).all()
    return jsonify([{
        'id': l.id,
        'topic': l.topic,
        'message': l.message,
        'direction': l.direction,
        'timestamp': l.timestamp.isoformat()
    } for l in logs])

@app.route('/api/mqtt/unlock', methods=['POST'])
def mqtt_unlock():
    global mqtt_client
    data = request.json
    box_id = data.get('box_id', 'A')
    
    if not mqtt_client or not mqtt_connected:
        return jsonify({'error': 'MQTT未连接'}), 503
    
    response = data.get('response', {'result': 'true', 'reason': 'score_ok', 'current_score': 85})
    mqtt_client.publish(f'phonebox/unlock/{box_id}', json.dumps(response))
    
    with app.app_context():
        message = json.dumps(response)
        log = MQTTLog(topic=f'phonebox/unlock/{box_id}', message=message, direction='send')
        db.session.add(log)
        db.session.commit()
    
    return jsonify({'message': f'{box_id}箱解锁指令已发送'})

@app.route('/api/system/backup', methods=['POST'])
def backup_database():
    try:
        app_dir = os.path.dirname(os.path.abspath(__file__))
        instance_dir = os.path.join(app_dir, 'instance')
        db_path = os.path.join(instance_dir, 'score_management.db')
        
        backup_dir = os.path.join(app_dir, 'backups')
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'score_management_backup_{timestamp}.db'
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(db_path, backup_path)
        
        backup_size = os.path.getsize(backup_path)
        
        cleanup_old_backups(backup_dir, keep_count=10)
        
        return jsonify({
            'message': '数据库备份成功',
            'filename': backup_filename,
            'path': backup_path,
            'timestamp': timestamp,
            'size': backup_size,
            'size_human': format_size(backup_size)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def cleanup_old_backups(backup_dir, keep_count=10):
    try:
        files = [f for f in os.listdir(backup_dir) if f.endswith('.db')]
        if len(files) <= keep_count:
            return
        
        files.sort(key=lambda x: os.path.getmtime(os.path.join(backup_dir, x)))
        
        files_to_delete = files[:-keep_count]
        for f in files_to_delete:
            os.remove(os.path.join(backup_dir, f))
    except Exception as e:
        print(f'清理旧备份失败: {e}')

def format_size(bytes):
    if bytes < 1024:
        return f'{bytes} B'
    elif bytes < 1024 * 1024:
        return f'{bytes / 1024:.2f} KB'
    else:
        return f'{bytes / (1024 * 1024):.2f} MB'

@app.route('/api/system/backup/download/<filename>', methods=['GET'])
def download_backup(filename):
    try:
        backup_path = os.path.join('backups', filename)
        if os.path.exists(backup_path):
            return send_file(backup_path, as_attachment=True)
        else:
            return jsonify({'error': '备份文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/restore', methods=['POST'])
def restore_database():
    try:
        app_dir = os.path.dirname(os.path.abspath(__file__))
        instance_dir = os.path.join(app_dir, 'instance')
        db_path = os.path.join(instance_dir, 'score_management.db')
        
        data = request.json
        backup_filename = data.get('filename')
        
        if not backup_filename:
            return jsonify({'error': '请提供备份文件名'}), 400
        
        backup_dir = os.path.join(app_dir, 'backups')
        backup_path = os.path.join(backup_dir, backup_filename)
        
        if not os.path.exists(backup_path):
            return jsonify({'error': '备份文件不存在'}), 404
        
        if not backup_filename.endswith('.db'):
            return jsonify({'error': '无效的备份文件格式'}), 400
        
        if '..' in backup_filename or '/' in backup_filename or '\\' in backup_filename:
            return jsonify({'error': '非法的文件路径'}), 400
        
        backup_size = os.path.getsize(backup_path)
        if backup_size < 100:
            return jsonify({'error': '备份文件太小，可能已损坏'}), 400
        
        shutil.copy2(db_path, db_path + '.bak')
        
        shutil.copy2(backup_path, db_path)
        
        return jsonify({
            'message': '数据恢复成功', 
            'filename': backup_filename,
            'backup_size': backup_size,
            'backup_size_human': format_size(backup_size)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/backups', methods=['GET'])
def list_backups():
    try:
        app_dir = os.path.dirname(os.path.abspath(__file__))
        backup_dir = os.path.join(app_dir, 'backups')
        
        if not os.path.exists(backup_dir):
            return jsonify([])
        
        files = [f for f in os.listdir(backup_dir) if f.endswith('.db')]
        files.sort(reverse=True)
        
        backups = []
        for f in files:
            filepath = os.path.join(backup_dir, f)
            stats = os.stat(filepath)
            backups.append({
                'filename': f,
                'size': stats.st_size,
                'modified': datetime.fromtimestamp(stats.st_mtime).isoformat()
            })
        
        return jsonify(backups)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/clear-cache', methods=['POST'])
def clear_cache():
    try:
        global mqtt_logs
        mqtt_logs = []
        
        mqtt_logs_dir = 'mqtt_logs'
        if os.path.exists(mqtt_logs_dir):
            shutil.rmtree(mqtt_logs_dir)
        
        return jsonify({'message': '缓存清理成功'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

mqtt_logs = []

with app.app_context():
    db.create_all()
    
    # 创建默认管理员
    if not Admin.query.filter_by(username='admin').first():
        default_admin = Admin(
            username='admin',
            password='admin123',
            role='admin',
            real_name='系统管理员',
            phone='13800138000'
        )
        db.session.add(default_admin)
        db.session.commit()
    
    # 创建数据大屏专用用户
    if not Admin.query.filter_by(username='dashboard').first():
        dashboard_user = Admin(
            username='dashboard',
            password='dashboard123',
            role='dashboard',
            real_name='大屏展示用户',
            phone='13800138001'
        )
        db.session.add(dashboard_user)
        db.session.commit()
    
    if not ScoreRankRule.query.first():
        default_rules = [
            {'name': '重生点', 'min_score': 0, 'max_score': 9, 'color': '#6b7280', 'icon': 'RotateCcw', 'description': '所有权益保留，停课半天改为在班主任办公室自习并完成行为复盘表'},
            {'name': '护航区', 'min_score': 10, 'max_score': 19, 'color': '#8b5cf6', 'icon': 'Shield', 'description': '所有权益保留，领航者志愿者担任成长伙伴'},
            {'name': '重启预备', 'min_score': 20, 'max_score': 29, 'color': '#ef4444', 'icon': 'AlertTriangle', 'description': '所有权益保留，手机每日两次抽查'},
            {'name': '限行观察区', 'min_score': 30, 'max_score': 39, 'color': '#f97316', 'icon': 'Eye', 'description': '所有权益保留，启动《三方提醒协议》'},
            {'name': '深观察区', 'min_score': 40, 'max_score': 49, 'color': '#f59e0b', 'icon': 'Search', 'description': '权益不变，作业班主任亲自逐题复查'},
            {'name': '浅观察区', 'min_score': 50, 'max_score': 59, 'color': '#eab308', 'icon': 'Monitor', 'description': '权益不变，作业每科课代表逐题检查签名'},
            {'name': '安全基准', 'min_score': 60, 'max_score': 64, 'color': '#22c55e', 'icon': 'CheckCircle', 'description': '基础权益，班主任口头提醒'},
            {'name': '稳定区', 'min_score': 65, 'max_score': 74, 'color': '#10b981', 'icon': 'TrendingUp', 'description': '基础权益'},
            {'name': '进取者', 'min_score': 75, 'max_score': 84, 'color': '#06b6d4', 'icon': 'Rocket', 'description': '每月一次课间自由选座，减免一项周末简单作业'},
            {'name': '自律星', 'min_score': 85, 'max_score': 94, 'color': '#3b82f6', 'icon': 'Star', 'description': '每两周一次免交手机日，晚自习戴单耳耳机'},
            {'name': '领航者', 'min_score': 95, 'max_score': 100, 'color': '#a855f7', 'icon': 'Crown', 'description': '周末提前30分钟取回手机，免一次大扫除'}
        ]
        for rule in default_rules:
            db.session.add(ScoreRankRule(**rule))
        db.session.commit()
    
    if not User.query.filter_by(card_id='STU001').first():
        test_users = [
            {'name': '张小明', 'gender': '男', 'class_name': '高三(1)班', 'phone': '13800138001', 'parent_info': '父亲: 张伟 13900139001', 'card_id': 'STU001', 'current_score': 85},
            {'name': '李小红', 'gender': '女', 'class_name': '高三(1)班', 'phone': '13800138002', 'parent_info': '母亲: 李华 13900139002', 'card_id': 'STU002', 'current_score': 45},
            {'name': '王小强', 'gender': '男', 'class_name': '高三(2)班', 'phone': '13800138003', 'parent_info': '父亲: 王刚 13900139003', 'card_id': 'STU003', 'current_score': 95},
            {'name': '赵小美', 'gender': '女', 'class_name': '高三(2)班', 'phone': '13800138004', 'parent_info': '母亲: 赵芳 13900139004', 'card_id': 'STU004', 'current_score': 72},
            {'name': '陈小龙', 'gender': '男', 'class_name': '高三(3)班', 'phone': '13800138005', 'parent_info': '父亲: 陈伟 13900139005', 'card_id': 'STU005', 'current_score': 68},
        ]
        for user in test_users:
            db.session.add(User(**user))
        db.session.commit()
    
    if not MQTTConfig.query.first():
        config = MQTTConfig()
        db.session.add(config)
        db.session.commit()
    
    if not ScoreCategory.query.first():
        categories = [
            {'name': '课堂纪律类', 'description': '课堂表现相关的积分规则'},
            {'name': '学业完成类', 'description': '作业和考试相关的积分规则'},
            {'name': '违纪行为类', 'description': '违纪行为相关的扣分规则'},
            {'name': '住宿专项', 'description': '住宿生相关的积分规则'},
            {'name': '课外活动与技能竞赛类', 'description': '课外活动和技能比赛相关的积分规则'},
            {'name': '特殊奖励', 'description': '班主任特殊奖励相关的积分规则'}
        ]
        for cat in categories:
            db.session.add(ScoreCategory(**cat))
        db.session.commit()
    
    if not TimeRule.query.first():
        time_rules = [
            {'name': '上午上课', 'description': '上午上课期间禁止取手机', 'day_of_week': -1, 'start_hour': 8, 'start_minute': 0, 'end_hour': 12, 'end_minute': 0, 'is_active': True, 'allow_unlock': False},
            {'name': '午休', 'description': '午休期间禁止取手机', 'day_of_week': -1, 'start_hour': 12, 'start_minute': 0, 'end_hour': 14, 'end_minute': 30, 'is_active': True, 'allow_unlock': False},
            {'name': '下午上课', 'description': '下午上课期间禁止取手机', 'day_of_week': -1, 'start_hour': 14, 'start_minute': 30, 'end_hour': 18, 'end_minute': 0, 'is_active': True, 'allow_unlock': False},
            {'name': '晚自习', 'description': '晚自习期间禁止取手机', 'day_of_week': -1, 'start_hour': 19, 'start_minute': 0, 'end_hour': 21, 'end_minute': 30, 'is_active': True, 'allow_unlock': False}
        ]
        for rule in time_rules:
            db.session.add(TimeRule(**rule))
        db.session.commit()

    if not ScoreRule.query.first():
        rules = [
            {'name': '主动回答问题', 'description': '老师认可的主动回答问题', 'category_name': '课堂纪律类', 'score': 0.5, 'is_active': True, 'daily_limit': 4, 'min_interval': 30},
            {'name': '被老师点名表扬', 'description': '课堂上被老师点名表扬', 'category_name': '课堂纪律类', 'score': 1, 'is_active': True, 'daily_limit': 0, 'min_interval': 60},
            {'name': '完整记录课堂笔记', 'description': '每周抽查2次，完整记录课堂笔记', 'category_name': '课堂纪律类', 'score': 1, 'is_active': True, 'daily_limit': 2, 'min_interval': 86400},
            {'name': '帮助同学讲题', 'description': '帮助同学讲题并被证实', 'category_name': '课堂纪律类', 'score': 1, 'is_active': True, 'daily_limit': 2, 'min_interval': 600},
            {'name': '上课趴桌睡觉', 'description': '提醒后仍睡', 'category_name': '课堂纪律类', 'score': -2, 'is_active': True, 'daily_limit': 6, 'min_interval': 300},
            {'name': '上课讲话影响课堂', 'description': '上课讲话或接话茬影响课堂纪律', 'category_name': '课堂纪律类', 'score': -1, 'is_active': True, 'daily_limit': 0, 'min_interval': 300},
            {'name': '上课玩手机', 'description': '上课期间玩手机', 'category_name': '课堂纪律类', 'score': -5, 'is_active': True, 'daily_limit': 0, 'min_interval': 3600},
            {'name': '上课吃零食', 'description': '上课吃零食（水除外）', 'category_name': '课堂纪律类', 'score': -2, 'is_active': True, 'daily_limit': 0, 'min_interval': 600},
            {'name': '未经允许换座位', 'description': '未经老师允许擅自换座位', 'category_name': '课堂纪律类', 'score': -3, 'is_active': True, 'daily_limit': 0, 'min_interval': 300},
            {'name': '上课上厕所超15分钟', 'description': '上课期间上厕所超过15分钟', 'category_name': '课堂纪律类', 'score': -2, 'is_active': True, 'daily_limit': 0, 'min_interval': 300},
            {'name': '实训课未穿工装', 'description': '实训课未穿工装或未戴防护用品', 'category_name': '课堂纪律类', 'score': -3, 'is_active': True, 'daily_limit': 0, 'min_interval': 300},
            {'name': '作业获优秀', 'description': '作业获得A等级', 'category_name': '学业完成类', 'score': 1, 'is_active': True, 'daily_limit': 4, 'min_interval': 0},
            {'name': '作业获模范', 'description': '作业获得A+或被评为模范作业', 'category_name': '学业完成类', 'score': 2, 'is_active': True, 'daily_limit': 4, 'min_interval': 0},
            {'name': '连续一周按时交作业', 'description': '连续一周全科按时交作业', 'category_name': '学业完成类', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '主动找老师批改订正', 'description': '主动找老师批改订正后的作业', 'category_name': '学业完成类', 'score': 0.5, 'is_active': True, 'daily_limit': 1, 'min_interval': 7200},
            {'name': '缺交作业', 'description': '缺交作业', 'category_name': '学业完成类', 'score': -3, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '作业抄袭', 'description': '作业抄袭', 'category_name': '学业完成类', 'score': -5, 'is_active': True, 'daily_limit': 0, 'min_interval': 3600},
            {'name': '作业敷衍', 'description': '作业敷衍或乱写', 'category_name': '学业完成类', 'score': -2, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '班级排名进步5名以上', 'description': '月考期中期末班级排名进步≥5名', 'category_name': '学业完成类', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '班级排名进步10名以上', 'description': '月考期中期末班级排名进步≥10名', 'category_name': '学业完成类', 'score': 5, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '单科全班第一', 'description': '月考期中期末单科全班第一', 'category_name': '学业完成类', 'score': 2, 'is_active': True, 'daily_limit': 0, 'min_interval': 604800},
            {'name': '及格', 'description': '相比上次不及格本次及格', 'category_name': '学业完成类', 'score': 2, 'is_active': True, 'daily_limit': 0, 'min_interval': 604800},
            {'name': '成绩退步10名以上', 'description': '月考期中期末成绩退步≥10名', 'category_name': '学业完成类', 'score': -4, 'is_active': True, 'daily_limit': 0, 'min_interval': 604800},
            {'name': '考试作弊', 'description': '考试作弊', 'category_name': '学业完成类', 'score': -20, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '迟到', 'description': '上课铃响后迟到', 'category_name': '违纪行为类', 'score': -2, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '旷课1节', 'description': '旷课1节课', 'category_name': '违纪行为类', 'score': -5, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '旷课累计2节以上', 'description': '旷课累计≥2节', 'category_name': '违纪行为类', 'score': -10, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '吸烟首次', 'description': '首次吸烟或使用电子烟', 'category_name': '违纪行为类', 'score': -10, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '吸烟第二次', 'description': '第二次吸烟或使用电子烟', 'category_name': '违纪行为类', 'score': -20, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '携带违禁品', 'description': '携带刀具火机酒等违禁品', 'category_name': '违纪行为类', 'score': -10, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '顶撞老师', 'description': '顶撞老师教官宿管', 'category_name': '违纪行为类', 'score': -10, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '打架斗殴', 'description': '打架斗殴', 'category_name': '违纪行为类', 'score': -20, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '校园欺凌', 'description': '参与校园欺凌', 'category_name': '违纪行为类', 'score': -15, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '故意损坏公物', 'description': '故意损坏公物', 'category_name': '违纪行为类', 'score': -10, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '撒谎伪造假条', 'description': '撒谎或伪造假条', 'category_name': '违纪行为类', 'score': -15, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '晚自习擅自离开', 'description': '晚自习擅自离开教室', 'category_name': '违纪行为类', 'score': -5, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '集合缺勤', 'description': '集合升旗晨跑缺勤', 'category_name': '违纪行为类', 'score': -3, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '内务检查满分', 'description': '个人内务检查满分', 'category_name': '住宿专项', 'score': 1, 'is_active': True, 'daily_limit': 1, 'min_interval': 86400},
            {'name': '文明寝室', 'description': '宿舍获文明寝室称号', 'category_name': '住宿专项', 'score': 1, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '连续3天按时熄灯', 'description': '连续3天按时熄灯不说话', 'category_name': '住宿专项', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '帮助生病室友', 'description': '主动帮助生病室友并被证实', 'category_name': '住宿专项', 'score': 1, 'is_active': True, 'daily_limit': 2, 'min_interval': 1800},
            {'name': '早操全勤规范', 'description': '早操全勤且动作规范', 'category_name': '住宿专项', 'score': 0.5, 'is_active': True, 'daily_limit': 1, 'min_interval': 86400},
            {'name': '内务不整', 'description': '被子未叠或宿舍乱', 'category_name': '住宿专项', 'score': -2, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '熄灯后讲话', 'description': '熄灯后讲话被提醒后仍讲', 'category_name': '住宿专项', 'score': -2, 'is_active': True, 'daily_limit': 0, 'min_interval': 300},
            {'name': '夜点名迟到', 'description': '夜点名迟到', 'category_name': '住宿专项', 'score': -3, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '窜寝带危险品', 'description': '窜寝或携带危险品', 'category_name': '住宿专项', 'score': -5, 'is_active': True, 'daily_limit': 0, 'min_interval': 0},
            {'name': '晚自习玩手机', 'description': '晚自习期间玩手机', 'category_name': '住宿专项', 'score': -5, 'is_active': True, 'daily_limit': 0, 'min_interval': 3600},
            {'name': '就寝后擅自离开', 'description': '就寝后擅自离开宿舍楼', 'category_name': '住宿专项', 'score': -10, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '宿舍内打架欺凌', 'description': '宿舍内打架或欺凌', 'category_name': '住宿专项', 'score': -20, 'is_active': True, 'daily_limit': 0, 'min_interval': 86400},
            {'name': '参加课外活动', 'description': '参加班级校级课外活动', 'category_name': '课外活动与技能竞赛类', 'score': 1, 'is_active': True, 'daily_limit': 3, 'min_interval': 86400},
            {'name': '参加社团活动', 'description': '主动参加学校社团活动', 'category_name': '课外活动与技能竞赛类', 'score': 0.5, 'is_active': True, 'daily_limit': 2, 'min_interval': 1800},
            {'name': '实训室加练', 'description': '课余时间到实训室加练≥30分钟', 'category_name': '课外活动与技能竞赛类', 'score': 1, 'is_active': True, 'daily_limit': 3, 'min_interval': 3600},
            {'name': '完成技能作品', 'description': '完成一项技能作品并拍照存档', 'category_name': '课外活动与技能竞赛类', 'score': 1, 'is_active': True, 'daily_limit': 3, 'min_interval': 86400},
            {'name': '参加校级技能比赛', 'description': '报名并参加校级技能比赛', 'category_name': '课外活动与技能竞赛类', 'score': 1, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '校级技能比赛一等奖', 'description': '校级技能比赛获得一等奖', 'category_name': '课外活动与技能竞赛类', 'score': 5, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '校级技能比赛二等奖', 'description': '校级技能比赛获得二等奖', 'category_name': '课外活动与技能竞赛类', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '校级技能比赛三等奖', 'description': '校级技能比赛获得三等奖', 'category_name': '课外活动与技能竞赛类', 'score': 2, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '代表学校参加市级比赛', 'description': '代表学校参加市级及以上比赛', 'category_name': '课外活动与技能竞赛类', 'score': 2, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '市级比赛一等奖', 'description': '市级比赛获得一等奖', 'category_name': '课外活动与技能竞赛类', 'score': 8, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '市级比赛二等奖', 'description': '市级比赛获得二等奖', 'category_name': '课外活动与技能竞赛类', 'score': 5, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '市级比赛三等奖', 'description': '市级比赛获得三等奖', 'category_name': '课外活动与技能竞赛类', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '省级比赛一等奖', 'description': '省级比赛获得一等奖', 'category_name': '课外活动与技能竞赛类', 'score': 12, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '省级比赛二等奖', 'description': '省级比赛获得二等奖', 'category_name': '课外活动与技能竞赛类', 'score': 8, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '省级比赛三等奖', 'description': '省级比赛获得三等奖', 'category_name': '课外活动与技能竞赛类', 'score': 5, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '国家级比赛一等奖', 'description': '国家级比赛获得一等奖', 'category_name': '课外活动与技能竞赛类', 'score': 20, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '国家级比赛二等奖', 'description': '国家级比赛获得二等奖', 'category_name': '课外活动与技能竞赛类', 'score': 15, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '国家级比赛三等奖', 'description': '国家级比赛获得三等奖', 'category_name': '课外活动与技能竞赛类', 'score': 10, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '获得初级工证书', 'description': '获得初级工技能等级证书', 'category_name': '课外活动与技能竞赛类', 'score': 5, 'is_active': True, 'daily_limit': 1, 'min_interval': 2592000},
            {'name': '获得中级工证书', 'description': '获得中级工技能等级证书', 'category_name': '课外活动与技能竞赛类', 'score': 10, 'is_active': True, 'daily_limit': 1, 'min_interval': 2592000},
            {'name': '技能成果展示', 'description': '在班级学校展示技能成果', 'category_name': '课外活动与技能竞赛类', 'score': 2, 'is_active': True, 'daily_limit': 2, 'min_interval': 604800},
            {'name': '指导同学技能训练', 'description': '指导同学技能训练并帮助其进步', 'category_name': '课外活动与技能竞赛类', 'score': 1, 'is_active': True, 'daily_limit': 2, 'min_interval': 1800},
            {'name': '金点子奖', 'description': '班级管理建议被采纳', 'category_name': '特殊奖励', 'score': 2, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '好人好事', 'description': '拾金不昧或助人等好人好事', 'category_name': '特殊奖励', 'score': 1, 'is_active': True, 'daily_limit': 3, 'min_interval': 0},
            {'name': '小小讲师', 'description': '上台讲题作为小小讲师', 'category_name': '特殊奖励', 'score': 2, 'is_active': True, 'daily_limit': 2, 'min_interval': 1800},
            {'name': '全勤之星', 'description': '一周全勤获得全勤之星', 'category_name': '特殊奖励', 'score': 2, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '进步最快奖', 'description': '班主任提名的进步最快奖', 'category_name': '特殊奖励', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '帮带成功', 'description': '帮带低分生使其回升20分', 'category_name': '特殊奖励', 'score': 3, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '技能之星周', 'description': '获得技能之星（周）', 'category_name': '特殊奖励', 'score': 2, 'is_active': True, 'daily_limit': 1, 'min_interval': 604800},
            {'name': '技能之星月', 'description': '获得技能之星（月）', 'category_name': '特殊奖励', 'score': 5, 'is_active': True, 'daily_limit': 1, 'min_interval': 2592000}
        ]
        for rule_data in rules:
            category = ScoreCategory.query.filter_by(name=rule_data['category_name']).first()
            if category:
                rule = ScoreRule(
                    name=rule_data['name'],
                    description=rule_data['description'],
                    category_id=category.id,
                    score=rule_data['score'],
                    is_active=rule_data['is_active'],
                    daily_limit=rule_data['daily_limit'],
                    min_interval=rule_data['min_interval']
                )
                db.session.add(rule)
        db.session.commit()

def send_notification(user_id, score_change, description):
    user = User.query.get(user_id)
    if not user:
        return
    
    phone = user.father_phone or user.mother_phone or user.guardian_phone
    if not phone:
        return
    
    content = f"【积分变动通知】{user.name}同学的积分发生变动：{score_change:+d}分，当前积分：{user.current_score}分。{description}"
    
    notification = Notification(
        user_id=user_id,
        type='score_change',
        title='积分变动通知',
        content=content,
        phone=phone
    )
    db.session.add(notification)
    db.session.commit()
    
    send_sms(phone, content)

def send_sms(phone, content):
    pass

def send_wechat(openid, content):
    pass

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    user_id = request.args.get('user_id', type=int)
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    query = Notification.query
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    if status:
        query = query.filter_by(status=status)
    
    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).offset((page-1)*per_page).limit(per_page).all()
    
    return jsonify({
        'notifications': [{
            'id': n.id,
            'user_id': n.user_id,
            'type': n.type,
            'title': n.title,
            'content': n.content,
            'status': n.status,
            'phone': n.phone,
            'created_at': n.created_at.isoformat(),
            'sent_at': n.sent_at.isoformat() if n.sent_at else None
        } for n in notifications],
        'total': total,
        'page': page,
        'per_page': per_page
    })

@app.route('/api/notifications/send', methods=['POST'])
def send_notification_api():
    data = request.json
    user_id = data.get('user_id')
    content = data.get('content')
    
    if not user_id or not content:
        return jsonify({'error': '缺少参数'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 400
    
    phone = user.father_phone or user.mother_phone or user.guardian_phone
    if not phone:
        return jsonify({'error': '未设置家长联系方式'}), 400
    
    notification = Notification(
        user_id=user_id,
        type='manual',
        title='手动通知',
        content=content,
        phone=phone
    )
    db.session.add(notification)
    db.session.commit()
    
    send_sms(phone, content)
    
    return jsonify({'message': '通知已发送', 'notification_id': notification.id})

@app.route('/api/approvals', methods=['POST'])
def create_approval():
    data = request.json
    user_id = data.get('user_id')
    type = data.get('type', 'score_appeal')
    title = data.get('title')
    description = data.get('description')
    score_change = data.get('score_change')
    
    if not user_id or not title or not description:
        return jsonify({'error': '缺少参数'}), 400
    
    approval = Approval(
        user_id=user_id,
        type=type,
        title=title,
        description=description,
        score_change=score_change
    )
    db.session.add(approval)
    db.session.commit()
    
    return jsonify({'message': '申请已提交', 'approval_id': approval.id})

@app.route('/api/approvals', methods=['GET'])
def get_approvals():
    user_id = request.args.get('user_id', type=int)
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    query = Approval.query
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    if status:
        query = query.filter_by(status=status)
    
    total = query.count()
    approvals = query.order_by(Approval.created_at.desc()).offset((page-1)*per_page).limit(per_page).all()
    
    result = []
    for approval in approvals:
        user = User.query.get(approval.user_id)
        result.append({
            'id': approval.id,
            'user_id': approval.user_id,
            'user_name': user.name if user else '',
            'type': approval.type,
            'title': approval.title,
            'description': approval.description,
            'score_change': approval.score_change,
            'status': approval.status,
            'comment': approval.comment,
            'created_at': approval.created_at.isoformat(),
            'approve_time': approval.approve_time.isoformat() if approval.approve_time else None
        })
    
    return jsonify({
        'approvals': result,
        'total': total,
        'page': page,
        'per_page': per_page
    })

@app.route('/api/approvals/<int:id>/approve', methods=['POST'])
def approve_approval(id):
    data = request.json
    comment = data.get('comment', '')
    
    approval = Approval.query.get(id)
    if not approval:
        return jsonify({'error': '申请不存在'}), 400
    
    if approval.status != 'pending':
        return jsonify({'error': '申请状态不允许操作'}), 400
    
    approval.status = 'approved'
    approval.approver_id = 1
    approval.approve_time = datetime.now()
    approval.comment = comment
    
    if approval.score_change:
        user = User.query.get(approval.user_id)
        if user:
            user.current_score = apply_score_limit(user.current_score + approval.score_change)
            
            record = ScoreRecord(
                user_id=user.id,
                score_change=approval.score_change,
                description=f'申诉通过: {approval.title}',
                operator='审批系统'
            )
            db.session.add(record)
    
    db.session.commit()
    
    return jsonify({'message': '审批通过'})

@app.route('/api/approvals/<int:id>/reject', methods=['POST'])
def reject_approval(id):
    data = request.json
    comment = data.get('comment', '')
    
    approval = Approval.query.get(id)
    if not approval:
        return jsonify({'error': '申请不存在'}), 400
    
    if approval.status != 'pending':
        return jsonify({'error': '申请状态不允许操作'}), 400
    
    approval.status = 'rejected'
    approval.approver_id = 1
    approval.approve_time = datetime.now()
    approval.comment = comment
    
    db.session.commit()
    
    return jsonify({'message': '已拒绝'})

@app.route('/api/notifications/<int:id>/read', methods=['POST'])
def mark_notification_read(id):
    notification = Notification.query.get(id)
    if not notification:
        return jsonify({'error': '通知不存在'}), 400
    
    notification.status = 'read'
    db.session.commit()
    
    return jsonify({'message': '已标记为已读'})

@app.route('/api/notifications/<int:id>', methods=['DELETE'])
def delete_notification(id):
    notification = Notification.query.get(id)
    if not notification:
        return jsonify({'error': '通知不存在'}), 400
    
    db.session.delete(notification)
    db.session.commit()
    
    return jsonify({'message': '删除成功'})

@app.route('/api/approvals/<int:id>', methods=['GET'])
def get_approval(id):
    approval = Approval.query.get(id)
    if not approval:
        return jsonify({'error': '申请不存在'}), 400
    
    user = User.query.get(approval.user_id)
    
    return jsonify({
        'id': approval.id,
        'user_id': approval.user_id,
        'user_name': user.name if user else '',
        'type': approval.type,
        'title': approval.title,
        'description': approval.description,
        'score_change': approval.score_change,
        'status': approval.status,
        'approver_id': approval.approver_id,
        'approve_time': approval.approve_time.isoformat() if approval.approve_time else None,
        'comment': approval.comment,
        'created_at': approval.created_at.isoformat() if approval.created_at else None
    })

@app.route('/api/admins/login', methods=['POST'])
def admin_login():
    print(f"[DEBUG] 收到登录请求 from {request.remote_addr}")
    print(f"[DEBUG] Headers: {dict(request.headers)}")
    
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    print(f"[DEBUG] 用户名: {username}")
    
    if not username or not password:
        print(f"[DEBUG] 缺少用户名或密码")
        return jsonify({'error': '缺少用户名或密码'}), 400
    
    admin = Admin.query.filter_by(username=username).first()
    if not admin:
        print(f"[DEBUG] 用户不存在")
        return jsonify({'error': '用户不存在'}), 401
    
    print(f"[DEBUG] 存储的密码: {admin.password}, 输入的密码: {password}")
    
    if admin.password != password:
        print(f"[DEBUG] 密码错误")
        return jsonify({'error': '密码错误'}), 401
    
    print(f"[DEBUG] 登录成功")
    
    return jsonify({
        'id': admin.id,
        'username': admin.username,
        'role': admin.role,
        'real_name': admin.real_name,
        'class_name': admin.class_name
    })

@app.route('/api/admins', methods=['GET'])
def get_admins():
    admins = Admin.query.all()
    return jsonify([{
        'id': a.id,
        'username': a.username,
        'role': a.role,
        'real_name': a.real_name,
        'phone': a.phone,
        'class_name': a.class_name,
        'created_at': a.created_at.isoformat()
    } for a in admins])

@app.route('/api/admins', methods=['POST'])
def create_admin():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'teacher')
    real_name = data.get('real_name')
    phone = data.get('phone')
    class_name = data.get('class_name')
    
    if not username or not password:
        return jsonify({'error': '缺少用户名或密码'}), 400
    
    if Admin.query.filter_by(username=username).first():
        return jsonify({'error': '用户名已存在'}), 400
    
    admin = Admin(
        username=username,
        password=password,
        role=role,
        real_name=real_name,
        phone=phone,
        class_name=class_name
    )
    db.session.add(admin)
    db.session.commit()
    
    return jsonify({'message': '管理员创建成功', 'admin_id': admin.id})

@app.route('/api/admins/<int:id>', methods=['PUT'])
def update_admin(id):
    data = request.json
    admin = Admin.query.get(id)
    
    if not admin:
        return jsonify({'error': '管理员不存在'}), 400
    
    if 'username' in data:
        # 检查新用户名是否已被其他用户使用
        existing = Admin.query.filter_by(username=data['username']).first()
        if existing and existing.id != id:
            return jsonify({'error': '用户名已存在'}), 400
        admin.username = data['username']
    if 'password' in data and data['password']:
        admin.password = data['password']
    if 'role' in data:
        admin.role = data['role']
    if 'real_name' in data:
        admin.real_name = data['real_name']
    if 'phone' in data:
        admin.phone = data['phone']
    if 'class_name' in data:
        admin.class_name = data['class_name']
    
    admin.updated_at = datetime.now()
    db.session.commit()
    
    return jsonify({'message': '更新成功'})

@app.route('/api/admins/<int:id>', methods=['DELETE'])
def delete_admin(id):
    admin = Admin.query.get(id)
    
    if not admin:
        return jsonify({'error': '管理员不存在'}), 400
    
    db.session.delete(admin)
    db.session.commit()
    
    return jsonify({'message': '删除成功'})

@app.route('/api/admins/<int:id>/change-password', methods=['POST'])
def change_admin_password(id):
    data = request.json
    admin = Admin.query.get(id)
    if not admin:
        return jsonify({'error': '管理员不存在'}), 404
    
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({'error': '请提供旧密码和新密码'}), 400
    
    if admin.password != old_password:
        return jsonify({'error': '旧密码不正确'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': '新密码长度至少6位'}), 400
    
    admin.password = new_password
    admin.updated_at = datetime.now()
    db.session.commit()
    
    log_operation(
        'update',
        'admin',
        id,
        '修改密码',
        operator='admin'
    )
    
    return jsonify({'message': '密码修改成功'})

@app.route('/api/admins/<int:id>', methods=['GET'])
def get_admin(id):
    admin = Admin.query.get(id)
    if not admin:
        return jsonify({'error': '管理员不存在'}), 404
    
    return jsonify({
        'id': admin.id,
        'username': admin.username,
        'real_name': admin.real_name,
        'phone': admin.phone,
        'class_name': admin.class_name,
        'role': admin.role,
        'created_at': admin.created_at.isoformat() if admin.created_at else None
    })

@app.route('/api/roles', methods=['GET'])
def get_roles():
    """获取所有角色列表"""
    roles = Role.query.all()
    return jsonify([{
        'id': role.id,
        'name': role.name,
        'permissions': json.loads(role.permissions) if role.permissions else []
    } for role in roles])

@app.route('/api/roles', methods=['POST'])
def create_role():
    """创建新角色"""
    data = request.json
    name = data.get('name')
    permissions = data.get('permissions', [])
    
    if not name:
        return jsonify({'error': '请提供角色名称'}), 400
    
    existing_role = Role.query.filter_by(name=name).first()
    if existing_role:
        return jsonify({'error': '角色名称已存在'}), 400
    
    role = Role(
        name=name,
        permissions=json.dumps(permissions, ensure_ascii=False)
    )
    db.session.add(role)
    db.session.commit()
    
    log_operation(
        'create',
        'role',
        role.id,
        f'创建角色: {name}',
        operator='admin'
    )
    
    return jsonify({'message': '角色创建成功', 'role_id': role.id})

@app.route('/api/roles/<int:id>', methods=['PUT'])
def update_role(id):
    """更新角色"""
    role = Role.query.get(id)
    if not role:
        return jsonify({'error': '角色不存在'}), 404
    
    data = request.json
    if 'name' in data:
        existing_role = Role.query.filter_by(name=data['name']).first()
        if existing_role and existing_role.id != id:
            return jsonify({'error': '角色名称已存在'}), 400
        role.name = data['name']
    
    if 'permissions' in data:
        role.permissions = json.dumps(data['permissions'], ensure_ascii=False)
    
    db.session.commit()
    
    log_operation(
        'update',
        'role',
        role.id,
        f'更新角色: {role.name}',
        operator='admin'
    )
    
    return jsonify({'message': '更新成功'})

@app.route('/api/roles/<int:id>', methods=['DELETE'])
def delete_role(id):
    """删除角色"""
    role = Role.query.get(id)
    if not role:
        return jsonify({'error': '角色不存在'}), 404
    
    role_name = role.name
    db.session.delete(role)
    db.session.commit()
    
    log_operation(
        'delete',
        'role',
        role.id,
        f'删除角色: {role_name}',
        operator='admin'
    )
    
    return jsonify({'message': '删除成功'})

@app.route('/api/export/users/excel', methods=['GET'])
def export_users_excel():
    users = User.query.all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['姓名', '性别', '班级', '电话', '父亲姓名', '父亲电话', '母亲姓名', '母亲电话', '监护人姓名', '监护人电话', '监护关系', '饭卡号', '当前积分'])
    
    for user in users:
        writer.writerow([
            user.name,
            user.gender,
            user.class_name,
            user.phone,
            user.father_name,
            user.father_phone,
            user.mother_name,
            user.mother_phone,
            user.guardian_name,
            user.guardian_phone,
            user.guardian_relation,
            user.card_id,
            user.current_score
        ])
    
    output.seek(0)
    content = '\ufeff' + output.getvalue()
    
    import urllib.parse
    filename = urllib.parse.quote('学生数据.xls')
    response = Response(
        content,
        mimetype='application/vnd.ms-excel',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"; filename*=UTF-8''"{filename}"'
        }
    )
    return response

@app.route('/api/export/records/excel', methods=['GET'])
def export_records_excel():
    user_id = request.args.get('user_id', type=int)
    
    query = ScoreRecord.query
    if user_id:
        query = query.filter_by(user_id=user_id)
    
    records = query.order_by(ScoreRecord.created_at.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['学生姓名', '班级', '规则名称', '积分变动', '描述', '操作人', '操作时间'])
    
    for record in records:
        user = User.query.get(record.user_id)
        rule = ScoreRule.query.get(record.rule_id) if record.rule_id else None
        
        writer.writerow([
            user.name if user else '',
            user.class_name if user else '',
            rule.name if rule else '',
            record.score_change,
            record.description,
            record.operator,
            record.created_at.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    output.seek(0)
    content = '\ufeff' + output.getvalue()
    
    import urllib.parse
    filename = urllib.parse.quote('积分记录.xls')
    response = Response(
        content,
        mimetype='application/vnd.ms-excel',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"; filename*=UTF-8''"{filename}"'
        }
    )
    return response

def cleanup_old_processed_messages():
    try:
        with app.app_context():
            from datetime import timedelta
            cutoff_time = datetime.now() - timedelta(days=7)
            old_messages = ProcessedMessage.query.filter(
                ProcessedMessage.processed_at < cutoff_time
            ).delete()
            db.session.commit()
            if old_messages > 0:
                print(f"清理了 {old_messages} 条过期的已处理消息记录")
    except Exception as e:
        print(f"清理过期消息失败: {e}")

def cleanup_old_processed_messages():
    """清理7天前的已处理消息记录"""
    try:
        with app.app_context():
            cutoff_time = datetime.now() - timedelta(days=7)
            old_messages = ProcessedMessage.query.filter(
                ProcessedMessage.processed_at < cutoff_time
            ).delete()
            db.session.commit()
            print(f"定时任务: 清理了 {old_messages} 条已处理消息记录")
    except Exception as e:
        print(f"定时任务清理失败: {e}")

def cleanup_old_mqtt_logs():
    """清理30天前的MQTT日志"""
    try:
        with app.app_context():
            cutoff_time = datetime.now() - timedelta(days=30)
            old_logs = MQTTLog.query.filter(
                MQTTLog.timestamp < cutoff_time
            ).delete()
            db.session.commit()
            print(f"定时任务: 清理了 {old_logs} 条MQTT日志")
    except Exception as e:
        print(f"定时任务清理MQTT日志失败: {e}")

def cleanup_old_operation_logs():
    """清理90天前的操作日志"""
    try:
        with app.app_context():
            cutoff_time = datetime.now() - timedelta(days=90)
            old_logs = OperationLog.query.filter(
                OperationLog.created_at < cutoff_time
            ).delete()
            db.session.commit()
            print(f"定时任务: 清理了 {old_logs} 条操作日志")
    except Exception as e:
        print(f"定时任务清理操作日志失败: {e}")

def start_scheduler():
    """启动定时任务调度器"""
    scheduler = BackgroundScheduler(timezone='Asia/Shanghai')
    
    scheduler.add_job(
        cleanup_old_processed_messages,
        'cron',
        hour=2,
        minute=0,
        id='cleanup_processed_messages',
        name='清理已处理消息记录'
    )
    
    scheduler.add_job(
        cleanup_old_mqtt_logs,
        'cron',
        hour=2,
        minute=30,
        id='cleanup_mqtt_logs',
        name='清理MQTT日志'
    )
    
    scheduler.add_job(
        cleanup_old_operation_logs,
        'cron',
        hour=3,
        minute=0,
        id='cleanup_operation_logs',
        name='清理操作日志'
    )
    
    scheduler.start()
    print("定时任务调度器已启动")

def schedule_cleanup():
    import time
    while True:
        time.sleep(24 * 60 * 60)
        cleanup_old_processed_messages()

@app.route('/api/admin/cleanup-processed-messages', methods=['POST'])
def api_cleanup_processed_messages():
    try:
        days = request.json.get('days', 7)
        cutoff_time = datetime.now() - timedelta(days=days)
        
        if days < 1 or days > 365:
            return jsonify({'error': '天数必须在 1-365 之间'}), 400
        
        old_messages = ProcessedMessage.query.filter(
            ProcessedMessage.processed_at < cutoff_time
        ).delete()
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'deleted': old_messages,
            'message': f'成功清理 {old_messages} 条记录'
        })
    except Exception as e:
        return jsonify({'error': '清理失败: ' + str(e)}), 500

@app.route('/api/admin/processed-messages-stats', methods=['GET'])
def api_processed_messages_stats():
    try:
        from datetime import timedelta
        
        total = ProcessedMessage.query.count()
        today = datetime.now().date()
        today_count = ProcessedMessage.query.filter(
            db.func.date(ProcessedMessage.processed_at) == today
        ).count()
        
        week_ago = datetime.now() - timedelta(days=7)
        week_count = ProcessedMessage.query.filter(
            ProcessedMessage.processed_at >= week_ago
        ).count()
        
        return jsonify({
            'total': total,
            'today': today_count,
            'week': week_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/mqtt-logs-stats', methods=['GET'])
def api_mqtt_logs_stats():
    try:
        from datetime import timedelta
        
        total = MQTTLog.query.count()
        today = datetime.now().date()
        today_count = MQTTLog.query.filter(
            db.func.date(MQTTLog.timestamp) == today
        ).count()
        
        return jsonify({
            'total': total,
            'today': today_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/cleanup-mqtt-logs', methods=['POST'])
def api_cleanup_mqtt_logs():
    try:
        days = request.json.get('days', 30)
        cutoff_time = datetime.now() - timedelta(days=days)
        
        if days < 1 or days > 365:
            return jsonify({'error': '天数必须在 1-365 之间'}), 400
        
        old_logs = MQTTLog.query.filter(
            MQTTLog.timestamp < cutoff_time
        ).delete()
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'deleted': old_logs,
            'message': f'成功清理 {old_logs} 条MQTT日志'
        })
    except Exception as e:
        return jsonify({'error': '清理失败: ' + str(e)}), 500

def check_time_valid(box_id, hour=None, minute=None):
    """检查当前时间是否允许开锁"""
    now = datetime.now()
    current_hour = hour if hour is not None else now.hour
    current_minute = minute if minute is not None else now.minute
    day_of_week = now.weekday()  # 0=周一, 6=周日
    
    rules = TimeRule.query.filter_by(is_active=True).all()
    
    for rule in rules:
        if rule.day_of_week != -1 and rule.day_of_week != day_of_week:
            continue
        
        start_time = rule.start_hour * 60 + rule.start_minute
        end_time = rule.end_hour * 60 + rule.end_minute
        current_time = current_hour * 60 + current_minute
        
        if start_time <= current_time <= end_time:
            return rule.allow_unlock
    
    return True

def publish_unlock_result(box_id, success, reason, current_score=None):
    """发布开锁结果到MQTT"""
    topic = f'phonebox/unlock/{box_id}'
    result = {'result': 'true' if success else 'false', 'reason': reason}
    if current_score is not None:
        result['current_score'] = current_score
    message = json.dumps(result)
    mqtt_client.publish(topic, message)
    log_mqtt_message(mqtt_client, topic, result)

@ns_time_rules.route('/')
class TimeRuleList(Resource):
    @ns_time_rules.doc('get_time_rules')
    def get(self):
        """获取所有时间规则"""
        rules = TimeRule.query.all()
        return [{
            'id': r.id,
            'name': r.name,
            'description': r.description,
            'day_of_week': r.day_of_week,
            'start_hour': r.start_hour,
            'start_minute': r.start_minute,
            'end_hour': r.end_hour,
            'end_minute': r.end_minute,
            'is_active': r.is_active,
            'allow_unlock': r.allow_unlock,
            'created_at': r.created_at.isoformat() if r.created_at else None
        } for r in rules]
    
    @ns_time_rules.doc('create_time_rule')
    @ns_time_rules.expect(time_rule_model)
    def post(self):
        """创建时间规则"""
        data = request.json
        rule = TimeRule(
            name=data.get('name'),
            description=data.get('description', ''),
            day_of_week=data.get('day_of_week', -1),
            start_hour=data.get('start_hour', 0),
            start_minute=data.get('start_minute', 0),
            end_hour=data.get('end_hour', 0),
            end_minute=data.get('end_minute', 0),
            is_active=data.get('is_active', True),
            allow_unlock=data.get('allow_unlock', False)
        )
        db.session.add(rule)
        db.session.commit()
        return {'message': '创建成功', 'rule_id': rule.id}, 201

@ns_time_rules.route('/<int:id>')
@ns_time_rules.param('id', '规则ID')
class TimeRuleDetail(Resource):
    @ns_time_rules.doc('get_time_rule')
    def get(self, id):
        """获取单个时间规则"""
        rule = TimeRule.query.get(id)
        if not rule:
            return {'error': '规则不存在'}, 404
        return {
            'id': rule.id,
            'name': rule.name,
            'description': rule.description,
            'day_of_week': rule.day_of_week,
            'start_hour': rule.start_hour,
            'start_minute': rule.start_minute,
            'end_hour': rule.end_hour,
            'end_minute': rule.end_minute,
            'is_active': rule.is_active,
            'allow_unlock': rule.allow_unlock,
            'created_at': rule.created_at.isoformat() if rule.created_at else None
        }
    
    @ns_time_rules.doc('update_time_rule')
    @ns_time_rules.expect(time_rule_model)
    def put(self, id):
        """更新时间规则"""
        rule = TimeRule.query.get(id)
        if not rule:
            return {'error': '规则不存在'}, 404
        
        data = request.json
        if 'name' in data:
            rule.name = data['name']
        if 'description' in data:
            rule.description = data['description']
        if 'day_of_week' in data:
            rule.day_of_week = data['day_of_week']
        if 'start_hour' in data:
            rule.start_hour = data['start_hour']
        if 'start_minute' in data:
            rule.start_minute = data['start_minute']
        if 'end_hour' in data:
            rule.end_hour = data['end_hour']
        if 'end_minute' in data:
            rule.end_minute = data['end_minute']
        if 'is_active' in data:
            rule.is_active = data['is_active']
        if 'allow_unlock' in data:
            rule.allow_unlock = data['allow_unlock']
        
        rule.updated_at = datetime.now()
        db.session.commit()
        return {'message': '更新成功'}
    
    @ns_time_rules.doc('delete_time_rule')
    def delete(self, id):
        """删除时间规则"""
        rule = TimeRule.query.get(id)
        if not rule:
            return {'error': '规则不存在'}, 404
        
        db.session.delete(rule)
        db.session.commit()
        return {'message': '删除成功'}

@app.route('/api/time-rules/check', methods=['POST'])
def check_time_rule():
    """检查当前时间是否允许开锁"""
    data = request.json
    box_id = data.get('box_id', 'A')
    hour = data.get('hour')
    minute = data.get('minute')
    
    allow = check_time_valid(box_id, hour, minute)
    return {'allow_unlock': allow}

@ns_devices.route('/')
class DeviceList(Resource):
    @ns_devices.doc('get_devices', description='获取所有设备列表')
    def get(self):
        """获取所有设备列表"""
        devices = Device.query.all()
        result = []
        for device in devices:
            is_online = False
            if device.last_heartbeat:
                time_diff = (datetime.now() - device.last_heartbeat).total_seconds()
                is_online = time_diff <= 30
            
            result.append({
                'id': device.id,
                'device_id': device.device_id,
                'name': device.name,
                'status': device.status,
                'is_online': is_online,
                'last_heartbeat': device.last_heartbeat.isoformat() if device.last_heartbeat else None,
                'wifi_signal': device.wifi_signal,
                'uptime': device.uptime,
                'box_a_status': device.box_a_status,
                'box_b_status': device.box_b_status,
                'system_state': device.system_state,
                'created_at': device.created_at.isoformat(),
                'updated_at': device.updated_at.isoformat()
            })
        return result

    @ns_devices.doc('create_device', description='创建设备')
    def post(self):
        """创建设备"""
        data = request.json
        device_id = data.get('device_id')
        
        if not device_id:
            return {'error': '设备ID不能为空'}, 400
        
        if Device.query.filter_by(device_id=device_id).first():
            return {'error': '设备ID已存在'}, 400
        
        device = Device(
            device_id=device_id,
            name=data.get('name', f'设备 {device_id}'),
            status=data.get('status', 'offline')
        )
        db.session.add(device)
        db.session.commit()
        return {'message': '创建设备成功', 'device_id': device.id}, 201

@ns_devices.route('/<string:device_id>')
@ns_devices.param('device_id', '设备ID')
class DeviceDetail(Resource):
    @ns_devices.doc('get_device', description='获取单个设备详情')
    def get(self, device_id):
        """获取单个设备详情"""
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return {'error': '设备不存在'}, 404
        
        is_online = False
        if device.last_heartbeat:
            time_diff = (datetime.now() - device.last_heartbeat).total_seconds()
            is_online = time_diff <= 30
        
        return {
            'id': device.id,
            'device_id': device.device_id,
            'name': device.name,
            'status': device.status,
            'is_online': is_online,
            'last_heartbeat': device.last_heartbeat.isoformat() if device.last_heartbeat else None,
            'wifi_signal': device.wifi_signal,
            'uptime': device.uptime,
            'box_a_status': device.box_a_status,
            'box_b_status': device.box_b_status,
            'system_state': device.system_state,
            'created_at': device.created_at.isoformat(),
            'updated_at': device.updated_at.isoformat()
        }

    @ns_devices.doc('update_device', description='更新设备信息')
    def put(self, device_id):
        """更新设备信息"""
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return {'error': '设备不存在'}, 404
        
        data = request.json
        if 'name' in data:
            device.name = data['name']
        
        db.session.commit()
        return {'message': '更新成功'}

    @ns_devices.doc('delete_device', description='删除设备')
    def delete(self, device_id):
        """删除设备"""
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return {'error': '设备不存在'}, 404
        
        db.session.delete(device)
        db.session.commit()
        return {'message': '删除成功'}

@app.route('/api/devices/<string:device_id>/heartbeats', methods=['GET'])
def get_device_heartbeats(device_id):
    """获取设备心跳记录"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    query = DeviceHeartbeat.query.filter_by(device_id=device_id).order_by(DeviceHeartbeat.received_at.desc())
    total = query.count()
    heartbeats = query.offset((page-1)*per_page).limit(per_page).all()
    
    return jsonify({
        'data': [{
            'id': h.id,
            'device_id': h.device_id,
            'timestamp': h.timestamp,
            'status': h.status,
            'wifi_signal': h.wifi_signal,
            'uptime': h.uptime,
            'box_a_status': h.box_a_status,
            'box_b_status': h.box_b_status,
            'system_state': h.system_state,
            'received_at': h.received_at.isoformat()
        } for h in heartbeats],
        'total': total,
        'page': page,
        'per_page': per_page
    })

@app.route('/api/devices/stats', methods=['GET'])
def get_device_stats():
    """获取设备统计信息"""
    total = Device.query.count()
    
    online_count = 0
    devices = Device.query.all()
    for device in devices:
        if device.last_heartbeat:
            time_diff = (datetime.now() - device.last_heartbeat).total_seconds()
            if time_diff <= 30:
                online_count += 1
    
    today = datetime.now().date()
    today_heartbeats = DeviceHeartbeat.query.filter(
        db.func.date(DeviceHeartbeat.received_at) == today
    ).count()
    
    return jsonify({
        'total_devices': total,
        'online_devices': online_count,
        'offline_devices': total - online_count,
        'today_heartbeats': today_heartbeats
    })

@app.route('/api/system/config', methods=['GET'])
def get_system_config():
    """获取系统配置"""
    config = SystemConfig.query.first()
    if not config:
        config = SystemConfig()
        db.session.add(config)
        db.session.commit()
    return jsonify({
        'system_name': config.system_name,
        'system_logo': config.system_logo,
        'default_score': config.default_score,
        'min_score': config.min_score,
        'max_score': config.max_score,
        'enable_notifications': config.enable_notifications,
        'notification_sound': config.notification_sound,
        'auto_save': config.auto_save,
        'theme': config.theme,
        'language': config.language
    })

@app.route('/api/system/config', methods=['PUT'])
def update_system_config():
    """更新系统配置"""
    config = SystemConfig.query.first()
    if not config:
        config = SystemConfig()
        db.session.add(config)
    
    data = request.json
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
    db.session.commit()
    
    log_operation(
        'update_config',
        'system',
        None,
        '更新系统配置',
        operator='admin'
    )
    
    return jsonify({'message': '配置已更新'})


@app.route('/api/test-permission', methods=['GET'])
def test_permission_api():
    """测试权限系统 - 返回当前登录管理员信息"""
    admin = get_current_admin()
    
    if admin:
        allowed_classes = get_allowed_classes(admin.id)
        
        # 获取该管理员能看到的学生数
        query = User.query
        if allowed_classes is not None:
            if allowed_classes:
                student_count = query.filter(User.class_name.in_(allowed_classes)).count()
            else:
                student_count = 0
        else:
            student_count = query.count()
        
        return {
            'success': True,
            'admin': {
                'id': admin.id,
                'username': admin.username,
                'role': admin.role,
                'class_name': admin.class_name
            },
            'allowed_classes': allowed_classes,
            'student_count': student_count
        }
    else:
        return {
            'success': False,
            'message': 'No admin found'
        }


# ============================== 权限系统核心函数 ==============================


def get_current_admin():
    """
    获取当前登录的管理员信息
    TODO: 这里未来应该从token/session中获取，暂时从请求头中获取
    """
    # 先尝试从请求头获取admin_id
    admin_id = request.headers.get('X-Admin-Id')
    if admin_id:
        admin = Admin.query.get(int(admin_id))
        if admin:
            return admin
    # 没有请求头时返回None，强制验证身份
    return None


def get_admin_classes(admin_id):
    """获取管理员管理的所有班级"""
    links = AdminClass.query.filter_by(admin_id=admin_id).all()
    class_ids = [link.class_info_id for link in links]
    return ClassInfo.query.filter(ClassInfo.id.in_(class_ids)).all()


def can_access_class(admin_id, class_name):
    """检查管理员是否有权限访问指定班级"""
    # 超级管理员所有权限
    admin = Admin.query.get(admin_id)
    if admin and admin.role == 'admin':
        return True
    
    # 获取管理员管理的班级列表
    links = AdminClass.query.filter_by(admin_id=admin_id).all()
    allowed_classes = [link.class_info.name for link in links]
    
    # 如果是班主任且没有关联班级，使用原class_name字段
    if not allowed_classes and admin and admin.class_name:
        allowed_classes = [admin.class_name]
    
    return class_name in allowed_classes


def get_allowed_classes(admin_id):
    """获取管理员允许访问的班级列表"""
    admin = Admin.query.get(admin_id)
    if admin and admin.role == 'admin':
        return None  # None表示全部
    
    links = AdminClass.query.filter_by(admin_id=admin_id).all()
    allowed_classes = [link.class_info.name for link in links]
    
    if not allowed_classes and admin and admin.class_name:
        allowed_classes = [admin.class_name]
    
    return allowed_classes


def filter_query_by_permission(query, class_name_field, admin_id):
    """根据权限过滤查询"""
    allowed_classes = get_allowed_classes(admin_id)
    if allowed_classes is None:  # 全部权限
        return query
    
    if not allowed_classes:
        return query.filter(False)
    
    return query.filter(class_name_field.in_(allowed_classes))


def log_permission_operation(operator_id, action, target_type, target_id=None, description=None, ip=None):
    """记录权限操作日志"""
    try:
        log = PermissionLog(
            operator_id=operator_id,
            operator_type='admin',
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
            ip_address=ip or request.remote_addr
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"记录权限操作日志失败: {e}")


def init_role_permissions():
    """初始化系统角色权限"""
    # 检查是否已初始化
    if RolePermission.query.first():
        return
    
    # 定义角色
    roles = [
        {
            'code': 'admin',
            'name': '超级管理员',
            'desc': '拥有所有系统权限',
            'perms': ['*']  # *表示所有权限
        },
        {
            'code': 'head_teacher',
            'name': '班主任',
            'desc': '管理自己班级的学生、积分等',
            'perms': [
                'user.view', 'user.create', 'user.edit', 'user.delete',
                'score.view', 'score.add', 'score.edit',
                'record.view', 'record.export',
                'dashboard.view',
                'notification.view', 'notification.send'
            ]
        },
        {
            'code': 'dashboard_viewer',
            'name': '数据大屏用户',
            'desc': '只读权限，查看数据大屏',
            'perms': [
                'dashboard.view', 'user.view', 'score.view', 'record.view'
            ]
        }
    ]
    
    for role_data in roles:
        role = RolePermission(
            role_code=role_data['code'],
            role_name=role_data['name'],
            description=role_data['desc'],
            permissions=json.dumps(role_data['perms'], ensure_ascii=False)
        )
        db.session.add(role)
    
    db.session.commit()
    print("角色权限初始化完成")


def init_sample_classes():
    """初始化示例班级数据"""
    if ClassInfo.query.first():
        return
    
    # 创建示例班级
    sample_classes = [
        {'name': '一年级1班', 'grade': '一年级', 'desc': '小学一年级1班'},
        {'name': '一年级2班', 'grade': '一年级', 'desc': '小学一年级2班'},
        {'name': '二年级1班', 'grade': '二年级', 'desc': '小学二年级1班'},
    ]
    
    for cdata in sample_classes:
        ci = ClassInfo(
            name=cdata['name'],
            grade=cdata['grade'],
            description=cdata['desc']
        )
        db.session.add(ci)
    
    db.session.commit()
    print("示例班级初始化完成")


# ============================== 班级管理 API ==============================


ns_classes = api.namespace('classes', description='班级管理相关操作')


class_info_model = api.model('ClassInfo', {
    'id': fields.Integer(readOnly=True),
    'name': fields.String(required=True),
    'grade': fields.String,
    'description': fields.String,
    'is_active': fields.Boolean,
    'created_at': fields.DateTime
})


@ns_classes.route('/')
class ClassList(Resource):
    @ns_classes.doc('list_classes')
    def get(self):
        """获取班级列表（根据权限过滤）"""
        admin = get_current_admin()
        
        if admin and admin.role != 'admin':
            allowed_classes = get_allowed_classes(admin.id)
            if allowed_classes:
                query = ClassInfo.query.filter(ClassInfo.name.in_(allowed_classes)).filter_by(is_active=True)
            else:
                query = ClassInfo.query.filter(False)
        else:
            query = ClassInfo.query.filter_by(is_active=True)
        
        classes = query.all()
        
        return [{
            'id': c.id,
            'name': c.name,
            'grade': c.grade,
            'description': c.description,
            'is_active': c.is_active,
            'student_count': User.query.filter_by(class_name=c.name).count()
        } for c in classes]
    
    @ns_classes.doc('create_class')
    @ns_classes.expect(class_info_model)
    def post(self):
        """创建新班级"""
        data = request.json
        
        name = data.get('name')
        if not name:
            return {'error': '班级名称不能为空'}, 400
        
        if ClassInfo.query.filter_by(name=name).first():
            return {'error': '班级名称已存在'}, 400
        
        new_class = ClassInfo(
            name=name,
            grade=data.get('grade'),
            description=data.get('description')
        )
        db.session.add(new_class)
        db.session.commit()
        
        log_permission_operation(
            operator_id=get_current_admin().id if get_current_admin() else 0,
            action='create',
            target_type='class',
            target_id=new_class.id,
            description=f'创建班级: {name}'
        )
        
        return {'message': '班级创建成功', 'class_id': new_class.id}


@ns_classes.route('/<int:id>')
class ClassDetail(Resource):
    @ns_classes.doc('get_class')
    def get(self, id):
        """获取班级详情"""
        class_info = ClassInfo.query.get(id)
        if not class_info:
            return {'error': '班级不存在'}, 404
        
        students = User.query.filter_by(class_name=class_info.name).all()
        
        return {
            'id': class_info.id,
            'name': class_info.name,
            'grade': class_info.grade,
            'description': class_info.description,
            'is_active': class_info.is_active,
            'student_count': len(students),
            'students': [{'id': s.id, 'name': s.name} for s in students]
        }
    
    @ns_classes.doc('update_class')
    def put(self, id):
        """更新班级"""
        class_info = ClassInfo.query.get(id)
        if not class_info:
            return {'error': '班级不存在'}, 404
        
        data = request.json
        if 'name' in data:
            # 检查是否存在同名班级
            existing = ClassInfo.query.filter_by(name=data['name']).first()
            if existing and existing.id != id:
                return {'error': '班级名称已存在'}, 400
            
            # 同步更新学生班级名
            old_name = class_info.name
            new_name = data['name']
            students = User.query.filter_by(class_name=old_name).all()
            for s in students:
                s.class_name = new_name
            
            class_info.name = new_name
        
        if 'grade' in data:
            class_info.grade = data['grade']
        if 'description' in data:
            class_info.description = data['description']
        if 'is_active' in data:
            class_info.is_active = data['is_active']
        
        class_info.updated_at = datetime.now()
        db.session.commit()
        
        log_permission_operation(
            operator_id=get_current_admin().id if get_current_admin() else 0,
            action='update',
            target_type='class',
            target_id=id,
            description=f'更新班级: {class_info.name}'
        )
        
        return {'message': '班级更新成功'}
    
    @ns_classes.doc('delete_class')
    def delete(self, id):
        """删除班级"""
        class_info = ClassInfo.query.get(id)
        if not class_info:
            return {'error': '班级不存在'}, 404
        
        class_info.is_active = False
        db.session.commit()
        
        log_permission_operation(
            operator_id=get_current_admin().id if get_current_admin() else 0,
            action='delete',
            target_type='class',
            target_id=id,
            description=f'删除班级: {class_info.name}'
        )
        
        return {'message': '班级删除成功'}


# ============================== 子账号管理 API ==============================


ns_sub_accounts = api.namespace('sub-accounts', description='子账号管理相关操作')


sub_account_model = api.model('SubAccount', {
    'id': fields.Integer(readOnly=True),
    'username': fields.String(required=True),
    'password': fields.String(required=True),
    'real_name': fields.String,
    'phone': fields.String,
    'role_type': fields.String,
    'is_active': fields.Boolean
})


@ns_sub_accounts.route('/')
class SubAccountList(Resource):
    @ns_sub_accounts.doc('list_sub_accounts')
    def get(self):
        """获取子账号列表"""
        admin = get_current_admin()
        if not admin:
            return {'error': '未登录'}, 401
        
        # 获取当前管理员的子账号
        sub_accounts = SubAccount.query.filter_by(parent_admin_id=admin.id, is_active=True).all()
        
        return [{
            'id': sa.id,
            'username': sa.username,
            'real_name': sa.real_name,
            'phone': sa.phone,
            'role_type': sa.role_type,
            'permissions': json.loads(sa.permissions) if sa.permissions else [],
            'is_active': sa.is_active,
            'created_at': sa.created_at.isoformat()
        } for sa in sub_accounts]
    
    @ns_sub_accounts.doc('create_sub_account')
    @ns_sub_accounts.expect(sub_account_model)
    def post(self):
        """创建子账号（如数据大屏用户）"""
        admin = get_current_admin()
        if not admin:
            return {'error': '未登录'}, 401
        
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return {'error': '用户名和密码不能为空'}, 400
        
        if SubAccount.query.filter_by(username=username).first():
            return {'error': '用户名已存在'}, 400
        
        sub_account = SubAccount(
            parent_admin_id=admin.id,
            username=username,
            password=password,
            real_name=data.get('real_name'),
            phone=data.get('phone'),
            role_type=data.get('role_type', 'dashboard_viewer'),
            permissions=json.dumps(data.get('permissions', []), ensure_ascii=False)
        )
        db.session.add(sub_account)
        db.session.commit()
        
        log_permission_operation(
            operator_id=admin.id,
            action='create',
            target_type='sub_account',
            target_id=sub_account.id,
            description=f'创建子账号: {username}'
        )
        
        return {'message': '子账号创建成功', 'sub_account_id': sub_account.id}


@ns_sub_accounts.route('/<int:id>')
class SubAccountDetail(Resource):
    @ns_sub_accounts.doc('update_sub_account')
    def put(self, id):
        """更新子账号"""
        sub_account = SubAccount.query.get(id)
        if not sub_account:
            return {'error': '子账号不存在'}, 404
        
        # 检查权限（只能操作自己的子账号）
        admin = get_current_admin()
        if not admin or sub_account.parent_admin_id != admin.id:
            return {'error': '无权限操作'}, 403
        
        data = request.json
        if 'password' in data:
            sub_account.password = data['password']
        if 'real_name' in data:
            sub_account.real_name = data['real_name']
        if 'phone' in data:
            sub_account.phone = data['phone']
        if 'role_type' in data:
            sub_account.role_type = data['role_type']
        if 'permissions' in data:
            sub_account.permissions = json.dumps(data['permissions'], ensure_ascii=False)
        if 'is_active' in data:
            sub_account.is_active = data['is_active']
        
        sub_account.updated_at = datetime.now()
        db.session.commit()
        
        return {'message': '子账号更新成功'}
    
    @ns_sub_accounts.doc('delete_sub_account')
    def delete(self, id):
        """删除子账号"""
        sub_account = SubAccount.query.get(id)
        if not sub_account:
            return {'error': '子账号不存在'}, 404
        
        admin = get_current_admin()
        if not admin or sub_account.parent_admin_id != admin.id:
            return {'error': '无权限操作'}, 403
        
        sub_account.is_active = False
        db.session.commit()
        
        return {'message': '子账号删除成功'}


# ============================== 角色权限管理 API ==============================


ns_roles = api.namespace('role-permissions', description='角色权限管理相关操作')


@ns_roles.route('/')
class RolePermissionList(Resource):
    @ns_roles.doc('list_role_permissions')
    def get(self):
        """获取所有角色权限"""
        roles = RolePermission.query.filter_by(is_active=True).all()
        return [{
            'id': r.id,
            'code': r.role_code,
            'name': r.role_name,
            'description': r.description,
            'permissions': json.loads(r.permissions) if r.permissions else []
        } for r in roles]


@ns_roles.route('/<int:id>')
class RolePermissionDetail(Resource):
    @ns_roles.doc('get_role_permission')
    def get(self, id):
        """获取角色权限详情"""
        role = RolePermission.query.get(id)
        if not role:
            return {'error': '角色不存在'}, 404
        
        return {
            'id': role.id,
            'code': role.role_code,
            'name': role.role_name,
            'description': role.description,
            'permissions': json.loads(role.permissions) if role.permissions else []
        }


# ============================== 管理员-班级关联 API ==============================


ns_admin_classes = api.namespace('admin-classes', description='管理员班级关联操作')


@ns_admin_classes.route('/<int:admin_id>')
class AdminClassList(Resource):
    @ns_admin_classes.doc('get_admin_classes')
    def get(self, admin_id):
        """获取管理员管理的班级"""
        links = AdminClass.query.filter_by(admin_id=admin_id).all()
        class_ids = [link.class_info_id for link in links]
        
        classes = ClassInfo.query.filter(ClassInfo.id.in_(class_ids)).all()
        
        return [{
            'class_id': c.id,
            'class_name': c.name,
            'is_primary': any(l.class_info_id == c.id and l.is_primary for l in links)
        } for c in classes]


@app.route('/api/admins/<int:admin_id>/assign-class', methods=['POST'])
def assign_class_to_admin(admin_id):
    """为管理员分配班级"""
    admin = Admin.query.get(admin_id)
    if not admin:
        return {'error': '管理员不存在'}, 404
    
    data = request.json
    class_id = data.get('class_id')
    is_primary = data.get('is_primary', False)
    
    class_info = ClassInfo.query.get(class_id)
    if not class_info:
        return {'error': '班级不存在'}, 404
    
    # 检查是否已分配
    existing = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
    if existing:
        return {'error': '班级已分配给该管理员'}, 400
    
    # 如果是主班级，取消其他主班级
    if is_primary:
        existing_primary = AdminClass.query.filter_by(admin_id=admin_id, is_primary=True).first()
        if existing_primary:
            existing_primary.is_primary = False
    
    new_link = AdminClass(
        admin_id=admin_id,
        class_info_id=class_id,
        is_primary=is_primary
    )
    db.session.add(new_link)
    db.session.commit()
    
    log_permission_operation(
        operator_id=get_current_admin().id if get_current_admin() else 0,
        action='assign',
        target_type='admin_class',
        target_id=admin_id,
        description=f'为管理员 {admin.username} 分配班级: {class_info.name}'
    )
    
    return {'message': '班级分配成功'}


@app.route('/api/admins/<int:admin_id>/remove-class/<int:class_id>', methods=['POST'])
def remove_class_from_admin(admin_id, class_id):
    """移除管理员的班级"""
    link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
    if not link:
        return {'error': '分配关系不存在'}, 404
    
    db.session.delete(link)
    db.session.commit()
    
    return {'message': '班级移除成功'}


# ============================== 子账号登录 API ==============================


@app.route('/api/sub-accounts/login', methods=['POST'])
def sub_account_login():
    """子账号登录（数据大屏用户等）"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return {'error': '缺少用户名或密码'}, 400
    
    sub_account = SubAccount.query.filter_by(username=username, is_active=True).first()
    if not sub_account:
        return {'error': '用户不存在'}, 401
    
    if sub_account.password != password:
        return {'error': '密码错误'}, 401
    
    return {
        'id': sub_account.id,
        'username': sub_account.username,
        'role_type': sub_account.role_type,
        'real_name': sub_account.real_name,
        'parent_admin_id': sub_account.parent_admin_id,
        'permissions': json.loads(sub_account.permissions) if sub_account.permissions else []
    }


# ============================== 数据大屏专用 API ==============================


@app.route('/api/dashboard/data', methods=['GET'])
def get_dashboard_data():
    """获取数据大屏数据（根据权限过滤）"""
    admin = get_current_admin()
    if not admin:
        return {'error': '未登录'}, 401
    
    allowed_classes = get_allowed_classes(admin.id)
    
    query = User.query
    if allowed_classes is not None:
        if not allowed_classes:
            query = query.filter(False)
        else:
            query = query.filter(User.class_name.in_(allowed_classes))
    
    students = query.all()
    
    total_students = len(students)
    total_score = sum(s.current_score for s in students)
    avg_score = total_score / total_students if total_students > 0 else 0
    
    # 班级统计
    class_stats = {}
    for student in students:
        cname = student.class_name or '未分配'
        if cname not in class_stats:
            class_stats[cname] = {'count': 0, 'total_score': 0}
        class_stats[cname]['count'] += 1
        class_stats[cname]['total_score'] += student.current_score
    
    for cname, stat in class_stats.items():
        stat['avg_score'] = stat['total_score'] / stat['count'] if stat['count'] > 0 else 0
    
    # 积分分布
    score_ranges = {
        '0-59': 0,
        '60-69': 0,
        '70-79': 0,
        '80-89': 0,
        '90-100': 0,
        '100+': 0
    }
    
    for student in students:
        score = student.current_score
        if score < 60:
            score_ranges['0-59'] += 1
        elif score < 70:
            score_ranges['60-69'] += 1
        elif score < 80:
            score_ranges['70-79'] += 1
        elif score < 90:
            score_ranges['80-89'] += 1
        elif score <= 100:
            score_ranges['90-100'] += 1
        else:
            score_ranges['100+'] += 1
    
    return {
        'summary': {
            'total_students': total_students,
            'avg_score': round(avg_score, 2),
            'class_count': len(class_stats)
        },
        'class_stats': class_stats,
        'score_distribution': score_ranges
    }


# ============================== 权限日志 API ==============================


@app.route('/api/permission-logs', methods=['GET'])
def get_permission_logs():
    """获取权限操作日志"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    
    query = PermissionLog.query.order_by(PermissionLog.created_at.desc())
    total = query.count()
    logs = query.offset((page-1)*per_page).limit(per_page).all()
    
    return {
        'data': [{
            'id': log.id,
            'operator_id': log.operator_id,
            'action': log.action,
            'target_type': log.target_type,
            'target_id': log.target_id,
            'description': log.description,
            'ip_address': log.ip_address,
            'created_at': log.created_at.isoformat()
        } for log in logs],
        'total': total,
        'page': page,
        'per_page': per_page
    }


# ============================== 初始化函数 ==============================


def init_permission_system():
    """初始化权限系统"""
    with app.app_context():
        # 创建所有表
        db.create_all()
        
        # 初始化角色权限
        init_role_permissions()
        
        # 初始化示例班级
        init_sample_classes()


if __name__ == '__main__':
    # 禁用重新加载器以确保MQTT客户端只启动一次
    print("正在初始化权限系统...")
    init_permission_system()
    print("正在启动MQTT客户端和定时任务...")
    threading.Thread(target=start_mqtt_client, daemon=True).start()
    start_scheduler()
    try:
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except (KeyboardInterrupt, SystemExit):
        pass
