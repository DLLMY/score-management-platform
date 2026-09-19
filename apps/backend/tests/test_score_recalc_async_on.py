"""T4 闸门（异步开启路径）：CELERY_ASYNC_SCORE_RECALC=True 时，写路径必须「仅入队 + 返回」。

验收依据 docs/下一步开发计划-20260824.md §T4：
- ① 写路径仅入队 + 返回（不得同步调用 CompositeScoreService.recalculate_user_score）；
- ② 异步任务由 worker 执行重算（tasks.score_tasks.recalc_user_score.delay 入队）。

本用例锁定「异步开关开启 → 派发走 .delay() 入队、绝不同步重算」这一不变量，
无需真实 broker：通过 monkeypatch 让 .delay() 记录调用并立即返回，
并 spy 同步 recalculate_user_score 确认其未被触碰。

默认（未开启）行为由 test_composite_score_service.
test_score_recalc_dispatcher_falls_back_to_sync 与 test_score_recalc.
test_sync_recalc_failure_propagates_not_swallowed 覆盖。
"""

import pytest


def test_async_enabled_enqueues_and_skips_sync(app, monkeypatch):
    """CELERY_ASYNC_SCORE_RECALC=True 时：派发仅入队 .delay()，不同步重算。"""
    with app.app_context():
        # 开启异步开关
        app.config["CELERY_ASYNC_SCORE_RECALC"] = True

        # 记录 .delay() 入队调用（无需真实 broker）
        calls = []
        import tasks.score_tasks as st

        def fake_delay(user_id):
            calls.append(user_id)
            return None

        monkeypatch.setattr(st.recalc_user_score, "delay", fake_delay)

        # spy 同步重算：若被调用则记录，用于断言「未被触碰」
        import services.composite_score_service as cs

        sync_calls = []
        orig = cs.CompositeScoreService.recalculate_user_score

        def spy_sync(user_id):
            sync_calls.append(user_id)
            return None

        monkeypatch.setattr(
            cs.CompositeScoreService, "recalculate_user_score", staticmethod(spy_sync)
        )

        from services.score_recalc import enqueue_or_recalc_user_score

        enqueue_or_recalc_user_score(7)

        # ① 写路径仅入队：.delay() 被调用且参数正确
        assert calls == [7], f"期望 .delay(7) 入队，实际 {calls}"
        # ② 未同步重算：同步路径绝不被触碰（延迟随用户数不线性增长的前提）
        assert sync_calls == [], f"异步开启时不应同步重算，实际 {sync_calls}"

        # 还原，避免污染其他用例
        monkeypatch.setattr(cs.CompositeScoreService, "recalculate_user_score", staticmethod(orig))
