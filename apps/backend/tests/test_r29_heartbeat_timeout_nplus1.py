"""R29：写路径 N+1 批处理回归防护——heartbeat_service.check_heartbeat_timeout。

原逻辑：先一次取超时设备列表，循环内对每台设备各发一次
Alert.query.filter_by(device_id, alert_type, is_resolved, source).first()
（N 台 = N 查，全部为「该设备是否已存在未解决心跳超时告警」的存在性检查）。

R29 改为循环前单次 Alert.query.filter(device_id.in_(timeout_ids), ...).all()
+ 集合判定，查询数从 N 降为 1（与 N 无关），且精确复刻原语义：
  - IN 在循环前、session 干净，捕获的是已提交状态，与原逐台查询等价；
  - 原循环内 autoflush 仅 flush 其他设备的待插入告警，不影响当前设备判定。
  - 不存在设备/已在组类同义。

本文件证明：
  1) alert 表 SELECT 数恒定（=1），不再随超时设备数 N 线性增长；
  2) 语义完全等价——alerts_created 数量、已有告警不再重复创建、设备置 offline。
"""

import re
from datetime import datetime, timedelta

import pytest
from sqlalchemy import event

from models import Alert, Device, db
from services.heartbeat_service import check_heartbeat_timeout


def _count_table_selects(app, fn, tables):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（复用 R28 模板）。"""
    pat = re.compile("|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables))
    counter = {"n": 0}

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            return fn(), counter["n"]
    finally:
        event.remove(engine, "after_cursor_execute", _after)


def _seed_timeout_devices(app, n, base_offset=0):
    """在 app.app_context 内建 n 台超时在线设备（last_heartbeat 过期、alert_enabled）。"""
    with app.app_context():
        created = []
        for i in range(n):
            did = f"r29dev_{base_offset + i}"
            db.session.add(
                Device(
                    device_id=did,
                    name="r29超时设备",
                    status="online",
                    last_heartbeat=datetime.now() - timedelta(seconds=120),
                    alert_enabled=True,
                    heartbeat_timeout=60,
                )
            )
            created.append(did)
        db.session.commit()
    return created


class TestCheckHeartbeatTimeoutBatched:
    """R29：心跳超时告警存在性检查 N+1 消除 + 语义等价性。"""

    def test_sql_count_constant_small(self, app):
        """2 台超时设备 → alert 表 SELECT 恒为 1（批量 IN），而非逐台 N=2。"""
        _seed_timeout_devices(app, 2, base_offset=0)
        (result, cnt) = _count_table_selects(
            app, lambda: check_heartbeat_timeout(60), {"alert"}
        )
        assert cnt == 1, cnt
        assert result["total_timeout"] >= 2
        assert result["alerts_created"] >= 2

    def test_sql_count_constant_large(self, app):
        """8 台超时设备 → alert 表 SELECT 仍为 1（与 N 无关），证明非 N 增长。"""
        _seed_timeout_devices(app, 8, base_offset=100)
        (result, cnt) = _count_table_selects(
            app, lambda: check_heartbeat_timeout(60), {"alert"}
        )
        assert cnt == 1, cnt
        assert result["total_timeout"] >= 8
        assert result["alerts_created"] >= 8

    def test_existing_alert_not_duplicated(self, app):
        """已有未解决心跳超时告警 → 不再新建（alerts_created=0），仍只发 1 条 SELECT。"""
        ids = _seed_timeout_devices(app, 3, base_offset=200)
        with app.app_context():
            db.session.add(
                Alert(
                    device_id=ids[0],
                    alert_type="heartbeat_timeout",
                    severity="warning",
                    message="已有告警",
                    is_resolved=False,
                    source="device",
                )
            )
            db.session.commit()

        (result, cnt) = _count_table_selects(
            app, lambda: check_heartbeat_timeout(60), {"alert"}
        )
        assert cnt == 1, cnt
        # 仅 2 台（ids[1], ids[2]）应新建，ids[0] 已有告警跳过
        assert result["alerts_created"] == 2

    def test_device_marked_offline(self, app):
        """超时设备经处理后 status 置 offline、last_error 记「心跳超时」。"""
        ids = _seed_timeout_devices(app, 4, base_offset=300)
        with app.app_context():
            check_heartbeat_timeout(60)
            for did in ids:
                dev = Device.query.filter_by(device_id=did).first()
                assert dev.status == "offline"
                assert dev.last_error == "心跳超时"
