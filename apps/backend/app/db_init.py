from models import db, Admin, MQTTConfig
from utils.security import hash_password
from utils.logger import log_error, log_info, log_warning
from config import config
import os


import secrets
import sqlite3


def init_database(app):
    db.init_app(app)

    with app.app_context():
        db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        log_info(f"数据库URI: {db_uri}")

        if db_uri.startswith("sqlite:///"):
            db_path = db_uri.replace("sqlite:///", "")
            log_info(
                f"数据库路径: {db_path} | 路径存在: {os.path.exists(db_path)} "
                f"| 是文件: {os.path.isfile(db_path)}"
            )

            try:
                test_conn = sqlite3.connect(db_path)
                log_info("SQLite直接连接成功")
                test_conn.close()
            except Exception as e:
                log_error(f"SQLite直接连接失败: {e}", exception=e)

        db.create_all()
        log_info("数据库表创建完成")

        # M11+: 启动自举核心索引（幂等，已存在跳过）。延迟 import 避免 app 初始化链
        # 循环依赖（scripts.create_indexes 模块级 from app import app）。
        try:
            # site-packages 存在同名 scripts 包，故将 backend/scripts 显式加入 sys.path 后
            # 直接 import create_indexes（其模块已解耦 app 实例依赖，engine 由上方 init_app 绑定）
            import sys as _sys
            import os as _os

            _scripts_dir = _os.path.join(
                _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "scripts"
            )
            if _scripts_dir not in _sys.path:
                _sys.path.insert(0, _scripts_dir)
            from create_indexes import create_indexes as _ensure_indexes

            _ensure_indexes()
            log_info("核心索引自举完成")
        except Exception as e:
            log_error(
                f"核心索引自举失败（可稍后运行 python scripts/create_indexes.py --create）: {e}",
                exception=e,
            )

        try:
            existing_admin = Admin.query.first()
            if not existing_admin:
                log_info("初始化默认管理员...")
                default_password = os.getenv("ADMIN_INIT_PASSWORD", secrets.token_hex(16))
                default_admin = Admin(
                    username="admin",
                    password=hash_password(default_password),
                    role="admin",
                    real_name="系统管理员",
                    phone="13800138000",
                )
                db.session.add(default_admin)
                db.session.commit()
                log_warning(
                    f"默认管理员已创建，临时密码: {default_password}；"
                    "请尽快修改并设置 ADMIN_INIT_PASSWORD 环境变量"
                )
        except Exception as e:
            log_error(f"初始化管理员失败: {e}", exception=e)

        try:
            mqtt_config = MQTTConfig.query.first()
            if not mqtt_config:
                log_info("初始化MQTT配置...")
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
                log_info(f"MQTT配置已初始化: broker={mqtt_config.broker}")
        except Exception as e:
            log_error(f"初始化MQTT配置失败: {e}", exception=e)

    return db
