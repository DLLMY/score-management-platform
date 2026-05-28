"""MQTT消息队列服务 - 提供消息缓冲、重试和批量处理功能"""
import json
import time
import threading
from queue import Queue, Empty
from datetime import datetime
from services.mqtt_service import mqtt_manager

class MQTTQueueService:
    """MQTT消息队列服务"""
    
    def __init__(self, max_queue_size=1000, retry_max=3, retry_delay=1.0):
        self.message_queue = Queue(maxsize=max_queue_size)
        self.max_queue_size = max_queue_size
        self.retry_max = retry_max
        self.retry_delay = retry_delay
        self.is_running = False
        self.worker_thread = None
        self.stats = {
            'enqueued': 0,
            'processed': 0,
            'failed': 0,
            'retried': 0
        }
        
    def start(self):
        """启动消息队列服务"""
        if not self.is_running:
            self.is_running = True
            self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
            self.worker_thread.start()
            print("MQTT消息队列服务已启动")
    
    def stop(self):
        """停止消息队列服务"""
        self.is_running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        print("MQTT消息队列服务已停止")
    
    def enqueue_message(self, topic, payload, qos=0, retain=False):
        """将消息加入队列"""
        if self.message_queue.full():
            # 队列满时，移除最老的消息（FIFO策略）
            try:
                self.message_queue.get_nowait()
                self.stats['failed'] += 1
            except Empty:
                pass
        
        message = {
            'topic': topic,
            'payload': json.dumps(payload) if isinstance(payload, dict) else str(payload),
            'qos': qos,
            'retain': retain,
            'retry_count': 0,
            'timestamp': time.time(),
            'message_id': f"{int(time.time() * 1000)}_{id(payload)}"
        }
        
        self.message_queue.put(message)
        self.stats['enqueued'] += 1
        return True
    
    def _process_queue(self):
        """处理队列中的消息"""
        while self.is_running:
            try:
                # 阻塞等待消息，超时1秒检查是否继续运行
                message = self.message_queue.get(timeout=1)
                
                success = self._process_message(message)
                
                if success:
                    self.stats['processed'] += 1
                else:
                    self.stats['failed'] += 1
                
                self.message_queue.task_done()
            except Empty:
                continue
            except Exception as e:
                print(f"处理消息队列异常: {e}")
    
    def _process_message(self, message):
        """处理单个消息"""
        topic = message['topic']
        payload = message['payload']
        qos = message['qos']
        retry_count = message['retry_count']
        
        # 检查连接状态
        if not mqtt_manager.is_connected:
            # 重新连接
            mqtt_manager.connect()
            time.sleep(1)
        
        for attempt in range(retry_count + 1, self.retry_max + 1):
            try:
                result = mqtt_manager.publish(topic, payload, qos)
                
                if result:
                    return True
                else:
                    raise Exception("发布失败")
                    
            except Exception as e:
                if attempt < self.retry_max:
                    self.stats['retried'] += 1
                    message['retry_count'] = attempt
                    # 指数退避等待
                    wait_time = self.retry_delay * (2 ** (attempt - 1))
                    time.sleep(wait_time)
                    continue
                else:
                    # 超过重试次数，记录失败消息
                    self._log_failed_message(message, str(e))
                    return False
        
        return False
    
    def _log_failed_message(self, message, error):
        """记录失败的消息"""
        try:
            from app import app
            from models import db, OperationLog
            with app.app_context():
                log = OperationLog(
                    operation_type='mqtt_message_failed',
                    target_type='mqtt',
                    description=f"MQTT消息发送失败: {message['topic']}",
                    after_data=json.dumps({
                        'message': message,
                        'error': error
                    }),
                    operator='MQTT队列'
                )
                db.session.add(log)
                db.session.commit()
        except Exception as e:
            print(f"记录失败消息日志失败: {e}")
    
    def get_stats(self):
        """获取队列统计信息"""
        return {
            'queue_size': self.message_queue.qsize(),
            'max_queue_size': self.max_queue_size,
            'is_running': self.is_running,
            **self.stats
        }
    
    def flush(self):
        """刷新队列（等待所有消息处理完成）"""
        self.message_queue.join()
    
    def clear(self):
        """清空队列"""
        while not self.message_queue.empty():
            try:
                self.message_queue.get_nowait()
                self.message_queue.task_done()
            except Empty:
                pass

# 全局消息队列实例
mqtt_queue = MQTTQueueService()

# 批量消息处理工具
class MQTTBatchProcessor:
    """MQTT批量消息处理器"""
    
    def __init__(self, batch_size=10, batch_timeout=5.0):
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.batch_queue = []
        self.lock = threading.Lock()
        self.timer = None
    
    def add_message(self, topic, payload, qos=0):
        """添加消息到批量队列"""
        with self.lock:
            self.batch_queue.append({
                'topic': topic,
                'payload': json.dumps(payload) if isinstance(payload, dict) else str(payload),
                'qos': qos,
                'timestamp': time.time()
            })
            
            # 检查是否达到批量处理阈值
            if len(self.batch_queue) >= self.batch_size:
                self._process_batch()
            elif self.timer is None:
                # 设置定时器
                self.timer = threading.Timer(self.batch_timeout, self._process_batch)
                self.timer.start()
    
    def _process_batch(self):
        """处理批量消息"""
        with self.lock:
            if not self.batch_queue:
                return
            
            batch = self.batch_queue.copy()
            self.batch_queue = []
            
            if self.timer:
                self.timer.cancel()
                self.timer = None
        
        # 批量发布消息
        success_count = 0
        for message in batch:
            try:
                result = mqtt_manager.publish(message['topic'], message['payload'], message['qos'])
                if result:
                    success_count += 1
            except Exception as e:
                print(f"批量发布消息失败: {e}")
        
        print(f"批量处理完成: {success_count}/{len(batch)} 成功")
    
    def flush(self):
        """立即处理剩余消息"""
        with self.lock:
            if self.batch_queue:
                self._process_batch()

# 全局批量处理器实例
mqtt_batch_processor = MQTTBatchProcessor()

# 便捷函数
def enqueue_mqtt_message(topic, payload, qos=0, retain=False):
    """便捷函数：将消息加入队列"""
    return mqtt_queue.enqueue_message(topic, payload, qos, retain)

def batch_publish_mqtt(topic, payload, qos=0):
    """便捷函数：批量发布消息"""
    return mqtt_batch_processor.add_message(topic, payload, qos)

def get_queue_stats():
    """便捷函数：获取队列统计"""
    return mqtt_queue.get_stats()

def start_mqtt_queue():
    """便捷函数：启动消息队列"""
    mqtt_queue.start()

def stop_mqtt_queue():
    """便捷函数：停止消息队列"""
    mqtt_queue.stop()