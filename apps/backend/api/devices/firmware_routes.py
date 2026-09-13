import logging

from flask import request, send_file
import os
import time
from flask_restx import Namespace, Resource, fields
from models import FirmwareVersion, DeviceFirmwareUpdate, Device
from utils.logger import log_info

# 响应序列化字段子集（不含 created_by；OTA 命令 payload 字段集不同，不经由此处）
# 差异 #1/#2/#12：补充 device_type / is_stable / rollback_to，供管理端展示与筛选
FIRMWARE_FIELDS = [
    "id",
    "version",
    "description",
    "file_path",
    "file_size",
    "md5",
    "min_compatible_version",
    "is_mandatory",
    "is_active",
    "device_type",
    "is_stable",
    "rollback_to",
    "created_at",
]
from utils.permission import requires_permission
from werkzeug.utils import secure_filename

from utils.response import APIResponse
from utils.pagination import get_pagination
import hashlib
from services.mqtt_service import mqtt_manager
from services.ota_negotiation_service import (
    build_download_url,
    compare_versions,
    get_latest_active_firmware,
    negotiate_all_devices,
    normalize_device_type,
    resolve_rollback_target,
    rollback_all_devices,
    rollback_device,
    sign_ota_command,
    verify_download_token,
)

logger = logging.getLogger(__name__)
from services.firmware_service import (
    create_firmware_version,
    update_firmware_version,
    delete_firmware_version,
    report_ota_status,
    create_uploaded_firmware,
    log_batch_upgrade,
    log_ota_upgrade,
)

ns_firmware = Namespace("firmware", description="Firmware management operations")

firmware_version_model = ns_firmware.model(
    "FirmwareVersion",
    {
        "version": fields.String(required=True, description="Firmware version"),
        "description": fields.String(description="Version description"),
        "file_path": fields.String(description="Firmware file path"),
        "file_size": fields.Integer(description="File size (bytes)"),
        "md5": fields.String(description="MD5 checksum"),
        "min_compatible_version": fields.String(description="Minimum compatible version"),
        "is_mandatory": fields.Boolean(description="Is mandatory update"),
        "is_active": fields.Boolean(description="Is active"),
    },
)


@ns_firmware.route("/versions")
class FirmwareVersions(Resource):

    @ns_firmware.doc("list_firmware_versions", description="Get firmware version list")
    @ns_firmware.param("is_active", "Is active")
    @ns_firmware.response(200, "Success")
    @requires_permission("device.view")
    def get(self):
        """
        Get firmware version list (paginated).

        Returns paginated uploaded firmware version information with pagination metadata.
        """
        page, per_page = get_pagination(default=50)
        is_active = request.args.get("is_active")

        query = FirmwareVersion.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == "true")

        pagination = query.order_by(FirmwareVersion.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return {
            "versions": [v.to_dict(FIRMWARE_FIELDS) for v in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }

    @ns_firmware.doc("create_firmware_version", description="Create firmware version record")
    @ns_firmware.expect(firmware_version_model)
    @ns_firmware.response(201, "Created")
    @requires_permission("device.manage")
    def post(self):
        """
        Create firmware version record

        Records new uploaded firmware version information.
        """
        data = request.get_json(silent=True) or {}

        version = data.get("version")
        if not version:
            return APIResponse.bad_request(message="version 为必填项")

        existing = FirmwareVersion.query.filter_by(version=version).first()
        if existing:
            return APIResponse.error(message="Version already exists", status_code=400)

        firmware_id = create_firmware_version(data, created_by=getattr(request, "admin_id", None))

        return {"success": True, "message": "Firmware version created", "id": firmware_id}, 201


@ns_firmware.route("/versions/<int:id>")
@ns_firmware.param("id", "Firmware ID")
class FirmwareVersionItem(Resource):

    @ns_firmware.doc("get_firmware_version", description="Get firmware version detail")
    @ns_firmware.response(200, "Success")
    @ns_firmware.response(404, "Not found")
    @requires_permission("device.view")
    def get(self, id):
        """
        Get firmware version detail
        """
        firmware = FirmwareVersion.query.get_or_404(id)

        return firmware.to_dict(FIRMWARE_FIELDS)

    @ns_firmware.doc("update_firmware_version", description="Update firmware version")
    @ns_firmware.expect(firmware_version_model)
    @ns_firmware.response(200, "Success")
    @requires_permission("device.manage")
    def put(self, id):
        """
        Update firmware version information
        """
        firmware = FirmwareVersion.query.get_or_404(id)
        data = request.get_json()

        update_firmware_version(firmware, data)

        return APIResponse.success(message="Firmware version updated")

    @ns_firmware.doc("delete_firmware_version", description="Delete firmware version")
    @ns_firmware.response(200, "Success")
    @ns_firmware.response(404, "Not found")
    @requires_permission("device.manage")
    def delete(self, id):
        """
        Delete firmware version

        Only allows deleting inactive versions.
        """
        firmware = FirmwareVersion.query.get_or_404(id)

        if firmware.is_active:
            return APIResponse.error(message="Cannot delete active version", status_code=400)

        if firmware.file_path and os.path.exists(firmware.file_path):
            real_file_path = os.path.realpath(firmware.file_path)
            real_upload_folder = os.path.realpath(FIRMWARE_UPLOAD_FOLDER)

            if real_file_path.startswith(real_upload_folder):
                try:
                    os.remove(firmware.file_path)
                except Exception as e:
                    # 固件文件删除失败（权限/已被清理）不应阻断版本记录删除，仅留痕（T9 日志化）。
                    logger.warning(f"删除固件文件失败 path={firmware.file_path}: {e}", exc_info=True)

        delete_firmware_version(firmware)

        return APIResponse.success(message="Firmware version deleted")


@ns_firmware.route("/ota/check")
class OTACheck(Resource):

    @ns_firmware.doc("ota_check", description="Check firmware update")
    @ns_firmware.param("device_id", "Device ID")
    @ns_firmware.param("current_version", "Current firmware version")
    @ns_firmware.param("device_type", "Device type (optional, defaults to the device's own type)")
    @ns_firmware.response(200, "Success")
    @requires_permission("view_devices")
    def get(self):
        """
        Device check firmware update

        Device calls this interface at startup or periodically to check for available updates.
        A valid device ID is required for authentication.

        差异 #1：只返回与该设备 device_type 匹配的固件（未上报类型视为 phonebox），
        避免多设备类型共存时把 phonebox 固件推给 doorlock 等设备。
        差异 #9：统一调用 ota_negotiation_service.compare_versions（容错实现），
        删除本地 `_compare_versions`——其 `int(x)` 在版本串含非数字片段时抛
        ValueError 导致 500。
        """
        device_id = request.args.get("device_id")
        current_version = request.args.get("current_version")

        if not device_id or not current_version:
            return APIResponse.error(message="Missing parameters", status_code=400)

        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return APIResponse.error(message="Device not registered", status_code=401)

        # 差异 #1：优先用显式查询参数，其次用设备自身上报的类型，最后回退 phonebox
        device_type = request.args.get("device_type") or getattr(device, "device_type", None)

        latest_firmware = get_latest_active_firmware(device_type)

        if not latest_firmware:
            return {"has_update": False, "message": "No firmware updates available"}

        if compare_versions(latest_firmware.version, current_version) <= 0:
            return {"has_update": False, "message": "Already latest version"}

        if (
            latest_firmware.min_compatible_version
            and compare_versions(current_version, latest_firmware.min_compatible_version) < 0
        ):
            return {
                "has_update": False,
                "message": "Current version too old, need intermediate upgrade first",
            }

        return {
            "has_update": True,
            "version": latest_firmware.version,
            "description": latest_firmware.description,
            "file_size": latest_firmware.file_size,
            "md5": latest_firmware.md5,
            "download_url": f"/api/firmware/download/{latest_firmware.id}",
            "is_mandatory": latest_firmware.is_mandatory,
            # 差异 #12：回传设备类型，便于设备侧确认协商上下文
            "device_type": normalize_device_type(
                getattr(latest_firmware, "device_type", None)
            ),
        }


@ns_firmware.route("/ota/report")
class OTAReport(Resource):

    @ns_firmware.doc("ota_report", description="Report firmware upgrade result")
    @ns_firmware.response(200, "Success")
    @requires_permission("manage_devices")
    def post(self):
        """
        Device report firmware upgrade status

        Device reports status after firmware download or upgrade is complete.
        """
        data = request.get_json(silent=True) or {}

        device_id = data.get("device_id")
        device_name = data.get("device_name")
        from_version = data.get("from_version")
        to_version = data.get("to_version")
        status = data.get("status")
        error_message = data.get("error_message")

        if not device_id or not status:
            return APIResponse.bad_request(message="device_id 与 status 为必填项")

        if status == "started":
            report_ota_status("started", device_id, device_name, from_version, to_version)
            return APIResponse.success(message="Upgrade started")

        if status == "completed":
            report_ota_status("completed", device_id, device_name, from_version, to_version)
            return APIResponse.success(message="Upgrade completed")

        if status == "failed":
            report_ota_status(
                "failed", device_id, device_name, from_version, to_version, error_message
            )
            return APIResponse.success(message="Failed status recorded")

        return APIResponse.success()


@ns_firmware.route("/upgrade-records")
class UpgradeRecords(Resource):

    @ns_firmware.doc("get_upgrade_records", description="Get upgrade records")
    @ns_firmware.param("device_id", "Device ID")
    @ns_firmware.param("status", "Upgrade status")
    @ns_firmware.param("page", "Page number (default 1)")
    @ns_firmware.param("per_page", "Items per page (default 20)")
    @ns_firmware.response(200, "Success")
    @requires_permission("device.view")
    def get(self):
        """
        Get device upgrade records

        View all firmware upgrade history records, supports pagination.
        """
        device_id = request.args.get("device_id")
        status = request.args.get("status")
        page, per_page = get_pagination(default=20)

        query = DeviceFirmwareUpdate.query
        if device_id:
            query = query.filter_by(device_id=device_id)
        if status:
            query = query.filter_by(status=status)

        pagination = query.order_by(DeviceFirmwareUpdate.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        records = pagination.items

        return {
            "records": [
                {
                    "id": r.id,
                    "device_id": r.device_id,
                    "device_name": r.device_name,
                    "from_version": r.from_version,
                    "to_version": r.to_version,
                    "status": r.status,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "error_message": r.error_message,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in records
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }


@ns_firmware.route("/batch-upgrade")
class BatchUpgrade(Resource):
    @ns_firmware.doc("batch_upgrade", description="Batch upgrade device firmware")
    @ns_firmware.expect(
        ns_firmware.model(
            "BatchUpgradeRequest",
            {
                "device_ids": fields.List(
                    fields.String, required=True, description="Device ID list"
                ),
                "target_version": fields.String(
                    required=True, description="Target firmware version"
                ),
            },
        )
    )
    @ns_firmware.response(200, "Success")
    @requires_permission("device.manage")
    def post(self):
        """
        Batch upgrade device firmware

        Send firmware upgrade commands to multiple devices at once.
        """
        data = request.get_json()
        device_ids = data.get("device_ids", [])
        target_version = data.get("target_version")

        # S5-A-P1-2 修复: 工具常下发 "latest" → 解析为最新激活版本（原直接按 version 查 → 404）
        if str(target_version).strip().lower() == "latest":
            firmware = (
                FirmwareVersion.query.filter(FirmwareVersion.is_active)
                .order_by(FirmwareVersion.created_at.desc())
                .first()
            )
        else:
            firmware = FirmwareVersion.query.filter_by(
                version=target_version, is_active=True
            ).first()

        if not firmware:
            return APIResponse.error(
                message="Target version does not exist or is not active", status_code=404
            )

        from services.mqtt_manager import mqtt_manager

        url = build_download_url(firmware, request)
        sig = sign_ota_command(firmware, url)
        results = []
        for device_id in device_ids:
            payload = {
                "id": firmware.id,
                "url": url,
                "download_url": f"/api/firmware/download/{firmware.id}",
                "version": firmware.version,
                "md5": firmware.md5,
                "is_mandatory": firmware.is_mandatory,
                "force": True,
            }
            if sig:
                payload["signature"] = sig
            mqtt_manager.publish_ota_command(device_id, payload)

            results.append({"device_id": device_id, "status": "command_sent"})

        log_batch_upgrade(firmware.id, len(device_ids), target_version)

        return {
            "success": True,
            "message": f"Upgrade commands sent to {len(device_ids)} devices",
            "results": results,
        }


FIRMWARE_UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "uploads", "firmware"
)
ALLOWED_EXTENSIONS = {"bin", "hex", "fw"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def ensure_upload_folder():
    if not os.path.exists(FIRMWARE_UPLOAD_FOLDER):
        os.makedirs(FIRMWARE_UPLOAD_FOLDER)
        log_info(f"[Firmware] Created upload directory: {FIRMWARE_UPLOAD_FOLDER}")


@ns_firmware.route("/upload")
class FirmwareUpload(Resource):
    @ns_firmware.doc("upload_firmware", description="Upload firmware file")
    @ns_firmware.expect(
        ns_firmware.model(
            "FirmwareUpload",
            {
                "version": fields.String(required=True, description="Firmware version"),
                "description": fields.String(description="Version description"),
                "min_compatible_version": fields.String(description="Minimum compatible version"),
                "is_mandatory": fields.Boolean(description="Is mandatory update", default=False),
                "device_type": fields.String(
                    description="Target device type (defaults to phonebox)", default="phonebox"
                ),
                "is_stable": fields.Boolean(description="Mark as stable release", default=False),
                "rollback_to": fields.String(description="Rollback target version"),
            },
        )
    )
    @ns_firmware.response(200, "Success")
    @ns_firmware.response(400, "Bad request")
    @requires_permission("device.manage")
    def post(self):
        """
        Upload firmware file

        Upload new firmware file to server and create firmware version record.

        差异 #1/#2：可选表单字段 device_type / is_stable / rollback_to 均为可选，
        不传时 device_type 落 phonebox、is_stable=False、rollback_to=None，
        与历史行为完全一致（向后兼容）。
        """
        ensure_upload_folder()

        if "file" not in request.files:
            return APIResponse.error(message="No file uploaded", status_code=400)

        file = request.files["file"]
        version = request.form.get("version")
        description = request.form.get("description", "")
        min_compatible_version = request.form.get("min_compatible_version", "")
        is_mandatory = request.form.get("is_mandatory", "false").lower() == "true"
        # 差异 #1/#2：新增可选字段（缺省即历史行为）
        device_type = request.form.get("device_type") or None
        is_stable = request.form.get("is_stable", "false").lower() == "true"
        rollback_to = request.form.get("rollback_to") or None

        if not version:
            return APIResponse.error(message="Version is required", status_code=400)

        if file.filename == "":
            return APIResponse.error(message="No file selected", status_code=400)

        if not allowed_file(file.filename):
            return APIResponse.error(
                message="Unsupported file type, only bin/hex/fw allowed", status_code=400
            )

        existing = FirmwareVersion.query.filter_by(version=version).first()
        if existing:
            return APIResponse.error(message=f"Version {version} already exists", status_code=400)

        filename = secure_filename(f"firmware_{version}_{int(time.time())}.bin")
        file_path = os.path.join(FIRMWARE_UPLOAD_FOLDER, filename)

        try:
            file.save(file_path)
            file_size = os.path.getsize(file_path)

            with open(file_path, "rb") as f:
                md5_hash = hashlib.md5()
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
                md5_hex = md5_hash.hexdigest()

            firmware_id = create_uploaded_firmware(
                version,
                description,
                file_path,
                file_size,
                md5_hex,
                min_compatible_version,
                is_mandatory,
                created_by=getattr(request, "admin_id", None),
                device_type=device_type,
                is_stable=is_stable,
                rollback_to=rollback_to,
            )

            return {
                "success": True,
                "message": "Firmware uploaded successfully",
                "firmware": {
                    "id": firmware_id,
                    "version": version,
                    "file_size": file_size,
                    "md5": md5_hex,
                    "description": description,
                    "is_mandatory": is_mandatory,
                },
            }

        except Exception:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.exception("Upload failed")
            return APIResponse.error(message="Upload failed", status_code=500)


@ns_firmware.route("/download/<int:id>")
@ns_firmware.param("id", "Firmware ID")
class FirmwareDownload(Resource):

    @ns_firmware.doc("download_firmware", description="Download firmware file")
    @ns_firmware.response(200, "Success")
    @ns_firmware.response(404, "Not found")
    # S1 修复: 固件 http.GET 无认证头 → 原 requires_permission 致 OTA 全链路 401。
    # 匿名化依据：仅 GET 二进制 + realpath 目录校验 + OTA 指令携带 HMAC 签名（fwId:version:url），
    # 固件验签通过才下载，签名即来源保证。
    #
    # 差异 #6：新增「时效令牌」二次防护——当且仅当配置了 OTA_SIGNING_SECRET 时，
    # 强制校验 URL 上的 expire + token（verify_download_token 在未配置密钥时恒为 True），
    # 使「ID 可枚举」的匿名下载在启用密钥后失效。未配置密钥的存量部署行为不变。
    def get(self, id):
        """
        Download firmware file

        Download firmware file by firmware ID. 默认匿名可下载（固件 OTA 场景），
        完整性由 OTA 指令 HMAC 签名 + 固件 MD5 校验保证；
        配置 OTA_SIGNING_SECRET 后额外要求 URL 携带有效 expire + token 时效令牌。
        """
        firmware = FirmwareVersion.query.get_or_404(id)

        # 差异 #6：启用密钥时强制验签（未配置密钥 → 恒通过，向后兼容）
        if not verify_download_token(
            firmware.id,
            request.args.get("expire"),
            request.args.get("token"),
        ):
            return APIResponse.error(message="Invalid or expired download token", status_code=403)

        if not firmware.file_path or not os.path.exists(firmware.file_path):
            return APIResponse.error(message="Firmware file not found", status_code=404)

        real_file_path = os.path.realpath(firmware.file_path)
        real_upload_folder = os.path.realpath(FIRMWARE_UPLOAD_FOLDER)

        if not real_file_path.startswith(real_upload_folder):
            return APIResponse.error(message="Invalid file path", status_code=403)

        return send_file(
            firmware.file_path,
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=f"firmware_{firmware.version}.bin",
        )


@ns_firmware.route("/latest")
class FirmwareLatest(Resource):

    @ns_firmware.doc("get_latest_firmware", description="Get latest firmware")
    @ns_firmware.response(200, "Success")
    @requires_permission("view_devices")
    def get(self):
        """
        Get latest firmware information

        Returns latest active firmware version information for device update check.
        """
        latest_firmware = (
            FirmwareVersion.query.filter(FirmwareVersion.is_active)
            .order_by(FirmwareVersion.created_at.desc())
            .first()
        )

        if not latest_firmware:
            return {"has_update": False, "message": "No firmware available"}

        return {
            "has_update": True,
            "version": latest_firmware.version,
            "description": latest_firmware.description,
            "file_size": latest_firmware.file_size,
            "md5": latest_firmware.md5,
            "is_mandatory": latest_firmware.is_mandatory,
            "created_at": (
                latest_firmware.created_at.isoformat() if latest_firmware.created_at else None
            ),
        }


@ns_firmware.route("/<int:firmware_id>/ota-upgrade")
class FirmwareOTAUpgrade(Resource):

    @ns_firmware.doc("firmware_ota_upgrade", description="Start OTA upgrade for specific firmware")
    @ns_firmware.param("firmware_id", "Firmware ID")
    @ns_firmware.response(200, "Success")
    @requires_permission("device.manage")
    def post(self, firmware_id):
        """
        Start OTA upgrade for specific firmware

        Send firmware upgrade commands to devices using specified firmware version.
        """
        data = request.get_json()
        device_ids = data.get("device_ids", [])

        firmware = FirmwareVersion.query.get_or_404(firmware_id)

        if not firmware.is_active:
            return APIResponse.error(message="Firmware version is not active", status_code=400)

        results = []
        url = build_download_url(firmware, request)
        sig = sign_ota_command(firmware, url)
        for device_id in device_ids:
            payload = {
                "id": firmware.id,
                "url": url,
                "download_url": f"/api/firmware/download/{firmware.id}",
                "version": firmware.version,
                "md5": firmware.md5,
                "is_mandatory": firmware.is_mandatory,
                "force": True,
            }
            if sig:
                payload["signature"] = sig
            mqtt_manager.publish_ota_command(str(device_id), payload)

            results.append({"device_id": device_id, "status": "command_sent"})

        log_ota_upgrade(firmware.id, len(device_ids), firmware.version)

        return APIResponse.success(
            data={
                "success": True,
                "message": f"Upgrade commands sent to {len(device_ids)} devices",
                "results": results,
            }
        )


@ns_firmware.route("/ota-status")
class OTAStatus(Resource):

    @ns_firmware.doc("get_ota_status", description="Get OTA upgrade status")
    @ns_firmware.param("device_id", "Device ID")
    @ns_firmware.response(200, "Success")
    @requires_permission("device.view")
    def get(self):
        """
        Get OTA upgrade status

        View current in-progress OTA upgrade progress and history records.
        """
        device_id = request.args.get("device_id")

        query = DeviceFirmwareUpdate.query
        if device_id:
            query = query.filter_by(device_id=device_id)

        records = query.order_by(DeviceFirmwareUpdate.created_at.desc()).limit(50).all()

        in_progress = [r for r in records if r.status == "in_progress"]
        completed = [r for r in records if r.status == "completed"]
        failed = [r for r in records if r.status == "failed"]

        return {
            "summary": {
                "in_progress_count": len(in_progress),
                "completed_count": len(completed),
                "failed_count": len(failed),
                "total_count": len(records),
            },
            "in_progress": [
                {
                    "id": r.id,
                    "device_id": r.device_id,
                    "device_name": r.device_name,
                    "from_version": r.from_version,
                    "to_version": r.to_version,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                }
                for r in in_progress
            ],
            "recent": [
                {
                    "id": r.id,
                    "device_id": r.device_id,
                    "device_name": r.device_name,
                    "from_version": r.from_version,
                    "to_version": r.to_version,
                    "status": r.status,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "error_message": r.error_message,
                }
                for r in records[:20]
            ],
        }


@ns_firmware.route("/negotiate-all")
class OTAFirmwareNegotiateAll(Resource):
    @ns_firmware.doc("negotiate_all", description="Trigger firmware negotiation for all devices")
    @ns_firmware.response(200, "Success")
    @requires_permission("device.manage")
    def post(self):
        """
        对全部已上报版本的设备触发 OTA 版本协商扫描。

        逐个比对最新 active 固件：版本落后且 auto_update 开启的设备会被调度自动推送
        （带滚动抖动）。支持灰度/分批：
          - stage_percent: 仅推送可升级设备的前 N%（如 10 先灰度，再 50、100 推进）
          - batch_size:    每批设备数，>0 时批间隔 OTA_STAGE_BATCH_INTERVAL_SEC 错峰
        返回 checked / eligible / scheduled 计数，便于运维确认推送范围。
        """
        body = request.get_json(silent=True) or {}
        stage_percent = body.get("stage_percent")
        batch_size = body.get("batch_size")
        if stage_percent is not None:
            try:
                stage_percent = int(stage_percent)
            except (ValueError, TypeError):
                return APIResponse.error(message="stage_percent 必须为整数", status_code=400)
        if batch_size is not None:
            try:
                batch_size = int(batch_size)
            except (ValueError, TypeError):
                return APIResponse.error(message="batch_size 必须为整数", status_code=400)
        result = negotiate_all_devices(stage_percent=stage_percent, batch_size=batch_size)
        return APIResponse.success(data=result)


# ---------------------------------------------------------------------------
# 差异 #2：回滚端点
# ---------------------------------------------------------------------------
rollback_model = ns_firmware.model(
    "FirmwareRollback",
    {
        "device_ids": fields.List(fields.Integer, description="Device IDs (empty = all devices)"),
        "reason": fields.String(description="Rollback reason for audit"),
    },
)


@ns_firmware.route("/rollback")
class FirmwareRollbackAll(Resource):

    @ns_firmware.doc("rollback_all_devices", description="Rollback devices to their previous stable firmware")
    @ns_firmware.expect(rollback_model)
    @ns_firmware.response(200, "Success")
    @requires_permission("device.manage")
    def post(self):
        """批量回滚：device_ids 为空/缺省时对所有设备执行。

        差异 #2：回滚目标解析优先级为 ① 当前固件的 rollback_to ② 同类型更早的
        稳定版（is_stable=True）。找不到目标或设备固件未知的设备会被逐个标记失败，
        不影响其余设备（逐台异常隔离）。
        """
        data = request.get_json(silent=True) or {}
        device_ids = data.get("device_ids") or None
        reason = data.get("reason") or "manual_rollback"

        if device_ids is not None and not isinstance(device_ids, list):
            return APIResponse.error(message="device_ids 必须为数组", status_code=400)

        result = rollback_all_devices(device_ids=device_ids, reason=reason)
        return APIResponse.success(data=result)


@ns_firmware.route("/<int:device_id>/rollback")
@ns_firmware.param("device_id", "Device primary key ID", type="int")
class FirmwareRollbackDevice(Resource):

    @ns_firmware.doc("rollback_one_device", description="Rollback a single device firmware")
    @ns_firmware.response(200, "Success")
    @ns_firmware.response(400, "Rollback not possible")
    @requires_permission("device.manage")
    def post(self, device_id):
        """单台设备回滚：路径参数为 Device 主键 id。

        差异 #2：与批量端点共用同一 service 逻辑，行为一致。
        """
        device = Device.query.get_or_404(device_id)
        data = request.get_json(silent=True) or {}
        reason = data.get("reason") or "manual_rollback"

        ok, message, payload = rollback_device(device, reason=reason)
        if not ok:
            # 目标缺失/固件未知 → 400（业务前置条件不满足）；MQTT 失败 → 500
            status = 500 if message == "mqtt_publish_failed" else 400
            return APIResponse.error(message=message, status_code=status, data=payload)

        return APIResponse.success(
            data={
                "device_id": device.device_id,
                "from_version": device.fw_version,
                "rollback_to": payload.get("version") if payload else None,
                "message": message,
            }
        )


@ns_firmware.route("/<int:id>/rollback-target")
@ns_firmware.param("id", "Firmware ID")
class FirmwareRollbackTarget(Resource):

    @ns_firmware.doc(
        "get_rollback_target", description="Resolve the rollback target for a firmware version"
    )
    @ns_firmware.response(200, "Success")
    @requires_permission("device.view")
    def get(self, id):
        """查询某固件版本在回滚时会落到哪个版本（供管理端预检与展示）。

        差异 #2：不产生任何副作用，仅解析 rollback_to 或更早的稳定版。
        """
        firmware = FirmwareVersion.query.get_or_404(id)
        target = resolve_rollback_target(firmware)
        return APIResponse.success(
            data={
                "firmware_id": firmware.id,
                "version": firmware.version,
                "rollback_to": firmware.rollback_to,
                "resolved_target": (
                    {
                        "id": target.id,
                        "version": target.version,
                        "is_stable": target.is_stable,
                        "device_type": normalize_device_type(target.device_type),
                    }
                    if target
                    else None
                ),
            }
        )
