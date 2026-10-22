from datetime import datetime, timedelta

from redis import Redis

from celery_app import celery_app
from config.config_loader import config_loader
from models import db
from services.redis_cache_service import get_cache_service
from utils.db_session import db_session_scope
from utils.logger import log_info, log_warning


def _resolve_flask_app():
    """解析任务执行所需的 Flask 应用。

    celery worker 无 Flask app_context（celery_app.py 未设 ContextTask 基座，
    2026-10-21 探针实证：daily_summary / health_check / archive_operation_logs
    在 worker 下恒崩/恒败）→ 无环境上下文时取 app 包单例（create_app 写入的
    sys.modules["app"].app）；测试/同步调用链已有环境上下文时沿用环境 app，
    防止误连真实库（测试会话内 `from app import app` 解析到
    instance/score_management.db，已实证）。
    """
    from flask import current_app, has_app_context

    if has_app_context():
        return current_app._get_current_object()
    from app import app as flask_app

    return flask_app


@celery_app.task(name="tasks.scheduled_tasks.clean_expired_results")
def clean_expired_results():
    """
    清理过期的任务结果
    """
    log_info(f"[Scheduled Task] 清理过期任务结果 - {datetime.now()}")
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
        # 扫描并删除过期键
        keys = redis_client.keys("celery-task-meta-*")
        deleted_count = 0
        for key in keys:
            # 检查键的创建时间
            ttl = redis_client.ttl(key)
            if ttl == -1:  # 无过期时间的键
                redis_client.delete(key)
                deleted_count += 1
        log_info(f"[Scheduled Task] 清理了 {deleted_count} 个过期任务结果")
        return {"success": True, "deleted_count": deleted_count}
    except Exception as e:
        log_warning(f"[Scheduled Task] 清理失败: {e}", exception=e)
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.sync_device_status")
def sync_device_status():
    """
    同步设备状态
    """
    log_info(f"[Scheduled Task] 同步设备状态 - {datetime.now()}")
    try:
        from models import Device

        # 2026-10-22 统一：与同文件其他任务一致走 _resolve_flask_app()
        # （原 from app import app 在测试会话内会解析到真实库单例）
        with _resolve_flask_app().app_context():
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
            log_info(f"[Scheduled Task] 更新了 {len(offline_devices)} 个设备为离线状态")
            return {"success": True, "offline_count": len(offline_devices)}
    except Exception as e:
        log_warning(f"[Scheduled Task] 同步失败: {e}", exception=e)
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.daily_summary")
def daily_summary():
    """
    每日汇总任务
    """
    log_info(f"[Scheduled Task] 每日汇总 - {datetime.now()}")
    try:
        from sqlalchemy import case, func

        from models import ScoreRecord

        yesterday = datetime.now() - timedelta(days=1)
        yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        # 2026-10-21 修复：补 app_context（worker 下 ScoreRecord.query 恒抛
        # RuntimeError，汇总从未成功）。
        with _resolve_flask_app().app_context():
            # 条件聚合（R26 模式）：单条 SQL 完成 COUNT / 正负 SUM / distinct 活跃用户，
            # 替代 `.all()` 全量取行 + Python 求和（N 条记录 → N 个 ORM 实例）。
            # coalesce(student_id, 0) 令 NULL 学号计为 1 个活跃成员，与旧实现
            # `{r.student_id for r in records}`（None 亦为集合成员）语义严格一致。
            row = (
                db.session.query(
                    func.count(ScoreRecord.id).label("total_count"),
                    func.coalesce(
                        func.sum(
                            case(
                                (ScoreRecord.score_change > 0, ScoreRecord.score_change),
                                else_=0.0,
                            )
                        ),
                        0.0,
                    ).label("total_add"),
                    func.coalesce(
                        func.sum(
                            case(
                                (ScoreRecord.score_change < 0, -ScoreRecord.score_change),
                                else_=0.0,
                            )
                        ),
                        0.0,
                    ).label("total_subtract"),
                    func.count(func.distinct(func.coalesce(ScoreRecord.student_id, 0))).label(
                        "active_users"
                    ),
                )
                .filter(
                    ScoreRecord.created_at >= yesterday_start,
                    ScoreRecord.created_at <= yesterday_end,
                )
                .one()
            )
            total_count = row.total_count or 0
            total_add = row.total_add or 0.0
            total_subtract = row.total_subtract or 0.0
            active_users = row.active_users or 0
            summary_data = {
                "date": yesterday.strftime("%Y-%m-%d"),
                "total_records": total_count,
                "total_add": total_add,
                "total_subtract": total_subtract,
                "net_change": total_add - total_subtract,
                "active_users": active_users,
                "generated_at": datetime.now().isoformat(),
            }
            # 存储到缓存中
            # 2026-10-21 修复：RedisCache 无 set_stats 方法（worker 下 AttributeError
            # 恒败，汇总从未落缓存）→ 改用 set()；key 保持 `daily:{date}` 不变
            # （零契约漂移），7 天过期（昨日汇总无长期查询价值）。
            from services.redis_cache_service import get_cache_service

            cache = get_cache_service()
            if cache:
                cache.set(
                    f'daily:{yesterday.strftime("%Y-%m-%d")}',
                    summary_data,
                    expire=7 * 24 * 3600,
                )
        log_info(f"[Scheduled Task] 每日汇总完成: {summary_data}")
        return {"success": True, "summary": summary_data}
    except Exception as e:
        log_warning(f"[Scheduled Task] 每日汇总失败: {e}", exception=e)
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.health_check")
def health_check():
    """
    系统健康检查
    """
    log_info(f"[Scheduled Task] 健康检查 - {datetime.now()}")
    health_status = {"timestamp": datetime.now().isoformat(), "services": {}}
    # 2026-10-21 修复：整体补 app_context —— 原实现无上下文，worker 下
    # db.session.execute 恒抛 RuntimeError（被内层 try 吞 → 数据库恒报
    # unhealthy），且 set_stats 不存在 → AttributeError 逃逸使任务崩溃。
    with _resolve_flask_app().app_context():
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
            # 2026-10-21 修复：原 `from app import mqtt_manager` 恒 ImportError
            # （app 包无此导出）→ MQTT 检查恒为 unknown；权威管理器为
            # services.mqtt_manager.mqtt_manager（service_init 注释确认的 tcp 单例）。
            from services.mqtt_manager import mqtt_manager

            if mqtt_manager and mqtt_manager.is_connected:
                health_status["services"]["mqtt"] = {"status": "healthy"}
            else:
                health_status["services"]["mqtt"] = {"status": "unhealthy", "error": "Not connected"}
        except Exception as e:
            health_status["services"]["mqtt"] = {"status": "unknown", "error": str(e)}
        # 存储健康状态到缓存
        # 2026-10-21 修复：set_stats 不存在 → set()；key 不变，1 小时过期
        # （与每小时调度同频，过期即由下一次调度刷新）。
        cache = get_cache_service()
        if cache:
            cache.set("health_check", health_status, expire=3600)
    log_info(f"[Scheduled Task] 健康检查完成: {health_status}")
    return {"success": True, "health_status": health_status}


@celery_app.task(name="tasks.scheduled_tasks.clean_api_cache")
def clean_api_cache():
    """
    清理API缓存
    """
    log_info(f"[Scheduled Task] 清理API缓存 - {datetime.now()}")
    try:
        cache = get_cache_service()
        if cache:
            # 清理过期的API缓存键
            # 注意：Redis会自动清理过期键，这里主要是清理可能残留的键
            cache.flush("api:*")
        return {"success": True}
    except Exception as e:
        log_warning(f"[Scheduled Task] 清理API缓存失败: {e}", exception=e)
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.warmup_cache_task")
def warmup_cache_task():
    """
    缓存预热任务
    """
    log_info(f"[Scheduled Task] 缓存预热 - {datetime.now()}")
    try:
        from services.redis_cache_service import warmup_cache

        # 2026-10-21 修复：原 `warmup_cache()` 漏传 app 参数 → TypeError 恒败
        # （每 30 分钟的 beat 预热从未成功）；warmup_cache(app) 内部自包
        # app_context，这里传入解析出的 Flask 应用即可。
        warmup_cache(_resolve_flask_app())
        return {"success": True}
    except Exception as e:
        log_warning(f"[Scheduled Task] 缓存预热失败: {e}", exception=e)
        return {"success": False, "error": str(e)}


@celery_app.task(name="tasks.scheduled_tasks.archive_operation_logs")
def archive_operation_logs(days_to_keep: int = 90):
    """
    归档操作日志
    将指定天数之前的操作日志迁移到归档表，然后删除原表中的旧记录。
    Args:
        days_to_keep: 保留在主表中的天数（默认90天）
    """
    log_info(f"[Scheduled Task] 归档操作日志 - {datetime.now()}")
    # 2026-10-21 修复：补 app_context —— 原实现无上下文，worker 下
    # OperationLog.query 恒抛 RuntimeError，而 except 内 db.session.rollback()
    # 同样依赖上下文 → 二次抛错逃逸，任务崩溃。内层 try 保证回滚发生在
    # 上下文内，再上抛由外层统一记录失败。
    try:
        from models import OperationLog, OperationLogArchive

        with _resolve_flask_app().app_context():
            try:
                cutoff_date = datetime.now() - timedelta(days=days_to_keep)
                # 查询需要归档的日志
                old_logs = OperationLog.query.filter(OperationLog.created_at < cutoff_date).all()
                if not old_logs:
                    log_info("[Scheduled Task] 没有需要归档的日志")
                    return {"success": True, "archived_count": 0, "deleted_count": 0}
                # 批量插入归档表（2026-09-04 修复：OperationLogArchive 表结构为
                # original_id/admin_id/action/details/archived_at，原代码按 OperationLog 字段
                # 构造 → TypeError 恒败，日志从未归档）
                archives = []
                for log in old_logs:
                    archives.append(
                        OperationLogArchive(
                            original_id=log.id,
                            admin_id=log.user_id,
                            action=log.operation_type,
                            details={
                                "target_type": log.target_type,
                                "target_id": log.target_id,
                                "operator": log.operator,
                                "description": log.description,
                                "before_data": log.before_data,
                                "after_data": log.after_data,
                                "ip_address": log.ip_address,
                                "created_at": log.created_at.isoformat() if log.created_at else None,
                            },
                        )
                    )
                db.session.add_all(archives)
                # 仅删除已成功归档的旧记录（按 id 精确匹配，避免与批量 insert 同批 evaluate 冲突）
                log_ids = [log.id for log in old_logs]
                OperationLog.query.filter(OperationLog.id.in_(log_ids)).delete(
                    synchronize_session=False
                )
                db.session.commit()
                log_info(f"[Scheduled Task] 归档完成: 迁移 {len(archives)} 条日志")
                return {
                    "success": True,
                    "archived_count": len(archives),
                    "deleted_count": len(archives),
                }
            except Exception as e:
                db.session.rollback()
                raise
    except Exception as e:
        log_warning(f"[Scheduled Task] 归档失败: {e}", exception=e)
        return {"success": False, "error": str(e)}
