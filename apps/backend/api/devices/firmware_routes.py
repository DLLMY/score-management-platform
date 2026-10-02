import logging
import os

from flask_restx import Namespace, fields

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



logger = logging.getLogger(__name__)

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
