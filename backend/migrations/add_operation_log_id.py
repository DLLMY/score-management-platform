# -*- coding: utf-8 -*-
from app import app
from models import db

"""
"""
"""
为score_record表添加operation_log_id字段的迁移脚本
"""
"""
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_migration():
    with app.app_context():
        from sqlalchemy import text

        # 添加operation_log_id字段
        try:
            db.session.execute(text("ALTER TABLE score_record ADD COLUMN operation_log_id INTEGER"))
            db.session.commit()
            print("成功添加 operation_log_id 字段")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("operation_log_id 字段已存在，跳过")
            else:
                raise

        # 添加索引
        try:
            db.session.execute(text("CREATE INDEX idx_score_record_operation_log ON score_record(operation_log_id)"))
            db.session.commit()
            print("成功添加索引 idx_score_record_operation_log")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("索引 idx_score_record_operation_log 已存在，跳过")
            else:
                raise

        print("迁移完成!")


if __name__ == "__main__":
    run_migration()
