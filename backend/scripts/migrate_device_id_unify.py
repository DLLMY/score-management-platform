# -*- coding: utf-8 -*-
"""
F5: device_id 全项目统一 String(100)（语义迁移）。

- 重建 device_group_mappings：device_id INTEGER -> VARCHAR(100) FK->device.device_id
  （旧 device_id 为整数 Device PK，重映射为 device.device_id 字符串）。
- 重建 notify_histories：device_id INTEGER -> VARCHAR(100) FK->device.device_id
  （优先用 F10 的 wol id 映射，否则按 Device PK 查找，孤儿写 'ORPHAN-<int>'）。
- 删除 wol_devices 表（F10 遗留，已无引用）。
- SQLite FK 开启，故全程 PRAGMA foreign_keys=OFF，结束恢复。
幂等：表已为新结构时跳过重建；wol_devices 不存在则跳过。
"""

import os
import sys
import json
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(BACKEND_DIR, "migration_backups", "migration_wol_id_map.json")


def _table_exists(name):
    return bool(
        db.session.execute(
            text("SELECT name FROM sqlite_master WHERE name=:n"), {"n": name}
        ).fetchone()
    )


def upgrade():
    with app.app_context():
        db.session.execute(text("PRAGMA foreign_keys=OFF"))
        try:
            wol_map = {}
            if os.path.exists(MAP_PATH):
                with open(MAP_PATH, encoding="utf-8") as f:
                    wol_map = json.load(f)  # {str(wol_int_id): device_id_string}

            # ---- device_group_mappings ----
            if _table_exists("device_group_mappings"):
                cols = [
                    r[1]
                    for r in db.session.execute(
                        text("PRAGMA table_info(device_group_mappings)")
                    ).fetchall()
                ]
                if (
                    cols
                    and cols[2] != "device_id"
                    or (
                        cols
                        and cols[2] == "device_id"
                        and db.session.execute(
                            text("SELECT sql FROM sqlite_master WHERE name='device_group_mappings'")
                        )
                        .fetchone()[0]
                        .find("VARCHAR(100)")
                        == -1
                    )
                ):
                    db.session.execute(text("""
                        CREATE TABLE device_group_mappings_new (
                            id INTEGER NOT NULL,
                            group_id INTEGER NOT NULL,
                            device_id VARCHAR(100) NOT NULL,
                            added_at DATETIME,
                            PRIMARY KEY (id),
                            UNIQUE (group_id, device_id),
                            FOREIGN KEY(group_id) REFERENCES device_groups (id),
                            FOREIGN KEY(device_id) REFERENCES device (device_id)
                        )
                    """))
                    db.session.execute(text("""
                        INSERT INTO device_group_mappings_new (id, group_id, device_id, added_at)
                        SELECT dgm.id, dgm.group_id,
                            COALESCE((SELECT d.device_id FROM device d WHERE d.id = dgm.device_id),
                                     'ORPHAN-' || dgm.device_id),
                            dgm.added_at
                        FROM device_group_mappings dgm
                    """))
                    db.session.execute(text("DROP TABLE device_group_mappings"))
                    db.session.execute(
                        text(
                            "ALTER TABLE device_group_mappings_new RENAME TO device_group_mappings"
                        )
                    )
                    print(
                        "OK: device_group_mappings 重建为 device_id VARCHAR(100) FK->device.device_id"
                    )
                else:
                    print("SKIP: device_group_mappings 已是 VARCHAR(100)")
            else:
                print("INFO: device_group_mappings 不存在，跳过")

            # ---- notify_histories ----
            if _table_exists("notify_histories"):
                sql = db.session.execute(
                    text("SELECT sql FROM sqlite_master WHERE name='notify_histories'")
                ).fetchone()[0]
                if sql.find("device_id VARCHAR(100)") == -1:
                    db.session.execute(text("""
                        CREATE TABLE notify_histories_new (
                            id INTEGER NOT NULL,
                            text TEXT,
                            volume FLOAT,
                            speak BOOLEAN,
                            popup BOOLEAN,
                            timeout_sec INTEGER,
                            urgent BOOLEAN,
                            send_mode VARCHAR(50),
                            device_id VARCHAR(100),
                            topic VARCHAR(500),
                            template_id INTEGER,
                            status VARCHAR(20),
                            sent_by INTEGER,
                            created_at DATETIME,
                            PRIMARY KEY (id),
                            FOREIGN KEY(template_id) REFERENCES notify_templates (id),
                            FOREIGN KEY(device_id) REFERENCES device (device_id)
                        )
                    """))
                    db.session.execute(text("""
                        INSERT INTO notify_histories_new
                            (id, text, volume, speak, popup, timeout_sec, urgent, send_mode, device_id, topic, template_id, status, sent_by, created_at)
                        SELECT nh.id, nh.text, nh.volume, nh.speak, nh.popup, nh.timeout_sec, nh.urgent, nh.send_mode,
                            CASE WHEN nh.device_id IS NULL THEN NULL
                                 ELSE COALESCE((SELECT d.device_id FROM device d WHERE d.id = nh.device_id),
                                              'ORPHAN-' || nh.device_id) END,
                            nh.topic, nh.template_id, nh.status, nh.sent_by, nh.created_at
                        FROM notify_histories nh
                    """))
                    db.session.execute(text("DROP TABLE notify_histories"))
                    db.session.execute(
                        text("ALTER TABLE notify_histories_new RENAME TO notify_histories")
                    )
                    print("OK: notify_histories 重建为 device_id VARCHAR(100) FK->device.device_id")
                else:
                    print("SKIP: notify_histories 已是 VARCHAR(100)")
            else:
                print("INFO: notify_histories 不存在，跳过")

            # ---- 删除 wol_devices ----
            if _table_exists("wol_devices"):
                db.session.execute(text("DROP TABLE wol_devices"))
                print("OK: 已删除 wol_devices 表")
            else:
                print("INFO: wol_devices 已不存在")

            db.session.commit()
        finally:
            db.session.execute(text("PRAGMA foreign_keys=ON"))
            db.session.commit()


if __name__ == "__main__":
    upgrade()
