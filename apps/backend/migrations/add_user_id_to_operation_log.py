#!/usr/bin/env python3
""" """

"""
为operation_log表添加user_id字段
"""
"""
"""

import os
import sys

from app import create_app
from models import db

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


app = create_app()

with app.app_context():
    conn = db.engine.connect()

    cursor = conn.execute(db.text("PRAGMA table_info(operation_log)"))
    columns = [row[1] for row in cursor.fetchall()]

    if "user_id" not in columns:
        print("正在为operation_log表添加user_id字段...")
        conn.execute(db.text("ALTER TABLE operation_log ADD COLUMN user_id INTEGER"))
        conn.execute(db.text("CREATE INDEX IF NOT EXISTS idx_operation_log_user_id ON operation_log(user_id)"))
        conn.commit()
        print("user_id字段添加成功")
    else:
        print("user_id字段已存在")

    conn.close()

print("迁移脚本执行完成")
