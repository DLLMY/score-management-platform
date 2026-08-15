"""为 devices 表幂等新增 device_type 列（无缝 OTA：设备类型主动上报落库）。

- 仅 SQLite 适用（本项目开发/生产均用 SQLite）。
- 重复执行安全：列已存在则跳过。
- 运行前建议先备份 instance/*.db（见下方 cp 命令）。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app import get_app
from models import db


def main():
    app = get_app()
    with app.app_context():
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("device")]
        if "device_type" in cols:
            print("[migrate] device.device_type 已存在，跳过")
            return
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE device ADD COLUMN device_type VARCHAR(50)"))
        print("[migrate] 已为 device 表新增 device_type 列")


if __name__ == "__main__":
    main()
