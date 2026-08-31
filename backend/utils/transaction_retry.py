import logging
import time
import threading
from contextlib import contextmanager
from functools import wraps
from models import db

# -*- coding: utf-8 -*-
"""
事务重试和并发控制模块
解决SQLite并发写入数据丢失问题
实现事务隔离、乐观锁、重试机制
"""

logger = logging.getLogger(__name__)


class TransactionRetry:
    """事务重试管理器"""

    def __init__(
        self,
        max_retries=5,
        base_delay=0.1,
        max_delay=5.0,
        retry_on=(Exception,),
        backoff_factor=2.0,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.retry_on = retry_on
        self.backoff_factor = backoff_factor
        self._stats = {
            "total_attempts": 0,
            "successful": 0,
            "failed": 0,
            "retries": 0,
            "last_retry_time": None,
        }
        self._lock = threading.Lock()

    def execute(self, func, *args, **kwargs):
        """
        执行带重试的操作

        Args:
            func: 要执行的函数
            *args, **kwargs: 函数参数

        Returns:
            函数返回值

        Raises:
            最后一次重试的异常
        """
        last_exception = None
        delay = self.base_delay

        for attempt in range(self.max_retries + 1):
            try:
                self._stats["total_attempts"] += 1
                result = func(*args, **kwargs)  # noqa: F841
                self._stats["successful"] += 1
                return result
            except self.retry_on as e:
                last_exception = e
                self._stats["retries"] += 1
                self._stats["last_retry_time"] = time.time()

                if attempt < self.max_retries:
                    logger.warning(
                        f"事务执行失败 (第{attempt + 1}次), " f"{delay:.2f}秒后重试: {str(e)}"
                    )
                    time.sleep(delay)
                    delay = min(delay * self.backoff_factor, self.max_delay)
                else:
                    self._stats["failed"] += 1
                    logger.error(f"事务执行失败 (已达最大重试次数{self.max_retries}): {str(e)}")

        raise last_exception

    @property
    def retry_count(self):
        """获取重试次数"""
        return self._stats["retries"]

    def get_stats(self):
        """获取重试统计"""
        with self._lock:
            return self._stats.copy()

    def reset_stats(self):
        """重置统计"""
        with self._lock:
            self._stats = {
                "total_attempts": 0,
                "successful": 0,
                "failed": 0,
                "retries": 0,
                "last_retry_time": None,
            }


# 全局默认重试器


default_retry = TransactionRetry(
    max_retries=5,
    base_delay=0.1,
    max_delay=5.0,
)


def retry_on_db_lock(max_retries=5, base_delay=0.1):
    """
    数据库锁冲突重试装饰器

    用于处理SQLite的database is locked错误

    Usage:

        @retry_on_db_lock(max_retries=3)
        def import_data(data):
            ...
    """

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):
            retry = TransactionRetry(
                max_retries=max_retries,
                base_delay=base_delay,
                retry_on=(Exception,),
            )
            return retry.execute(func, *args, **kwargs)

        return wrapper

    return decorator


@contextmanager
def transaction_with_retry(auto_commit=True, max_retries=3):
    """
    带重试的事务上下文管理器

    解决SQLite并发写入时的database is locked问题

    Usage:
        with transaction_with_retry() as session:
            session.add(obj)
            session.commit()

    Args:
        auto_commit: 是否自动提交
        max_retries: 最大重试次数
    """
    from models import db

    retry = TransactionRetry(
        max_retries=max_retries,
        base_delay=0.05,
        max_delay=2.0,
    )

    def _do_transaction():
        session = db.session
        try:
            yield session
            if auto_commit:
                session.commit()
            return True
        except Exception:
            session.rollback()
            raise

    return retry.execute(_do_transaction)


class OptimisticLock:
    """乐观锁实现"""

    def __init__(self, model_class, version_field="version"):
        """
        初始化乐观锁

        Args:
            model_class: ORM模型类
            version_field: 版本字段名
        """
        self.model_class = model_class
        self.version_field = version_field

    def acquire(self, instance):
        """
        获取锁（检查版本）

        Args:
            instance: 模型实例

        Returns:
            是否获取成功
        """
        current_version = getattr(instance, self.version_field, 0)
        fresh = self.model_class.query.get(instance.id)
        if fresh and getattr(fresh, self.version_field, 0) == current_version:
            return True
        return False

    def release(self, instance):
        """
        释放锁（更新版本）

        Args:
            instance: 模型实例
        """
        current = getattr(instance, self.version_field, 0)
        setattr(instance, self.version_field, current + 1)


def safe_bulk_insert(records, batch_size=100, max_retries=3):
    """
    安全批量插入

    分批插入数据，遇到锁冲突时自动重试

    Args:
        records: 要插入的记录列表
        batch_size: 每批大小
        max_retries: 最大重试次数

    Returns:
        成功插入的记录数
    """

    total_inserted = 0
    retry = TransactionRetry(max_retries=max_retries)

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]

        def _insert_batch():
            db.session.add_all(batch)
            db.session.commit()
            return len(batch)

        try:
            inserted = retry.execute(_insert_batch)
            total_inserted += inserted
            logger.info(f"批量插入: 已插入 {total_inserted}/{len(records)} 条")
        except Exception as e:
            db.session.rollback()
            logger.error(f"批量插入失败: {str(e)}")
            raise

    return total_inserted


def safe_bulk_update(updates, batch_size=100, max_retries=3):
    """
    安全批量更新

    Args:
        updates: 更新操作列表
        batch_size: 每批大小
        max_retries: 最大重试次数

    Returns:
        成功更新的记录数
    """

    total_updated = 0
    retry = TransactionRetry(max_retries=max_retries)

    for i in range(0, len(updates), batch_size):
        batch = updates[i : i + batch_size]

        def _update_batch():
            for model, data in batch:
                for key, value in data.items():
                    setattr(model, key, value)
            db.session.commit()
            return len(batch)

        try:
            updated = retry.execute(_update_batch)
            total_updated += updated
        except Exception as e:
            db.session.rollback()
            logger.error(f"批量更新失败: {str(e)}")
            raise

    return total_updated


class ConcurrentImportGuard:
    """并发导入守卫"""

    def __init__(self, max_concurrent=5, queue_timeout=30):
        """
        初始化并发导入守卫

        Args:
            max_concurrent: 最大并发导入数
            queue_timeout: 队列超时时间（秒）
        """
        self.max_concurrent = max_concurrent
        self.queue_timeout = queue_timeout
        self._semaphore = threading.Semaphore(max_concurrent)
        self._active_imports = {}
        self._lock = threading.Lock()

    def acquire(self, import_id=None):
        """
        获取导入许可

        Args:
            import_id: 导入ID

        Returns:
            (是否获取成功, 导入ID)
        """
        acquired = self._semaphore.acquire(timeout=self.queue_timeout)
        if acquired:
            with self._lock:
                if import_id is None:
                    import_id = f"import_{len(self._active_imports) + 1}"
                self._active_imports[import_id] = time.time()
            logger.info(f"获取导入许可: {import_id}")
            return True, import_id
        else:
            logger.warning("获取导入许可超时: 队列已满")
            return False, None

    def release(self, import_id):
        """
        释放导入许可

        Args:
            import_id: 导入ID
        """
        with self._lock:
            self._active_imports.pop(import_id, None)
        self._semaphore.release()
        logger.info(f"释放导入许可: {import_id}")

    def get_active_count(self):
        """获取当前活跃导入数"""
        with self._lock:
            return len(self._active_imports)

    def get_queue_status(self):
        """获取队列状态"""
        with self._lock:
            return {
                "active_imports": len(self._active_imports),
                "max_concurrent": self.max_concurrent,
                "available_slots": self.max_concurrent - len(self._active_imports),
                "imports": list(self._active_imports.keys()),
            }


# 全局并发导入守卫实例


_import_guard = None


def get_import_guard(max_concurrent=5):
    """获取全局导入守卫实例"""
    global _import_guard
    if _import_guard is None:
        _import_guard = ConcurrentImportGuard(max_concurrent)  # noqa: F841
    return _import_guard
