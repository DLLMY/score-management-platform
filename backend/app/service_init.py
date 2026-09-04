import time
import threading
from apscheduler.schedulers.background import BackgroundScheduler

from utils.logger import log_error, log_info, log_warning

# 记录由 init_scheduler 启动的调度器实例，供测试 teardown（pytest_unconfigure）
# 统一关闭，避免非守护线程挂起 pytest 进程。
_ACTIVE_SCHEDULERS = []


def init_services(app, lightweight=False):
    if not lightweight:
        init_redis_cache(app)
        init_di_container(app)
        init_config_watcher(app)
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

        inspector = db.inspect(db.engine)
        core_indexes = {
            "user": ["ix_user_card_id_is_active", "ix_user_created_at"],
            "score_record": ["ix_score_record_created_desc", "ix_score_record_user_created"],
            "score": ["ix_score_exam_student"],
            "operation_log": ["ix_log_created_desc", "ix_log_operation_type"],
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
            except Exception:
                existing = set()
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
                if not mqtt_config:
                    log_info("MQTT配置未找到，跳过MQTT连接")
                    return

                tcp_mqtt_config = {
                    "broker": mqtt_config.broker,
                    "port": 8883,
                    "client_id": mqtt_config.client_id + "_tcp",
                    "username": mqtt_config.username,
                    "password": mqtt_config.password,
                    "ssl": True,
                    "timeout": min(5, mqtt_config.timeout),
                    "keepalive": mqtt_config.keepalive,
                    "transport": "tcp",
                }

                ws_mqtt_config = {
                    "broker": mqtt_config.broker,
                    "port": 8084,
                    "client_id": mqtt_config.client_id + "_ws",
                    "username": mqtt_config.username,
                    "password": mqtt_config.password,
                    "ssl": True,
                    "timeout": mqtt_config.timeout,
                    "keepalive": mqtt_config.keepalive,
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
                            from services.mqtt_message_service import mqtt_message_service

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
                log_info(
                    f"后台线程：默认MQTT管理器已设置: {chosen}, "
                    f"connected={mqtt_service.mqtt_manager.is_connected}"
                )

        except Exception as e:
            # exception=e 会一并记录堆栈，替代原 traceback.print_exc() 直出
            log_error(f"MQTT启动失败: {e}", exception=e)

    mqtt_init_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_init_thread.start()


def init_scheduler(app):

    def scheduled_backup():
        try:
            from utils.backup_utils import backup_manager

            result = backup_manager.create_backup("full")  # noqa: F841
            if result["success"]:
                log_info(f"数据库定时备份成功: {result['filename']}")
                backup_manager.clean_old_backups()
            else:
                log_error(f"数据库定时备份失败: {result['message']}")
        except Exception as e:
            log_error(f"数据库定时备份异常: {e}", exception=e)

    def scheduled_cleanup_backups():
        """独立备份保留策略清理（不依赖备份创建是否成功，防止磁盘膨胀）"""
        try:
            from utils.backup_utils import backup_manager
            from config import Config

            result = backup_manager.clean_old_backups(max_count=Config.BACKUP_MAX_COUNT)
            if result["deleted_count"] > 0:
                log_info(f"备份保留策略清理: 删除 {result['deleted_count']} 个旧备份")
        except Exception as e:
            log_error(f"备份保留策略清理异常: {e}", exception=e)

    def scheduled_heartbeat_check():
        try:
            from services.heartbeat_service import check_heartbeat_timeout

            with app.app_context():
                result = check_heartbeat_timeout()  # noqa: F841
                if result and result.get("total_timeout", 0) > 0:
                    log_warning(f"心跳超时检查发现 {result['total_timeout']} 台设备离线")
                else:
                    log_info("心跳超时检查完成，所有设备正常")
        except Exception as e:
            log_error(f"心跳超时检查异常: {e}", exception=e)

    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_backup, "cron", hour=2, minute=0)
    # 备份保留策略独立于备份创建：每天 3:00 无条件清理过期/超量备份
    scheduler.add_job(scheduled_cleanup_backups, "cron", hour=3, minute=0)
    scheduler.add_job(scheduled_heartbeat_check, "interval", seconds=30)

    # 补接审批超时提醒 + 定时通知任务（此前 tasks/scheduler.py 的 init_scheduler 从未被
    # 加载 → 用户配置的定时通知/审批超时提醒功能实际从不自动执行，仅手动 trigger 可用）。
    # 复用 tasks/scheduler 已有实现（已带 app_context + try/except），仅注册两个新任务，
    # 不引入其备份/心跳（避免与上面重复执行）。
    try:
        from tasks.scheduler import scheduled_approval_timeout_check, scheduled_notify_check

        scheduler.add_job(lambda: scheduled_approval_timeout_check(app), "interval", minutes=5)
        scheduler.add_job(lambda: scheduled_notify_check(app), "interval", seconds=10)
        log_info("审批超时检查任务已启动，每5分钟执行一次")
        log_info("定时通知检查任务已启动，每10秒执行一次")
    except Exception as e:  # noqa: BLE001
        log_error(f"审批超时/定时通知任务注册失败（不影响其他定时任务）: {e}", exception=e)

    scheduler.start()
    # 设为守护线程：测试等场景下即使未显式 shutdown，也不会因非守护线程阻塞
    # pytest 进程退出（此前表现为“用例跑完后卡死”）。生产环境主进程常驻，不受影响。
    try:
        scheduler._thread.daemon = True
    except Exception:  # noqa: BLE001
        pass
    app.scheduler = scheduler
    _ACTIVE_SCHEDULERS.append(scheduler)
    log_info("定时备份任务已启动，每天凌晨2:00执行")
    log_info("心跳超时检查任务已启动，每30秒执行一次")


def shutdown_all_schedulers():
    """关闭所有由 init_scheduler 启动的调度器（供测试 teardown 调用，避免残留线程挂起进程）。"""
    for sched in list(_ACTIVE_SCHEDULERS):
        try:
            sched.shutdown(wait=False)
        except Exception:  # noqa: BLE001
            pass
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
