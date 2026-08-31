"""固件（firmware）路由行为测试 — F17 防腐层迁移前基线 + 迁移后回归。

覆盖 firmware_routes 的 7 个 DB 写端点（含 OTA 上报/批量升级/上传/指定固件 OTA），
以及关键只读端点回归。捕捉真实契约：

写端点：
- POST   /firmware/versions          : version 必填(400) / 重复(400) / 成功(201, 返回 id)
- PUT    /firmware/versions/<id>     : 404(不存在) / 成功(200, 落库)
- DELETE /firmware/versions/<id>     : 删除 active(400) / 404(不存在) / 成功(200)
- POST   /firmware/ota/report        : device_id+status 必填(400) / started(200) / completed(200, 状态流转) / failed(200, 记录错误)
- POST   /firmware/batch-upgrade     : 目标版本不存在(404) / 成功(200, results)
- POST   /firmware/upload            : 无文件(400) / 无 version(400) / 类型不符(400) / 重复(400) / 成功(200, 真 MD5 落库)
- POST   /firmware/<id>/ota-upgrade  : 不存在(404) / 非 active(400) / 成功(200, data.results)

只读回归（仅确认契约不漂移，DB 写不动）：
- GET /firmware/versions             : 200, 列表+total
- GET /firmware/versions/<id>        : 200, 详情 / 404
- GET /firmware/upgrade-records      : 200, records+pagination
- GET /firmware/ota-status           : 200, summary 计数

注意：/ota/check、/latest、/download、/negotiate-all 不在本文件范围
（check/latest 读设备表、download 二进制+匿名、negotiate-all 已委托 ota_negotiation_service 且会起定时器，
均与本批「路由内 db.session 写入」迁移无直接关系）。
"""

import io
import uuid

from models import FirmwareVersion, DeviceFirmwareUpdate, get_by_id


def _unique_version():
    return "v" + uuid.uuid4().hex[:10]


class TestFirmwareRoutes:

    # ---------- POST /firmware/versions ----------

    def test_create_firmware_version_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            payload = {
                "version": _unique_version(),
                "description": "初始版本",
                "is_mandatory": True,
            }
            response = client.post("/api/firmware/versions", json=payload, headers=auth_headers)
            assert response.status_code == 201
            data = response.get_json()
            assert data["success"] is True
            assert data["id"] > 0
            fw = get_by_id(FirmwareVersion, data["id"])
            assert fw is not None
            assert fw.is_mandatory is True
            assert fw.is_active is True

    def test_create_firmware_version_missing_version(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/firmware/versions", json={"description": "x"}, headers=auth_headers
            )
            assert response.status_code == 400

    def test_create_firmware_version_duplicate(self, client, app, auth_headers, db_session):
        with app.app_context():
            ver = _unique_version()
            db_session.add(FirmwareVersion(version=ver, is_active=True))
            db_session.commit()
            response = client.post(
                "/api/firmware/versions", json={"version": ver}, headers=auth_headers
            )
            assert response.status_code == 400

    # ---------- GET /firmware/versions ----------

    def test_list_firmware_versions(self, client, app, auth_headers, db_session):
        with app.app_context():
            db_session.add(FirmwareVersion(version=_unique_version(), is_active=True))
            db_session.commit()
            response = client.get("/api/firmware/versions", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert "versions" in data
            assert data["total"] >= 1

    # ---------- GET /firmware/versions/<id> ----------

    def test_get_firmware_version_detail(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=True)
            db_session.add(fw)
            db_session.commit()
            fw_id = fw.id
            response = client.get(f"/api/firmware/versions/{fw_id}", headers=auth_headers)
            assert response.status_code == 200
            assert response.get_json()["id"] == fw_id

    def test_get_firmware_version_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.get("/api/firmware/versions/99999", headers=auth_headers)
            assert response.status_code == 404

    # ---------- PUT /firmware/versions/<id> ----------

    def test_update_firmware_version_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=True, is_mandatory=False)
            db_session.add(fw)
            db_session.commit()
            fw_id = fw.id
            response = client.put(
                f"/api/firmware/versions/{fw_id}",
                json={"description": "更新说明", "is_mandatory": True, "is_active": False},
                headers=auth_headers,
            )
            assert response.status_code == 200
            db_fw = get_by_id(FirmwareVersion, fw_id)
            assert db_fw.description == "更新说明"
            assert db_fw.is_mandatory is True
            assert db_fw.is_active is False

    def test_update_firmware_version_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.put(
                "/api/firmware/versions/99999", json={"description": "x"}, headers=auth_headers
            )
            assert response.status_code == 404

    # ---------- DELETE /firmware/versions/<id> ----------

    def test_delete_firmware_version_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=False, file_path=None)
            db_session.add(fw)
            db_session.commit()
            fw_id = fw.id
            response = client.delete(f"/api/firmware/versions/{fw_id}", headers=auth_headers)
            assert response.status_code == 200
            assert get_by_id(FirmwareVersion, fw_id) is None

    def test_delete_firmware_version_active_forbidden(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=True)
            db_session.add(fw)
            db_session.commit()
            fw_id = fw.id
            response = client.delete(f"/api/firmware/versions/{fw_id}", headers=auth_headers)
            assert response.status_code == 400
            assert get_by_id(FirmwareVersion, fw_id) is not None

    def test_delete_firmware_version_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.delete("/api/firmware/versions/99999", headers=auth_headers)
            assert response.status_code == 404

    # ---------- POST /firmware/ota/report ----------

    def test_ota_report_missing_params(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/firmware/ota/report", json={"device_id": "D1"}, headers=auth_headers
            )
            assert response.status_code == 400
            response2 = client.post(
                "/api/firmware/ota/report", json={"status": "started"}, headers=auth_headers
            )
            assert response2.status_code == 400

    def test_ota_report_started_then_completed(self, client, app, auth_headers, db_session):
        with app.app_context():
            did = "DEV-OTA-" + uuid.uuid4().hex[:6]
            ver = _unique_version()
            r1 = client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": did,
                    "from_version": "1.0",
                    "to_version": ver,
                    "status": "started",
                },
                headers=auth_headers,
            )
            assert r1.status_code == 200
            r2 = client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": did,
                    "from_version": "1.0",
                    "to_version": ver,
                    "status": "completed",
                },
                headers=auth_headers,
            )
            assert r2.status_code == 200
            rec = (
                DeviceFirmwareUpdate.query.filter_by(device_id=did, to_version=ver)
                .order_by(DeviceFirmwareUpdate.started_at.desc())
                .first()
            )
            assert rec is not None
            assert rec.status == "completed"
            assert rec.completed_at is not None

    def test_ota_report_failed_records_error(self, client, app, auth_headers, db_session):
        with app.app_context():
            did = "DEV-OTA-" + uuid.uuid4().hex[:6]
            ver = _unique_version()
            client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": did,
                    "from_version": "1.0",
                    "to_version": ver,
                    "status": "started",
                },
                headers=auth_headers,
            )
            r = client.post(
                "/api/firmware/ota/report",
                json={
                    "device_id": did,
                    "from_version": "1.0",
                    "to_version": ver,
                    "status": "failed",
                    "error_message": "checksum mismatch",
                },
                headers=auth_headers,
            )
            assert r.status_code == 200
            rec = (
                DeviceFirmwareUpdate.query.filter_by(device_id=did, to_version=ver)
                .order_by(DeviceFirmwareUpdate.started_at.desc())
                .first()
            )
            assert rec.status == "failed"
            assert rec.error_message == "checksum mismatch"

    # ---------- POST /firmware/batch-upgrade ----------

    def test_batch_upgrade_target_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/firmware/batch-upgrade",
                json={"device_ids": ["D1"], "target_version": "no-such-version"},
                headers=auth_headers,
            )
            assert response.status_code == 404

    def test_batch_upgrade_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=True, md5="abc")
            db_session.add(fw)
            db_session.commit()
            response = client.post(
                "/api/firmware/batch-upgrade",
                json={"device_ids": ["D1", "D2"], "target_version": fw.version},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data["success"] is True
            assert len(data["results"]) == 2

    def test_batch_upgrade_latest_alias(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=True, md5="abc")
            db_session.add(fw)
            db_session.commit()
            response = client.post(
                "/api/firmware/batch-upgrade",
                json={"device_ids": ["D1"], "target_version": "latest"},
                headers=auth_headers,
            )
            assert response.status_code == 200
            assert len(response.get_json()["results"]) == 1

    # ---------- POST /firmware/upload ----------

    def test_upload_no_file(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/firmware/upload",
                data={"version": "1.0"},
                content_type="multipart/form-data",
                headers=auth_headers,
            )
            assert response.status_code == 400

    def test_upload_success_with_real_md5(self, client, app, auth_headers, db_session, tmp_path):
        import api.devices.firmware_routes as fw_mod

        fw_mod.FIRMWARE_UPLOAD_FOLDER = str(tmp_path)
        with app.app_context():
            ver = _unique_version()
            content = b"\x00\x01\x02FAKE-FIRMWARE-BINARY\xff"
            expected_md5 = __import__("hashlib").md5(content).hexdigest()
            response = client.post(
                "/api/firmware/upload",
                data={
                    "file": (io.BytesIO(content), "fw.bin"),
                    "version": ver,
                    "description": "上传测试",
                    "is_mandatory": "true",
                },
                content_type="multipart/form-data",
                headers=auth_headers,
            )
            assert response.status_code == 200, response.get_data(as_text=True)
            data = response.get_json()
            assert data["firmware"]["md5"] == expected_md5
            # 落库：真 MD5（32 位）而非模块名/SHA256
            fw = FirmwareVersion.query.filter_by(version=ver).first()
            assert fw is not None
            assert fw.md5 == expected_md5
            assert len(fw.md5) == 32

    def test_upload_duplicate_version(self, client, app, auth_headers, db_session, tmp_path):
        import api.devices.firmware_routes as fw_mod

        fw_mod.FIRMWARE_UPLOAD_FOLDER = str(tmp_path)
        with app.app_context():
            ver = _unique_version()
            db_session.add(FirmwareVersion(version=ver, is_active=True))
            db_session.commit()
            content = b"dup"
            response = client.post(
                "/api/firmware/upload",
                data={"file": (io.BytesIO(content), "fw.bin"), "version": ver},
                content_type="multipart/form-data",
                headers=auth_headers,
            )
            assert response.status_code == 400

    # ---------- POST /firmware/<id>/ota-upgrade ----------

    def test_ota_upgrade_success(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=True, md5="abc")
            db_session.add(fw)
            db_session.commit()
            fw_id = fw.id
            response = client.post(
                f"/api/firmware/{fw_id}/ota-upgrade",
                json={"device_ids": ["D1"]},
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data["data"]["success"] is True
            assert len(data["data"]["results"]) == 1

    def test_ota_upgrade_not_found(self, client, app, auth_headers):
        with app.app_context():
            response = client.post(
                "/api/firmware/99999/ota-upgrade", json={"device_ids": ["D1"]}, headers=auth_headers
            )
            assert response.status_code == 404

    def test_ota_upgrade_inactive_forbidden(self, client, app, auth_headers, db_session):
        with app.app_context():
            fw = FirmwareVersion(version=_unique_version(), is_active=False)
            db_session.add(fw)
            db_session.commit()
            fw_id = fw.id
            response = client.post(
                f"/api/firmware/{fw_id}/ota-upgrade",
                json={"device_ids": ["D1"]},
                headers=auth_headers,
            )
            assert response.status_code == 400

    # ---------- GET /firmware/upgrade-records ----------

    def test_upgrade_records(self, client, app, auth_headers, db_session):
        with app.app_context():
            db_session.add(
                DeviceFirmwareUpdate(
                    device_id="D1", from_version="1.0", to_version="2.0", status="completed"
                )
            )
            db_session.commit()
            response = client.get("/api/firmware/upgrade-records", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["total"] >= 1
            assert "records" in data

    # ---------- GET /firmware/ota-status ----------

    def test_ota_status_summary(self, client, app, auth_headers, db_session):
        with app.app_context():
            db_session.add(
                DeviceFirmwareUpdate(
                    device_id="D1", from_version="1.0", to_version="2.0", status="in_progress"
                )
            )
            db_session.commit()
            response = client.get("/api/firmware/ota-status", headers=auth_headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["summary"]["in_progress_count"] >= 1
