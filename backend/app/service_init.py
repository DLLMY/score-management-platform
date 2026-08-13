import time
import threading
import traceback
from apscheduler.schedulers.background import BackgroundScheduler

# 记录由 init_scheduler 启动的调度器实例，供测试 teardown（pytest_unconfigure）
# 统一关闭，避免非守护线程挂起 pytest 进程。
_ACTIVE_SCHEDULERS = []


def init_services(app, lightweight=False):
    if not lightweight:
        init_di_container(app)
        init_config_watcher(app)
        init_mqtt(app)
        init_scheduler(app)
        init_cache_warmup(app)
        init_nlp_service(app)
        init_websocket(app)


def init_di_container(app):
    from di import init_container

    container = init_container(app)
    print("依赖注入容器初始化完成")
    return container


def init_config_watcher(app):
    from config.config_loader import config_loader

    config_loader.start_config_watcher(interval=30)
    print("配置热更新监控线程已启动")


def init_mqtt(app):

    def start_mqtt():
        try:
            time.sleep(3)
            with app.app_context():
                from models import MQTTConfig

                mqtt_config = MQTTConfig.query.first()
                if not mqtt_config:
                    print("MQTT配置未找到，跳过MQTT连接", flush=True)
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
                        print(f"处理MQTT消息失败: {e}")

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
                print(f"后台线程：默认MQTT管理器已设置: {chosen}, connected={mqtt_service.mqtt_manager.is_connected}", flush=True)

        except Exception as e:
            print(f"MQTT启动失败: {e}", flush=True)

            traceback.print_exc()

    mqtt_init_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_init_thread.start()


def init_scheduler(app):

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

    def scheduled_heartbeat_check():
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

    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_backup, "cron", hour=2, minute=0)
    scheduler.add_job(scheduled_heartbeat_check, "interval", seconds=30)
    scheduler.start()
    # 设为守护线程：测试等场景下即使未显式 shutdown，也不会因非守护线程阻塞
    # pytest 进程退出（此前表现为“用例跑完后卡死”）。生产环境主进程常驻，不受影响。
    try:
        scheduler._thread.daemon = True
    except Exception:  # noqa: BLE001
        pass
    app.scheduler = scheduler
    _ACTIVE_SCHEDULERS.append(scheduler)
    print("定时备份任务已启动，每天凌晨2:00执行")
    print("心跳超时检查任务已启动，每30秒执行一次")


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
            print(f"缓存预热失败: {e}")

    cache_warmup_thread = threading.Thread(target=warmup, daemon=True)
    cache_warmup_thread.start()
    print("缓存预热线程已启动")


def init_nlp_service(app):
    try:
        from services.nlp_service import get_nlp_service

        nlp_service = get_nlp_service()
        nlp_service.initialize(flask_app=app)
        nlp_service.warmup()
        app.nlp_service = nlp_service
        print("NLP服务初始化完成")
    except Exception as e:
        print(f"NLP服务初始化失败: {e}")


def init_websocket(app):
    try:
        from flask_socketio import SocketIO
        from services.websocket_service import register_handlers

        socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
        register_handlers(socketio)
        app.socketio = socketio
        print("WebSocket服务初始化完成")
    except Exception as e:
        print(f"WebSocket服务初始化失败: {e}")
