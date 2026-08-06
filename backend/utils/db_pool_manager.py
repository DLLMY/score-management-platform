"""
数据库连接池管理模块 - 提供连接池监控和优化
"""

from sqlalchemy import event, text
from sqlalchemy.pool import QueuePool, StaticPool
import time
import threading
from contextlib import contextmanager
from datetime import datetime


class DatabasePoolManager:
    """数据库连接池管理器"""

    def __init__(self, engine):
        self.engine = engine
        self.pool = engine.pool
        self._stats = {
            "total_connections": 0,
            "checked_out": 0,
            "overflow": 0,
            "checked_in": 0,
            "connection_errors": 0,
            "query_times": [],
        }
        self._lock = threading.Lock()
        self._setup_event_listeners()

    def _setup_event_listeners(self):
        """设置连接池事件监听器"""

        @event.listens_for(self.engine, "connect")
        def on_connect(dbapi_connection, connection_record):
            with self._lock:
                self._stats["total_connections"] += 1

        @event.listens_for(self.engine, "checkout")
        def on_checkout(dbapi_connection, connection_record, connection_proxy):
            with self._lock:
                self._stats["checked_out"] += 1

        @event.listens_for(self.engine, "checkin")
        def on_checkin(dbapi_connection, connection_record):
            with self._lock:
                self._stats["checked_in"] += 1
                self._stats["checked_out"] = max(0, self._stats["checked_out"] - 1)

    def get_pool_status(self):
        """获取连接池状态"""
        pool = self.pool
        return {
            "pool_size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "queue_size": pool._queue.qsize() if hasattr(pool, "_queue") else None,
            "total_connections": self._stats["total_connections"],
        }

    def get_pool_config(self):
        """获取连接池配置"""
        pool = self.pool
        if isinstance(pool, QueuePool):
            return {
                "pool_class": "QueuePool",
                "pool_size": pool.size(),
                "max_overflow": pool._max_overflow,
                "pool_timeout": pool._timeout,
                "pool_recycle": pool._recycle,
                "pool_pre_ping": pool._pre_ping,
            }
        elif isinstance(pool, StaticPool):
            return {"pool_class": "StaticPool", "pool_size": 1}
        return {"pool_class": str(type(pool).__name__)}

    def record_query_time(self, query_time):
        """记录查询时间"""
        with self._lock:
            self._stats["query_times"].append({"time": query_time, "timestamp": datetime.now()})
            if len(self._stats["query_times"]) > 100:
                self._stats["query_times"] = self._stats["query_times"][-100:]

    def get_slow_queries(self, threshold_seconds=1.0):
        """获取慢查询"""
        with self._lock:
            return [q for q in self._stats["query_times"] if q["time"] >= threshold_seconds]

    def get_query_stats(self):
        """获取查询统计"""
        with self._lock:
            times = [q["time"] for q in self._stats["query_times"]]
            if not times:
                return {"count": 0, "avg_time": 0, "max_time": 0, "min_time": 0}
            return {
                "count": len(times),
                "avg_time": sum(times) / len(times),
                "max_time": max(times),
                "min_time": min(times),
            }

    @contextmanager
    def connection(self, timeout=None):
        """获取连接的上下文管理器"""
        connection = None
        start_time = time.time()
        try:
            connection = self.pool.connect()
            yield connection
        finally:
            if connection:
                connection.close()
            query_time = time.time() - start_time
            self.record_query_time(query_time)


db_pool_manager = None


def init_db_pool_manager(app):
    """初始化数据库连接池管理器"""
    global db_pool_manager
    db_pool_manager = DatabasePoolManager(app.extensions["sqlalchemy"].engine)
    return db_pool_manager


def get_db_pool_manager():
    """获取数据库连接池管理器实例"""
    return db_pool_manager


@contextmanager
def safe_db_operation(max_retries=3, retry_delay=0.5):
    """安全的数据库操作上下文管理器，带重试机制"""
    import sqlite3

    for attempt in range(max_retries):
        try:
            yield
            return
        except sqlite3.OperationalError as e:
            if attempt < max_retries - 1 and "locked" in str(e).lower():
                time.sleep(retry_delay)
                continue
            raise
        except Exception:
            raise


def test_connection():
    """测试数据库连接"""
    from models import db

    try:
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            return {"success": True, "message": "数据库连接正常"}
    except Exception as e:
        return {"success": False, "message": f"数据库连接失败: {str(e)}"}
