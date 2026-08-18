from datetime import datetime
from services.data_consistency_checker import DataConsistencyChecker
from services.class_migration_service import ClassMigrationService
import time
import logging
import threading

"""
数据同步定时任务
使用 APScheduler 或后台线程执行定时同步
"""
logger = logging.getLogger(__name__)
_scheduler = None
_scheduler_thread = None
_running = False


class DataSyncScheduler:
    """数据同步调度器"""

    def __init__(self, app):
        self.app = app
        self.running = False
        self.thread = None

    def start(self):
        """启动定时同步"""
        self.running = True
        self.thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.thread.start()
        logger.info("Data sync scheduler started")

    def stop(self):
        """停止定时同步"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Data sync scheduler stopped")

    def _run_scheduler(self):
        """运行调度循环"""
        check_interval = 3600  # 每小时执行一次一致性检查 (1小时)
        fix_hour = 3  # 每天凌晨3点执行数据修复
        last_fix_date = None
        # 启动时立即执行一次检查
        self._run_consistency_check()
        while self.running:
            try:
                with self.app.app_context():
                    # 一致性检查
                    checker = DataConsistencyChecker()
                    result = checker.check_all()  # noqa: F841
                    if not result["healthy"]:
                        logger.warning(f"Data consistency issues found: {result['total_issues']}")
                    else:
                        logger.info("Data consistency check: all good")
                    # 每天凌晨执行一次修复
                    now = datetime.now()
                    if now.hour == fix_hour and (
                        last_fix_date is None or last_fix_date != now.date()
                    ):
                        logger.info("Running scheduled data fix...")
                        service = ClassMigrationService()
                        service.run_full_migration()
                        last_fix_date = now.date()
                        logger.info("Scheduled data fix completed")
            except Exception as e:
                logger.error(f"Scheduled sync task failed: {e}")
            # 等待下一次检查
            time.sleep(check_interval)

    def _run_consistency_check(self):
        """立即执行一次一致性检查"""
        try:
            with self.app.app_context():
                checker = DataConsistencyChecker()
                result = checker.check_all()  # noqa: F841
                if not result["healthy"]:
                    logger.warning(
                        f"Initial check: {result['total_issues']} data consistency issues found"
                    )
                else:
                    logger.info("Initial check: data is consistent")
        except Exception as e:
            logger.error(f"Initial consistency check failed: {e}")


def start_data_sync_scheduler(app):
    """启动数据同步调度器"""
    global _scheduler, _running
    if _running:
        logger.info("Data sync scheduler already running")
        return
    _scheduler = DataSyncScheduler(app)  # noqa: F841
    _scheduler.start()
    _running = True  # noqa: F841


def stop_data_sync_scheduler():
    """停止数据同步调度器"""
    global _running
    if _scheduler:
        _scheduler.stop()
        _running = False  # noqa: F841


def run_immediate_check(app):
    """立即执行一次一致性检查（可用于手动触发）"""
    with app.app_context():
        checker = DataConsistencyChecker()
        return checker.check_all()
