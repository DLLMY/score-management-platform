from services.mqtt_manager import mqtt_manager, MQTTManager, MQTTConnectionState
import json
from datetime import datetime
import threading

# 使用TCP实例作为默认连接（优先使用更稳定的TCP连接）
mqtt_manager = MQTTManager('tcp')
mqtt_client = mqtt_manager
mqtt_logs = []

# 动态属性访问
def __getattr__(name):
    if name == 'mqtt_connected':
        return mqtt_manager.is_connected
    if name == 'subscribed_topics':
        return mqtt_manager.subscribed_topics
    raise AttributeError(f"module {__name__} has no attribute {name}")

DEFAULT_CONFIG = mqtt_manager.DEFAULT_CONFIG

def log_mqtt_message_async(client, topic, data, qos=1):
    """异步记录MQTT发送消息日志（不阻塞主流程）"""
    def log_task():
        try:
            from app import app
            from models import db, MQTTLog
            with app.app_context():
                log = MQTTLog(
                    topic=topic,
                    message=json.dumps(data) if isinstance(data, dict) else str(data),
                    direction='send',
                    timestamp=datetime.now()
                )
                db.session.add(log)
                db.session.commit()

            mqtt_logs.append({
                'topic': topic,
                'message': json.dumps(data) if isinstance(data, dict) else str(data),
                'direction': 'send',
                'qos': qos,
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            print(f"记录MQTT消息失败: {e}")
    
    # 启动后台线程执行日志记录，不阻塞主流程
    thread = threading.Thread(target=log_task, daemon=True)
    thread.start()

def log_operation_detail(operation_type, details, success=True):
    """记录操作详情日志"""
    try:
        from app import app
        from models import db, OperationLog
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

def get_mqtt_config_from_db():
    """从数据库获取MQTT配置"""
    return mqtt_manager.load_config_from_db()

def connect_mqtt(config=None):
    """连接MQTT"""
    if config:
        mqtt_manager.set_config(config)
    return mqtt_manager.connect()

def reconnect_mqtt():
    """重新连接MQTT"""
    return mqtt_manager.connect()

def publish_mqtt(topic, payload, qos=0):
    """发布MQTT消息 - 使用QoS 0以匹配设备端订阅配置（优化版）"""
    if isinstance(payload, dict):
        payload = json.dumps(payload)
    
    # 直接发布，不等待日志记录
    result = mqtt_manager.publish(topic, payload, qos)
    
    if result:
        # 异步记录日志，不阻塞发布流程
        log_mqtt_message_async(None, topic, payload, qos)
    
    return result

def clear_mqtt_logs():
    """清理内存中的MQTT日志"""
    global mqtt_logs
    mqtt_logs = []

def get_mqtt_status():
    """获取MQTT状态"""
    return mqtt_manager.get_status()