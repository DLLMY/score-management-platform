import paho.mqtt.client as mqtt
import json
import threading
import time
import ssl
from datetime import datetime
from enum import Enum
from collections import deque
from functools import lru_cache

class MQTTConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"

class MQTTManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, instance_name='default'):
        # 单例模式，支持多个命名实例
        if cls._instance is None:
            cls._instance = {}
        if instance_name not in cls._instance:
            with cls._lock:
                if instance_name not in cls._instance:
                    cls._instance[instance_name] = super().__new__(cls)
                    cls._instance[instance_name]._initialized = False
                    cls._instance[instance_name]._instance_name = instance_name
        return cls._instance[instance_name]

    def __init__(self, instance_name='default'):
        if self._initialized:
            return

        self._initialized = True
        self._client = None
        self._state = MQTTConnectionState.DISCONNECTED
        self._state_lock = threading.Lock()
        self._config = None
        self._subscribed_topics = []
        self._message_callbacks = []
        self._reconnect_thread = None
        self._reconnect_delay = 5
        self._max_reconnect_delay = 60
        self._should_reconnect = True
        self._connection_result = None
        
        # 性能优化：消息队列和批量处理
        self._message_queue = deque(maxlen=1000)
        self._queue_processing = False
        self._queue_lock = threading.Lock()
        self._flush_interval = 1.0  # 批量写入间隔（秒）
        self._last_flush_time = time.time()
        
        # 性能优化：缓存
        self._user_cache = {}
        self._cache_lock = threading.Lock()
        self._cache_ttl = 60  # 缓存有效期（秒）

        self.DEFAULT_CONFIG = {
            'broker': 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
            'port': 8883,
            'client_id': 'score_backend',
            'username': 'phoneboxtest',
            'password': '123456',
            'ssl': True,
            'timeout': 10,
            'keepalive': 60,
            'transport': 'tcp'
        }

        self.DEFAULT_SUBSCRIPTIONS = [
            ('phonebox/status', 1),
            ('phonebox/log', 1),
            ('phonebox/query', 1),
            ('phonebox/heartbeat', 1),
            ('phonebox/unlock/+', 1),
            ('phonebox/ota/status', 1),
            ('phonebox/ota/+/status', 1),
            ('score/add', 1),
            ('score/undo', 1),
            ('score/rules/query', 1)
        ]

    @property
    def state(self):
        with self._state_lock:
            return self._state

    @property
    def is_connected(self):
        return self.state == MQTTConnectionState.CONNECTED

    @property
    def subscribed_topics(self):
        return self._subscribed_topics.copy()

    def set_config(self, config):
        self._config = config

    def load_config_from_db(self):
        try:
            from models import MQTTConfig
            from app import app, db

            with app.app_context():
                config = MQTTConfig.query.first()
                if config:
                    self._config = {
                        'broker': config.broker,
                        'port': config.port,
                        'client_id': config.client_id,
                        'username': config.username,
                        'password': config.password,
                        'ssl': config.ssl,
                        'timeout': config.timeout,
                        'keepalive': config.keepalive
                    }
                    print(f"[MQTTManager] 配置已从数据库加载: broker={config.broker}, port={config.port}")
                    return True
        except Exception as e:
            print(f"[MQTTManager] 从数据库加载配置失败: {e}")

        self._config = self.DEFAULT_CONFIG.copy()
        print(f"[MQTTManager] 使用默认配置")
        return False

    def _get_config(self):
        if self._config is None:
            self.load_config_from_db()
        return self._config or self.DEFAULT_CONFIG

    def _on_connect(self, client, userdata, flags, rc):
        print(f"[MQTTManager] _on_connect 被调用, rc={rc}, flags={flags}")
        with self._state_lock:
            if rc == 0:
                self._state = MQTTConnectionState.CONNECTED
                self._reconnect_delay = 5
                self._should_reconnect = True
                print("[MQTTManager] 连接成功!")
            else:
                self._state = MQTTConnectionState.ERROR
                error_messages = {
                    1: "协议版本错误",
                    2: "客户端标识符无效",
                    3: "服务器不可用",
                    4: "用户名或密码错误",
                    5: "未授权"
                }
                print(f"[MQTTManager] 连接失败, rc={rc}: {error_messages.get(rc, '未知错误')}")

        if self.is_connected:
            for topic, qos in self.DEFAULT_SUBSCRIPTIONS:
                client.subscribe(topic, qos=qos)
                self._subscribed_topics.append(topic)
            print(f"[MQTTManager] 已订阅主题: {[t[0] for t in self.DEFAULT_SUBSCRIPTIONS]}")

    def _on_disconnect(self, client, userdata, rc):
        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []

        print(f"[MQTTManager] 断开连接, rc={rc}")

        if rc != 0 and self._should_reconnect:
            print(f"[MQTTManager] 意外断开，将在 {self._reconnect_delay} 秒后尝试重新连接...")
            self._schedule_reconnect()

    def _on_message(self, client, userdata, msg):
        try:
            message = msg.payload.decode()
            topic = msg.topic

            # 性能优化：异步处理消息
            self._queue_message(topic, message)

            # 关键消息（如查询、开锁回复、OTA状态）立即处理
            if topic == 'phonebox/query' or topic.startswith('phonebox/unlock/') or topic.startswith('phonebox/ota/'):
                self._process_critical_message(topic, message)

        except Exception as e:
            print(f"[MQTTManager] 处理消息失败: {e}")

    def _queue_message(self, topic, message):
        """将消息加入队列，批量处理"""
        with self._queue_lock:
            self._message_queue.append({
                'topic': topic,
                'message': message,
                'timestamp': time.time()
            })
        
        # 检查是否需要立即刷新
        current_time = time.time()
        if (current_time - self._last_flush_time >= self._flush_interval or 
            len(self._message_queue) >= 50):
            self._flush_messages()

    def _flush_messages(self):
        """批量处理队列中的消息"""
        if self._queue_processing:
            return
        
        self._queue_processing = True
        try:
            messages = []
            with self._queue_lock:
                while self._message_queue:
                    messages.append(self._message_queue.popleft())
            
            if messages:
                self._process_messages_batch(messages)
                self._last_flush_time = time.time()
        finally:
            self._queue_processing = False

    def _process_messages_batch(self, messages):
        """批量处理消息"""
        from app import app
        from models import MQTTLog, db
        
        logs_to_insert = []
        heartbeat_data = []
        
        with app.app_context():
            for msg in messages:
                topic = msg['topic']
                message = msg['message']
                timestamp = datetime.fromtimestamp(msg['timestamp'])
                
                # 创建日志记录
                logs_to_insert.append(MQTTLog(
                    topic=topic, 
                    message=message, 
                    direction='receive',
                    timestamp=timestamp
                ))
                
                # 心跳消息单独收集用于更新设备状态
                if topic == 'phonebox/heartbeat':
                    heartbeat_data.append({'topic': topic, 'message': message})
            
            # 批量插入日志
            if logs_to_insert:
                db.session.add_all(logs_to_insert)
                db.session.commit()
                print(f"[MQTTManager] 批量写入 {len(logs_to_insert)} 条日志")
            
            # 处理心跳消息更新设备状态
            for data in heartbeat_data:
                self._process_heartbeat(data['topic'], data['message'])

    def _process_critical_message(self, topic, message):
        """立即处理关键消息（如刷卡查询、OTA状态）"""
        if topic.startswith('phonebox/ota/'):
            self._process_ota_status(topic, message)

        for callback in self._message_callbacks:
            try:
                callback(topic, message)
            except Exception as e:
                print(f"[MQTTManager] 消息回调处理错误: {e}")

    def _process_ota_status(self, topic, message):
        """处理OTA状态消息

        设备通过 phonebox/ota/status 或 phonebox/ota/{device_id}/status 主题
        上报OTA升级进度和结果。
        """
        try:
            data = json.loads(message)
            device_id = data.get('device_id')
            status = data.get('status')
            progress = data.get('progress', -1)
            from_version = data.get('from_version')
            to_version = data.get('to_version')
            error_message = data.get('error_message')

            print(f"[OTA] 设备 {device_id} OTA状态更新: status={status}, progress={progress}%")

            from app import app
            from models import db, DeviceFirmwareUpdate, OperationLog

            with app.app_context():
                if status == 'started':
                    record = DeviceFirmwareUpdate(
                        device_id=device_id,
                        from_version=from_version,
                        to_version=to_version,
                        status='in_progress',
                        started_at=datetime.now()
                    )
                    db.session.add(record)
                    db.session.commit()
                    print(f"[OTA] 设备 {device_id} 开始升级: {from_version} -> {to_version}")

                elif status == 'downloading' or status == 'updating':
                    record = DeviceFirmwareUpdate.query.filter_by(
                        device_id=device_id,
                        to_version=to_version,
                        status='in_progress'
                    ).order_by(DeviceFirmwareUpdate.started_at.desc()).first()

                    if record:
                        print(f"[OTA] 设备 {device_id} 升级进度: {progress}%")
                    else:
                        record = DeviceFirmwareUpdate(
                            device_id=device_id,
                            from_version=from_version,
                            to_version=to_version,
                            status='in_progress',
                            started_at=datetime.now()
                        )
                        db.session.add(record)
                        db.session.commit()

                elif status == 'success' or status == 'completed':
                    record = DeviceFirmwareUpdate.query.filter_by(
                        device_id=device_id,
                        to_version=to_version,
                        status='in_progress'
                    ).order_by(DeviceFirmwareUpdate.started_at.desc()).first()

                    if record:
                        record.status = 'completed'
                        record.completed_at = datetime.now()
                        db.session.commit()
                        print(f"[OTA] 设备 {device_id} 升级成功: {from_version} -> {to_version}")

                    log = OperationLog(
                        operation_type='firmware_upgrade_success',
                        target_type='device',
                        target_id=device_id,
                        operator='OTA System',
                        description=f'设备 {device_id} 固件升级成功: {from_version} -> {to_version}'
                    )
                    db.session.add(log)
                    db.session.commit()

                elif status == 'failed' or status == 'error':
                    record = DeviceFirmwareUpdate.query.filter_by(
                        device_id=device_id,
                        to_version=to_version,
                        status='in_progress'
                    ).order_by(DeviceFirmwareUpdate.started_at.desc()).first()

                    if record:
                        record.status = 'failed'
                        record.completed_at = datetime.now()
                        record.error_message = error_message
                        db.session.commit()
                        print(f"[OTA] 设备 {device_id} 升级失败: {error_message}")

                    log = OperationLog(
                        operation_type='firmware_upgrade_failed',
                        target_type='device',
                        target_id=device_id,
                        operator='OTA System',
                        description=f'设备 {device_id} 固件升级失败: {from_version} -> {to_version}, 错误: {error_message}'
                    )
                    db.session.add(log)
                    db.session.commit()

        except Exception as e:
            print(f"[OTA] 处理OTA状态消息失败: {e}")

    def _process_heartbeat(self, topic, message):
        """处理心跳消息，更新设备状态"""
        try:
            data = json.loads(message)
            device_id = data.get('device_id')
            
            if device_id:
                from app import app
                from models import DeviceHeartbeat, db
                
                with app.app_context():
                    # 更新或创建心跳记录
                    heartbeat = DeviceHeartbeat.query.filter_by(device_id=device_id).first()
                    if heartbeat:
                        heartbeat.timestamp = data.get('timestamp')
                        heartbeat.status = data.get('status')
                        heartbeat.wifi_signal = data.get('wifi_signal')
                        heartbeat.uptime = data.get('uptime')
                        heartbeat.box_a_status = data.get('box_a_status')
                        heartbeat.box_b_status = data.get('box_b_status')
                        heartbeat.system_state = data.get('system_state')
                    else:
                        heartbeat = DeviceHeartbeat(
                            device_id=device_id,
                            timestamp=data.get('timestamp'),
                            status=data.get('status'),
                            wifi_signal=data.get('wifi_signal'),
                            uptime=data.get('uptime'),
                            box_a_status=data.get('box_a_status'),
                            box_b_status=data.get('box_b_status'),
                            system_state=data.get('system_state')
                        )
                        db.session.add(heartbeat)
                    db.session.commit()
                    print(f"设备心跳更新成功: {device_id}")
        except Exception as e:
            print(f"处理心跳消息错误: {e}")

    def _on_error(self, client, userdata, error):
        print(f"[MQTTManager] 客户端错误: {error}")
        with self._state_lock:
            self._state = MQTTConnectionState.ERROR

    def _schedule_reconnect(self):
        if self._reconnect_thread and self._reconnect_thread.is_alive():
            return

        self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)

        def delayed_reconnect():
            time.sleep(self._reconnect_delay)
            if self._should_reconnect and not self.is_connected:
                print(f"[MQTTManager] 执行延迟重连...")
                self.connect()

        self._reconnect_thread = threading.Thread(target=delayed_reconnect, daemon=True)
        self._reconnect_thread.start()

    def connect(self, config=None):
        with self._state_lock:
            if self._state == MQTTConnectionState.CONNECTING:
                print("[MQTTManager] 连接正在进行中...")
                return False
            if self._state == MQTTConnectionState.CONNECTED:
                print("[MQTTManager] 已经连接")
                return True

            self._state = MQTTConnectionState.CONNECTING

        if config:
            self._config = config

        cfg = self._get_config()

        try:
            if self._client:
                try:
                    self._client.loop_stop()
                except:
                    pass
                self._client = None

            broker = cfg.get('broker', self.DEFAULT_CONFIG['broker'])
            port = cfg.get('port', self.DEFAULT_CONFIG['port'])
            client_id = cfg.get('client_id', self.DEFAULT_CONFIG['client_id'])
            username = cfg.get('username', self.DEFAULT_CONFIG['username'])
            password = cfg.get('password', self.DEFAULT_CONFIG['password'])
            ssl_enabled = cfg.get('ssl', self.DEFAULT_CONFIG['ssl'])
            keepalive = cfg.get('keepalive', self.DEFAULT_CONFIG['keepalive'])
            transport = cfg.get('transport', self.DEFAULT_CONFIG.get('transport', 'tcp'))

            client_id = f"{client_id}_{int(time.time())}"

            print(f"[MQTTManager] 创建客户端: {client_id}, transport={transport}")
            
            # 根据配置选择传输方式
            if transport == 'websockets':
                self._client = mqtt.Client(client_id=client_id, clean_session=True, transport='websockets')
                # 设置WebSocket路径
                ws_path = cfg.get('ws_path', '/mqtt')
                self._client.ws_set_options(path=ws_path)
                print(f"[MQTTManager] WebSocket路径: {ws_path}")
            else:
                self._client = mqtt.Client(client_id=client_id, clean_session=True)
            
            self._client.username_pw_set(username, password)

            if ssl_enabled:
                print("[MQTTManager] 配置TLS...")
                self._client.tls_set(ca_certs=None, certfile=None, keyfile=None, 
                                     cert_reqs=ssl.CERT_NONE, tls_version=ssl.PROTOCOL_TLS, ciphers=None)
                self._client.tls_insecure_set(True)
                print("[MQTTManager] TLS配置完成")

            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message
            self._client.on_error = self._on_error
            self._client.reconnect_delay_set(min_delay=1, max_delay=30)

            print(f"[MQTTManager] 连接到 {broker}:{port}...")
            print(f"[MQTTManager] ssl={ssl_enabled}, keepalive={keepalive}")
            
            try:
                self._client.loop_start()
                print("[MQTTManager] loop_start() 调用成功")
            except Exception as e:
                print(f"[MQTTManager] loop_start() 调用失败: {type(e).__name__}: {e}")
                with self._state_lock:
                    self._state = MQTTConnectionState.ERROR
                return False
            
            print("[MQTTManager] 准备调用 connect_async()...")
            try:
                self._client.connect_async(broker, port, keepalive=keepalive)
                print("[MQTTManager] connect_async() 调用成功")
            except Exception as e:
                print(f"[MQTTManager] connect_async() 调用失败: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                with self._state_lock:
                    self._state = MQTTConnectionState.ERROR
                return False

            # 等待连接回调确认
            timeout = cfg.get('timeout', 15)
            print(f"[MQTTManager] 等待连接确认... (超时时间={timeout}秒)")
            for i in range(timeout * 10):
                time.sleep(0.1)
                if i % 10 == 0:
                    print(f"[MQTTManager] 等待连接... {i//10}秒, 当前状态: {self._state.value if self._state else 'None'}")
                if self.is_connected:
                    print(f"[MQTTManager] 检测到已连接!")
                    return True

            print(f"[MQTTManager] 连接确认超时({timeout}秒)")
            with self._state_lock:
                self._state = MQTTConnectionState.ERROR
            return False

        except Exception as e:
            print(f"[MQTTManager] 连接异常: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            with self._state_lock:
                self._state = MQTTConnectionState.ERROR
            return False

    def disconnect(self):
        print("[MQTTManager] 断开连接请求")
        self._should_reconnect = False

        with self._state_lock:
            self._state = MQTTConnectionState.DISCONNECTED
            self._subscribed_topics = []

        if self._client:
            try:
                self._client.disconnect()
                self._client.loop_stop()
            except Exception as e:
                print(f"[MQTTManager] 断开连接时出错: {e}")
            self._client = None

    def publish(self, topic, payload, qos=1):
        if not self.is_connected or not self._client:
            print("[MQTTManager] 发布失败: 未连接", flush=True)
            return False

        try:
            if isinstance(payload, dict):
                payload = json.dumps(payload)
            
            print(f"[MQTTManager] 准备发布消息 - topic: {topic}, payload_length: {len(payload) if payload else 0}, qos: {qos}", flush=True)
            result = self._client.publish(topic, payload, qos=qos)
            
            # 检查发布结果
            if result.rc == 0:
                print(f"[MQTTManager] 发布成功: {topic}", flush=True)
                return True
            else:
                error_messages = {
                    1: "协议错误",
                    2: "无效主题",
                    3: "消息太大",
                    4: "权限不足",
                    5: "服务器不可用"
                }
                print(f"[MQTTManager] 发布失败, rc={result.rc}: {error_messages.get(result.rc, '未知错误')}", flush=True)
                return False
        except Exception as e:
            print(f"[MQTTManager] 发布异常: {type(e).__name__}: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return False

    def subscribe(self, topic, qos=1):
        if not self.is_connected or not self._client:
            print("[MQTTManager] 订阅失败: 未连接")
            return False

        try:
            self._client.subscribe(topic, qos=qos)
            if topic not in self._subscribed_topics:
                self._subscribed_topics.append(topic)
            print(f"[MQTTManager] 订阅主题: {topic}")
            return True
        except Exception as e:
            print(f"[MQTTManager] 订阅异常: {e}")
            return False

    def unsubscribe(self, topic):
        if not self.is_connected or not self._client:
            return False

        try:
            self._client.unsubscribe(topic)
            if topic in self._subscribed_topics:
                self._subscribed_topics.remove(topic)
            print(f"[MQTTManager] 取消订阅: {topic}")
            return True
        except Exception as e:
            print(f"[MQTTManager] 取消订阅异常: {e}")
            return False

    def add_message_callback(self, callback):
        if callback not in self._message_callbacks:
            self._message_callbacks.append(callback)

    def remove_message_callback(self, callback):
        if callback in self._message_callbacks:
            self._message_callbacks.remove(callback)

    def get_status(self):
        return {
            'connected': self.is_connected,
            'state': self.state.value,
            'subscribed_topics': self.subscribed_topics,
            'config': {
                'broker': self._get_config().get('broker'),
                'port': self._get_config().get('port'),
                'ssl': self._get_config().get('ssl')
            }
        }

    def get_cached_user(self, card_id):
        """获取缓存的用户信息"""
        with self._cache_lock:
            if card_id in self._user_cache:
                cached = self._user_cache[card_id]
                if time.time() - cached['timestamp'] < self._cache_ttl:
                    return cached['user']
                else:
                    del self._user_cache[card_id]
        return None

    def set_cached_user(self, card_id, user):
        """缓存用户信息"""
        with self._cache_lock:
            self._user_cache[card_id] = {
                'user': user,
                'timestamp': time.time()
            }

    def clear_cache(self):
        """清除所有缓存"""
        with self._cache_lock:
            self._user_cache.clear()

    def publish_ota_command(self, device_id=None, payload=None):
        """发布OTA固件升级指令

        Args:
            device_id: 目标设备ID（可选，为None时向所有设备广播）
            payload: OTA指令内容，包含:
                - url: 固件下载URL
                - version: 目标版本
                - md5: MD5校验值（可选）
                - force: 是否强制升级（可选）

        Returns:
            bool: 发布是否成功
        """
        if payload is None:
            payload = {}

        if device_id:
            topic = f'phonebox/ota/{device_id}'
        else:
            topic = 'phonebox/ota'

        ota_payload = {
            'action': 'update',
            'timestamp': int(time.time())
        }
        ota_payload.update(payload)

        print(f"[OTA] 发送OTA指令到 {topic}: {json.dumps(ota_payload)}")
        return self.publish(topic, json.dumps(ota_payload), qos=1)


mqtt_manager = MQTTManager()