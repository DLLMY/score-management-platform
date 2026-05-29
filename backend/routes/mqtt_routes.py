from flask_restx import Namespace, Resource, fields
from models import db, MQTTLog, MQTTConfig, User, ScoreRule, ScoreRecord, ProcessedMessage, Device, DeviceHeartbeat, TimeRule
from utils.permission import requires_admin
from services.mqtt_service import publish_mqtt, mqtt_logs, connect_mqtt, mqtt_manager
from datetime import datetime, date
import json

# 延迟导入app以避免循环依赖
def get_app_context():
    from app import app
    return app

ns_mqtt = Namespace('mqtt', description='MQTT相关操作')

mqtt_config_model = ns_mqtt.model('MQTTConfig', {
    'id': fields.Integer(readOnly=True, description='配置ID'),
    'broker': fields.String(description='MQTT Broker地址'),
    'port': fields.Integer(description='端口'),
    'client_id': fields.String(description='客户端ID'),
    'username': fields.String(description='用户名'),
    'password': fields.String(description='密码'),
    'ssl': fields.Boolean(description='是否启用SSL'),
    'timeout': fields.Integer(description='超时时间'),
    'keepalive': fields.Integer(description='心跳间隔')
})

mqtt_publish_model = ns_mqtt.model('MQTTPublish', {
    'topic': fields.String(required=True, description='MQTT主题'),
    'message': fields.String(required=True, description='消息内容')
})

mqtt_status_response = ns_mqtt.model('MQTTStatusResponse', {
    'connected': fields.Boolean(description='是否已连接'),
    'subscribed_topics': fields.List(fields.String, description='已订阅的主题列表')
})

def check_time_valid(box_id, hour, minute):
    time_rules = TimeRule.query.filter_by(is_active=True).all()
    if not time_rules:
        return True
    
    for rule in time_rules:
        if rule.day_of_week == -1 or rule.day_of_week == datetime.now().weekday():
            start_time = datetime.now().replace(hour=rule.start_hour, minute=rule.start_minute, second=0)
            end_time = datetime.now().replace(hour=rule.end_hour, minute=rule.end_minute, second=0)
            current_time = datetime.now().replace(hour=hour, minute=minute, second=0)
            
            if start_time <= current_time <= end_time:
                return rule.allow_unlock
    
    return False

def check_rule_limit(user_id, rule_id):
    rule = ScoreRule.query.get(rule_id)
    if not rule:
        return {'allow': False, 'message': '规则不存在'}
    
    if rule.daily_limit <= 0:
        return {'allow': True, 'message': '无限制'}
    
    today = datetime.now().date()
    records = ScoreRecord.query.filter(
        ScoreRecord.user_id == user_id,
        ScoreRecord.rule_id == rule_id,
        ScoreRecord.created_at >= datetime.combine(today, datetime.min.time())
    ).all()
    
    total_score = sum(r.score_change for r in records)
    if total_score >= rule.daily_limit:
        return {'allow': False, 'message': f'今日已达到上限 ({total_score}/{rule.daily_limit})'}
    
    if rule.min_interval > 0:
        last_record = ScoreRecord.query.filter(
            ScoreRecord.user_id == user_id,
            ScoreRecord.rule_id == rule_id
        ).order_by(ScoreRecord.created_at.desc()).first()
        
        if last_record and (datetime.now() - last_record.created_at).total_seconds() < rule.min_interval:
            return {'allow': False, 'message': f'操作过于频繁，请等待 {rule.min_interval} 秒'}
    
    return {'allow': True, 'message': '通过'}

def apply_score_limit(score):
    from models import SystemConfig
    config = SystemConfig.query.first()
    if config:
        return max(config.min_score, min(config.max_score, score))
    return max(0, min(100, score))

def publish_unlock_result(box_id, success, reason, score=None):
    topic = f'phonebox/unlock/{box_id}'
    payload = {
        'result': 'true' if success else 'false',  # 设备端期望字符串格式
        'reason': reason,
        'current_score': score
    }
    publish_mqtt(topic, json.dumps(payload))

def handle_mqtt_message(client, topic, message):
    """处理MQTT消息 - 优化版"""
    print(f"收到消息: {topic} -> {message}")
    
    # 添加到内存日志（用于实时显示）
    mqtt_logs.append({
        'topic': topic,
        'message': message,
        'direction': 'receive',
        'timestamp': datetime.now().isoformat()
    })
    
    # 关键消息：刷卡查询 - 需要即时响应
    if topic == 'phonebox/query':
        try:
            data = json.loads(message)
            box_id = data.get('box_id', 'A')
            card_id = data.get('card_id')
            hour = data.get('hour')
            minute = data.get('minute')
            
            print(f"收到查询请求: box_id={box_id}, card_id={card_id}, hour={hour}, minute={minute}")
            
            # 使用延迟导入获取app
            app = get_app_context()
            with app.app_context():
                # 时间验证
                if not check_time_valid(box_id, hour, minute):
                    print(f"时间验证失败，拒绝开锁")
                    publish_unlock_result(box_id, False, 'not_in_time')
                    return
                
                if not card_id:
                    print(f"卡号为空")
                    publish_unlock_result(box_id, False, 'card_not_found')
                    return
                
                # 性能优化：尝试从缓存获取用户
                user = mqtt_manager.get_cached_user(card_id)
                
                if not user:
                    # 缓存未命中，从数据库查询
                    user = User.query.filter_by(card_id=card_id).first()
                    if user:
                        # 将用户信息缓存起来（线程安全）
                        mqtt_manager.set_cached_user(card_id, user)
                
                if not user:
                    print(f"未找到用户: {card_id}")
                    publish_unlock_result(box_id, False, 'card_not_found')
                elif user.current_score < 60:
                    print(f"积分不足: {user.name} ({user.current_score}分)")
                    publish_unlock_result(box_id, False, 'score_low', user.current_score)
                else:
                    print(f"开锁成功: {user.name} ({user.current_score}分)")
                    
                    # 记录积分扣除
                    user.current_score -= 10
                    user.current_score = max(0, user.current_score)
                    
                    record = ScoreRecord(
                        user_id=user.id,
                        score_change=-10,
                        description='开锁扣积分',
                        operator='MQTT系统'
                    )
                    db.session.add(record)
                    db.session.commit()
                    
                    # 更新缓存中的用户积分
                    mqtt_manager.set_cached_user(card_id, user)
                    
                    publish_unlock_result(box_id, True, 'score_ok', user.current_score)
                        
        except Exception as e:
            print(f"处理查询消息错误: {e}")
            import traceback
            traceback.print_exc()
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
            
            # 使用延迟导入获取app
            app = get_app_context()
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
            
            # 使用延迟导入获取app
            app = get_app_context()
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
                    publish_mqtt(response_topic, json.dumps(response))
                    return
                
                user = User.query.get(user_id)
                if not user:
                    response = {'success': False, 'message': '用户不存在', 'msg_id': msg_id}
                    publish_mqtt(response_topic, json.dumps(response))
                elif rule_id:
                    rule = ScoreRule.query.get(rule_id)
                    if not rule or not rule.is_active:
                        response = {'success': False, 'message': '规则无效或未启用', 'msg_id': msg_id}
                        publish_mqtt(response_topic, json.dumps(response))
                    else:
                        limit_check = check_rule_limit(user_id, rule_id)
                        if not limit_check['allow']:
                            response = {'success': False, 'message': limit_check['message'], 'msg_id': msg_id}
                            publish_mqtt(response_topic, json.dumps(response))
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
                            publish_mqtt(response_topic, json.dumps(response))
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
                        publish_mqtt(response_topic, json.dumps(response))
                    else:
                        limit_check = check_rule_limit(user_id, rule.id)
                        if not limit_check['allow']:
                            response = {'success': False, 'message': limit_check['message'], 'msg_id': msg_id}
                            publish_mqtt(response_topic, json.dumps(response))
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
                            publish_mqtt(response_topic, json.dumps(response))
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
                    publish_mqtt(response_topic, json.dumps(response))
                else:
                    response = {'success': False, 'message': '需要提供 rule_id、rule_name 或 score_change', 'msg_id': msg_id}
                    publish_mqtt(response_topic, json.dumps(response))
        except Exception as e:
            print(f"处理加分消息错误: {e}")
    elif topic == 'score/undo':
        try:
            data = json.loads(message)
            undo_code = data.get('undo_code')
            client_id = data.get('client_id')
            reason = data.get('reason', 'MQTT撤销')
            
            response_topic = f'score/undo/result/{client_id}' if client_id else 'score/undo/result'
            
            if not undo_code or not undo_code.startswith('UNDO_'):
                response = {'success': False, 'message': '无效的撤销代码'}
                publish_mqtt(response_topic, json.dumps(response))
                return
            
            record_id = int(undo_code.replace('UNDO_', ''))
            
            # 使用延迟导入获取app
            app = get_app_context()
            with app.app_context():
                record = ScoreRecord.query.get(record_id)
                if not record:
                    response = {'success': False, 'message': f'找不到记录 ID: {record_id}'}
                elif '已撤销' in (record.description or ''):
                    response = {'success': False, 'message': '该记录已被撤销'}
                else:
                    user = User.query.get(record.user_id)
                    if user:
                        user.current_score -= record.score_change
                        user.current_score = max(0, user.current_score)
                    
                    record.description = f'{record.description} [已撤销: {reason}]'
                    record.operator = 'MQTT撤销'
                    db.session.commit()
                    
                    response = {
                        'success': True,
                        'message': f'撤销成功 ({record.score_change:+d}分已回滚)',
                        'user_id': user.id if user else None,
                        'new_score': user.current_score if user else None
                    }
                publish_mqtt(response_topic, json.dumps(response))
        except Exception as e:
            print(f"处理撤销消息错误: {e}")

@ns_mqtt.route('/logs')
class MQTTLogs(Resource):
    @ns_mqtt.doc('get_mqtt_logs', description='获取MQTT日志')
    @ns_mqtt.response(200, '成功')
    def get(self):
        """
        获取MQTT日志
        
        获取最近的MQTT消息日志记录，最多返回100条。
        """
        logs = MQTTLog.query.order_by(MQTTLog.timestamp.desc()).limit(100).all()
        return [{
            'id': l.id,
            'topic': l.topic,
            'message': l.message,
            'direction': l.direction,
            'timestamp': l.timestamp.isoformat() if l.timestamp else None
        } for l in logs]

@ns_mqtt.route('/config')
class MQTTConfigResource(Resource):
    @ns_mqtt.doc('get_mqtt_config', description='获取MQTT配置')
    @ns_mqtt.response(200, '成功')
    def get(self):
        """
        获取MQTT配置
        
        获取当前的MQTT连接配置信息。
        """
        config = MQTTConfig.query.first()
        if not config:
            config = MQTTConfig()
            db.session.add(config)
            db.session.commit()
        return {
            'id': config.id,
            'broker': config.broker,
            'port': config.port,
            'client_id': config.client_id,
            'username': config.username,
            'password': '******',
            'ssl': config.ssl,
            'timeout': config.timeout,
            'keepalive': config.keepalive,
            'updated_at': config.updated_at.isoformat() if config.updated_at else None
        }

    @ns_mqtt.doc('update_mqtt_config', description='更新MQTT配置', security='Bearer')
    @ns_mqtt.expect(mqtt_config_model)
    @ns_mqtt.response(200, '更新成功')
    @requires_admin
    def put(self):
        """
        更新MQTT配置
        
        更新MQTT连接配置，需要管理员权限。
        """
        config = MQTTConfig.query.first()
        if not config:
            config = MQTTConfig()
        
        data = ns_mqtt.payload
        config.broker = data.get('broker', config.broker)
        config.port = data.get('port', config.port)
        config.client_id = data.get('client_id', config.client_id)
        config.username = data.get('username', config.username)
        if data.get('password') and data.get('password') != '******':
            config.password = data.get('password')
        config.ssl = data.get('ssl', config.ssl)
        config.timeout = data.get('timeout', config.timeout)
        config.keepalive = data.get('keepalive', config.keepalive)
        config.updated_at = datetime.now()
        
        db.session.add(config)
        db.session.commit()
        return {'success': True, 'message': 'MQTT配置更新成功'}

@ns_mqtt.route('/status')
class MQTTStatus(Resource):
    @ns_mqtt.doc('get_mqtt_status', description='获取MQTT连接状态')
    @ns_mqtt.response(200, '成功', mqtt_status_response)
    def get(self):
        """
        获取MQTT连接状态
        
        获取当前MQTT连接的状态信息。
        """
        status = mqtt_manager.get_status()
        return {
            'connected': status['connected'],
            'subscribed_topics': status['subscribed_topics']
        }

@ns_mqtt.route('/publish')
class MQTTPublish(Resource):
    @ns_mqtt.doc('publish_mqtt_message', description='发布MQTT消息', security='Bearer')
    @ns_mqtt.expect(mqtt_publish_model)
    @ns_mqtt.response(200, '发布成功')
    @ns_mqtt.response(400, '参数错误')
    @requires_admin
    def post(self):
        """
        发布MQTT消息
        
        向指定主题发布MQTT消息，需要管理员权限。
        
        请求体：
        - topic: MQTT主题（必填）
        - message: 消息内容（必填）
        """
        data = ns_mqtt.payload
        topic = data.get('topic')
        message = data.get('message')
        
        if not topic or message is None:
            return {'success': False, 'message': '需要提供 topic 和 message'}, 400
        
        result = publish_mqtt(topic, json.dumps(message) if isinstance(message, dict) else str(message))
        return {'success': result, 'message': '发布成功' if result else '发布失败'}

@ns_mqtt.route('/recent')
class MQTTRecentLogs(Resource):
    @ns_mqtt.doc('get_recent_mqtt_logs', description='获取最近MQTT日志')
    @ns_mqtt.response(200, '成功')
    def get(self):
        """
        获取最近MQTT日志
        
        获取内存中的最近MQTT消息日志，最多50条。
        """
        return mqtt_logs[-50:] if len(mqtt_logs) > 50 else mqtt_logs

mqtt_connect_model = ns_mqtt.model('MQTTConnect', {
    'broker': fields.String(description='MQTT Broker地址'),
    'port': fields.Integer(description='端口'),
    'client_id': fields.String(description='客户端ID'),
    'username': fields.String(description='用户名'),
    'password': fields.String(description='密码'),
    'ssl': fields.Boolean(description='是否启用SSL'),
    'timeout': fields.Integer(description='超时时间'),
    'keepalive': fields.Integer(description='心跳间隔'),
    'transport': fields.String(description='传输协议（tcp/websocket）'),
    'ws_path': fields.String(description='WebSocket路径')
})

mqtt_subscribe_model = ns_mqtt.model('MQTTSubscribe', {
    'topic': fields.String(required=True, description='MQTT主题'),
    'qos': fields.Integer(description='QoS级别（0/1/2）')
})

mqtt_unlock_model = ns_mqtt.model('MQTTUnlock', {
    'box_id': fields.String(description='箱子ID（A/B）')
})

@ns_mqtt.route('/connect')
class MQTTConnect(Resource):
    @ns_mqtt.doc('connect_mqtt', description='连接MQTT服务器')
    @ns_mqtt.expect(mqtt_connect_model)
    @ns_mqtt.response(200, '连接成功')
    @ns_mqtt.response(500, '连接失败')
    def post(self):
        """
        连接MQTT服务器
        
        连接到MQTT Broker服务器。如果已连接则直接返回成功。
        可以不传入参数，使用数据库中保存的配置或默认配置。
        
        请求体（可选）：
        - broker: MQTT Broker地址
        - port: 端口
        - client_id: 客户端ID
        - username: 用户名
        - password: 密码
        - ssl: 是否启用SSL
        - timeout: 超时时间
        - keepalive: 心跳间隔
        - transport: 传输协议（tcp/websocket）
        - ws_path: WebSocket路径
        """
        print("=== MQTT连接API被调用 ===")
        try:
            if mqtt_manager.is_connected:
                print("MQTT已经连接，无需重新连接")
                return {'success': True, 'message': 'MQTT已经连接', 'status': 'connected'}
            
            config_dict = None
            from app import app as flask_app
            with flask_app.app_context():
                config = MQTTConfig.query.first()
                if config:
                    config_dict = {
                        'broker': config.broker,
                        'port': config.port,
                        'client_id': config.client_id,
                        'username': config.username,
                        'password': config.password,
                        'ssl': config.ssl,
                        'timeout': config.timeout,
                        'keepalive': config.keepalive
                    }

            data = None
            try:
                data = ns_mqtt.payload
            except:
                pass

            if data:
                config_dict = {
                    'broker': data.get('broker', config_dict['broker'] if config_dict else 'nc5233fc.ala.cn-hangzhou.emqxsl.cn'),
                    'port': data.get('port', config_dict['port'] if config_dict else 8883),
                    'client_id': data.get('client_id', config_dict['client_id'] if config_dict else 'score_backend'),
                    'username': data.get('username', config_dict['username'] if config_dict else 'phoneboxtest'),
                    'password': data.get('password', config_dict['password'] if config_dict else '123456'),
                    'ssl': data.get('ssl', config_dict['ssl'] if config_dict else True),
                    'timeout': data.get('timeout', config_dict['timeout'] if config_dict else 10),
                    'keepalive': data.get('keepalive', config_dict['keepalive'] if config_dict else 60),
                    'transport': data.get('transport', 'tcp'),
                    'ws_path': data.get('ws_path', '/mqtt')
                }
            else:
                if not config_dict:
                    config_dict = {
                        'broker': 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
                        'port': 8883,
                        'client_id': 'score_backend',
                        'username': 'phoneboxtest',
                        'password': '123456',
                        'ssl': True,
                        'timeout': 10,
                        'keepalive': 60,
                        'transport': 'tcp',
                        'ws_path': '/mqtt'
                    }
                else:
                    config_dict['transport'] = 'tcp'
                    config_dict['ws_path'] = '/mqtt'

            print(f"使用配置: broker={config_dict['broker']}, port={config_dict['port']}, transport={config_dict['transport']}")

            result = connect_mqtt(config_dict)

            if result:
                print("MQTT连接成功!")
                return {'success': True, 'message': 'MQTT连接成功'}
            else:
                print("MQTT连接失败")
                return {'success': False, 'message': 'MQTT连接失败'}, 500

        except Exception as e:
            print(f"MQTT连接失败: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'message': f'MQTT连接失败: {str(e)}'}, 500

@ns_mqtt.route('/disconnect')
class MQTTDisconnect(Resource):
    @ns_mqtt.doc('disconnect_mqtt', description='断开MQTT连接')
    @ns_mqtt.response(200, '断开成功')
    @ns_mqtt.response(500, '断开失败')
    def post(self):
        """
        断开MQTT连接
        
        断开与MQTT Broker的连接。
        """
        try:
            mqtt_manager.disconnect()
            return {'success': True, 'message': 'MQTT已断开连接'}
        except Exception as e:
            return {'success': False, 'message': f'MQTT断开连接错误: {str(e)}'}, 500

@ns_mqtt.route('/subscribe')
class MQTTSubscribe(Resource):
    @ns_mqtt.doc('subscribe_mqtt_topic', description='订阅MQTT主题')
    @ns_mqtt.expect(mqtt_subscribe_model)
    @ns_mqtt.response(200, '订阅成功')
    @ns_mqtt.response(400, '参数错误')
    @ns_mqtt.response(500, '订阅失败')
    def post(self):
        """
        订阅MQTT主题
        
        订阅指定的MQTT主题。
        
        请求体：
        - topic: MQTT主题（必填）
        - qos: QoS级别（可选，默认0）
        """
        data = ns_mqtt.payload
        topic = data.get('topic')
        qos = data.get('qos', 0)

        if not topic:
            return {'success': False, 'message': '需要提供主题'}, 400

        result = mqtt_manager.subscribe(topic, qos)
        if result:
            return {'success': True, 'message': f'订阅成功: {topic}'}
        else:
            return {'success': False, 'message': '订阅失败，MQTT未连接'}, 500

@ns_mqtt.route('/unsubscribe')
class MQTTUnsubscribe(Resource):
    @ns_mqtt.doc('unsubscribe_mqtt_topic', description='取消订阅MQTT主题')
    @ns_mqtt.expect(mqtt_subscribe_model)
    @ns_mqtt.response(200, '取消订阅成功')
    @ns_mqtt.response(400, '参数错误')
    @ns_mqtt.response(500, '取消订阅失败')
    def post(self):
        """
        取消订阅MQTT主题
        
        取消订阅指定的MQTT主题。
        
        请求体：
        - topic: MQTT主题（必填）
        """
        data = ns_mqtt.payload
        topic = data.get('topic')

        if not topic:
            return {'success': False, 'message': '需要提供主题'}, 400

        result = mqtt_manager.unsubscribe(topic)
        if result:
            return {'success': True, 'message': f'取消订阅成功: {topic}'}
        else:
            return {'success': False, 'message': '取消订阅失败，MQTT未连接'}, 500

@ns_mqtt.route('/unlock')
class MQTTUnlock(Resource):
    @ns_mqtt.doc('publish_unlock_command', description='发送开锁命令')
    @ns_mqtt.expect(mqtt_unlock_model)
    @ns_mqtt.response(200, '发送成功')
    def post(self):
        """
        发送开锁命令
        
        向指定的箱子发送开锁命令。A箱开锁无需验证，B箱开锁需要验证积分。
        
        请求体：
        - box_id: 箱子ID（A/B，默认A）
        """
        
        try:
            topic = f'phonebox/unlock/{box_id}'
            
            # A箱开锁发送空消息（无需验证）
            if box_id == 'A':
                payload = ''
            # B箱开锁发送JSON格式消息（需验证）
            else:
                payload = json.dumps({
                    'result': data.get('response', {}).get('result', 'false'),
                    'reason': data.get('response', {}).get('reason', 'manual'),
                    'current_score': data.get('response', {}).get('current_score')
                })
            
            result = publish_mqtt(topic, payload)
            if result:
                return {'success': True, 'message': f'已发送开锁指令到 {topic}'}
            else:
                return {'success': False, 'message': '发送失败，MQTT未连接'}, 500
        except Exception as e:
            return {'success': False, 'message': f'发送错误: {str(e)}'}, 500