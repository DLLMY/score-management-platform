from unittest.mock import patch
from datetime import datetime, timedelta

import pytest

try:
    from models import Device
except ImportError:
    pass


class TestDevicesRoutes:

    def test_get_devices_list(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/devices/", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["success"] is True
            assert "devices" in data["data"]
            assert "total" in data["data"]
            assert "page" in data["data"]
            assert "per_page" in data["data"]

    def test_get_devices_list_with_pagination(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/devices/?page=1&per_page=10", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["data"]["page"] == 1
            assert data["data"]["per_page"] == 10

    def test_get_devices_list_with_filter(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/devices/?status=online", headers=auth_headers)
            assert response.status_code == 200

    def test_get_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/devices/99999", headers=auth_headers)
            assert response.status_code == 404

    def test_update_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.put(
                "/api/devices/99999", json={"name": "新名称"}, headers=auth_headers
            )
            assert response.status_code == 404

    def test_delete_device_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete("/api/devices/99999", headers=auth_headers)
            assert response.status_code == 404

    def test_get_device_stats(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/devices/stats", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["success"] is True
            assert "total_devices" in data["data"]
            assert "online_devices" in data["data"]
            assert "offline_devices" in data["data"]

    def test_ota_upgrade_all_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            from models import Device

            device = Device(
                device_id="test_device_001",
                name="测试设备",
                status="online",
                last_heartbeat=datetime.now(),
            )
            db_session.add(device)
            db_session.commit()

            with patch("api.devices.devices_routes.publish_mqtt", return_value=True):
                response = client.post(
                    "/api/devices/ota-upgrade-all",
                    json={"firmware_url": "http://test.com/firmware.bin"},
                    headers=auth_headers,
                )
                assert response.status_code == 200
                data = response.get_json()
                assert data["success"] is True

    def test_ota_upgrade_all_missing_url(self, client, app, auth_headers):
        with app.app_context():
            response = client.post("/api/devices/ota-upgrade-all", json={}, headers=auth_headers)
            assert response.status_code == 400

    def test_ota_upgrade_all_no_online_devices(self, client, app, auth_headers, db_session):
        # P3: 实现改 filter(last_heartbeat>=60s) 索引查询，无法 mock 整个 Device 类
        # （filter 表达式会在 mock 类属性上求值崩溃）——改造真实离线设备走真实查询。
        with app.app_context():
            offline_device = Device(
                device_id="offline_dev_001",
                name="离线设备",
                status="offline",
                last_heartbeat=datetime.now() - timedelta(hours=2),
            )
            db_session.add(offline_device)
            db_session.commit()
            response = client.post(
                "/api/devices/ota-upgrade-all",
                json={"firmware_url": "http://test.com/firmware.bin"},
                headers=auth_headers,
            )
            assert response.status_code == 400

    def test_bulk_ota_upgrade_alias(self, client, app, auth_headers, db_session):
        with app.app_context():

            device = Device(
                device_id="test_device_002",
                name="测试设备2",
                status="online",
                last_heartbeat=datetime.now(),
            )
            db_session.add(device)
            db_session.commit()

            with patch("api.devices.devices_routes.publish_mqtt", return_value=True):
                response = client.post(
                    "/api/devices/bulk-ota-upgrade",
                    json={"firmware_url": "http://test.com/firmware.bin"},
                    headers=auth_headers,
                )
                assert response.status_code == 200
                data = response.get_json()
                assert data["success"] is True


class TestFirmwareOTAReport:
    """OTA 上报状态必须真正落库（回归 #381 的 query 未 .first() 导致状态永远卡 in_progress）。"""

    def _seed_device(self, db_session):
        from models import Device

        device = Device(device_id="ota_report_dev_001", name="OTA上报设备", status="online")
        db_session.add(device)
        db_session.commit()
        return device

    def test_ota_report_completed_persists_status(self, client, app, auth_headers, db_session):
        from models import DeviceFirmwareUpdate

        with app.app_context():
            self._seed_device(db_session)

            start = client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": "ota_report_dev_001",
                    "device_name": "OTA上报设备",
                    "from_version": "1.0.0",
                    "to_version": "1.1.0",
                    "status": "started",
                },
                headers=auth_headers,
            )
            assert start.status_code == 200

            done = client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": "ota_report_dev_001",
                    "device_name": "OTA上报设备",
                    "from_version": "1.0.0",
                    "to_version": "1.1.0",
                    "status": "completed",
                },
                headers=auth_headers,
            )
            assert done.status_code == 200

            record = (
                DeviceFirmwareUpdate.query.filter_by(
                    device_id="ota_report_dev_001", to_version="1.1.0"
                )
                .order_by(DeviceFirmwareUpdate.started_at.desc())
                .first()
            )
            assert record is not None, "应当存在对应的升级记录"
            assert record.status == "completed", "completed 状态必须落库"
            assert record.completed_at is not None, "completed_at 必须被写入"

    def test_ota_report_failed_persists_status_and_error(
        self, client, app, auth_headers, db_session
    ):
        from models import DeviceFirmwareUpdate

        with app.app_context():
            self._seed_device(db_session)

            client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": "ota_report_dev_001",
                    "device_name": "OTA上报设备",
                    "from_version": "1.0.0",
                    "to_version": "1.2.0",
                    "status": "started",
                },
                headers=auth_headers,
            )
            failed = client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": "ota_report_dev_001",
                    "device_name": "OTA上报设备",
                    "from_version": "1.0.0",
                    "to_version": "1.2.0",
                    "status": "failed",
                    "error_message": "checksum mismatch",
                },
                headers=auth_headers,
            )
            assert failed.status_code == 200

            record = (
                DeviceFirmwareUpdate.query.filter_by(
                    device_id="ota_report_dev_001", to_version="1.2.0"
                )
                .order_by(DeviceFirmwareUpdate.started_at.desc())
                .first()
            )
            assert record is not None
            assert record.status == "failed", "failed 状态必须落库"
            assert record.error_message == "checksum mismatch", "错误信息必须被写入"

    def test_ota_report_missing_required_fields_bad_request(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/firmware/ota/report",
                json={"device_id": "ota_report_dev_001"},
                headers=auth_headers,
            )
            assert response.status_code == 400


class TestDeviceWriteEndpoints:
    """F17 devices 域写入端点行为测试（防腐层迁移前后契约一致）。

    覆盖 Device 的 create/update/delete/bind-class/bind-admin/settings/resolve-alert/import
    八个写入路径，逐字节校验响应体/状态码；仅验证逻辑未迁移（保持原样）。
    """

    def _seed_device(self, db_session, device_id="dev_write_001"):
        from models import Device

        d = Device(device_id=device_id, name="写入测试设备", status="offline")
        db_session.add(d)
        db_session.commit()
        return d

    def test_create_device(self, client, app, auth_headers, db_session):
        with app.app_context():
            resp = client.post(
                "/api/devices/",
                json={"device_id": "dev_create_001", "name": "新建设备"},
                headers=auth_headers,
            )
            assert resp.status_code == 201
            data = resp.get_json()
            assert data["success"] is True
            # 注意：create 响应的 data.device_id 实为记录主键(id)，与详情中的业务键 device_id 同名不同义
            assert data["data"]["device_id"] is not None
            did = data["data"]["device_id"]
            get = client.get(f"/api/devices/{did}", headers=auth_headers)
            assert get.status_code == 200
            assert get.get_json()["data"]["id"] == did
            assert get.get_json()["data"]["device_id"] == "dev_create_001"

    def test_create_device_missing_device_id_returns_error(
        self, client, app, auth_headers, db_session
    ):
        """缺失必填 device_id：Device.device_id NOT NULL 且路由层无前置校验，事务提交抛 IntegrityError。

        F17 防腐层仅迁移 db.session，未改动校验契约（生产环境由全局错误处理返回 500，
        测试环境 TESTING 模式异常上浮）。本断言锁定该行为未被迁移意外改变。
        """
        from sqlalchemy.exc import IntegrityError

        with app.app_context():
            with pytest.raises(IntegrityError):
                client.post("/api/devices/", json={"name": "无标识设备"}, headers=auth_headers)
            # 清理 IntegrityError 后的 PendingRollbackError 状态，避免污染同 session 后续用例
            from models import db

            db.session.rollback()

    def test_update_device(self, client, app, auth_headers, db_session):
        with app.app_context():
            d = self._seed_device(db_session, "dev_upd_001")
            resp = client.put(f"/api/devices/{d.id}", json={"name": "改名后"}, headers=auth_headers)
            assert resp.status_code == 200
            get = client.get(f"/api/devices/{d.id}", headers=auth_headers)
            assert get.get_json()["data"]["name"] == "改名后"

    def test_update_device_not_found(self, client, app, auth_headers, db_session):
        with app.app_context():
            resp = client.put("/api/devices/99999", json={"name": "x"}, headers=auth_headers)
            assert resp.status_code == 404

    def test_delete_device(self, client, app, auth_headers, db_session):
        with app.app_context():
            d = self._seed_device(db_session, "dev_del_001")
            resp = client.delete(f"/api/devices/{d.id}", headers=auth_headers)
            assert resp.status_code == 200
            get = client.get(f"/api/devices/{d.id}", headers=auth_headers)
            assert get.status_code == 404

    def test_bind_class(self, client, app, auth_headers, db_session):
        from models import ClassInfo

        with app.app_context():
            d = self._seed_device(db_session, "dev_bindc_001")
            cls = ClassInfo(name="绑定测试班级")
            db_session.add(cls)
            db_session.commit()
            resp = client.post(
                f"/api/devices/{d.id}/bind-class",
                json={"class_id": cls.id},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.get_json()["data"]["class_info_id"] == cls.id
            # 解绑
            resp2 = client.post(
                f"/api/devices/{d.id}/bind-class",
                json={"class_id": None},
                headers=auth_headers,
            )
            assert resp2.status_code == 200
            assert resp2.get_json()["data"]["class_info_id"] is None

    def test_bind_class_not_found(self, client, app, auth_headers, db_session):
        with app.app_context():
            d = self._seed_device(db_session, "dev_bindc_nf_001")
            resp = client.post(
                f"/api/devices/{d.id}/bind-class",
                json={"class_id": 999999},
                headers=auth_headers,
            )
            assert resp.status_code == 404

    def test_bind_admin(self, client, app, auth_headers, db_session):
        with app.app_context():
            d = self._seed_device(db_session, "dev_binda_001")
            resp = client.post(
                f"/api/devices/{d.id}/bind-admin",
                json={"admin_id": 1},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.get_json()["data"]["admin_id"] == 1

    def test_device_settings(self, client, app, auth_headers, db_session):
        with app.app_context():
            d = self._seed_device(db_session, "dev_set_001")
            resp = client.put(
                f"/api/devices/{d.id}/settings",
                json={"name": "设置名", "alert_enabled": True, "heartbeat_timeout": 60},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            sd = resp.get_json()["data"]["settings"]
            assert sd["name"] == "设置名"
            assert sd["alert_enabled"] is True
            assert sd["heartbeat_timeout"] == 60

    def test_resolve_alert(self, client, app, auth_headers, db_session):
        from models import Alert

        with app.app_context():
            d = self._seed_device(db_session, "dev_alert_001")
            alert = Alert(
                device_id=d.device_id,
                source="device",
                alert_type="test",
                severity="warning",
                message="m",
                is_resolved=False,
            )
            db_session.add(alert)
            db_session.commit()
            resp = client.post(
                f"/api/devices/{d.id}/alerts/{alert.id}/resolve",
                headers=auth_headers,
            )
            assert resp.status_code == 200
            db_session.refresh(alert)
            assert alert.is_resolved is True

    def test_import_devices(self, client, app, auth_headers, db_session):
        import io

        import openpyxl

        with app.app_context():
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.append(["设备标识", "设备名称", "班级名称", "管理员姓名"])
            ws.append(["phonebox001", "导入设备", "", ""])
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            resp = client.post(
                "/api/devices/import",
                data={"file": (buf, "devices.xlsx")},
                content_type="multipart/form-data",
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["success"] is True
            assert data["data"]["success_count"] == 1
            assert data["data"]["failed_count"] == 0


class TestDeviceGroupWriteEndpoints:
    """F17 device-group 域写入端点行为测试（create/update/delete/add/remove）。"""

    def test_create_update_delete_group(self, client, app, auth_headers, db_session):
        with app.app_context():
            resp = client.post("/api/device-group/", json={"name": "分组A"}, headers=auth_headers)
            assert resp.status_code == 201
            gid = resp.get_json()["data"]["id"]

            upd = client.put(
                f"/api/device-group/{gid}",
                json={"name": "分组A改", "description": "d"},
                headers=auth_headers,
            )
            assert upd.status_code == 200
            assert upd.get_json()["data"]["name"] == "分组A改"

            # 重复名称应 400
            dup = client.post("/api/device-group/", json={"name": "分组A改"}, headers=auth_headers)
            assert dup.status_code == 400

            dele = client.delete(f"/api/device-group/{gid}", headers=auth_headers)
            assert dele.status_code == 200

    def test_group_add_remove_device(self, client, app, auth_headers, db_session):
        from models import Device

        with app.app_context():
            g = client.post("/api/device-group/", json={"name": "分组B"}, headers=auth_headers)
            gid = g.get_json()["data"]["id"]
            dev = Device(device_id="grp_dev_001", name="g", status="offline")
            db_session.add(dev)
            db_session.commit()

            add = client.post(
                f"/api/device-group/{gid}/devices",
                json={"device_ids": ["grp_dev_001"]},
                headers=auth_headers,
            )
            assert add.status_code == 201
            assert add.get_json()["data"]["added"] == ["grp_dev_001"]

            rem = client.delete(
                f"/api/device-group/{gid}/devices/grp_dev_001", headers=auth_headers
            )
            assert rem.status_code == 200

            # 重复移除应 404
            rem2 = client.delete(
                f"/api/device-group/{gid}/devices/grp_dev_001", headers=auth_headers
            )
            assert rem2.status_code == 404
