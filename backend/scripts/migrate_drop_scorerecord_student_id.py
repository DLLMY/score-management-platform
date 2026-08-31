"""迁移：删除 score_records.student_id 冗余列。

ScoreRecord 已通过 user_id (FK->user.id) 引用学生，原 student_id 仅索引列、
无任何 service/route/serialize 读取，属同义重复字段（报告 F1）。
幂等：列不存在则跳过。需在系统 Python 3.11 下运行。
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app import app
from models import db, ScoreRecord

TABLE = (
    ScoreRecord.__tablename__
)  # 实际物理表名（无显式 __tablename__，Flask-SQLAlchemy 默认 score_record）


def upgrade():
    with app.app_context():
        inspector = db.inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns(TABLE)]
        if "student_id" in cols:
            with db.engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {TABLE} DROP COLUMN student_id"))
            print(f"OK: 已删除 {TABLE}.student_id")
        else:
            print(f"SKIP: {TABLE}.student_id 不存在，无需处理")


if __name__ == "__main__":
    upgrade()
