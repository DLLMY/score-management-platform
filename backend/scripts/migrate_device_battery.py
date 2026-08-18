# -*- coding: utf-8 -*-
"""幂等迁移脚本（R7/F8）：device 表加 battery_level / temperature 列。

此前 heartbeat_service 对设备上报的 battery_level/temperature 直接赋值，
但 Device 模型无对应列 → 设备带电量/温度上报时抛 AttributeError。

用法（须系统 Python 3.11）:
    python scripts/migrate_device_battery.py
"""
import os
import sqlite3

DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "instance", "score_management.db"))


def main():
    if not os.path.exists(DB):
        print("[migrate] DB 不存在，跳过:", DB)
        return
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    try:
        cols = [r[1] for r in cur.execute("PRAGMA table_info(device)").fetchall()]
        added = []
        if "battery_level" not in cols:
            cur.execute("ALTER TABLE device ADD COLUMN battery_level FLOAT")
            added.append("battery_level")
        if "temperature" not in cols:
            cur.execute("ALTER TABLE device ADD COLUMN temperature FLOAT")
            added.append("temperature")
        conn.commit()
        print("[migrate] device 表新增列:", added if added else "（均已存在，跳过）")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
