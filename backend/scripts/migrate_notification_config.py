"""幂等迁移：为通知配置创建持久化表 notification_config。

背景：通知配置原写入 current_app.config（内存），重启丢失。本迁移创建单行配置表
（id=1），配合 services.notification_config_store 在启动时回灌、写入时落库。

实现方式：在 app context 中调用 db.create_all()（对已存在表幂等，仅创建缺失表）。
可安全重复执行。

用法：
  python scripts/migrate_notification_config.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db
from models.notification_config import NotificationConfig


def main():
    with app.app_context():
        db.create_all()
        inspector = db.inspect(db.engine)
        exists = inspector.has_table(NotificationConfig.__tablename__)
        print(f"notification_config 表存在: {exists}")
        if not exists:
            print("迁移失败：表未创建")
            sys.exit(1)
        # 预置单行（id=1），保证启动加载逻辑可命中
        row = NotificationConfig.query.get(1)
        if row is None:
            db.session.add(NotificationConfig(id=1))
            db.session.commit()
            print("已预置通知配置占位行(id=1)")
        else:
            print("通知配置占位行已存在")
        print("迁移完成")


if __name__ == "__main__":
    main()
