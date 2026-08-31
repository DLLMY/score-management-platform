"""综合分重算的 Celery 异步任务。

生产环境由 worker 消费，避免批量录分 / 删除在请求链路内同步重算
（N 个学生 → 响应延迟随用户数线性增长）。

测试 / 本地无 worker 时，调用方通过 services.score_recalc.enqueue_or_recalc_user_score
自动回退同步，保证综合分不漂移、写路径契约不变。
"""
import logging

from celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.score_tasks.recalc_user_score", queue="score")
def recalc_user_score(self, user_id):
    """异步重算单个用户的综合分（在 Flask 应用上下文中执行）。"""
    from app import app as flask_app

    with flask_app.app_context():
        try:
            from services.composite_score_service import CompositeScoreService

            CompositeScoreService.recalculate_user_score(user_id)
            return {"success": True, "user_id": user_id}
        except Exception as e:  # noqa: BLE001
            logger.error("[CompositeScore] 异步重算综合分失败 user_id=%s: %s", user_id, e)
            try:
                # 轻量重试，便于 broker 抖动后自愈；超出重试次数后落入 finally 返回失败
                self.retry(exc=e, countdown=5, max_retries=2)
            except Exception:  # noqa: BLE001
                pass
            return {"success": False, "user_id": user_id, "error": str(e)}
