""" """

"""
设备管理模块索引迁移脚本
为DeviceHeartbeat.device_id添加索引
"""
"""
"""

from app import app, db
from sqlalchemy import text


def add_indexes():
    with app.app_context():
        try:
            db.session.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_device_heartbeat_device_id
                ON device_heartbeat(device_id)
            """))
            db.session.commit()
            print("✓ 索引 idx_device_heartbeat_device_id 创建成功")
        except Exception as e:
            print(f"✗ 创建索引失败: {e}")


def run_migration():
    """供 migrations.runner 编排调用（等价于原 __main__ 行为）。"""
    add_indexes()


if __name__ == "__main__":
    run_migration()
