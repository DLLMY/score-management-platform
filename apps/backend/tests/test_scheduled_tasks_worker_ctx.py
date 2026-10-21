"""定时任务 worker 环境回归守卫（2026-10-21）。

背景：celery worker 无 Flask app_context（celery_app.py 未设 ContextTask 基座），
tasks/scheduled_tasks.py 的 daily_summary / health_check / archive_operation_logs
既不自包上下文、又调用了 RedisCache 不存在的方法 set_stats；warmup_cache_task
漏传 app 参数 → TypeError。以上缺陷导致 beat 调度（config.py CELERY_BEAT_SCHEDULE）
6 个任务中 4 个在生产 worker 下崩溃或静默失败：
- health_check（每小时）：set_stats AttributeError 逃逸 → 任务崩溃；
- daily_summary（每日）：无 app_context → success=False；
- warmup_cache_task（每 30 分钟）：漏传 app → TypeError → 静默失败；
- archive_operation_logs（被调时）：无 app_context → except 内 rollback 再抛 → 崩溃。

既有 test_scheduled_tasks_archive.py 以 `with app.app_context():` 包裹调用，
掩盖了「任务自身不提供上下文」的缺陷（测试绿、生产崩）。

本用例模拟 celery worker：**无外层 app_context** 直接调用任务，并断言：
1. 四个任务均 success=True（上下文自包 + set_stats→set + warmup 参数修复生效）；
2. daily_summary 汇总数值与旧版 Python 参考实现逐项相等（条件聚合语义等价，
   覆盖 score_change=0 与 student_id=NULL 边界）；
3. 缓存写入走 set() 且 key/TTL 契约正确（防回归到不存在的 set_stats）；
4. 全程不触碰真实库：worker_app 夹具把 `from app import app` 解析到的单例
   换成测试 app（探针实证：测试会话内该导入会解析到 instance/score_management.db）。
"""

from datetime import datetime, timedelta

import pytest


@pytest.fixture
def worker_app(app, monkeypatch):
    """模拟 worker 进程：无环境 app_context，且 app 单例指向测试 app。

    同时把缓存单例 client 置空：set/get 走降级分支——既验证 set_stats→set
    修复生效，又避免向开发机真实 Redis 写入 daily:/health_check 键。
    """
    import sys
    import types

    from services.redis_cache_service import cache as cache_singleton

    monkeypatch.setattr(cache_singleton, "client", None)

    real = sys.modules.get("app")
    if real is not None:
        monkeypatch.setattr(real, "app", app, raising=False)
    else:
        stub = types.ModuleType("app")
        stub.app = app
        monkeypatch.setitem(sys.modules, "app", stub)
    return app


@pytest.fixture
def seeded_records(app):
    """在昨日时间窗内播种积分记录（覆盖正/负/零变化、多学生、NULL 学号）。"""
    from models import ScoreRecord, db

    yesterday_noon = (datetime.now() - timedelta(days=1)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    rows = [
        ScoreRecord(student_id=1, score_change=5.0, created_at=yesterday_noon),
        ScoreRecord(student_id=1, score_change=-3.0, created_at=yesterday_noon),
        ScoreRecord(student_id=2, score_change=10.0, created_at=yesterday_noon),
        ScoreRecord(student_id=2, score_change=0.0, created_at=yesterday_noon),
        ScoreRecord(student_id=None, score_change=-7.0, created_at=yesterday_noon),
    ]
    with app.app_context():
        db.session.add_all(rows)
        db.session.commit()
    return yesterday_noon


def _record_cache_calls(monkeypatch):
    """记录 cache.set 调用（key, value, expire），返回 calls 列表。"""
    from services.redis_cache_service import cache as cache_singleton

    calls = []

    def _fake_set(key, value, expire=None, ttl=None, tags=None):
        calls.append((key, value, expire))
        return True

    monkeypatch.setattr(cache_singleton, "set", _fake_set)
    return calls


class TestWorkerContextGuards:
    def test_daily_summary_runs_without_app_context(self, app, worker_app, seeded_records):
        """worker 环境（无外层 app_context）下每日汇总成功且数值正确。"""
        from tasks.scheduled_tasks import daily_summary

        result = daily_summary()
        assert result["success"] is True, result
        summary = result["summary"]

        # 与旧版 Python 参考实现逐项相等（旧实现：.all() 全量取行 + sum/set）
        yesterday = datetime.now() - timedelta(days=1)
        assert summary["date"] == yesterday.strftime("%Y-%m-%d")
        assert summary["total_records"] == 5
        assert summary["total_add"] == 15.0  # 5.0 + 10.0
        assert summary["total_subtract"] == 10.0  # abs(-3.0 + -7.0)
        assert summary["net_change"] == 5.0
        assert summary["active_users"] == 3  # {1, 2, None} —— None 计 1 个成员

    def test_daily_summary_writes_cache_via_set(self, worker_app, seeded_records, monkeypatch):
        """缓存写入走 set()（非不存在的 set_stats），key/TTL 契约正确。"""
        from tasks.scheduled_tasks import daily_summary

        calls = _record_cache_calls(monkeypatch)
        result = daily_summary()
        assert result["success"] is True, result

        assert len(calls) == 1
        key, value, expire = calls[0]
        yesterday = datetime.now() - timedelta(days=1)
        assert key == f'daily:{yesterday.strftime("%Y-%m-%d")}'
        assert value["total_records"] == 5
        assert expire == 7 * 24 * 3600

    def test_health_check_runs_without_app_context(self, worker_app):
        """worker 环境下健康检查不再崩溃，且数据库判活真正执行。"""
        from tasks.scheduled_tasks import health_check

        result = health_check()
        assert result["success"] is True, result
        services = result["health_status"]["services"]
        # 数据库必须 healthy：证明 db.session.execute 在自包上下文内真实执行
        assert services["database"]["status"] == "healthy"
        assert "redis" in services
        assert "mqtt" in services

    def test_health_check_writes_cache_via_set(self, worker_app, monkeypatch):
        """健康状态缓存写入走 set()，key/TTL 契约正确。"""
        from tasks.scheduled_tasks import health_check

        calls = _record_cache_calls(monkeypatch)
        result = health_check()
        assert result["success"] is True, result

        assert len(calls) == 1
        key, _value, expire = calls[0]
        assert key == "health_check"
        assert expire == 3600

    def test_archive_runs_without_app_context(self, app, worker_app):
        """worker 环境下归档成功（含 except 内 rollback 不再二次抛错）。"""
        from models import OperationLog, OperationLogArchive, db
        from tasks.scheduled_tasks import archive_operation_logs

        old = OperationLog(
            operation_type="score.change",
            target_type="score",
            target_id=7,
            operator="tester",
            description="旧日志（应归档）",
            user_id=3,
            created_at=datetime.now() - timedelta(days=100),
        )
        with app.app_context():
            db.session.add(old)
            db.session.commit()
            old_id = old.id

        result = archive_operation_logs(days_to_keep=30)
        assert result["success"] is True, result
        assert result["archived_count"] == 1
        assert result["deleted_count"] == 1

        with app.app_context():
            assert OperationLog.query.count() == 0
            archives = OperationLogArchive.query.all()
            assert len(archives) == 1
            assert archives[0].original_id == old_id
            assert archives[0].admin_id == 3

    def test_warmup_cache_task_runs_without_app_context(self, worker_app):
        """worker 环境下预热不再因漏传 app 参数恒 TypeError。"""
        from tasks.scheduled_tasks import warmup_cache_task

        result = warmup_cache_task()
        assert result["success"] is True, result
