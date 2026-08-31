"""
F9-A: 将 device_alert 物理合并进 alert 表。

背景：
- 原 device_alert 表存放设备告警（10 行），alert 表存放系统/通用告警（0 行）。
- 合并后统一用 alert 表，新增 source 列区分来源（'device' | 'system'）。
- 物理表命名：DeviceAlert 无 __tablename__，物理名 = device_alert（单数）。
  Alert 无 __tablename__，物理名 = alert（单数）。

操作（幂等、单事务）：
1. 物理备份 score_management.db -> *.pre_F09A_<timestamp>
2. 关闭 FK 约束
3. 给 alert 表增加 source / is_resolved / resolved_at 三列（已存在则跳过）
4. 将 device_alert 全部行拷入 alert（source='device'，重建自增 id 避免 seq 冲突）
5. 校验拷贝行数 == device_alert 行数
6. 删除 device_alert 表
7. 恢复 FK 约束并提交

运行：系统 Python 3.11
  python scripts/migrate_f09a_alert_merge.py
"""

import os
import sys
import shutil
import sqlite3
from datetime import datetime

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from app import app

DB_URI = app.config.get("SQLALCHEMY_DATABASE_URI", "")
if not DB_URI.startswith("sqlite:///"):
    raise SystemExit(f"非预期数据库类型: {DB_URI}")

DB_PATH = os.path.abspath(DB_URI[len("sqlite:///") :])
if not os.path.exists(DB_PATH):
    raise SystemExit(f"数据库文件不存在: {DB_PATH}")


def backup_db():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = f"{DB_PATH}.pre_F09A_{ts}"
    shutil.copy2(DB_PATH, dst)
    print(f"[backup] {DB_PATH} -> {dst}")
    return dst


def main():
    backup_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA foreign_keys=OFF")

        # 3) 幂等加列
        cur.execute("PRAGMA table_info(alert)")
        existing = {row[1] for row in cur.fetchall()}
        for col, ddl in [
            ("source", "VARCHAR(20) DEFAULT 'device'"),
            ("is_resolved", "BOOLEAN DEFAULT 0"),
            ("resolved_at", "DATETIME"),
        ]:
            if col not in existing:
                cur.execute(f"ALTER TABLE alert ADD COLUMN {col} {ddl}")
                print(f"[alter] alert 增加列 {col}")
            else:
                print(f"[alter] alert 列 {col} 已存在，跳过")

        # 4) 拷贝 device_alert -> alert（仅当 device_alert 仍存在）
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='device_alert'")
        if not cur.fetchone():
            print("[copy] device_alert 表不存在，无需合并（可能已执行过）")
            cur.execute("PRAGMA foreign_keys=ON")
            conn.commit()
            conn.close()
            return

        cur.execute("SELECT COUNT(*) FROM device_alert")
        src_count = cur.fetchone()[0]
        print(f"[copy] device_alert 现有 {src_count} 行")

        cur.execute("""
            INSERT INTO alert (
                alert_type, severity, message, device_id, device_name,
                extra_data, is_read, read_at, created_at,
                source, is_resolved, resolved_at
            )
            SELECT
                alert_type, severity, message, device_id, NULL,
                NULL, 0, NULL, created_at,
                'device', is_resolved, resolved_at
            FROM device_alert
            """)
        cur.execute("SELECT COUNT(*) FROM alert WHERE source='device'")
        dst_count = cur.fetchone()[0]
        print(f"[copy] alert(source='device') 现有 {dst_count} 行")

        if src_count and dst_count < src_count:
            raise SystemExit(f"[copy] 校验失败: 期望 >= {src_count} 行，实际 {dst_count} 行，回滚")

        # 6) 删除 device_alert
        cur.execute("DROP TABLE device_alert")
        print("[drop] device_alert 表已删除")

        # 注：alert 主键为 INTEGER PRIMARY KEY（rowid 别名，非 AUTOINCREMENT），
        # SQLite 会自动用 max(rowid)+1 分配新 id，无需维护 sqlite_sequence。

        cur.execute("PRAGMA foreign_keys=ON")
        conn.commit()
        print("[done] F9-A 合并完成")
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败并回滚: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
