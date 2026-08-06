from typing import Any, Callable, List, Optional, TypeVar, Dict
from functools import wraps
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Query
from models import db
import time

"""
数据库查询优化工具模块
提供查询性能优化、批量操作优化等功能
"""
T = TypeVar("T")


class QueryMetrics:
    """查询指标"""

    def __init__(self, query_name: str):
        self.query_name = query_name
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.duration: Optional[float] = None
        self.row_count: int = 0
        self.error: Optional[str] = None

    def start(self):
        self.start_time = time.time()

    def end(self, row_count: int = 0, error: Optional[str] = None):
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
        self.row_count = row_count
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_name": self.query_name,
            "duration": self.duration,
            "row_count": self.row_count,
            "error": self.error,
            "timestamp": datetime.now().isoformat(),
        }


class QueryProfiler:
    """查询分析器"""

    _instance = None  # noqa: F841
    _lock = __import__("threading").Lock()  # noqa: F841

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._metrics: List[QueryMetrics] = []
                    cls._instance._max_metrics = 1000
        return cls._instance

    def record(self, metrics: QueryMetrics):
        """记录查询指标"""
        self._metrics.append(metrics)
        # 保持最大数量
        if len(self._metrics) > self._max_metrics:
            self._metrics = self._metrics[-self._max_metrics :]

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if not self._metrics:
            return {
                "total_queries": 0,
                "avg_duration": 0,
                "max_duration": 0,
                "min_duration": 0,
            }
        durations = [m.duration for m in self._metrics if m.duration is not None]
        row_counts = [m.row_count for m in self._metrics]
        return {
            "total_queries": len(self._metrics),
            "avg_duration": sum(durations) / len(durations) if durations else 0,
            "max_duration": max(durations) if durations else 0,
            "min_duration": min(durations) if durations else 0,
            "total_rows": sum(row_counts),
            "avg_rows": sum(row_counts) / len(row_counts) if row_counts else 0,
        }

    def get_slow_queries(self, threshold: float = 1.0) -> List[QueryMetrics]:
        """获取慢查询"""
        return [m for m in self._metrics if m.duration and m.duration > threshold]

    def clear(self):
        """清空历史"""
        self._metrics.clear()


def profile_query(query_name: str = None):
    """
    查询性能分析装饰器
    Example:
        @profile_query('get_user_list')
        def get_users():
            return User.query.all()
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            profiler = QueryProfiler()
            name = query_name or f"{func.__module__}.{func.__name__}"
            metrics = QueryMetrics(name)
            metrics.start()
            try:
                result = func(*args, **kwargs)  # noqa: F841
                row_count = (
                    len(result)
                    if isinstance(result, (list, tuple))
                    else (result.rowcount if hasattr(result, "rowcount") else 0)
                )
                metrics.end(row_count=row_count)
                return result
            except Exception as e:
                metrics.end(error=str(e))
                raise
            finally:
                profiler.record(metrics)

        return wrapper

    return decorator


def batch_query(query_func: Callable[[List[int]], List[T]], ids: List[int], batch_size: int = 100) -> List[T]:
    """
    批量查询优化
    将大量 ID 查询拆分成小批次，减少数据库压力
    Args:
        query_func: 查询函数，接收 ID 列表，返回结果列表
        ids: 要查询的 ID 列表
        batch_size: 每批查询的大小
    Example:
        def query_users_by_ids(user_ids):
            return User.query.filter(User.id.in_(user_ids)).all()
        users = batch_query(query_users_by_ids, all_user_ids, batch_size=50)
    """
    results = []
    for i in range(0, len(ids), batch_size):
        batch = ids[i : i + batch_size]
        batch_results = query_func(batch)
        results.extend(batch_results)
    return results


def batch_update(model_class, updates: List[Dict[str, Any]], id_field: str = "id", batch_size: int = 100) -> int:
    """
    批量更新优化
    Args:
        model_class: 模型类
        updates: 更新数据列表，每项包含 id 和要更新的字段
        id_field: ID 字段名
        batch_size: 每批更新的大小
    Returns:
        更新的行数
    """
    total_updated = 0
    for i in range(0, len(updates), batch_size):
        batch = updates[i : i + batch_size]
        # 获取这批的 ID
        # 批量更新
        for update in batch:
            update_data = {k: v for k, v in update.items() if k != id_field}
            if update_data:
                count = model_class.query.filter(getattr(model_class, id_field) == update[id_field]).update(update_data)
                total_updated += count
    db.session.commit()
    return total_updated


def get_query_explain(query: Query) -> List[Dict[str, Any]]:
    """
    获取 SQL 查询执行计划
    用于分析查询性能
    """
    sql = str(query.statement.compile(compile_kwargs={"literal_binds": True}))
    try:
        result = db.session.execute(text(f"EXPLAIN QUERY PLAN {sql}"))  # noqa: F841
        return [dict(row) for row in result]
    except Exception:
        return []


class IndexSuggestion:
    """索引建议"""

    @staticmethod
    def analyze_table_access() -> Dict[str, List[str]]:
        """
        分析表访问模式，返回可能需要索引的字段
        这是一个基于规则的简单分析，实际生产环境可能需要更复杂的分析
        """
        suggestions = {}
        # 常见的查询字段组合
        common_patterns = {
            "user": ["card_id", "class_name", "name"],
            "class_info": ["name", "grade", "teacher_id"],
            "device": ["device_id", "class_id", "status"],
            "score": ["exam_id", "student_id", "subject"],
            "course_schedule": ["class_info_id", "day_of_week", "period_number"],
        }
        for table in common_patterns.items():
            suggestions[table] = common_patterns[table]
        return suggestions


class ConnectionPoolOptimizer:
    """连接池优化器"""

    @staticmethod
    def get_pool_stats() -> Dict[str, Any]:
        """获取连接池统计"""
        pool = db.engine.pool
        return {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "timeout": pool.timeout(),
        }

    @staticmethod
    def adjust_pool_size(min_size: int = 5, max_size: int = 20):
        """调整连接池大小"""
        pool = db.engine.pool
        # 注意：SQLite 的连接池不支持动态调整
        # 这只是一个示例，实际实现可能需要重启引擎
        return {"current_size": pool.size(), "message": "Pool size adjustment requires engine restart in SQLite"}


__all__ = [
    "QueryMetrics",
    "QueryProfiler",
    "profile_query",
    "batch_query",
    "batch_update",
    "get_query_explain",
    "IndexSuggestion",
    "ConnectionPoolOptimizer",
]
