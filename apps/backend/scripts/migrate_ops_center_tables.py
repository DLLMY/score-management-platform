"""幂等迁移：为运维中心创建遥测与系统指标落库所需的表。

新增表：
  - frontend_perf_metrics : 前端性能/自定义指标上报落库
  - frontend_error_logs  : 前端错误上报落库
  - system_metrics       : 系统指标历史采样（CPU/内存/磁盘/网络）

实现方式：在 app context 中调用 db.create_all()（SQLAlchemy 对每个已存在表是幂等的，
仅创建此前缺失的表）。可安全重复执行。

用法：
  python scripts/migrate_ops_center_tables.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db, FrontendPerfMetric, FrontendErrorLog, SystemMetric


def main():
    with app.app_context():
        # 仅创建缺失的表（已存在表会被跳过）
        db.create_all()
        # 验证表已存在
        inspector = db.inspect(db.engine)
        for model in (FrontendPerfMetric, FrontendErrorLog, SystemMetric):
            exists = model.__tablename__ in inspector.get_table_names()
            print(f"[{'OK' if exists else 'MISSING'}] table {model.__tablename__}")
            if not exists:
                sys.exit(1)
    print(
        "[migrate] 运维中心表创建完成（frontend_perf_metrics / frontend_error_logs / system_metrics）"
    )


if __name__ == "__main__":
    main()
