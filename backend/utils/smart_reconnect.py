from typing import Callable, List
from enum import Enum
from services.mqtt_manager import MQTTManager
import time
import logging
import threading
import random
import requests

"""
MQTT智能重连模块
功能：实现指数退避重连、网络状态检测、连接状态通知
作者：开发团队
日期：2026-06-14
"""
logger = logging.getLogger(__name__)


class NetworkStatus(Enum):
    """网络状态枚举"""

    UNKNOWN = "unknown"
    AVAILABLE = "available"  # 网络可用
    LIMITED = "limited"  # 网络受限
    UNAVAILABLE = "unavailable"  # 网络不可用


class ReconnectStrategy(Enum):
    """重连策略枚举"""

    FIXED = "fixed"  # 固定间隔
    LINEAR = "linear"  # 线性增长
    EXPONENTIAL = "exponential"  # 指数退避（推荐）
    FIBONACCI = "fibonacci"  # 斐波那契增长


class SmartReconnectConfig:
    """智能重连配置"""

    def __init__(self):
        # 基础配置
        self.min_delay = 1  # 最小重连延迟（秒）
        self.max_delay = 300  # 最大重连延迟（5分钟）
        self.initial_delay = 1  # 初始重连延迟（秒）
        # 策略配置
        self.strategy = ReconnectStrategy.EXPONENTIAL
        self.backoff_multiplier = 2.0  # 退避倍数
        self.jitter = 0.3  # 抖动系数（0-1），防止惊群效应
        # 稳定性配置
        self.max_reconnect_attempts = 0  # 0表示无限制
        self.reconnect_reset_time = 300  # 多少秒后重置重连计数（秒）
        self.successful_connection_stability = 3  # 连续成功连接次数后才重置
        # 网络检测配置
        self.network_check_enabled = True
        self.network_check_urls = [
            "https://www.baidu.com",
            "https://www.taobao.com",
            "https://www.qq.com",
        ]
        self.network_check_timeout = 5  # 网络检测超时（秒）
        self.network_check_interval = 30  # 网络检测间隔（秒）
        # 统计配置
        self.stats_enabled = True
        self.stats_window = 3600  # 统计时间窗口（秒）


class ConnectionStateListener:
    """连接状态监听器"""

    def __init__(self):
        self._listeners: List[Callable] = []
        self._last_state = None
        self._state_lock = threading.Lock()

    def add_listener(self, callback: Callable):
        """添加状态监听器
        Args:
            callback: 回调函数，签名为 on_state_change(old_state, new_state, extra_info)
        """
        if callback not in self._listeners:
            self._listeners.append(callback)

    def remove_listener(self, callback: Callable):
        """移除状态监听器"""
        if callback in self._listeners:
            self._listeners.remove(callback)

    def notify_listeners(self, old_state, new_state, extra_info=None):
        """通知所有监听器"""
        with self._state_lock:
            if old_state == new_state:
                return
            self._last_state = new_state
            for listener in self._listeners:
                try:
                    listener(old_state, new_state, extra_info)
                except Exception as e:
                    logger.error(f"[SmartReconnect] 通知监听器失败: {e}")


class ReconnectStats:
    """重连统计"""

    def __init__(self, window_size=3600):
        self._window_size = window_size
        self._attempts = []  # [(timestamp, success), ...]
        self._lock = threading.Lock()
        # 累计统计
        self.total_attempts = 0
        self.total_success = 0
        self.total_failures = 0
        self.current_streak = 0  # 当前连续成功/失败次数
        self.max_streak = 0  # 最大连续成功次数
        self._last_success_time = None

    def record_attempt(self, success: bool, latency_ms: float = None):
        """记录重连尝试
        Args:
            success: 是否成功
            latency_ms: 连接延迟（毫秒）
        """
        with self._lock:
            current_time = time.time()
            # 清理过期记录
            self._attempts = [
                (ts, result)
                for ts, result in self._attempts
                if current_time - ts < self._window_size
            ]
            # 添加新记录
            self._attempts.append((current_time, success))
            # 更新统计
            self.total_attempts += 1
            if success:
                self.total_success += 1
                self._last_success_time = current_time
                self.current_streak += 1
                self.max_streak = max(self.max_streak, self.current_streak)
            else:
                self.current_streak = -1 * abs(self.current_streak) - 1
                self.total_failures += 1

    def get_success_rate(self, window_seconds: int = None) -> float:
        """获取成功率
        Args:
            window_seconds: 时间窗口（秒），None表示使用配置的窗口
        Returns:
            成功率（0-1）
        """
        with self._lock:
            if window_seconds is None:
                window_seconds = self._window_size
            current_time = time.time()
            recent_attempts = [
                success for ts, success in self._attempts if current_time - ts < window_seconds
            ]
            if not recent_attempts:
                return 0.0
            return sum(recent_attempts) / len(recent_attempts)

    def get_average_latency(self, window_seconds: int = None) -> float:
        """获取平均延迟"""
        with self._lock:
            if window_seconds is None:
                window_seconds = self._window_size
            current_time = time.time()
            # 注意：这里简化了实现，实际应该记录latency_ms
            recent_count = len(
                [ts for ts, _ in self._attempts if current_time - ts < window_seconds]
            )
            if recent_count == 0:
                return 0.0
            return recent_count / max(1, self.total_attempts) * 1000  # 简化计算

    def get_stats(self) -> dict:
        """获取统计信息"""
        with self._lock:
            return {
                "total_attempts": self.total_attempts,
                "total_success": self.total_success,
                "total_failures": self.total_failures,
                "success_rate": self.get_success_rate(),
                "success_rate_1h": self.get_success_rate(3600),
                "success_rate_5m": self.get_success_rate(300),
                "current_streak": self.current_streak,
                "max_streak": self.max_streak,
                "last_success_time": self._last_success_time,
                "attempts_in_window": len(self._attempts),
            }


class NetworkChecker:
    """网络状态检测器"""

    def __init__(self, config: SmartReconnectConfig):
        self._config = config
        self._status = NetworkStatus.UNKNOWN
        self._last_check_time = 0
        self._check_lock = threading.Lock()
        self._check_thread = None
        self._should_check = False
        # 历史记录
        self._history = []  # [(timestamp, status), ...]
        self._history_max_size = 100

    def start(self):
        """启动网络检测"""
        if self._check_thread and self._check_thread.is_alive():
            return
        self._should_check = True
        self._check_thread = threading.Thread(target=self._check_loop, daemon=True)
        self._check_thread.start()

    def stop(self):
        """停止网络检测"""
        self._should_check = False

    def _check_loop(self):
        """网络检测循环"""
        while self._should_check:
            self.check_network()
            time.sleep(self._config.network_check_interval)

    def check_network(self) -> NetworkStatus:
        """检查网络状态
        Returns:
            网络状态
        """
        with self._check_lock:
            current_time = time.time()
            # 限制检测频率
            if current_time - self._last_check_time < 5:
                return self._status
            self._last_check_time = current_time
            # 执行网络检测
            try:
                for url in self._config.network_check_urls:
                    try:
                        start_time = time.time()
                        response = requests.head(
                            url, timeout=self._config.network_check_timeout, allow_redirects=True
                        )
                        (time.time() - start_time) * 1000
                        if response.status_code < 500:
                            new_status = NetworkStatus.AVAILABLE
                            break
                    except requests.RequestException:
                        continue
                else:
                    new_status = NetworkStatus.UNAVAILABLE
            except Exception as e:
                logger.warning(f"[NetworkChecker] 网络检测失败: {e}")
                new_status = NetworkStatus.UNKNOWN
            # 更新状态
            if new_status != self._status:
                logger.info(
                    f"[NetworkChecker] 网络状态变化: {self._status.value} -> {new_status.value}"
                )
                self._status = new_status
            # 记录历史
            self._history.append((current_time, new_status))
            if len(self._history) > self._history_max_size:
                self._history = self._history[-self._history_max_size :]
            return self._status

    @property
    def status(self) -> NetworkStatus:
        """获取当前网络状态"""
        return self._status

    def get_history(self, count: int = 10) -> List[tuple]:
        """获取网络状态历史"""
        return self._history[-count:]


class SmartReconnect:
    """智能重连管理器"""

    def __init__(self, mqtt_manager, config: SmartReconnectConfig = None):
        self._mqtt_manager = mqtt_manager
        self._config = config or SmartReconnectConfig()
        # 状态监听
        self._state_listener = ConnectionStateListener()
        # 统计
        self._stats = ReconnectStats(self._config.stats_window)
        # 网络检测
        self._network_checker = NetworkChecker(self._config)
        # 重连状态
        self._reconnect_count = 0
        self._reconnect_count_lock = threading.Lock()
        self._last_reconnect_time = 0
        self._reconnect_thread = None
        self._should_reconnect = True
        self._is_reconnecting = False
        # 回调函数
        self._on_reconnect_start = None
        self._on_reconnect_success = None
        self._on_reconnect_failure = None
        self._on_network_change = None

    def start(self):
        """启动智能重连"""
        self._should_reconnect = True
        if self._config.network_check_enabled:
            self._network_checker.start()

    def stop(self):
        """停止智能重连"""
        self._should_reconnect = False
        self._network_checker.stop()

    def schedule_reconnect(self, immediate: bool = False):
        """安排重连
        Args:
            immediate: 是否立即重连
        """
        if not self._should_reconnect:
            logger.info("[SmartReconnect] 重连已禁用")
            return
        if self._is_reconnecting:
            logger.info("[SmartReconnect] 正在重连中，跳过")
            return
        # 计算延迟
        if immediate:
            delay = 0
        else:
            delay = self._calculate_delay()
        # 更新状态
        with self._reconnect_count_lock:
            self._reconnect_count += 1
            self._last_reconnect_time = time.time()
        # 通知开始重连
        old_state = self._mqtt_manager.state
        self._state_listener.notify_listeners(
            old_state, "reconnecting", {"delay": delay, "attempt": self._reconnect_count}
        )
        if self._on_reconnect_start:
            self._on_reconnect_start(self._reconnect_count, delay)
        # 安排重连任务
        threading.Thread(target=self._reconnect_task, args=(delay,), daemon=True).start()

    def _calculate_delay(self) -> float:
        """计算重连延迟
        根据重连策略计算延迟时间。
        Returns:
            延迟时间（秒）
        """
        with self._reconnect_count_lock:
            attempt = self._reconnect_count
        delay = self._config.initial_delay
        if self._config.strategy == ReconnectStrategy.FIXED:
            delay = self._config.initial_delay
        elif self._config.strategy == ReconnectStrategy.LINEAR:
            delay = self._config.initial_delay + attempt * self._config.backoff_multiplier
        elif self._config.strategy == ReconnectStrategy.EXPONENTIAL:
            delay = self._config.initial_delay * (self._config.backoff_multiplier ** (attempt - 1))
        elif self._config.strategy == ReconnectStrategy.FIBONACCI:
            # 斐波那契数列
            fib = [1, 1]
            for i in range(2, min(attempt, 20)):
                fib.append(fib[-1] + fib[-2])
            delay = self._config.initial_delay * fib[min(attempt - 1, len(fib) - 1)]
        # 限制最大延迟
        delay = min(delay, self._config.max_delay)
        # 添加抖动
        if self._config.jitter > 0:
            jitter_range = delay * self._config.jitter
            delay = delay + random.uniform(-jitter_range, jitter_range)
        # 确保延迟为正数
        delay = max(delay, self._config.min_delay)
        return delay

    def _reconnect_task(self, delay: float):
        """重连任务"""
        self._is_reconnecting = True
        try:
            if delay > 0:
                logger.info(f"[SmartReconnect] 等待 {delay:.2f} 秒后重连...")
                time.sleep(delay)
            # 检查网络状态
            if self._config.network_check_enabled:
                network_status = self._network_checker.check_network()
                if network_status == NetworkStatus.UNAVAILABLE:
                    logger.warning("[SmartReconnect] 网络不可用，延迟重连")
                    # 再次调度重连
                    self._is_reconnecting = False
                    self.schedule_reconnect()
                    return
            # 执行重连
            logger.info(f"[SmartReconnect] 执行第 {self._reconnect_count} 次重连...")
            success = self._do_reconnect()
            if success:
                self._on_reconnect_succeeded()
            else:
                self._on_reconnect_failed()
        finally:
            self._is_reconnecting = False

    def _do_reconnect(self) -> bool:
        """执行实际重连"""
        try:
            # 调用MQTT管理器的连接方法
            if hasattr(self._mqtt_manager, "connect"):
                self._mqtt_manager.connect()
                return True
            return False
        except Exception as e:
            logger.error(f"[SmartReconnect] 重连执行失败: {e}")
            return False

    def _on_reconnect_succeeded(self):
        """重连成功处理"""
        self._stats.record_attempt(True)
        # 通知监听器
        self._state_listener.notify_listeners(
            "reconnecting",
            "connected",
            {"attempt": self._reconnect_count, "total_attempts": self._stats.total_attempts},
        )
        if self._on_reconnect_success:
            self._on_reconnect_success(self._reconnect_count)
        # 检查是否需要重置重连计数
        if self._stats.current_streak >= self._config.successful_connection_stability:
            with self._reconnect_count_lock:
                self._reconnect_count = 0
                logger.info("[SmartReconnect] 连续成功重连，重置计数")

    def _on_reconnect_failed(self):
        """重连失败处理"""
        self._stats.record_attempt(False)
        # 检查是否超过最大重连次数
        if (
            self._config.max_reconnect_attempts > 0
            and self._reconnect_count >= self._config.max_reconnect_attempts
        ):
            logger.error(
                f"[SmartReconnect] 超过最大重连次数 ({self._config.max_reconnect_attempts})，停止重连"
            )
            self._should_reconnect = False
            return
        # 通知监听器
        self._state_listener.notify_listeners(
            "reconnecting",
            "error",
            {"attempt": self._reconnect_count, "failure_count": self._stats.total_failures},
        )
        if self._on_reconnect_failure:
            self._on_reconnect_failure(self._reconnect_count)
        # 继续重连
        self.schedule_reconnect()

    def add_state_listener(self, callback: Callable):
        """添加连接状态监听器"""
        self._state_listener.add_listener(callback)

    def remove_state_listener(self, callback: Callable):
        """移除连接状态监听器"""
        self._state_listener.remove_listener(callback)

    def set_callbacks(
        self, on_start=None, on_success=None, on_failure=None, on_network_change=None
    ):
        """设置回调函数
        Args:
            on_start: 重连开始回调
            on_success: 重连成功回调
            on_failure: 重连失败回调
            on_network_change: 网络状态变化回调
        """
        self._on_reconnect_start = on_start
        self._on_reconnect_success = on_success
        self._on_reconnect_failure = on_failure
        self._on_network_change = on_network_change

    def get_stats(self) -> dict:
        """获取重连统计"""
        return self._stats.get_stats()

    @property
    def network_status(self) -> NetworkStatus:
        """获取网络状态"""
        return self._network_checker.status

    @property
    def reconnect_count(self) -> int:
        """获取当前重连次数"""
        with self._reconnect_count_lock:
            return self._reconnect_count


"""
使用智能重连模块的示例代码：
    mqtt_manager = MQTTManager('tcp')
    config = SmartReconnectConfig()
    config.min_delay = 1
    config.max_delay = 300
    config.initial_delay = 1
    config.strategy = ReconnectStrategy.EXPONENTIAL
    config.backoff_multiplier = 2.0
    config.jitter = 0.3
    config.network_check_enabled = True
    config.network_check_interval = 30
    smart_reconnect = SmartReconnect(mqtt_manager, config)
    smart_reconnect.set_callbacks(
        on_start=lambda attempt, delay: print(f"开始第{attempt}次重连，延迟{delay}秒"),
        on_success=lambda attempt: print(f"重连成功！共尝试{attempt}次"),
        on_failure=lambda attempt: print(f"重连失败，正在进行第{attempt+1}次尝试"),
        on_network_change=lambda old, new: print(f"网络状态变化: {old} -> {new}")
    )


    def on_state_change(old_state, new_state, info):
        print(f"状态变化: {old_state} -> {new_state}, 详情: {info}")


    smart_reconnect.add_state_listener(on_state_change)
    smart_reconnect.start()
    mqtt_manager.connect()
    smart_reconnect.stop()
    stats = smart_reconnect.get_stats()
    print(f"成功率: {stats['success_rate']:.2%}")
    print(f"1小时成功率: {stats['success_rate_1h']:.2%}")
"""
_smart_reconnect_instance = None


def get_smart_reconnect(mqtt_manager=None, config=None) -> SmartReconnect:
    """获取全局智能重连实例"""
    global _smart_reconnect_instance
    if _smart_reconnect_instance is None:
        if mqtt_manager is None:
            mqtt_manager = MQTTManager("tcp")
        _smart_reconnect_instance = SmartReconnect(mqtt_manager, config)  # noqa: F841
    return _smart_reconnect_instance
