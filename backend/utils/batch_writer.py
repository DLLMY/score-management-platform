import logging
import threading
import time
from typing import Any, Callable, Dict, List
from models import db
import atexit
from collections import deque

"""
批量写入优化模块
功能：实现高效的数据库批量写入、消息队列管理和事务优化
作者：开发团队
日期：2026-06-14
"""
logger = logging.getLogger(__name__)


class BatchWriteConfig:
    """批量写入配置"""

    def __init__(self):
        # 批量大小配置
        self.batch_size = 100  # 每批处理的消息数量
        self.max_batch_size = 500  # 最大批次大小
        # 时间配置
        self.flush_interval = 1.0  # 刷新间隔（秒）
        self.max_wait_time = 5.0  # 最大等待时间（秒）
        # 队列配置
        self.queue_max_size = 10000  # 队列最大容量
        # 重试配置
        self.max_retries = 3  # 最大重试次数
        self.retry_delay = 1.0  # 重试延迟（秒）
        self.exponential_backoff = True  # 指数退避
        # 性能配置
        self.use_transaction = True  # 使用事务
        self.commit_batch_size = 50  # 分批提交大小
        # 优先级配置
        self.priority_enabled = True  # 启用优先级队列
        self.high_priority_threshold = 5  # 高优先级阈值


class BatchWriter:
    """批量写入管理器"""

    def __init__(self, config: BatchWriteConfig = None):
        self._config = config or BatchWriteConfig()
        # 消息队列
        self._queue = deque(maxlen=self._config.queue_max_size)
        self._queue_lock = threading.Lock()
        # 处理状态
        self._is_processing = False
        self._is_shutdown = False
        self._last_flush_time = time.time()
        # 统计
        self._stats = {
            "total_received": 0,
            "total_processed": 0,
            "total_failed": 0,
            "total_retried": 0,
            "batch_count": 0,
            "avg_batch_size": 0,
            "last_batch_time": None,
            "queue_peak_size": 0,
        }
        self._stats_lock = threading.Lock()
        # 处理器
        self._handlers: List[Callable] = []
        self._handler_lock = threading.Lock()
        # 后台线程
        self._worker_thread = None
        self._should_run = False

    def start(self):
        """启动批量写入器"""
        if self._worker_thread and self._worker_thread.is_alive():
            logger.warning("[BatchWriter] 批量写入器已在运行")
            return
        self._should_run = True
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()
        logger.info("[BatchWriter] 批量写入器已启动")

    def stop(self):
        """停止批量写入器"""
        self._should_run = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5)
        logger.info("[BatchWriter] 批量写入器已停止")

    def add_handler(self, handler: Callable):
        """
        添加消息处理器
        Args:
            handler: 处理函数，签名为 handle_batch(messages: List[Dict]) -> bool
        """
        with self._handler_lock:
            if handler not in self._handlers:
                self._handlers.append(handler)

    def remove_handler(self, handler: Callable):
        """移除消息处理器"""
        with self._handler_lock:
            if handler in self._handlers:
                self._handlers.remove(handler)

    def enqueue(self, message: Dict[str, Any], priority: int = 10):
        """
        添加消息到队列
        Args:
            message: 消息数据
            priority: 优先级（数字越小优先级越高）
        """
        if self._is_shutdown:
            logger.warning("[BatchWriter] 批量写入器已关闭，拒绝新消息")
            return False
        msg_data = {
            "data": message,
            "priority": priority,
            "timestamp": time.time(),
            "retry_count": 0,
        }
        with self._queue_lock:
            self._queue.append(msg_data)
            self._stats["total_received"] += 1
            # 更新队列峰值
            if len(self._queue) > self._stats["queue_peak_size"]:
                self._stats["queue_peak_size"] = len(self._queue)
        # 检查是否需要立即处理
        self._check_flush()
        return True

    def enqueue_batch(self, messages: List[Dict[str, Any]], priority: int = 10):
        """
        批量添加消息
        Args:
            messages: 消息列表
            priority: 优先级
        """
        for msg in messages:
            self.enqueue(msg, priority)

    def _check_flush(self):
        """检查是否需要刷新队列"""
        current_time = time.time()
        queue_size = len(self._queue)
        # 条件判断：达到批次大小 或 超过最大等待时间
        should_flush = queue_size >= self._config.batch_size or (
            queue_size > 0 and current_time - self._last_flush_time >= self._config.max_wait_time
        )
        if should_flush and not self._is_processing:
            threading.Thread(target=self.flush, daemon=True).start()

    def flush(self) -> int:
        """
        手动刷新队列
        Returns:
            处理的消息数量
        """
        if self._is_processing:
            return 0
        self._is_processing = True
        processed_count = 0
        try:
            # 获取消息
            with self._queue_lock:
                batch_size = min(len(self._queue), self._config.max_batch_size)
                batch = []
                for _ in range(batch_size):
                    if self._queue:
                        batch.append(self._queue.popleft())
                if not batch:
                    return 0
            if batch:
                # 按优先级排序
                if self._config.priority_enabled:
                    batch.sort(key=lambda x: x["priority"])
                # 调用处理器
                success = self._process_batch(batch)
                if success:
                    processed_count = len(batch)
                    self._update_stats_on_success(processed_count)
                else:
                    # 处理失败，重试
                    self._retry_batch(batch)
                    processed_count = 0
                self._last_flush_time = time.time()
        except Exception as e:
            logger.error(f"[BatchWriter] 刷新队列失败: {e}")
        finally:
            self._is_processing = False
        return processed_count

    def _process_batch(self, batch: List[Dict]) -> bool:
        """
        处理一批消息
        Args:
            batch: 消息批次
        Returns:
            是否成功
        """
        if not batch:
            return True
        messages = [msg["data"] for msg in batch]
        with self._handler_lock:
            if not self._handlers:
                logger.warning("[BatchWriter] 没有注册的消息处理器")
                return True
            for handler in self._handlers:
                try:
                    result = handler(messages)  # noqa: F841
                    if not result:
                        logger.warning(f"[BatchWriter] 处理器 {handler.__name__} 返回失败")
                        return False
                except Exception as e:
                    logger.error(f"[BatchWriter] 处理器执行失败: {e}")
                    return False
        return True

    def _retry_batch(self, batch: List[Dict]):
        """重试处理失败的批次"""
        for msg in batch:
            msg["retry_count"] += 1
            if msg["retry_count"] < self._config.max_retries:
                # 重新加入队列
                delay = self._config.retry_delay
                if self._config.exponential_backoff:
                    delay *= 2 ** (msg["retry_count"] - 1)
                with self._queue_lock:
                    self._queue.append(msg)
                    self._stats["total_retried"] += 1
                logger.info(
                    f"[BatchWriter] 消息重试 ({msg['retry_count']}/{self._config.max_retries})"
                )
            else:
                # 超过最大重试次数，丢弃
                self._update_stats_on_failure()
                logger.error("[BatchWriter] 消息超过最大重试次数，已丢弃")

    def _worker_loop(self):
        """后台工作循环"""
        while self._should_run:
            try:
                current_time = time.time()
                # 检查是否需要刷新
                queue_size = len(self._queue)
                time_since_last_flush = current_time - self._last_flush_time
                should_flush = queue_size >= self._config.batch_size or (
                    queue_size > 0 and time_since_last_flush >= self._config.flush_interval
                )
                if should_flush and not self._is_processing:
                    self.flush()
                # 休眠
                time.sleep(0.1)
            except Exception as e:
                logger.error(f"[BatchWriter] 工作线程异常: {e}")
                time.sleep(1)

    def _update_stats_on_success(self, count: int):
        """更新成功统计"""
        with self._stats_lock:
            self._stats["total_processed"] += count
            self._stats["batch_count"] += 1
            self._stats["last_batch_time"] = time.time()
            # 计算平均批次大小
            total = self._stats["total_processed"]
            batches = self._stats["batch_count"]
            self._stats["avg_batch_size"] = total / batches if batches > 0 else 0

    def _update_stats_on_failure(self):
        """更新失败统计"""
        with self._stats_lock:
            self._stats["total_failed"] += 1

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self._stats_lock:
            stats = self._stats.copy()
        with self._queue_lock:
            stats["current_queue_size"] = len(self._queue)
        return stats

    def reset_stats(self):
        """重置统计"""
        with self._stats_lock:
            self._stats = {
                "total_received": 0,
                "total_processed": 0,
                "total_failed": 0,
                "total_retried": 0,
                "batch_count": 0,
                "avg_batch_size": 0,
                "last_batch_time": None,
                "queue_peak_size": 0,
            }

    @property
    def queue_size(self) -> int:
        """获取当前队列大小"""
        with self._queue_lock:
            return len(self._queue)

    @property
    def is_empty(self) -> bool:
        """队列是否为空"""
        with self._queue_lock:
            return len(self._queue) == 0


class MQTTLogBatchWriter(BatchWriter):
    """MQTT日志批量写入器"""

    def __init__(self, config: BatchWriteConfig = None):
        super().__init__(config)
        # 默认配置
        if not config:
            self._config.batch_size = 100
            self._config.flush_interval = 1.0
            self._config.max_wait_time = 3.0
        # 添加MQTT日志处理器
        self.add_handler(self._handle_mqtt_logs)

    def _handle_mqtt_logs(self, messages: List[Dict]) -> bool:
        """处理MQTT日志消息"""
        try:
            from app import db
            from models import MQTTLog

            logs = []
            for msg in messages:
                topic = msg.get("topic", "")
                message = msg.get("message", "")
                direction = msg.get("direction", "receive")
                timestamp = msg.get("timestamp")
                if isinstance(timestamp, (int, float)):
                    timestamp = datetime.fromtimestamp(timestamp)
                elif not isinstance(timestamp, datetime):
                    timestamp = datetime.now()
                logs.append(
                    MQTTLog(topic=topic, message=message, direction=direction, timestamp=timestamp)
                )
            if logs:
                db.session.add_all(logs)
                db.session.commit()
                logger.info(f"[MQTTLogWriter] 批量写入 {len(logs)} 条MQTT日志")
            return True
        except Exception as e:
            logger.error(f"[MQTTLogWriter] 批量写入失败: {e}")
            return False


class OperationLogBatchWriter(BatchWriter):
    """操作日志批量写入器"""

    def __init__(self, config: BatchWriteConfig = None):
        super().__init__(config)
        # 默认配置
        if not config:
            self._config.batch_size = 50
            self._config.flush_interval = 2.0
            self._config.max_wait_time = 5.0
        # 添加操作日志处理器
        self.add_handler(self._handle_operation_logs)

    def _handle_operation_logs(self, messages: List[Dict]) -> bool:
        """处理操作日志消息"""
        try:
            from models import OperationLog

            logs = []
            for msg in messages:
                logs.append(
                    OperationLog(
                        operation_type=msg.get("operation_type", ""),
                        target_type=msg.get("target_type", ""),
                        target_id=msg.get("target_id"),
                        operator=msg.get("operator", ""),
                        description=msg.get("description", ""),
                        before_data=msg.get("before_data"),
                        after_data=msg.get("after_data"),
                    )
                )
            if logs:
                db.session.add_all(logs)
                db.session.commit()
                logger.info(f"[OperationLogWriter] 批量写入 {len(logs)} 条操作日志")
            return True
        except Exception as e:
            logger.error(f"[OperationLogWriter] 批量写入失败: {e}")
            return False


_mqtt_log_writer = None
_operation_log_writer = None


def get_mqtt_log_writer() -> MQTTLogBatchWriter:
    """获取MQTT日志写入器实例"""
    global _mqtt_log_writer
    if _mqtt_log_writer is None:
        _mqtt_log_writer = MQTTLogBatchWriter()  # noqa: F841
        _mqtt_log_writer.start()
    return _mqtt_log_writer


def get_operation_log_writer() -> OperationLogBatchWriter:
    """获取操作日志写入器实例"""
    global _operation_log_writer
    if _operation_log_writer is None:
        _operation_log_writer = OperationLogBatchWriter()  # noqa: F841
        _operation_log_writer.start()
    return _operation_log_writer


def shutdown_all_writers():
    """关闭所有批量写入器"""
    global _mqtt_log_writer, _operation_log_writer
    if _mqtt_log_writer:
        _mqtt_log_writer.stop()
        _mqtt_log_writer = None  # noqa: F841
    if _operation_log_writer:
        _operation_log_writer.stop()
        _operation_log_writer = None  # noqa: F841
    logger.info("[BatchWriter] 所有批量写入器已关闭")


atexit.register(shutdown_all_writers)

"""
使用批量写入模块的示例：
    mqtt_writer = get_mqtt_log_writer()
    mqtt_writer.enqueue({
        'topic': 'phonebox/heartbeat',
        'message': '{"device_id": "001"}',
        'direction': 'receive',
        'timestamp': time.time()
    }, priority=5)
    config = BatchWriteConfig()
    config.batch_size = 200
    config.flush_interval = 0.5
    writer = BatchWriter(config)
    writer.add_handler(my_handler)
    writer.start()
    writer.enqueue({'data': 'test'}, priority=10)
    writer.enqueue_batch([{'data': 'test1'}, {'data': 'test2'}], priority=8)
    stats = writer.get_stats()
    print(f"处理了 {stats['total_processed']} 条消息")
    writer.flush()
    writer.stop()
"""


def optimize_batch_size(current_size: int, processing_time: float, target_time: float = 0.1) -> int:
    """
    动态优化批量大小
    根据处理时间动态调整批量大小以达到目标处理时间。
    Args:
        current_size: 当前批量大小
        processing_time: 当前处理时间（秒）
        target_time: 目标处理时间（秒）
    Returns:
        优化后的批量大小
    """
    if processing_time == 0:
        return current_size
    ratio = target_time / processing_time
    if ratio > 1.5:
        # 处理太快，增加批量大小
        new_size = int(current_size * 1.5)
    elif ratio < 0.5:
        # 处理太慢，减少批量大小
        new_size = max(10, int(current_size * 0.5))
    else:
        # 接近目标，保持不变
        new_size = current_size
    # 限制最大最小值
    return max(10, min(1000, new_size))
