from celery_app import celery_app
from datetime import datetime, timedelta
from config.config_loader import config_loader
from utils.db_session import db_session_scope
from services.redis_cache_service import get_cache_service


from models import db
from redis import Redis


@celery_app.task(name="tasks.scheduled_tasks.clean_expired_results")
def clean_expired_results():
    """
    清理过期的任务结果
    """
    print(f"[Scheduled Task] 清理过期任务结果 - {datetime.now()}")
    try:
        from redis import Redis

        redis_config = config_loader.get_redis_config()
        redis_client = Redis(
            host=redis_config.get("host", "localhost"),
            port=redis_config.get("port", 6379),
            db=redis_config.get("db", 0),
            password=redis_config.get("password"),
            protocol=2,
        )
        # 清理过期的Celery任务结果（超过24小时的）
        # Celery结果存储在 celery-task-meta-* 键中
        datetime.now() - timedelta(hours=24)
        # 扫描并删除过期键
        keys = redis_client.keys("celery-task-meta-*")
        deleted_count = 0
        for key in keys:
            # 检查键的创建时间
            ttl = redis_client.ttl(key)
            if ttl == -1:  # 无过期时间的键
                redis_client.delete(key)
                deleted_count += 1
        print(f"[Scheduled Task] 清理了 {deleted_count} 个过期任务结果")
        return {"success": True, "deleted_count": deleted_count}
    except Exception as e:
        print(f"[Scheduled Task] 清理失败: {e}")
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.sync_device_status")
def sync_device_status():
    """
    同步设备状态
    """
    print(f"[Scheduled Task] 同步设备状态 - {datetime.now()}")
    try:
        from app import app as flask_app
        from models import Device

        with flask_app.app_context():
            # 检查离线设备（超过5分钟无心跳）
            offline_threshold = datetime.now() - timedelta(minutes=5)
            offline_devices = Device.query.filter(
                Device.status == "online", Device.last_heartbeat < offline_threshold
            ).all()
            # 更新为离线状态
            for device in offline_devices:
                device.status = "offline"
            with db_session_scope():
                pass
            print(f"[Scheduled Task] 更新了 {len(offline_devices)} 个设备为离线状态")
            return {"success": True, "offline_count": len(offline_devices)}
    except Exception as e:
        print(f"[Scheduled Task] 同步失败: {e}")
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.daily_summary")
def daily_summary():
    """
    每日汇总任务
    """
    print(f"[Scheduled Task] 每日汇总 - {datetime.now()}")
    try:
        from models import ScoreRecord

        yesterday = datetime.now() - timedelta(days=1)
        yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        # 统计昨日的积分变化
        records = ScoreRecord.query.filter(
            ScoreRecord.created_at >= yesterday_start, ScoreRecord.created_at <= yesterday_end
        ).all()
        total_add = sum(r.score_change for r in records if r.score_change > 0)
        total_subtract = abs(sum(r.score_change for r in records if r.score_change < 0))
        total_count = len(records)
        # 统计活跃用户数
        active_users = set(r.user_id for r in records)
        summary_data = {
            "date": yesterday.strftime("%Y-%m-%d"),
            "total_records": total_count,
            "total_add": total_add,
            "total_subtract": total_subtract,
            "net_change": total_add - total_subtract,
            "active_users": len(active_users),
            "generated_at": datetime.now().isoformat(),
        }
        # 存储到缓存中
        from services.redis_cache_service import get_cache_service

        cache = get_cache_service()
        if cache:
            cache.set_stats(f'daily:{yesterday.strftime("%Y-%m-%d")}', summary_data)
        print(f"[Scheduled Task] 每日汇总完成: {summary_data}")
        return {"success": True, "summary": summary_data}
    except Exception as e:
        print(f"[Scheduled Task] 每日汇总失败: {e}")
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.health_check")
def health_check():
    """
    系统健康检查
    """
    print(f"[Scheduled Task] 健康检查 - {datetime.now()}")
    health_status = {"timestamp": datetime.now().isoformat(), "services": {}}
    # 检查数据库连接
    try:
        db.session.execute(db.text("SELECT 1"))
        health_status["services"]["database"] = {"status": "healthy"}
    except Exception as e:
        health_status["services"]["database"] = {"status": "unhealthy", "error": str(e)}
    # 检查Redis连接
    try:
        redis_config = config_loader.get_redis_config()
        redis_client = Redis(
            host=redis_config.get("host", "localhost"),
            port=redis_config.get("port", 6379),
            db=redis_config.get("db", 0),
            password=redis_config.get("password"),
            socket_timeout=2,
            protocol=2,
        )
        redis_client.ping()
        health_status["services"]["redis"] = {"status": "healthy"}
    except Exception as e:
        health_status["services"]["redis"] = {"status": "unhealthy", "error": str(e)}
    # 检查MQTT连接（如果可用）
    try:
        from app import mqtt_manager

        if mqtt_manager and mqtt_manager.is_connected:
            health_status["services"]["mqtt"] = {"status": "healthy"}
        else:
            health_status["services"]["mqtt"] = {"status": "unhealthy", "error": "Not connected"}
    except Exception as e:
        health_status["services"]["mqtt"] = {"status": "unknown", "error": str(e)}
    # 存储健康状态到缓存
    cache = get_cache_service()
    if cache:
        cache.set_stats("health_check", health_status)
    print(f"[Scheduled Task] 健康检查完成: {health_status}")
    return {"success": True, "health_status": health_status}


@celery_app.task(name="tasks.scheduled_tasks.clean_api_cache")
def clean_api_cache():
    """
    清理API缓存
    """
    print(f"[Scheduled Task] 清理API缓存 - {datetime.now()}")
    try:
        cache = get_cache_service()
        if cache:
            # 清理过期的API缓存键
            # 注意：Redis会自动清理过期键，这里主要是清理可能残留的键
            cache.flush("api:*")
        return {"success": True}
    except Exception as e:
        print(f"[Scheduled Task] 清理API缓存失败: {e}")
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.warmup_cache_task")
def warmup_cache_task():
    """
    缓存预热任务
    """
    print(f"[Scheduled Task] 缓存预热 - {datetime.now()}")
    try:
        from services.redis_cache_service import warmup_cache

        warmup_cache()
        return {"success": True}
    except Exception as e:
        print(f"[Scheduled Task] 缓存预热失败: {e}")
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.archive_operation_logs")
def archive_operation_logs(days_to_keep: int = 90):
    """
    归档操作日志
    将指定天数之前的操作日志迁移到归档表，然后删除原表中的旧记录。
    Args:
        days_to_keep: 保留在主表中的天数（默认90天）
    """
    print(f"[Scheduled Task] 归档操作日志 - {datetime.now()}")
    try:
        from models import OperationLog, OperationLogArchive

        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        # 查询需要归档的日志
        old_logs = OperationLog.query.filter(OperationLog.created_at < cutoff_date).all()
        if not old_logs:
            print("[Scheduled Task] 没有需要归档的日志")
            return {"success": True, "archived_count": 0, "deleted_count": 0}
        # 批量插入归档表
        archives = []
        for log in old_logs:
            archives.append(
                OperationLogArchive(
                    operation_type=log.operation_type,
                    target_type=log.target_type,
                    target_id=log.target_id,
                    operator=log.operator,
                    description=log.description,
                    before_data=log.before_data,
                    after_data=log.after_data,
                    ip_address=log.ip_address,
                    created_at=log.created_at,
                )
            )
        db.session.add_all(archives)
        # 删除原表中的旧记录
        OperationLog.query.filter(OperationLog.created_at < cutoff_date).delete()
        db.session.commit()
        print(f"[Scheduled Task] 归档完成: 迁移 {len(archives)} 条日志")
        return {"success": True, "archived_count": len(archives), "deleted_count": len(archives)}
    except Exception as e:
        print(f"[Scheduled Task] 归档失败: {e}")
        db.session.rollback()
        return {"success": False, "error": str(e)}
