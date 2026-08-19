# -*- coding: utf-8 -*-
"""
F10: WOLDevice 并入 Device（数据迁移 + 建列；WOLDevice 模型类已删除）。

- 给 device 表追加 WOL 专属列（idempotent ALTER ADD COLUMN）。
- 将 wol_devices 每行合并进 device（device_type='wol'），建立 int id -> device.device_id 映射。
- 映射持久化到 migration_backups/migration_wol_id_map.json，供 F5 重映射 DeviceGroupMapping/NotifyHistory 使用。
- 不删除 wol_devices 表（F5 验证通过后再删）。
- SQLite FK 在项目内默认开启，故全程 PRAGMA foreign_keys=OFF 操作、结束恢复。
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app import app
from models import db, Device

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(BACKEND_DIR, "migration_backups", "migration_wol_id_map.json")

WOL_COLS = {
    "mac_address": "VARCHAR(20)",
    "subnet_mask": "VARCHAR(45)",
    "broadcast_ip": "VARCHAR(45)",
    "wake_on_lan_enabled": "BOOLEAN",
    "last_wake_time": "DATETIME",
    "wake_count": "INTEGER",
    "is_active": "BOOLEAN",
    "wol_port": "INTEGER",
    "wol_description": "VARCHAR(500)",
}


def upgrade():
    with app.app_context():
        db.session.execute(text("PRAGMA foreign_keys=OFF"))
        try:
            # 1) 给 device 追加 WOL 列（幂等）
            existing = {
                r[1] for r in db.session.execute(text("PRAGMA table_info(device)")).fetchall()
            }
            for col, ctype in WOL_COLS.items():
                if col not in existing:
                    db.session.execute(text(f"ALTER TABLE device ADD COLUMN {col} {ctype}"))
            db.session.commit()
            print(f"OK: device 已确保 WOL 列 {len(WOL_COLS)} 个")

            # 2) 读取 wol_devices（模型类已删，走原始 SQL；仍用同一连接）
            wols = db.session.execute(
                text(
                    "SELECT id, device_id, mac_address, ip_address, subnet_mask, broadcast_ip, "
                    "wake_on_lan_enabled, last_wake_time, wake_count, is_active "
                    "FROM wol_devices"
                )
            ).fetchall()

            map_wol_int_id = {}
            merged = 0
            for w in wols:
                (
                    wid,
                    wdevice_id,
                    mac,
                    ip,
                    subnet,
                    bcast,
                    wol_en,
                    last_wake,
                    wake_count,
                    is_active,
                ) = w
                dev_id = wdevice_id if wdevice_id else f"wol-{wid}"
                existing_dev = Device.query.filter_by(device_id=dev_id).first()
                if existing_dev and existing_dev.device_type == "wol":
                    d = existing_dev
                elif existing_dev and existing_dev.device_type != "wol":
                    # 撞到非 WOL 设备，另建带前缀的行，避免污染真实设备
                    dev_id = f"wol-{wid}"
                    d = Device(device_id=dev_id, name=dev_id, device_type="wol")
                    db.session.add(d)
                    db.session.flush()
                else:
                    d = Device(device_id=dev_id, name=dev_id or dev_id, device_type="wol")
                    db.session.add(d)
                    db.session.flush()

                d.device_type = "wol"
                d.mac_address = mac
                d.ip_address = ip
                d.subnet_mask = subnet
                d.broadcast_ip = bcast
                d.wake_on_lan_enabled = wol_en
                d.last_wake_time = last_wake
                d.wake_count = wake_count
                d.is_active = is_active
                d.wol_port = d.wol_port if d.wol_port is not None else 9
                map_wol_int_id[str(wid)] = d.device_id
                merged += 1

            db.session.commit()

            with open(MAP_PATH, "w", encoding="utf-8") as f:
                json.dump(map_wol_int_id, f, ensure_ascii=False, indent=2)

            print(f"OK: wol_devices 合并 {merged} 行；map 写入 {MAP_PATH}")
            print("INFO: wol_devices 表保留（F5 验证后再删）")
        finally:
            db.session.execute(text("PRAGMA foreign_keys=ON"))
            db.session.commit()


if __name__ == "__main__":
    upgrade()
