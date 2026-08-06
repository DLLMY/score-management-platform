from models import db, Admin, MQTTConfig
from utils.security import hash_password
from config import config
import os


import secrets
import sqlite3


def init_database(app):
    db.init_app(app)

    with app.app_context():
        db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        print(f"数据库URI: {db_uri}")

        if db_uri.startswith("sqlite:///"):
            db_path = db_uri.replace("sqlite:///", "")
            print(f"数据库路径: {db_path}")
            print(f"路径存在: {os.path.exists(db_path)}")
            print(f"是文件: {os.path.isfile(db_path)}")

            try:
                test_conn = sqlite3.connect(db_path)
                print("SQLite直接连接成功")
                test_conn.close()
            except Exception as e:
                print(f"SQLite直接连接失败: {e}")

        db.create_all()
        print("数据库表创建完成")

        try:
            existing_admin = Admin.query.first()
            if not existing_admin:
                print("初始化默认管理员...")
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
                print("默认管理员创建成功!")
                print(f"⚠️  临时密码: {default_password}")
                print("⚠️  请尽快修改并设置 ADMIN_INIT_PASSWORD 环境变量")
        except Exception as e:
            print(f"初始化管理员失败: {e}")

        try:
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

    return db
