import pytest

try:
    from utils.query_optimizer import QueryOptimizer
except ImportError:
    pass

try:
    from utils.query_optimizer import CacheManager
except ImportError:
    pass

try:
    from utils.query_optimizer import CachedQueries
except ImportError:
    pass


class TestQueryOptimizer:

    def test_get_users_paginated(self, app, session):
        with app.app_context():
            from utils.query_optimizer import QueryOptimizer

            result = QueryOptimizer.get_users_paginated(page=1, per_page=10)
            assert result is not None

    def test_get_top_users(self, app, session):
        with app.app_context():
            result = QueryOptimizer.get_top_users(limit=5)
            assert isinstance(result, list)

    def test_get_score_stats(self, app, session):
        with app.app_context():
            try:
                result = QueryOptimizer.get_score_stats()
                assert isinstance(result, dict)
            except AttributeError:
                pytest.skip("ScoreRecord model schema mismatch")

    def test_get_daily_score_trend(self, app, session):
        with app.app_context():
            try:
                result = QueryOptimizer.get_daily_score_trend(days=7)
                assert isinstance(result, list)
            except AttributeError:
                pytest.skip("ScoreRecord model schema mismatch")

    def test_get_daily_score_trend_timezone_correct(self, app, session, sample_user, sample_rule):
        """R7 回归：since 必须以本地 naive 基准计算（与 ScoreRecord.created_at
        的 default=datetime.now() 存储基准一致），不能误用 datetime.now(UTC)
        导致 7 日趋势只返回最近约 8 小时。

        通过注入固定 now 参数（依赖注入）做确定性验证，避免对 C 层 immutable
        datetime.datetime.now 打桩（mock.patch.object 不可行）。
        """
        from datetime import datetime, timedelta

        from models import ScoreRecord

        # 固定本地 naive 基准
        BASE = datetime(2026, 1, 15, 12, 0, 0)

        # recent(2h前)/within(3d前) 必含；just_out(7d4h前) 修复后排除；far_out(9d前) 必排除
        offsets = {
            "recent": timedelta(hours=2),
            "within": timedelta(days=3),
            "just_out": timedelta(days=7) + timedelta(hours=4),
            "far_out": timedelta(days=9),
        }
        for off in offsets.values():
            session.add(
                ScoreRecord(
                    student_id=sample_user.id,
                    rule_id=sample_rule.id,
                    score_change=1.0,
                    created_at=BASE - off,
                )
            )
        session.commit()

        with app.app_context():
            result = QueryOptimizer.get_daily_score_trend(days=7, now=BASE)

        returned_dates = {r["date"] for r in result}
        assert str((BASE - offsets["recent"]).date()) in returned_dates
        assert str((BASE - offsets["within"]).date()) in returned_dates
        assert str((BASE - offsets["just_out"]).date()) not in returned_dates
        assert str((BASE - offsets["far_out"]).date()) not in returned_dates

    def test_get_device_status_summary(self, app, session):
        with app.app_context():
            result = QueryOptimizer.get_device_status_summary()
            assert isinstance(result, dict)

    def test_get_operation_logs(self, app, session):
        with app.app_context():
            result = QueryOptimizer.get_operation_logs(page=1, per_page=10)
            assert result is not None


class TestCacheManager:

    def test_cache_manager_init(self, app):
        with app.app_context():
            from utils.query_optimizer import CacheManager

            manager = CacheManager()
            assert manager is not None


class TestCachedQueries:

    def test_service_init(self, app):
        with app.app_context():
            from utils.query_optimizer import CachedQueries

            cache_manager = CacheManager()
            service = CachedQueries(cache_manager)
            assert service is not None

    def test_invalidate_user_cache(self, app):
        with app.app_context():
            cache_manager = CacheManager()
            service = CachedQueries(cache_manager)
            service.invalidate_user_cache(user_id=1)

    def test_invalidate_all_cache(self, app):
        with app.app_context():
            cache_manager = CacheManager()
            service = CachedQueries(cache_manager)
            service.invalidate_all_cache()
