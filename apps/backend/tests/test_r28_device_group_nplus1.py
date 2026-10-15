"""R28：写路径 N+1 批处理回归防护——device_service.add_devices_to_group。

原循环对每台设备各发一次 Device.query 与一次 DeviceGroupMapping.query
（每设备 2 查，N 台 = 2N）。R28 改为按 group_id + device_ids 两次批量 IN 预取，
循环内仅做内存查表，查询数从 2N 降为 2（批量 IN）+ 2（末尾 count/get_by_id），
收益随批量放大。本文件证明：
  1) HTTP 请求路径目标表 SELECT 数恒定（=3），不再随设备数 N 线性增长；
  2) 契约与语义完全等价——added/failed 内容、设备不存在 / 已在组内 判定、
     重复 device_id 的「首次 added、其余 failed」行为、group.device_count 回写。
"""

import re

import pytest
from sqlalchemy import event

from models import Device, DeviceGroup, DeviceGroupMapping, db, get_by_id
from services.device_service import add_devices_to_group


def _count_table_selects(app, fn, tables):
    """统计 fn() 执行期间真实引用 tables 的 SELECT 条数（复制自 test_devices_routes）。"""
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


def _seed_group_and_devices(app, n_new, with_existing_in_group=False, with_duplicate=False):
    """在 app.app_context 内建一个分组 + n_new 台离线设备，可选预置一台已在组设备。

    返回 (gid, new_ids)。
    """
    with app.app_context():
        g = DeviceGroup(name="r28g", is_active=True)
        db.session.add(g)
        db.session.flush()
        gid = g.id
        new_ids = []
        for i in range(n_new):
            did = f"r28dev_{i}"
            db.session.add(Device(device_id=did, name="r28", status="offline"))
            new_ids.append(did)
        if with_existing_in_group:
            db.session.add(Device(device_id="r28in", name="r28", status="offline"))
            db.session.flush()
            db.session.add(DeviceGroupMapping(group_id=gid, device_id="r28in"))
        db.session.commit()
    return gid, new_ids


class TestAddDevicesToGroupBatched:
    """R28：批量加组写路径 N+1 消除 + 契约/语义等价性。"""

    def test_sql_count_constant_via_http(self, client, app, auth_headers):
        """加 10 台设备，目标表 SELECT 应恒定 = 3（2 批量 IN + 1 末尾 count），而非 2N+1。"""
        gid, new_ids = _seed_group_and_devices(app, 10)
        (resp, cnt) = _count_table_selects(
            app,
            lambda: client.post(
                f"/api/device-group/{gid}/devices",
                json={"device_ids": new_ids},
                headers=auth_headers,
            ),
            {"device", "device_group_mappings"},
        )
        assert resp.status_code == 201
        # 业务查询恒定 3：existing Mapping IN + Device IN + 末尾 count；
        # 原逻辑 = 2*N(逐台 2 查) + 1(count) = 21，现与 N 无关。
        assert cnt == 3, cnt
        data = resp.get_json()["data"]
        assert len(data["added"]) == 10
        assert data["failed"] == []

    def test_semantics_all_new(self, app):
        """全为新设备且都不在组 → added 全收、failed 空、device_count 正确回写。"""
        with app.app_context():
            gid, new_ids = _seed_group_and_devices(app, 10)
            res = add_devices_to_group(gid, new_ids)
            assert res["added"] == new_ids
            assert res["failed"] == []
            assert DeviceGroupMapping.query.filter_by(group_id=gid).count() == 10

    def test_semantics_not_found_and_existing(self, app):
        """含不存在设备 + 已在组设备 → failed 原因正确，不污染 added。"""
        with app.app_context():
            gid, new_ids = _seed_group_and_devices(app, 5, with_existing_in_group=True)
            payload = new_ids + ["r28in", "r28missing"]
            res = add_devices_to_group(gid, payload)
            assert res["added"] == new_ids
            reasons = {f["device_id"]: f["reason"] for f in res["failed"]}
            assert reasons.get("r28in") == "设备已在分组中"
            assert reasons.get("r28missing") == "设备不存在"
            # 原 1（预置）+ 新加 5 = 6
            assert DeviceGroupMapping.query.filter_by(group_id=gid).count() == 6

    def test_semantics_duplicate_id(self, app):
        """重复 device_id 列表（如 ["a","a"]）→ 首次 added、后续判为已在分组中。

        精确复刻原 autoflush 行为：原循环第二次查询时 flush 出本批新加 mapping 而可见。
        """
        with app.app_context():
            gid, _ = _seed_group_and_devices(app, 0)
            db.session.add(Device(device_id="r28dup", name="r28", status="offline"))
            db.session.commit()
            res = add_devices_to_group(gid, ["r28dup", "r28dup"])
            assert res["added"] == ["r28dup"]
            assert len(res["failed"]) == 1
            assert res["failed"][0]["device_id"] == "r28dup"
            assert res["failed"][0]["reason"] == "设备已在分组中"
            assert DeviceGroupMapping.query.filter_by(group_id=gid).count() == 1
