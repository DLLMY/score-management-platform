"""迁移：warning_configs.enabled -> is_active（报告 F6，布尔启用态命名统一）。

warning_configs.enabled 与全局 is_active 同义不同名。该列无 API/前端消费者
（WarningConfig.get_config() 仅返回 config_key->config_value 字典），属纯命名收敛。

幂等步骤：
  1. 若 is_active 不存在则 ADD（默认 1/True）
  2. 若 enabled 仍存在则回填 is_active = enabled（仅补 NULL）
  3. 若 enabled 仍存在则 DROP
可在系统 Python 3.11 下重复执行。
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app import app
from models import db, WarningConfig

TABLE = WarningConfig.__tablename__


def upgrade():
    with app.app_context():
        inspector = db.inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns(TABLE)]

        if "is_active" not in cols:
            with db.engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {TABLE} ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            print(f"OK: 已新增 {TABLE}.is_active")
        else:
            print(f"SKIP: {TABLE}.is_active 已存在")

        if "enabled" in cols:
            # 回填：仅把 is_active 为 NULL 的行用 enabled 填充
            with db.engine.begin() as conn:
                conn.execute(
                    text(f"UPDATE {TABLE} SET is_active = enabled WHERE is_active IS NULL")
                )
                conn.execute(text(f"ALTER TABLE {TABLE} DROP COLUMN enabled"))
            print(f"OK: 已将 enabled 回填至 is_active 并删除 {TABLE}.enabled")
        else:
            print(f"SKIP: {TABLE}.enabled 不存在，无需处理")


if __name__ == "__main__":
    upgrade()
