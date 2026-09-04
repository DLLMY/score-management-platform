"""
定时任务辅助模块（仅提供被复用/引用的函数）。

说明：
- 备份 + 心跳检查的调度由 app/service_init.py::init_scheduler 统一管理
  （曾在此重复实现，存在双启动风险，已删除）。
- 本模块仅保留：
  1. scheduled_approval_timeout_check / scheduled_notify_check —— 被
     service_init.init_scheduler 注册（审批超时 5min + 定时通知 10s）；
  2. shutdown_scheduler —— 被 tests/conftest.py 引用（no-op 兼容，测试
     实际关闭的是 service_init 启动的调度器，见其 _ACTIVE_SCHEDULERS）。
"""

from datetime import datetime, timedelta

scheduler = None


from utils.logger import log_info, log_warning, log_debug
def scheduled_approval_timeout_check(app):
    try:
        from models import Approval, SystemConfig
        from api.monitoring.mqtt_routes import publish_mqtt

        with app.app_context():
            config = SystemConfig.query.first()
            timeout_hours = (
                config.approval_timeout_hours if config and config.approval_timeout_hours else 24
            )

            timeout_threshold = datetime.now() - timedelta(hours=timeout_hours)

            timeout_approvals = Approval.query.filter(
                Approval.status == "pending", Approval.created_at < timeout_threshold
            ).all()

            if timeout_approvals:
                log_info(f"审批超时检查发现 {len(timeout_approvals)} 个超时审批")

                for approval in timeout_approvals:
                    notification = {
                        "type": "approval_timeout",
                        "approval_id": approval.id,
                        "user_id": approval.student_id,
                        "user_name": approval.user.name if approval.user else None,
                        "title": approval.title,
                        "description": approval.description,
                        "score_change": approval.score_change,
                        "created_at": (
                            approval.created_at.isoformat() if approval.created_at else None
                        ),
                        "timeout_hours": timeout_hours,
                        "timestamp": datetime.now().isoformat(),
                    }

                    try:
                        publish_mqtt("phonebox/approval_timeout", notification)
                        log_info(f"[Approval] 已发送审批超时提醒: approval_id={approval.id}")
                    except Exception as e:
                        log_warning(f"[Approval] 发送审批超时提醒失败: {e}", exception=e)
            else:
                log_debug("审批超时检查完成，无超时审批")
    except Exception as e:
        log_warning(f"审批超时检查异常: {e}", exception=e)


def scheduled_notify_check(app):
    try:
        from api.scores.scheduled_notify_routes import process_scheduled_notifications

        with app.app_context():
            process_scheduled_notifications()
    except Exception as e:
        log_warning(f"定时通知检查异常: {e}", exception=e)


def shutdown_scheduler():
    if scheduler:
        scheduler.shutdown()
        log_info("定时任务调度器已关闭")
