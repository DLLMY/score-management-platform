"""后端启动清理：扫描悬挂训练记录并置 error。

场景：daemon 训练线程在开发重启/强杀时无法走 finally 更新 status=running → completed，
NLPModelTraining 记录永久悬挂（前端显示「进行中」）。启动后扫描清理，避免历史记录误导。
"""

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def cleanup_stale_training_records(app, max_running_minutes=5):
    """扫描 status=running 但 created_at 超过阈值的训练记录，置为 error。

    单进程/单 worker 部署下安全（重启会强杀在跑线程）；多 worker 部署建议调大阈值或
    改为按 worker 维度判断（当前项目 run.py 为单进程 socketio 启动）。

    Args:
        app: Flask app 实例（用于 app context）
        max_running_minutes: 超过该分钟数仍 status=running 视为悬挂

    Returns:
        清理的记录数
    """
    with app.app_context():
        from models import db
        from models.nlp_models import NLPModelTraining

        try:
            # 必须用 datetime.now()（与训练流程 datetime.now() 写入同基准/本地 naive），
            # 不能用 datetime.utcnow()——会导致时区错位、阈值与写入时间不可比（#912 实机）。
            threshold = datetime.now() - timedelta(minutes=max_running_minutes)
            stale = (
                NLPModelTraining.query.filter(
                    NLPModelTraining.status == "running",
                    NLPModelTraining.created_at < threshold,
                ).all()
            )
        except Exception as e:  # noqa: BLE001
            logger.error("扫描悬挂训练记录失败: %s", e, exc_info=True)
            return 0

        if not stale:
            logger.info("启动清理：无悬挂训练记录")
            return 0

        count = 0
        for rec in stale:
            rec.status = "error"
            rec.error_message = "进程重启/超时未完成，由启动清理置 error"
            db.session.add(rec)
            count += 1
            logger.warning(
                "启动清理悬挂训练记录 id=%s algorithm=%s created=%s → error（后端重启/超时未完成）",
                rec.id,
                rec.algorithm_type,
                rec.created_at,
            )
        if count:
            try:
                db.session.commit()
            except Exception as e:  # noqa: BLE001
                logger.error("提交清理失败: %s", e, exc_info=True)
                db.session.rollback()
                return 0
        logger.info("启动清理完成：%d 条悬挂训练记录置 error", count)
        return count
