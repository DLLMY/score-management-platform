# -*- coding: utf-8 -*-
# part of api/devices/firmware_routes.py (D2 split)

import logging
from flask import request, send_file
import os
import time
from flask_restx import Namespace, Resource, fields
from models import FirmwareVersion, DeviceFirmwareUpdate, Device
from utils.logger import log_info
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
from services.firmware_service import (
    create_firmware_version,
    update_firmware_version,
    delete_firmware_version,
    report_ota_status,
    create_uploaded_firmware,
    log_batch_upgrade,
    log_ota_upgrade,
)

from api.devices.firmware_routes import FIRMWARE_FIELDS, logger, ns_firmware, firmware_version_model, FIRMWARE_UPLOAD_FOLDER, ALLOWED_EXTENSIONS, allowed_file, ensure_upload_folder, rollback_model

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
