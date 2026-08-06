"""
数据库查询优化工具 - 提供查询分析和优化建议
"""

from functools import wraps
from models import db
from sqlalchemy import event
from sqlalchemy.engine import Engine
import time
import logging

logger = logging.getLogger(__name__)


class QueryProfiler:
    """查询性能分析器"""

    def __init__(self):
        self.queries = []
        self.enabled = False

    def enable(self):
        """启用性能分析"""
        self.enabled = True
        self.queries = []

    def disable(self):
        """禁用性能分析"""
        self.enabled = False

    def record(self, query, duration):
        """记录查询"""
        if self.enabled:
            self.queries.append({"query": query, "duration": duration, "timestamp": time.time()})

    def get_slow_queries(self, threshold=0.1):
        """获取慢查询"""
        return [q for q in self.queries if q["duration"] > threshold]

    def get_stats(self):
        """获取统计信息"""
        if not self.queries:
            return {"total_queries": 0, "total_time": 0, "avg_time": 0, "slow_queries": 0}
        durations = [q["duration"] for q in self.queries]
        return {
            "total_queries": len(self.queries),
            "total_time": sum(durations),
            "avg_time": sum(durations) / len(durations),
            "max_time": max(durations),
            "min_time": min(durations),
            "slow_queries": len([q for q in self.queries if q["duration"] > 0.1]),
        }

    def clear(self):
        """清空记录"""
        self.queries = []


query_profiler = QueryProfiler()


@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info["query_start_time"].pop()
    query_profiler.record(statement, total)


def profile_queries(f):
    """装饰器：分析函数内的查询性能"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        query_profiler.enable()
        query_profiler.clear()
        result = f(*args, **kwargs)
        stats = query_profiler.get_stats()
        logger.info(f"Query stats for {f.__name__}: {stats}")
        slow_queries = query_profiler.get_slow_queries()
        if slow_queries:
            logger.warning(f"Slow queries in {f.__name__}:")
            for sq in slow_queries:
                logger.warning(f"  - {sq['query'][:100]}... ({sq['duration']:.3f}s)")
        query_profiler.disable()
        return result

    return decorated_function


class QueryOptimizer:
    """查询优化工具"""

    @staticmethod
    def add_eager_load(query, model, includes):
        """添加预加载以避免N+1查询"""
        from sqlalchemy.orm import joinedload, selectinload

        for include in includes:
            if "." in include:
                parts = include.split(".")
                current = model
                for part in parts[:-1]:
                    current = getattr(current, part).property.mapper.class_
                rel = getattr(model, parts[0])
                if hasattr(rel.property, "lazy"):
                    query = query.options(joinedload(rel))
            else:
                rel = getattr(model, include)
                query = query.options(selectinload(rel))
        return query

    @staticmethod
    def optimize_pagination(query, page, per_page):
        """优化分页查询"""
        return query.limit(per_page).offset((page - 1) * per_page)

    @staticmethod
    def use_covering_index(query, table, columns, index_name):
        """使用覆盖索引优化查询"""
        return query.with_hint(table, f"USE INDEX ({index_name})", "mysql")

    @staticmethod
    def batch_query(ids, batch_size=100):
        """分批查询"""
        results = []
        for i in range(0, len(ids), batch_size):
            batch = ids[i : i + batch_size]
            results.extend(batch)
        return results

    # ---- 兼容旧测试接口的统计/报表方法（内存库下返回聚合结果） ----

    @staticmethod
    def get_users_paginated(page=1, per_page=10):
        """分页获取用户列表（兼容旧测试）。"""
        from models import User

        pagination = User.query.order_by(User.id.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        return {
            "items": [
                {
                    "id": u.id,
                    "name": u.name,
                    "class_name": u.class_name,
                    "current_score": u.current_score,
                    "card_id": u.card_id,
                }
                for u in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }

    @staticmethod
    def get_top_users(limit=5):
        """获取积分排行前列用户（兼容旧测试）。"""
        from models import User

        users = User.query.order_by(User.current_score.desc()).limit(limit).all()
        return [
            {"id": u.id, "name": u.name, "current_score": u.current_score}
            for u in users
        ]

    @staticmethod
    def get_score_stats():
        """积分统计（兼容旧测试）。"""
        from models import User, ScoreRecord
        from sqlalchemy import func

        try:
            total_users = User.query.count()
            total_records = ScoreRecord.query.count()
            total_score = (
                db.session.query(func.coalesce(func.sum(ScoreRecord.score_change), 0)).scalar() or 0
            )
        except Exception:
            total_users, total_records, total_score = 0, 0, 0
        return {
            "total_users": total_users,
            "total_records": total_records,
            "total_score": float(total_score),
        }

    @staticmethod
    def get_daily_score_trend(days=7):
        """按日聚合积分变化趋势（兼容旧测试）。"""
        from models import ScoreRecord
        from sqlalchemy import func
        from datetime import datetime, timedelta

        since = datetime.utcnow() - timedelta(days=days)
        rows = (
            db.session.query(
                func.date(ScoreRecord.created_at),
                func.coalesce(func.sum(ScoreRecord.score_change), 0),
            )
            .filter(ScoreRecord.created_at >= since)
            .group_by(func.date(ScoreRecord.created_at))
            .order_by(func.date(ScoreRecord.created_at).asc())
            .all()
        )
        return [
            {"date": str(r[0]) if r[0] is not None else "", "change": float(r[1] or 0)}
            for r in rows
        ]

    @staticmethod
    def get_device_status_summary():
        """设备状态汇总（兼容旧测试）。"""
        from models import Device

        try:
            total = Device.query.count()
            online = Device.query.filter(Device.status == "online").count()
        except Exception:
            total, online = 0, 0
        return {"total": total, "online": online, "offline": total - online}

    @staticmethod
    def get_operation_logs(page=1, per_page=10):
        """分页获取操作日志（兼容旧测试）。"""
        from models import OperationLog

        pagination = OperationLog.query.order_by(OperationLog.id.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        return {
            "logs": [
                {
                    "id": log.id,
                    "operation_type": log.operation_type,
                    "operator": log.operator,
                    "created_at": str(log.created_at) if log.created_at else None,
                }
                for log in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
        }


def get_table_indexes(table_name):
    """获取表的索引信息"""
    from flask import current_app
    from sqlalchemy import text

    with current_app.app_context():
        result = db.session.execute(text(f"SHOW INDEX FROM {table_name}"))
        indexes = {}
        for row in result:
            index_name = row[2]
            if index_name not in indexes:
                indexes[index_name] = {"name": index_name, "unique": row[1] == 0, "columns": []}
            indexes[index_name]["columns"].append(row[4])
        return list(indexes.values())


def suggest_indexes(table_name):
    """根据查询历史建议索引"""
    slow_queries = query_profiler.get_slow_queries(0.05)
    suggestions = set()
    for query_info in slow_queries:
        query = query_info["query"].upper()
        if "WHERE" in query:
            where_pos = query.find("WHERE")
            where_clause = query[where_pos : where_pos + 200]
            if "USER_ID" in where_clause:
                suggestions.add(("user_id", "user_id"))
            if "CLASS_NAME" in where_clause:
                suggestions.add(("class_name", "class_name"))
            if "CREATED_AT" in where_clause:
                suggestions.add(("created_at", "created_at"))
            if "CARD_ID" in where_clause:
                suggestions.add(("card_id", "card_id"))
    return list(suggestions)


def explain_query(query):
    """分析查询执行计划"""
    from sqlalchemy import text

    sql = str(query.statement)
    with db.session.connection() as conn:
        result = conn.execute(text(f"EXPLAIN {sql}"))
        return [dict(row) for row in result]


def optimize_statistics_query(user_id=None, class_name=None, start_date=None, end_date=None):
    """
    优化积分统计查询
    使用单个聚合查询代替多次查询
    """
    from sqlalchemy import func, case
    from models import ScoreRecord, User

    query = db.session.query(
        func.count(ScoreRecord.id).label("total_records"),
        func.sum(case((ScoreRecord.score_change > 0, ScoreRecord.score_change), else_=0)).label("total_add"),
        func.sum(case((ScoreRecord.score_change < 0, ScoreRecord.score_change), else_=0)).label("total_subtract"),
    )
    if user_id:
        query = query.filter(ScoreRecord.user_id == user_id)
    elif class_name:
        query = query.join(User).filter(User.class_name == class_name)
    if start_date:
        query = query.filter(ScoreRecord.created_at >= start_date)
    if end_date:
        query = query.filter(ScoreRecord.created_at <= end_date)
    result = query.first()
    return {
        "total_records": result.total_records or 0,
        "total_add": float(result.total_add or 0),
        "total_subtract": abs(float(result.total_subtract or 0)),
        "net_change": float((result.total_add or 0) + (result.total_subtract or 0)),
    }


def optimize_user_records_query(user_id, page=1, per_page=50):
    """
    优化用户积分记录查询
    使用JOIN和预加载减少查询次数
    """
    from sqlalchemy.orm import joinedload
    from models import ScoreRecord

    query = (
        ScoreRecord.query.options(joinedload(ScoreRecord.user), joinedload(ScoreRecord.rule))
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.created_at.desc())
    )
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "records": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "user_name": r.user.name if r.user else None,
                "rule_id": r.rule_id,
                "rule_name": r.rule.name if r.rule else None,
                "score_change": r.score_change,
                "description": r.description,
                "created_at": r.created_at.isoformat(),
            }
            for r in pagination.items
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }


def optimize_search_query(search_term, admin_role=None, allowed_classes=None, page=1, per_page=100):
    """
    优化用户搜索查询
    使用联合索引和优化后的LIKE查询
    """
    from models import User

    query = User.query
    if admin_role != "admin" and allowed_classes:
        if allowed_classes:
            query = query.filter(User.class_name.in_(allowed_classes))
        else:
            return {"users": [], "total": 0, "page": page, "per_page": per_page, "pages": 0}
    if search_term:
        search_pattern = f"%{search_term}%"
        query = query.filter(
            db.or_(User.name.like(search_pattern), User.card_id.like(search_pattern), User.phone.like(search_pattern))
        )
    pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return {
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "gender": u.gender,
                "class_name": u.class_name,
                "phone": u.phone,
                "card_id": u.card_id,
                "current_score": u.current_score,
                "created_at": u.created_at.isoformat(),
            }
            for u in pagination.items
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }



class CacheManager:
    """简单的查询缓存管理器（内存实现，便于测试与单进程部署）。"""

    def __init__(self, default_ttl=300):
        self.default_ttl = default_ttl
        self._store = {}
        self._timestamps = {}

    def get(self, key):
        if key in self._store:
            if time.time() - self._timestamps.get(key, 0) < self.default_ttl:
                return self._store[key]
            self.delete(key)
        return None

    def set(self, key, value, ttl=None):
        self._store[key] = value
        self._timestamps[key] = time.time()
        return True

    def delete(self, key):
        self._store.pop(key, None)
        self._timestamps.pop(key, None)

    def clear(self):
        self._store.clear()
        self._timestamps.clear()

    def has(self, key):
        return self.get(key) is not None

    def keys(self):
        return list(self._store.keys())


class CachedQueries:
    """基于 CacheManager 的查询缓存服务。"""

    def __init__(self, cache_manager):
        self.cache_manager = cache_manager
        self.prefix = "query:"

    def _key(self, *parts):
        return self.prefix + ":".join(str(p) for p in parts)

    def invalidate_user_cache(self, user_id):
        """失效指定用户的查询缓存。"""
        target = f":user:{user_id}"
        for k in self.cache_manager.keys():
            if target in k:
                self.cache_manager.delete(k)

    def invalidate_all_cache(self):
        """失效全部查询缓存。"""
        for k in self.cache_manager.keys():
            if k.startswith(self.prefix):
                self.cache_manager.delete(k)
