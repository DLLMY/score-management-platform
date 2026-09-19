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

import api.devices._firmware_part1
import api.devices._firmware_part2
