"""综合分重算的派发入口：生产异步入队，无 broker / 未配置时同步回退。

统一收口 records_routes 多处 CompositeScoreService.recalculate_user_score 调用，保证：
- 显式开启 CELERY_ASYNC_SCORE_RECALC 且 broker 可连接 → 异步入队，写路径立即返回；
- 未开启 / broker 不可用 / celery 未配置 / 任务未注册 → 同步回退调用
  CompositeScoreService.recalculate_user_score，失败向上抛出，由调用方 try/except
  记录上下文（不静默吞掉，沿用 T1 的 logger.error 约定）。

默认（不设置 CELERY_ASYNC_SCORE_RECALC）走同步，确保测试 / 沙箱 / 本地开发
综合分一定被重算，绝不因「已入队但无 worker 消费」而静默漂移。
"""
import logging

logger = logging.getLogger(__name__)


def enqueue_or_recalc_user_score(user_id):
    """重算 user_id 的综合分：异步优先，同步兜底。"""
    try:
        from flask import current_app

        if not current_app.config.get("CELERY_ASYNC_SCORE_RECALC", False):
            raise RuntimeError("async score recalc not enabled")
        from celery_app import celery_app  # noqa: F401  (仅用于早失败探测)
        from tasks.score_tasks import recalc_user_score

        recalc_user_score.delay(user_id)
        return  # 已异步入队，实际重算在 worker 中执行
    except Exception as e:  # noqa: BLE001
        logger.debug(
            "[CompositeScore] 异步重算未启用/不可用，回退同步 user_id=%s: %s", user_id, e
        )

    # 同步回退：保证综合分不漂移（测试 / 本地无 worker 时）
    from services.composite_score_service import CompositeScoreService

    CompositeScoreService.recalculate_user_score(user_id)  # 失败向上抛，由调用方记录
