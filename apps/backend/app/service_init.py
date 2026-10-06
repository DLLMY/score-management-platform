import contextlib
import os
import sys
import threading
import time

from apscheduler.schedulers.background import BackgroundScheduler

from utils.logger import log_error, log_info, log_warning

# 是否为 Celery Worker 进程：启动命令固定为 `python -m celery worker -A celery_app ...`，
# argv 中必含 "worker" 与 "celery_app"。Worker 只需 DB/Redis 上下文处理任务，不应再初始化
# MQTT 双连接与 APScheduler（否则会共用后端 client_id 撞车、EMQX 互踢、遥测订阅抖动丢心跳）。
_IS_CELERY_WORKER = "worker" in sys.argv[1:] and "celery_app" in sys.argv

# 记录由 init_scheduler 启动的调度器实例，供测试 teardown（pytest_unconfigure）
# 统一关闭，避免非守护线程挂起 pytest 进程。
_ACTIVE_SCHEDULERS = []


def init_services(app, lightweight=False):
    if not lightweight:
        init_redis_cache(app)
        init_di_container(app)
        init_config_watcher(app)
        # 在 Celery Worker 进程中跳过 MQTT 连接与调度器：
        # worker 仅需 DB/Redis 上下文处理异步任务，自建 MQTT 双连接会与后端共用
        # 同一 client_id 前缀（int(time.time()) 1 秒精度）撞车，导致 EMQX 互踢、
        # 后端遥测订阅反复抖动、QoS0 心跳丢帧，设备永远刷新不到在线状态。
        # 仅当本进程是 celery worker（argv 含 "worker" + "celery_app"）时跳过。
        if not _IS_CELERY_WORKER:
            init_mqtt(app)
            init_scheduler(app)
        init_cache_warmup(app)
        init_nlp_service(app)
        init_websocket(app)
        init_notification_config(app)
        init_system_metric_sampler(app)
        init_index_check(app)


def init_index_check(app):
    """M11: 启动时校验核心索引存在，缺失打印醒目告警（防新环境漏跑索引脚本导致静默全表扫描）。

    清单与 scripts/create_indexes.py::get_all_indexes 同步维护（此处仅抽查最关键的子集，
    完整校验走闸门 scripts/verify_indexes.py）。
    """
    try:
        from models import db

        with app.app_context():
            engine = db.engine
        inspector = db.inspect(engine)
        core_indexes = {
            "user": ["ix_user_card_id_is_active", "ix_user_created_at"],
            "score_record": ["ix_score_record_student_created", "ix_score_record_created_at"],
            "score": ["ix_score_exam_student"],
            "operation_log": ["ix_operation_log_created_at", "ix_log_operation_type"],
            "alert": ["ix_alert_created_desc"],
            "device": ["ix_device_last_heartbeat"],
            "exam": ["ix_exam_start_time"],
            "notification": ["ix_notification_user_status"],
            "approval": ["ix_approval_status_type"],
            "device_heartbeat": ["ix_heartbeat_received_at"],
        }
        missing = []
        for table_name, index_names in core_indexes.items():
            try:
                existing = {idx["name"] for idx in inspector.get_indexes(table_name)}
            except Exception as exc:
                existing = set()
                log_warning("检查索引失败，按无现有索引处理", exception=exc)
            for index_name in index_names:
                if index_name not in existing:
                    missing.append(f"{table_name}.{index_name}")
        if missing:
            log_warning(
                f"[索引告警] 缺失 {len(missing)} 个核心索引（新环境可能漏跑索引脚本）: "
                + ", ".join(missing)
            )
            log_warning("[索引告警] 请运行: python scripts/create_indexes.py --create")
        else:
            log_info("[启动检查] 核心索引 OK")
    except Exception as e:
        log_warning(f"[索引检查] 跳过（{e}）", exception=e)


def init_redis_cache(app):
    """初始化 Redis 缓存连接；若本机未运行 Redis 且开启 REDIS_AUTO_START，则自动拉起。"""
    try:
        from services.redis_cache_service import get_cache_service

        get_cache_service().init_app(app)
        log_info("Redis 缓存服务初始化完成")
    except Exception as e:
        log_error(f"Redis 缓存服务初始化失败(已降级为内存缓存): {e}", exception=e)


def init_di_container(app):
    from di import init_container

    container = init_container(app)
    log_info("依赖注入容器初始化完成")
    return container


def init_config_watcher(app):
    from config.config_loader import config_loader

    config_loader.start_config_watcher(interval=30)
    log_info("配置热更新监控线程已启动")


def init_mqtt(app):

    def start_mqtt():
        try:
            time.sleep(3)
            with app.app_context():
                from models import MQTTConfig

                mqtt_config = MQTTConfig.query.first()
                if mqtt_config:
                    cfg = {
                        "broker": mqtt_config.broker,
                        "client_id": mqtt_config.client_id,
                        "username": mqtt_config.username,
                        "password": mqtt_config.password,
                        "timeout": mqtt_config.timeout,
                        "keepalive": mqtt_config.keepalive,
                    }
                    log_info(
                        f"[MQTT] 使用数据库配置: broker={mqtt_config.broker}, "
                        f"client_id={mqtt_config.client_id}, "
                        f"username={'***' if mqtt_config.username else '(空)'}"
                    )
                else:
                    # 差异：未配置 MQTTConfig 时回退到 MQTTManager.DEFAULT_CONFIG（含正确 broker），
                    # 避免「配置缺失 → 静默跳过 → 永远收不到心跳」的哑故障；凭据缺失会在连接阶段
                    # 以 rc 日志暴露，便于定位。
                    from services.mqtt_manager import MQTTManager

                    _def = MQTTManager().DEFAULT_CONFIG
                    cfg = {
                        k: _def[k]
                        for k in (
                            "broker",
                            "client_id",
                            "username",
                            "password",
                            "timeout",
                            "keepalive",
                        )
                    }
                    log_warning(
                        "[MQTT] 数据库 MQTTConfig 未配置，回退到 MQTTManager.DEFAULT_CONFIG "
                        f"(broker={cfg['broker']})；若 EMQX 需要鉴权，请先在管理端配置 MQTT 凭据"
                    )

                tcp_mqtt_config = {
                    "broker": cfg["broker"],
                    "port": 8883,
                    "client_id": cfg["client_id"] + "_tcp",
                    "username": cfg["username"],
                    "password": cfg["password"],
                    "ssl": True,
                    "timeout": min(5, cfg["timeout"]),
                    "keepalive": cfg["keepalive"],
                    "transport": "tcp",
                }

                ws_mqtt_config = {
                    "broker": cfg["broker"],
                    "port": 8084,
                    "client_id": cfg["client_id"] + "_ws",
                    "username": cfg["username"],
                    "password": cfg["password"],
                    "ssl": True,
                    "timeout": cfg["timeout"],
                    "keepalive": cfg["keepalive"],
                    "transport": "websockets",
                    "ws_path": "/mqtt",
                }

                def on_mqtt_message_received(topic, message):
                    try:
                        with app.app_context():
                            # 注意：handle_mqtt_message 在 services.mqtt_message_service（mqtt_routes 的
                            # register_mqtt_message_handler 注册的也是这个）；api.monitoring.mqtt_routes 里
                            # 不存在同名函数——此前 import 错符号导致每条 query/unlock 消息 ImportError 被吞，
                            # 设备刷卡查询/开锁请求永远得不到响应。
                            from services.mqtt_message_service import (
                                mqtt_message_service,
                            )

                            mqtt_message_service.handle_mqtt_message(None, topic, message)
                    except Exception as e:
                        log_error(f"处理MQTT消息失败: {e}", exception=e)

                from services import mqtt_service

                # 权威管理器即健康检查 / 状态接口读取的 mqtt_service.mqtt_manager（tcp 单例）。
                # 注意：不要重复调用 DI 的 Singleton 工厂拿“第二个”管理器——它会返回同一个
                # 对象并互相覆盖 _instance_name / 传输方式，导致已建立的 TCP 连接被 WebSocket
                # 重连打断，最终 manager 停在断开态。
                manager = mqtt_service.mqtt_manager
                manager.set_app(app)
                manager.add_message_callback(on_mqtt_message_received)

                if manager.connect(tcp_mqtt_config) and manager.is_connected:
                    chosen = "tcp"
                else:
                    # TCP 失败时才用独立实例尝试 WebSocket，避免干扰上面的 tcp 单例
                    from services.mqtt_manager import MQTTManager

                    ws_manager = MQTTManager("websocket_fallback")
                    ws_manager.set_app(app)
                    ws_manager.add_message_callback(on_mqtt_message_received)
                    ws_manager.connect(ws_mqtt_config)
                    mqtt_service.mqtt_manager = ws_manager
                    manager = ws_manager
                    chosen = "websocket"

                app.mqtt_manager = manager
                from services.mqtt_manager import MQTTConnectionState

                # 遥测连接（负责接收 phonebox/# 心跳）必须建立，否则设备永远刷不到在线状态。
                # 旧逻辑只判断 control(is_connected)，遥测失败时会被「已连接」假象掩盖。
                if manager._telemetry_state != MQTTConnectionState.CONNECTED:
                    log_warning(
                        "[MQTT] 控制连接已建立但【遥测连接未建立】，重试一次订阅 phonebox/# ..."
                    )
                    try:
                        manager._connect_telemetry()
                    except Exception as _te:
                        log_error(f"[MQTT] 遥测连接重试失败: {_te}", exception=_te)
                log_info(
                    f"后台线程：默认MQTT管理器已设置: {chosen}, "
                    f"control_connected={manager.is_connected}, "
                    f"telemetry_state={manager._telemetry_state.value}, "
                    f"telemetry_subscribed={manager._telemetry_subscribed_topics}, "
                    f"control_subscribed={manager._subscribed_topics}"
                )
                if manager._telemetry_state != MQTTConnectionState.CONNECTED:
                    log_error(
                        "[MQTT] 遥测连接最终未建立！将无法接收 phonebox/# 心跳，"
                        "设备在线状态不会刷新——请检查 broker/凭据/网络是否可达 EMQX:8883"
                    )

        except Exception as e:
            # exception=e 会一并记录堆栈，替代原 traceback.print_exc() 直出
            log_error(f"MQTT启动失败: {e}", exception=e)

    mqtt_init_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_init_thread.start()


def _scheduled_backup_job():
    try:
        # P1-e: 运行时兜底——即使任务被注册，也在执行前确认开关，避免“默认关闭却静默备份”
        from config import Config

        if not Config.BACKUP_ENABLED:
            return
        from utils.backup_utils import backup_manager

        result = backup_manager.create_backup("full")
        if result["success"]:
            log_info(f"数据库定时备份成功: {result['filename']}")
            backup_manager.clean_old_backups()
        else:
            log_error(f"数据库定时备份失败: {result['message']}")
    except Exception as e:
        log_error(f"数据库定时备份异常: {e}", exception=e)


def _scheduled_cleanup_backups_job():
    """独立备份保留策略清理（不依赖备份创建是否成功，防止磁盘膨胀）"""
    try:
        from config import Config
        from utils.backup_utils import backup_manager

        result = backup_manager.clean_old_backups(max_count=Config.BACKUP_MAX_COUNT)
        if result["deleted_count"] > 0:
            log_info(f"备份保留策略清理: 删除 {result['deleted_count']} 个旧备份")
    except Exception as e:
        log_error(f"备份保留策略清理异常: {e}", exception=e)


def _scheduled_heartbeat_check_job(app):
    try:
        from services.heartbeat_service import check_heartbeat_timeout

        with app.app_context():
            result = check_heartbeat_timeout()
            if result and result.get("total_timeout", 0) > 0:
                log_warning(f"心跳超时检查发现 {result['total_timeout']} 台设备离线")
            else:
                log_info("心跳超时检查完成，所有设备正常")
    except Exception as e:
        log_error(f"心跳超时检查异常: {e}", exception=e)
    finally:
        try:
            from models import db
            db.session.remove()
        except Exception as e:
            log_warning(f"清理 db.session 失败(已忽略): {e}")


def init_scheduler(app):

    def scheduled_backup():
        _scheduled_backup_job()

    def scheduled_cleanup_backups():
        """独立备份保留策略清理（不依赖备份创建是否成功，防止磁盘膨胀）"""
        _scheduled_cleanup_backups_job()

    def scheduled_heartbeat_check():
        _scheduled_heartbeat_check_job(app)

    scheduler = BackgroundScheduler()
    # P1-e: 定时自动备份必须由 BACKUP_ENABLED 门控——默认 false 即不启用自动备份，
    # 解决此前 cron 无条件注册导致“默认关闭却每天静默备份”的语义脱节（flag 形同虚设）。
    from config import Config

    if Config.BACKUP_ENABLED:
        scheduler.add_job(scheduled_backup, "cron", hour=2, minute=0)
        log_info("定时备份任务已启动，每天凌晨2:00执行（BACKUP_ENABLED=true）")
    else:
        log_info(
            "定时自动备份未启用（BACKUP_ENABLED=false）；"
            "如需开启请在 .env 设置 BACKUP_ENABLED=true 后重启服务"
        )
    # 备份保留策略独立于备份创建：每天 3:00 无条件清理过期/超量备份（防御性，防止磁盘膨胀）
    scheduler.add_job(scheduled_cleanup_backups, "cron", hour=3, minute=0)
    scheduler.add_job(scheduled_heartbeat_check, "interval", seconds=30)

    # 补接审批超时提醒 + 定时通知任务（此前 tasks/scheduler.py 的 init_scheduler 从未被
    # 加载 → 用户配置的定时通知/审批超时提醒功能实际从不自动执行，仅手动 trigger 可用）。
    # 复用 tasks/scheduler 已有实现（已带 app_context + try/except），仅注册两个新任务，
    # 不引入其备份/心跳（避免与上面重复执行）。
    try:
        from tasks.scheduler import (
            scheduled_approval_timeout_check,
            scheduled_notify_check,
        )

        scheduler.add_job(lambda: scheduled_approval_timeout_check(app), "interval", minutes=5)
        scheduler.add_job(lambda: scheduled_notify_check(app), "interval", seconds=10)
        # 请假（硬件端）周期过期双保险之一（另一为读时惰性过期，见 leave_service）
        try:
            from tasks.scheduler import scheduled_leave_expiry

            scheduler.add_job(lambda: scheduled_leave_expiry(app), "interval", minutes=1)
            log_info("请假过期检查任务已启动，每1分钟执行一次")
        except Exception as e:
            log_error(f"请假过期任务注册失败（不影响其他定时任务）: {e}", exception=e)
        log_info("审批超时检查任务已启动，每5分钟执行一次")
        log_info("定时通知检查任务已启动，每10秒执行一次")
    except Exception as e:
        log_error(f"审批超时/定时通知任务注册失败（不影响其他定时任务）: {e}", exception=e)

    scheduler.start()
    # 设为守护线程：测试等场景下即使未显式 shutdown，也不会因非守护线程阻塞
    # pytest 进程退出（此前表现为“用例跑完后卡死”）。生产环境主进程常驻，不受影响。
    with contextlib.suppress(Exception):
        scheduler._thread.daemon = True
    app.scheduler = scheduler
    _ACTIVE_SCHEDULERS.append(scheduler)
    log_info("心跳超时检查任务已启动，每30秒执行一次")


def shutdown_all_schedulers():
    """关闭所有由 init_scheduler 启动的调度器（供测试 teardown 调用，避免残留线程挂起进程）。"""
    for sched in _ACTIVE_SCHEDULERS:
        with contextlib.suppress(Exception):
            sched.shutdown(wait=False)
    _ACTIVE_SCHEDULERS.clear()


def init_cache_warmup(app):

    def warmup():
        try:
            from services.redis_cache_service import warmup_cache

            warmup_cache(app)
        except Exception as e:
            log_error(f"缓存预热失败: {e}", exception=e)

    cache_warmup_thread = threading.Thread(target=warmup, daemon=True)
    cache_warmup_thread.start()
    log_info("缓存预热线程已启动")


def init_nlp_service(app):
    try:
        from services.nlp_service import get_nlp_service

        nlp_service = get_nlp_service()
        nlp_service.initialize(flask_app=app)
        # M10: 预热移出启动路径 → 后台 daemon 线程（BERT/jieba 加载不阻塞主进程就绪，
        # 冷启动 55s → <25s；首个请求若早于预热完成会触发懒加载，属可接受的一次性代价）
        nlp_service.async_warmup()
        app.nlp_service = nlp_service

        # M10: 解析器（torch/sklearn/jieba 模块链）预加载也放后台线程，避免重型 import 拖慢启动
        def _preload_parser():
            try:
                from services.nlp_enhanced_service import get_nlp_parser

                get_nlp_parser()
                log_info("NLP 解析器预加载完成")
            except Exception as e:
                log_error(f"NLP 解析器预加载失败(首个请求将懒加载): {e}", exception=e)

        threading.Thread(target=_preload_parser, daemon=True).start()

        log_info("NLP服务初始化完成")
    except Exception as e:
        log_error(f"NLP服务初始化失败: {e}", exception=e)


def init_notification_config(app):
    """启动时从数据库加载通知配置到 current_app.config（持久化通知配置）。"""
    try:
        from services.notification_config_store import load_notification_config_to_app

        load_notification_config_to_app(app)
    except Exception as e:
        log_error(f"通知配置初始化失败(沿用环境默认): {e}", exception=e)


def init_websocket(app):
    try:
        from flask_socketio import SocketIO

        from services.websocket_service import register_handlers

        socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
        register_handlers(socketio)
        app.socketio = socketio
        log_info("WebSocket服务初始化完成")
    except Exception as e:
        log_error(f"WebSocket服务初始化失败: {e}", exception=e)


def init_system_metric_sampler(app):
    try:
        from services.system_metric_service import start_sampler

        start_sampler(app)
        log_info("系统指标采样服务已启动")
    except Exception as e:
        log_error(f"系统指标采样服务启动失败: {e}", exception=e)
