"""T1 回归：综合分重算失败不得静默吞掉（数据正确性护栏）。

验收依据 docs/下一步开发计划-20260824.md §T1：消除 records_routes 对
CompositeScoreService.recalculate_user_score 的静默吞异常。

当前实现经 services/score_recalc.enqueue_or_recalc_user_score 收口：
默认（未启用 Celery 异步）走同步回退，且同步路径必须向上抛异常，
由路由层 try/except 记录 logger.error，绝不 except:pass 导致综合分与
明细长期静默漂移。本用例锁定「同步重算抛异常 → 向上传播」这一不变量。
"""

import pytest


def test_sync_recalc_failure_propagates_not_swallowed(monkeypatch, app):
    """同步重算抛异常时必须向上传播（路由层 logger.error 捕获），而非静默吞掉。"""
    # 关闭异步重算，强制走同步回退路径
    monkeypatch.setitem(app.config, "CELERY_ASYNC_SCORE_RECALC", False)

    def _boom(user_id):  # pragma: no cover - 故意失败以验证不变量
        raise RuntimeError("recalc boom")

    monkeypatch.setattr(
        "services.composite_score_service.CompositeScoreService.recalculate_user_score",
        staticmethod(_boom),
    )

    from services.score_recalc import enqueue_or_recalc_user_score

    with app.app_context():
        # 同步回退调用 recalculate_user_score 抛错，必须穿透 enqueue_or_recalc_user_score
        # 传到路由层 try/except（logger.error），绝不能在此被 except:pass 吞掉。
        with pytest.raises(RuntimeError):
            enqueue_or_recalc_user_score(1)
