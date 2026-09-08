#!/usr/bin/env python3
""" """

"""
数据库迁移脚本 - 算法集成模块
用于创建新增的数据表并初始化默认配置
"""
"""
"""

import os
import sys

# 添加项目路径到PYTHONPATH
from app import app
from models import db, WarningConfig

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def migrate():
    """
    执行数据库迁移
    """
    with app.app_context():
        print("开始执行数据库迁移...")

        # 创建所有表（包括新增的表）
        try:
            db.create_all()
            print("[OK] 所有数据表创建完成")
        except Exception as e:
            if "already exists" in str(e):
                print("[WARN] 数据表已存在，跳过创建")
            else:
                raise e

        # 初始化预警配置（如果不存在）
        initialize_warning_config()

        print("\n[DONE] 数据库迁移完成！")


def initialize_warning_config():
    """
    初始化预警配置
    """
    print("\n检查并初始化预警配置...")

    default_configs = [
        {"config_key": "score_threshold", "config_value": "30", "description": "积分预警阈值，低于此值触发预警"},
        {"config_key": "unlock_daily_limit", "config_value": "5", "description": "每日开锁次数限制"},
        {"config_key": "no_positive_days", "config_value": "7", "description": "连续无正向积分天数阈值"},
        {"config_key": "low_score_threshold", "config_value": "60", "description": "低分预警阈值（成绩）"},
        {"config_key": "risk_score_threshold", "config_value": "0.7", "description": "风险评分阈值"},
    ]

    for config in default_configs:
        existing = WarningConfig.query.filter_by(config_key=config["config_key"]).first()
        if not existing:
            new_config = WarningConfig(
                config_key=config["config_key"], config_value=config["config_value"], description=config["description"]
            )
            db.session.add(new_config)
            print("  [ADD] 初始化配置: %s = %s" % (config["config_key"], config["config_value"]))
        else:
            print("  [SKIP] 配置已存在: %s" % config["config_key"])

    db.session.commit()
    print("[OK] 预警配置初始化完成")


if __name__ == "__main__":
    migrate()
