"""
MQTT Queue Service Test Cases
"""
# 测试MQTT消息队列服务的核心功能
"""
"""
from unittest.mock import patch, Mock
try:
    from services.mqtt_queue import MQTTQueueService
except ImportError:
    pass

try:
    from services.mqtt_queue import MQTTBatchProcessor
except ImportError:
    pass

try:
    from services.mqtt_queue import enqueue_mqtt_message, mqtt_queue
except ImportError:
    pass

try:
    from services.mqtt_queue import batch_publish_mqtt, mqtt_batch_processor
except ImportError:
    pass

try:
    from services.mqtt_queue import get_queue_stats
except ImportError:
    pass

try:
    from services.mqtt_queue import start_mqtt_queue
except ImportError:
    pass

try:
    from services.mqtt_queue import stop_mqtt_queue
except ImportError:
    pass


class TestMQTTQueueService:
    """测试MQTT消息队列服务"""

    def test_init_default(self):
        """测试初始化-默认参数"""
        from services.mqtt_queue import MQTTQueueService

        service = MQTTQueueService()

        assert service.max_queue_size == 1000
        assert service.retry_max == 3
        assert service.retry_delay == 1.0
        assert service.is_running is False
        assert service.worker_thread is None

    def test_init_custom(self):
        """测试初始化-自定义参数"""

        service = MQTTQueueService(max_queue_size=500, retry_max=5, retry_delay=2.0)

        assert service.max_queue_size == 500
        assert service.retry_max == 5
        assert service.retry_delay == 2.0

    def test_enqueue_message_dict(self):
        """测试入队消息-字典payload"""

        service = MQTTQueueService()

        result = service.enqueue_message("test/topic", {"key": "value"}, qos=1, retain=True)

        assert result is True
        assert service.stats["enqueued"] == 1
        assert service.message_queue.qsize() == 1

    def test_enqueue_message_string(self):
        """测试入队消息-字符串payload"""

        service = MQTTQueueService()

        result = service.enqueue_message("test/topic", "test payload")

        assert result is True
        assert service.stats["enqueued"] == 1

    def test_enqueue_message_queue_full(self):
        """测试入队消息-队列满"""

        service = MQTTQueueService(max_queue_size=2)

        service.enqueue_message("topic1", "payload1")
        service.enqueue_message("topic2", "payload2")
        service.enqueue_message("topic3", "payload3")

        assert service.stats["enqueued"] == 3
        assert service.stats["failed"] == 1
        assert service.message_queue.qsize() == 2

    def test_get_stats(self):
        """测试获取统计信息"""

        service = MQTTQueueService()
        service.enqueue_message("test/topic", "payload")

        stats = service.get_stats()

        assert stats["queue_size"] == 1
        assert stats["max_queue_size"] == 1000
        assert stats["is_running"] is False
        assert stats["enqueued"] == 1
        assert stats["processed"] == 0
        assert stats["failed"] == 0
        assert stats["retried"] == 0

    def test_clear(self):
        """测试清空队列"""

        service = MQTTQueueService()
        service.enqueue_message("topic1", "payload1")
        service.enqueue_message("topic2", "payload2")

        assert service.message_queue.qsize() == 2

        service.clear()

        assert service.message_queue.qsize() == 0

    def test_start_stop(self):
        """测试启动和停止"""

        service = MQTTQueueService()

        service.start()

        assert service.is_running is True
        assert service.worker_thread is not None
        assert service.worker_thread.is_alive()

        service.stop()

        assert service.is_running is False

    def test_process_message_success(self):
        """测试处理消息-成功"""

        service = MQTTQueueService()

        message = {
            "topic": "test/topic",
            "payload": "test payload",
            "qos": 0,
            "retry_count": 0,
        }

        with patch('services.mqtt_queue.mqtt_manager') as mock_manager:
            mock_manager.is_connected = True
            mock_manager.publish.return_value = True

            result = service._process_message(message)

            assert result is True
            mock_manager.publish.assert_called_once_with("test/topic", "test payload", 0)

    def test_process_message_reconnection(self):
        """测试处理消息-需要重连"""

        service = MQTTQueueService()

        message = {
            "topic": "test/topic",
            "payload": "test payload",
            "qos": 0,
            "retry_count": 0,
        }

        with patch('services.mqtt_queue.mqtt_manager') as mock_manager:
            mock_manager.is_connected = False
            mock_manager.connect = Mock()
            mock_manager.publish.return_value = True

            result = service._process_message(message)

            assert result is True
            mock_manager.connect.assert_called_once()

    def test_process_message_retry(self):
        """测试处理消息-重试成功"""

        service = MQTTQueueService(retry_max=2, retry_delay=0.01)

        message = {
            "topic": "test/topic",
            "payload": "test payload",
            "qos": 0,
            "retry_count": 0,
        }

        with patch('services.mqtt_queue.mqtt_manager') as mock_manager:
            mock_manager.is_connected = True
            mock_manager.publish.side_effect = [False, True]

            result = service._process_message(message)

            assert result is True
            assert mock_manager.publish.call_count == 2
            assert service.stats["retried"] == 1

    def test_process_message_all_fail(self):
        """测试处理消息-全部失败"""

        service = MQTTQueueService(retry_max=3, retry_delay=0.01)

        message = {
            "topic": "test/topic",
            "payload": "test payload",
            "qos": 0,
            "retry_count": 0,
        }

        with patch('services.mqtt_queue.mqtt_manager') as mock_manager:
            mock_manager.is_connected = True
            mock_manager.publish.return_value = False

            with patch.object(service, '_log_failed_message') as mock_log:
                result = service._process_message(message)

                assert result is False
                assert mock_manager.publish.call_count == 3
                mock_log.assert_called_once()

    def test_log_failed_message_success(self, app):
        """测试记录失败消息-成功"""

        service = MQTTQueueService()

        message = {"topic": "test/topic", "payload": "test"}

        with patch('models.db') as mock_db:
            mock_db.session.add = Mock()

            with patch('utils.db_session.db_session_scope') as mock_scope:
                mock_scope.return_value.__enter__ = Mock()
                mock_scope.return_value.__exit__ = Mock()

                service._log_failed_message(message, "test error")

                mock_db.session.add.assert_called_once()

    def test_log_failed_message_exception(self, app):
        """测试记录失败消息-异常"""

        service = MQTTQueueService()

        message = {"topic": "test/topic"}

        with patch('utils.db_session.db_session_scope') as mock_scope:
            mock_scope.side_effect = Exception("DB error")

            service._log_failed_message(message, "test error")


class TestMQTTBatchProcessor:
    """测试MQTT批量消息处理器"""

    def test_init(self):
        """测试初始化"""
        from services.mqtt_queue import MQTTBatchProcessor

        processor = MQTTBatchProcessor(batch_size=5, batch_timeout=2.0)

        assert processor.batch_size == 5
        assert processor.batch_timeout == 2.0
        assert processor.batch_queue == []

    def test_add_message_dict(self):
        """测试添加消息-字典payload"""

        processor = MQTTBatchProcessor(batch_size=5)

        try:
            processor.add_message("test/topic", {"key": "value"}, qos=1)

            assert len(processor.batch_queue) == 1
            assert processor.batch_queue[0]["topic"] == "test/topic"
        finally:
            if processor.timer:
                processor.timer.cancel()

    def test_add_message_string(self):
        """测试添加消息-字符串payload"""

        processor = MQTTBatchProcessor(batch_size=5)

        try:
            processor.add_message("test/topic", "string payload")

            assert len(processor.batch_queue) == 1
        finally:
            if processor.timer:
                processor.timer.cancel()

    def test_add_message_trigger_batch(self):
        """测试添加消息-触发批量处理"""

        processor = MQTTBatchProcessor(batch_size=3)

        try:
            with patch('services.mqtt_queue.MQTTBatchProcessor._process_batch') as mock_process:
                processor.add_message("topic1", "payload1")
                processor.add_message("topic2", "payload2")
                processor.add_message("topic3", "payload3")

                assert len(processor.batch_queue) == 3
                mock_process.assert_called_once()
        finally:
            if processor.timer:
                processor.timer.cancel()

    def test_flush(self):
        """测试刷新"""

        processor = MQTTBatchProcessor(batch_size=10)

        try:
            processor.add_message("topic1", "payload1")
            processor.add_message("topic2", "payload2")

            assert len(processor.batch_queue) == 2

            with patch('services.mqtt_queue.MQTTBatchProcessor._process_batch') as mock_process:
                processor.flush()

                mock_process.assert_called_once()
        finally:
            if processor.timer:
                processor.timer.cancel()


class TestMQTTQueueConvenienceFunctions:
    """测试MQTT队列便捷函数"""

    def test_enqueue_mqtt_message(self):
        """测试便捷函数-入队消息"""
        from services.mqtt_queue import enqueue_mqtt_message, mqtt_queue

        with patch.object(mqtt_queue, 'enqueue_message') as mock_enqueue:
            mock_enqueue.return_value = True

            result = enqueue_mqtt_message("test/topic", "payload")

            assert result is True
            mock_enqueue.assert_called_once_with("test/topic", "payload", 0, False)

    def test_batch_publish_mqtt(self):
        """测试便捷函数-批量发布"""
        from services.mqtt_queue import batch_publish_mqtt, mqtt_batch_processor

        with patch.object(mqtt_batch_processor, 'add_message') as mock_add:
            batch_publish_mqtt("test/topic", "payload")

            mock_add.assert_called_once_with("test/topic", "payload", 0)

    def test_get_queue_stats(self):
        """测试便捷函数-获取队列统计"""
        from services.mqtt_queue import get_queue_stats

        with patch.object(mqtt_queue, 'get_stats') as mock_stats:
            mock_stats.return_value = {"queue_size": 0}

            result = get_queue_stats()

            assert result == {"queue_size": 0}
            mock_stats.assert_called_once()

    def test_start_mqtt_queue(self):
        """测试便捷函数-启动队列"""
        from services.mqtt_queue import start_mqtt_queue

        with patch.object(mqtt_queue, 'start') as mock_start:
            start_mqtt_queue()

            mock_start.assert_called_once()

    def test_stop_mqtt_queue(self):
        """测试便捷函数-停止队列"""
        from services.mqtt_queue import stop_mqtt_queue

        with patch.object(mqtt_queue, 'stop') as mock_stop:
            stop_mqtt_queue()

            mock_stop.assert_called_once()
