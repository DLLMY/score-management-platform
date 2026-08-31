# -*- coding: utf-8 -*-
from app import app, db
from models import DeviceGroup, DeviceGroupMapping

"""
设备分组管理数据库迁移脚本
执行: python migrations/add_device_group.py
"""

import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_migration():
    """执行迁移"""
    with app.app_context():
        print("=" * 50)
        print("开始设备分组管理数据库迁移...")
        print("=" * 50)

        # 检查表是否已存在
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()

        # 创建 device_group 表
        if "device_group" not in existing_tables:
            print("\n[1/2] 创建 device_group 表...")
            db.create_all([DeviceGroup])
            print("      device_group 表创建成功!")
        else:
            print("\n[1/2] device_group 表已存在，跳过创建。")

        # 创建 device_group_mapping 表
        if "device_group_mapping" not in existing_tables:
            print("\n[2/2] 创建 device_group_mapping 表...")
            db.create_all([DeviceGroupMapping])
            print("      device_group_mapping 表创建成功!")
        else:
            print("\n[2/2] device_group_mapping 表已存在，跳过创建。")

        # 添加索引
        print("\n[+] 检查索引...")
        indexes = inspector.get_indexes("device_group")
        index_names = [idx["name"] for idx in indexes]

        if "ix_device_group_name" not in index_names:
            db.session.execute(db.text("CREATE INDEX ix_device_group_name ON device_group (name)"))
            print("      添加索引: ix_device_group_name")

        if "ix_device_group_is_active" not in index_names:
            db.session.execute(db.text("CREATE INDEX ix_device_group_is_active ON device_group (is_active)"))
            print("      添加索引: ix_device_group_is_active")

        db.session.commit()

        print("\n" + "=" * 50)
        print("迁移完成!")
        print("=" * 50)

        # 显示表结构
        print("\n[表结构信息]")
        print("\ndevice_group 表:")
        print("  - id (PK)")
        print("  - name (唯一索引)")
        print("  - description")
        print("  - location")
        print("  - icon")
        print("  - color")
        print("  - sort_order")
        print("  - is_active (索引)")
        print("  - created_at")
        print("  - updated_at")

        print("\ndevice_group_mapping 表:")
        print("  - id (PK)")
        print("  - group_id (FK -> device_group.id, 索引)")
        print("  - device_id (FK -> device.id, 索引)")
        print("  - added_by (FK -> admin.id)")
        print("  - added_at")
        print("  - 唯一约束: (group_id, device_id)")


if __name__ == "__main__":
    run_migration()
