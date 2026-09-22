# -*- coding: utf-8 -*-
"""启动种子数据（生产就绪 P0-d 收口）。

背景
----
原 class_periods 默认节次、warning_configs 默认预警配置等"种子数据"散落在
手写迁移脚本（create_class_periods.py / migrate_algorithm.py）里，部署极易漏跑。
现收口到此处，作为 `reconcile_schema` 之后的第二步，在每次应用启动时幂等补齐。

设计
----
- 幂等：class_periods 仅在表为空时插入默认 12 节次；warning_configs 按 config_key
  去重插入，已有则跳过。
- 与 reconcile_schema 共用 `if not TESTING` 守卫（测试库由 conftest 自行构造，不污染）。
- 失败不阻断启动（已 try/except 包裹并由调用方记录），核心表结构由 reconcile 保证。
"""
from datetime import datetime

# 默认课时节次（与历史 create_class_periods.py 保持一致）
DEFAULT_PERIODS = [
    {"name": "第一节课", "period_number": 1, "start_hour": 8, "start_minute": 0,
     "end_hour": 8, "end_minute": 40, "description": "上午第一节", "sort_order": 1},
    {"name": "第二节课", "period_number": 2, "start_hour": 8, "start_minute": 50,
     "end_hour": 9, "end_minute": 30, "description": "上午第二节", "sort_order": 2},
    {"name": "第三节课", "period_number": 3, "start_hour": 9, "start_minute": 40,
     "end_hour": 10, "end_minute": 20, "description": "上午第三节", "sort_order": 3},
    {"name": "第四节课", "period_number": 4, "start_hour": 10, "start_minute": 30,
     "end_hour": 11, "end_minute": 10, "description": "上午第四节", "sort_order": 4},
    {"name": "第五节课", "period_number": 5, "start_hour": 11, "start_minute": 20,
     "end_hour": 12, "end_minute": 0, "description": "上午第五节", "sort_order": 5},
    {"name": "第六节课", "period_number": 6, "start_hour": 14, "start_minute": 0,
     "end_hour": 14, "end_minute": 40, "description": "下午第一节", "sort_order": 6},
    {"name": "第七节课", "period_number": 7, "start_hour": 14, "start_minute": 50,
     "end_hour": 15, "end_minute": 30, "description": "下午第二节", "sort_order": 7},
    {"name": "第八节课", "period_number": 8, "start_hour": 15, "start_minute": 40,
     "end_hour": 16, "end_minute": 20, "description": "下午第三节", "sort_order": 8},
    {"name": "第九节课", "period_number": 9, "start_hour": 16, "start_minute": 30,
     "end_hour": 17, "end_minute": 10, "description": "下午第四节", "sort_order": 9},
    {"name": "晚自习一", "period_number": 10, "start_hour": 19, "start_minute": 0,
     "end_hour": 19, "end_minute": 40, "description": "晚自习第一节", "sort_order": 10},
    {"name": "晚自习二", "period_number": 11, "start_hour": 19, "start_minute": 50,
     "end_hour": 20, "end_minute": 30, "description": "晚自习第二节", "sort_order": 11},
    {"name": "晚自习三", "period_number": 12, "start_hour": 20, "start_minute": 40,
     "end_hour": 21, "end_minute": 20, "description": "晚自习第三节", "sort_order": 12},
]

# 默认预警配置（与历史 migrate_algorithm.py 保持一致）
DEFAULT_WARNING_CONFIGS = [
    {"config_key": "score_threshold", "config_value": "30", "description": "积分预警阈值，低于此值触发预警"},
    {"config_key": "unlock_daily_limit", "config_value": "5", "description": "每日开锁次数限制"},
    {"config_key": "no_positive_days", "config_value": "7", "description": "连续无正向积分天数阈值"},
    {"config_key": "low_score_threshold", "config_value": "60", "description": "低分预警阈值（成绩）"},
    {"config_key": "risk_score_threshold", "config_value": "0.7", "description": "风险评分阈值"},
]


def seed_defaults(app, logger=None, verbose=True):
    """幂等补齐关键种子数据（class_periods / warning_configs）。返回 (periods, configs) 新增计数。"""
    from models import db

    def log(level, msg):
        if logger:
            logger(level, msg)
        elif verbose:
            print(msg)

    added_periods = added_configs = 0
    try:
        from models import ClassPeriod, WarningConfig

        # 1) 默认课时节次：仅在表为空时插入
        if ClassPeriod.query.count() == 0:
            now = datetime.now()
            for data in DEFAULT_PERIODS:
                db.session.add(ClassPeriod(**data, created_at=now, updated_at=now))
            db.session.commit()
            added_periods = len(DEFAULT_PERIODS)
            log("INFO", "[SEED] 已插入默认课时节次 %d 条" % added_periods)
        else:
            log("INFO", "[SEED] class_periods 已有数据，跳过默认节次插入")

        # 2) 默认预警配置：按 config_key 去重
        for cfg in DEFAULT_WARNING_CONFIGS:
            if not WarningConfig.query.filter_by(config_key=cfg["config_key"]).first():
                db.session.add(WarningConfig(
                    config_key=cfg["config_key"],
                    config_value=cfg["config_value"],
                    description=cfg["description"],
                ))
                added_configs += 1
        if added_configs:
            db.session.commit()
            log("INFO", "[SEED] 已插入默认预警配置 %d 条" % added_configs)
        else:
            log("INFO", "[SEED] warning_configs 配置齐全，跳过插入")
    except Exception as e:  # noqa: BLE001
        try:
            db.session.rollback()
        except Exception:  # noqa: BLE001
            pass
        log("ERROR", "[SEED] 种子数据补齐失败（不影响启动）: %s" % e)

    return added_periods, added_configs


if __name__ == "__main__":
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app import create_app

    flask_app = create_app(lightweight=True)
    with flask_app.app_context():
        p, c = seed_defaults(flask_app, verbose=True)
        print("seed_defaults 完成: periods=%d, configs=%d" % (p, c))
