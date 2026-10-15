"""R26 回归：device_query 两处统计端点「Device.query.all() 取全表再 Python 计数」→ DB 条件聚合。

优化本质：把回传整表行的 `Model.query.all()` 改为单条 DB 条件聚合（只回传计数/均值），
严格更优（尤其设备量大时）。因新旧都是 1 条目标表 SELECT（语句计数无法区分），
故用「SQL 形状（device 查询含 count/avg 聚合，非回传整表行）+ 数值正确性」双证据证明。
"""

import re
from datetime import datetime, timedelta

from sqlalchemy import event

from models import Alert, Device, db
from services.device_query_service import (
    get_device_advanced_stats_view,
    get_device_stats_view,
)


def _capture(app, fn, tables, warmup=None):
    """捕获 fn() 期间引用 tables 的 SELECT 条数与语句文本。"""
    pat = re.compile("|".join(r"(?:from|join)\s+%s\b|%s\." % (t, t) for t in tables))
    counter = {"n": 0}
    stmts = []

    def _after(conn, cursor, statement, *args, **kwargs):
        s = " ".join(statement.strip().lower().split())
        if s.startswith("select") and pat.search(s):
            counter["n"] += 1
            stmts.append(s)

    engine = db.engine
    event.listen(engine, "after_cursor_execute", _after)
    try:
        with app.app_context():
            if warmup is not None:
                warmup()
                counter["n"] = 0
                stmts.clear()
            return fn(), counter["n"], stmts
    finally:
        event.remove(engine, "after_cursor_execute", _after)


def _seed_devices(db_session):
    """5 台设备：3 在线（心跳 30s 内）、1 心跳过期、1 无心跳；1 台 error；信号覆盖四档。"""
    now = datetime.now()
    rows = [
        Device(device_id="R26A", status="online", last_heartbeat=now - timedelta(seconds=30), wifi_signal=-40),
        Device(device_id="R26B", status="online", last_heartbeat=now - timedelta(seconds=30), wifi_signal=-65),
        Device(device_id="R26C", status="error", last_heartbeat=now - timedelta(seconds=30), wifi_signal=-55),
        Device(device_id="R26D", status="online", last_heartbeat=now - timedelta(seconds=120), wifi_signal=-75),
        Device(device_id="R26E", status="online", last_heartbeat=None, wifi_signal=-90),
    ]
    db_session.add_all(rows)
    db_session.commit()


class TestR26DeviceStats:
    """R26-1: get_device_stats_view。"""

    def test_aggregate_shape(self, app, db_session):
        _seed_devices(db_session)
        (res, cnt, stmts) = _capture(app, get_device_stats_view, {"device"})
        assert cnt == 1, (cnt, stmts)  # 设备统计仅 1 条 device SELECT
        assert "count(" in stmts[0], stmts[0]  # 且为聚合查询（非回传整表行）

    def test_numeric(self, app, db_session):
        _seed_devices(db_session)
        with app.app_context():
            res = get_device_stats_view()
        assert res["total_devices"] == 5
        assert res["error_devices"] == 1  # C
        assert res["online_devices"] == 3  # A/B/C 心跳在 60s 内
        assert res["offline_devices"] == max(0, 5 - 3 - 1)  # =1
        assert set(res.keys()) >= {
            "total_devices", "online_devices", "offline_devices",
            "error_devices", "today_heartbeats", "recent_activity",
        }


class TestR26DeviceAdvancedStats:
    """R26-2: get_device_advanced_stats_view（设备 + 告警双聚合）。"""

    def _seed_alerts(self, db_session):
        base = Alert.query.filter_by(source="device", is_resolved=False).count()
        base_crit = Alert.query.filter_by(
            source="device", is_resolved=False, severity="critical"
        ).count()
        for sev in ("critical", "critical", "warning"):
            db_session.add(
                Alert(alert_type="t", message="m", source="device", is_resolved=False, severity=sev)
            )
        db_session.commit()
        return base, base_crit

    def test_aggregate_shape(self, app, db_session):
        _seed_devices(db_session)
        (res, cnt, stmts) = _capture(app, get_device_advanced_stats_view, {"device", "alert"})
        dev = [s for s in stmts if re.search(r"from device\b", s)]
        alr = [s for s in stmts if re.search(r"from alert\b", s)]
        assert len(dev) == 1, dev  # 设备聚合仅 1 条
        assert len(alr) == 1, alr  # 告警聚合仅 1 条
        assert "avg(" in dev[0] and "count(" in dev[0], dev[0]  # 设备为聚合
        assert "count(" in alr[0], alr[0]  # 告警为聚合

    def test_numeric(self, app, db_session):
        _seed_devices(db_session)
        base, base_crit = self._seed_alerts(db_session)
        with app.app_context():
            res = get_device_advanced_stats_view()
        assert res["total_devices"] == 5
        assert res["error_devices"] == 1
        assert res["online_devices"] == 3
        assert res["offline_devices"] == 5 - 3 - 1  # advanced 无 max(0,..)
        assert res["avg_signal_strength"] == -65.0  # (-40-65-55-75-90)/5
        assert res["signal_distribution"] == {"excellent": 1, "good": 2, "fair": 1, "poor": 1}
        assert res["unresolved_alerts"] == base + 3
        assert res["critical_alerts"] == base_crit + 2
        assert res["online_rate"] == round(3 / 5 * 100, 1)  # 60.0
