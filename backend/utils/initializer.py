import time
from sqlalchemy import text
from models import db, Admin, MQTTConfig
from utils.security import hash_password


def create_database_indexes(app):
    with app.app_context():
        conn = db.engine.connect()
        inspector = db.inspect(db.engine)

        indexes_to_create = {
            "user": [
                ("ix_user_card_id_is_active", ["card_id", "is_active"]),
                ("ix_user_class_name_is_active", ["class_name", "is_active"]),
                ("ix_user_current_score_desc", ["current_score"]),
            ],
            "score_record": [
                ("ix_score_record_user_created", ["user_id", "created_at"]),
                ("ix_score_record_rule_created", ["rule_id", "created_at"]),
                ("ix_score_record_created_desc", ["created_at"]),
            ],
            "device": [
                ("ix_device_status_class", ["status", "class_info_id"]),
                ("ix_device_last_heartbeat", ["last_heartbeat"]),
            ],
            "operation_log": [
                ("ix_log_operation_type", ["operation_type"]),
                ("ix_log_created_desc", ["created_at"]),
                ("ix_log_operator", ["operator"]),
            ],
            "notification": [
                ("ix_notification_user_status", ["user_id", "status"]),
            ],
            "approval": [
                ("ix_approval_status_type", ["status", "type"]),
            ],
            "alert": [
                ("ix_alert_severity_read", ["severity", "is_read"]),
                ("ix_alert_device_read", ["device_id", "is_read"]),
            ],
        }

        created_count = 0
        for table_name, indexes in indexes_to_create.items():
            existing_indexes = inspector.get_indexes(table_name)
            existing_index_names = {idx["name"] for idx in existing_indexes}

            for index_name, columns in indexes:
                if index_name in existing_index_names:
                    continue

                try:
                    columns_str = ", ".join(columns)
                    sql = f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns_str})"
                    conn.execute(db.text(sql))
                    conn.commit()
                    created_count += 1
                    print(f"[OK] 创建索引: {table_name}.{index_name}")
                except Exception as e:
                    print(f"[ERR] 创建索引失败 {table_name}.{index_name}: {e}")

        conn.close()
        print(f"索引创建完成，共创建 {created_count} 个新索引")


def init_default_admin(app):
    try:
        with app.app_context():
            existing_admin = Admin.query.first()
            if not existing_admin:
                print("初始化默认管理员...")
                default_admin = Admin(
                    username="admin",
                    password=hash_password("123456"),
                    role="admin",
                    real_name="系统管理员",
                    phone="13800138000",
                    force_password_change=True,
                )
                db.session.add(default_admin)
                db.session.commit()
                print("默认管理员创建成功! 首次登录需修改密码")
    except Exception as e:
        print(f"初始化管理员失败: {e}")


def init_mqtt_config(app, config):
    try:
        with app.app_context():
            mqtt_config = MQTTConfig.query.first()
            if not mqtt_config:
                print("初始化MQTT配置...")
                mqtt_config = MQTTConfig(
                    broker=config.MQTT_BROKER,
                    port=config.MQTT_PORT,
                    client_id=config.MQTT_CLIENT_ID,
                    username=config.MQTT_USERNAME,
                    password=config.MQTT_PASSWORD,
                    ssl=config.MQTT_SSL,
                    timeout=config.MQTT_TIMEOUT,
                    keepalive=config.MQTT_KEEPALIVE,
                )
                db.session.add(mqtt_config)
                db.session.commit()
                print(f"MQTT配置已初始化: broker={mqtt_config.broker}")
    except Exception as e:
        print(f"初始化MQTT配置失败: {e}")


def init_rbac_data(app):
    try:
        with app.app_context():
            from api.users.rbac_routes import init_default_permissions, init_default_roles

            print("初始化RBAC默认数据...")
            init_default_permissions()
            init_default_roles()
            print("RBAC默认数据初始化完成")
    except Exception as e:
        print(f"初始化RBAC数据失败: {e}")


def init_database(app, config):
    with app.app_context():
        try:
            db.create_all()
            print("数据库表创建完成")
        except Exception as e:
            if "table already exists" in str(e):
                print("数据库表已存在，跳过创建")
            else:
                print(f"数据库初始化警告: {e}")

        print("创建数据库索引...")
        create_database_indexes(app)

        init_default_admin(app)
        init_mqtt_config(app, config)
        init_rbac_data(app)


def setup_sqlite_optimizations(app):
    with app.app_context():
        from config import config

        engine = db.engine

        if "sqlite" in str(engine.url):
            try:
                with engine.connect() as conn:
                    conn.execute(text("PRAGMA journal_mode=WAL"))
                    conn.execute(text("PRAGMA synchronous=NORMAL"))
                    conn.execute(text(f'PRAGMA cache_size={config.SQLITE_CONFIG["cache_size"]}'))
                    conn.execute(text("PRAGMA temp_store=MEMORY"))
                    conn.execute(text(f'PRAGMA mmap_size={config.SQLITE_CONFIG["mmap_size"]}'))
                    conn.execute(text(f'PRAGMA busy_timeout={config.SQLITE_CONFIG["busy_timeout"]}'))
                    conn.execute(text("PRAGMA locking_mode=NORMAL"))
                    conn.execute(text("PRAGMA foreign_keys=ON"))
                    conn.execute(text("PRAGMA auto_vacuum=INCREMENTAL"))
                    conn.execute(text("PRAGMA secure_delete=OFF"))
                    conn.commit()
                print("[OK] SQLite性能优化已应用")
            except Exception as e:
                print(f"[WARN] SQLite优化应用失败: {e}")


def wait_for_db_ready(app, timeout=30):

    print("等待数据库初始化完成...", flush=True)
    start_time = time.time()

    with app.app_context():
        while time.time() - start_time < timeout:
            try:

                db.session.execute(text("SELECT 1"))
                print("数据库初始化完成", flush=True)
                return True
            except Exception:
                print(f"数据库未就绪，等待中... ({int(time.time() - start_time)}s)", flush=True)
                time.sleep(0.5)

    print(f"数据库初始化超时({timeout}s)，系统可能无法正常工作", flush=True)
    return False
