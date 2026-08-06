from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = None


def scheduled_backup():
    try:
        from utils.backup_utils import backup_manager

        result = backup_manager.create_backup("full")  # noqa: F841
        if result["success"]:
            print(f"数据库定时备份成功: {result['filename']}")
            backup_manager.clean_old_backups()
        else:
            print(f"数据库定时备份失败: {result['message']}")
    except Exception as e:
        print(f"数据库定时备份异常: {e}")


def scheduled_heartbeat_check(app):
    try:
        from services.heartbeat_service import check_heartbeat_timeout

        with app.app_context():
            result = check_heartbeat_timeout()  # noqa: F841
            if result and result.get("total_timeout", 0) > 0:
                print(f"心跳超时检查发现 {result['total_timeout']} 台设备离线")
            else:
                print("心跳超时检查完成，所有设备正常")
    except Exception as e:
        print(f"心跳超时检查异常: {e}")


def scheduled_approval_timeout_check(app):
    try:
        from models import Approval, SystemConfig
        from api.monitoring.mqtt_routes import publish_mqtt

        with app.app_context():
            config = SystemConfig.query.first()
            timeout_hours = config.approval_timeout_hours if config and config.approval_timeout_hours else 24

            timeout_threshold = datetime.now() - timedelta(hours=timeout_hours)

            timeout_approvals = Approval.query.filter(
                Approval.status == "pending", Approval.created_at < timeout_threshold
            ).all()

            if timeout_approvals:
                print(f"审批超时检查发现 {len(timeout_approvals)} 个超时审批")

                for approval in timeout_approvals:
                    notification = {
                        "type": "approval_timeout",
                        "approval_id": approval.id,
                        "user_id": approval.user_id,
                        "user_name": approval.user.name if approval.user else None,
                        "title": approval.title,
                        "description": approval.description,
                        "score_change": approval.score_change,
                        "created_at": approval.created_at.isoformat() if approval.created_at else None,
                        "timeout_hours": timeout_hours,
                        "timestamp": datetime.now().isoformat(),
                    }

                    try:
                        publish_mqtt("phonebox/approval_timeout", notification)
                        print(f"[Approval] 已发送审批超时提醒: approval_id={approval.id}")
                    except Exception as e:
                        print(f"[Approval] 发送审批超时提醒失败: {e}")
            else:
                print("审批超时检查完成，无超时审批")
    except Exception as e:
        print(f"审批超时检查异常: {e}")


def scheduled_notify_check(app):
    try:
        from api.scores.scheduled_notify_routes import process_scheduled_notifications

        with app.app_context():
            process_scheduled_notifications()
    except Exception as e:
        print(f"定时通知检查异常: {e}")


def init_scheduler(app):
    global scheduler
    if scheduler:
        return

    scheduler = BackgroundScheduler()

    scheduler.add_job(scheduled_backup, "cron", hour=2, minute=0)
    scheduler.add_job(lambda: scheduled_heartbeat_check(app), "interval", seconds=30)
    scheduler.add_job(lambda: scheduled_approval_timeout_check(app), "interval", minutes=5)
    scheduler.add_job(lambda: scheduled_notify_check(app), "interval", seconds=10)

    scheduler.start()
    # 设为守护线程：测试等场景下即使未显式 shutdown，也不会阻塞进程退出。
    try:
        scheduler._thread.daemon = True
    except Exception:  # noqa: BLE001
        pass

    print("定时备份任务已启动，每天凌晨2:00执行")
    print("心跳超时检查任务已启动，每30秒执行一次")
    print("审批超时检查任务已启动，每5分钟执行一次")
    print("定时通知检查任务已启动，每10秒执行一次")


def shutdown_scheduler():
    if scheduler:
        scheduler.shutdown()
        print("定时任务调度器已关闭")
