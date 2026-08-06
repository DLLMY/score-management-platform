from flask_restx import Resource, fields, Namespace
from datetime import datetime
from utils.permission import requires_permission, has_permission
from utils.response import APIResponse
from flask import request, g

from services.wol_service import wake_on_lan, is_valid_mac
from models import WOLDevice, Device, db
from services.class_time_checker import ClassTimeChecker

import subprocess
import re
from models import get_by_id

ns_wol = Namespace("wol", description="Wake-on-LAN Remote Boot Operations")

wol_request_model = ns_wol.model(
    "WakeOnLAN",
    {
        "mac_address": fields.String(
            required=True, description="Target computer MAC address (e.g., AA:BB:CC:DD:EE:FF)"
        ),
        "broadcast_ip": fields.String(description="Broadcast IP address", default="255.255.255.255"),
        "port": fields.Integer(description="UDP port", default=9),
        "force_send": fields.Boolean(
            default=False, description="强制唤醒（需 notification.force_send 权限，跳过上课时间检查）"
        ),
    },
)

wol_broadcast_model = ns_wol.model(
    "WakeOnLANBroadcast",
    {
        "mac_addresses": fields.List(fields.String, required=True, description="List of MAC addresses"),
        "broadcast_ip": fields.String(description="Broadcast IP address", default="255.255.255.255"),
        "port": fields.Integer(description="UDP port", default=9),
        "force_send": fields.Boolean(
            default=False, description="强制唤醒（需 notification.force_send 权限，跳过上课时间检查）"
        ),
    },
)

wol_response = ns_wol.model(
    "WOLResponse",
    {"success": fields.Boolean, "message": fields.String, "mac_address": fields.String, "timestamp": fields.String},
)

wol_device_model = ns_wol.model(
    "WOLDevice",
    {
        "id": fields.Integer(readOnly=True, description="Device ID"),
        "name": fields.String(required=True, description="Device name"),
        "mac_address": fields.String(required=True, description="MAC address"),
        "broadcast_ip": fields.String(description="Broadcast IP", default="255.255.255.255"),
        "port": fields.Integer(description="UDP port", default=9),
        "description": fields.String(description="Device description"),
        "is_active": fields.Boolean(description="Is device active", default=True),
        "created_at": fields.String(readOnly=True, description="Created time"),
        "updated_at": fields.String(readOnly=True, description="Updated time"),
    },
)
# ========== API端点 ==========


@ns_wol.route("/wake")
class WakeOnLAN(Resource):

    @ns_wol.expect(wol_request_model)
    @ns_wol.marshal_with(wol_response)
    @requires_permission("device.manage")
    def post(self):
        """
        Wake up a single computer via Wake-on-LAN
        The target computer must support WOL and have it enabled in BIOS/UEFI
        """
        from flask import request

        data = request.json

        mac_address = data.get("mac_address", "").strip()
        broadcast_ip = data.get("broadcast_ip", "255.255.255.255")
        port = data.get("port", 9)

        # 验证MAC地址格式
        if not is_valid_mac(mac_address):
            return APIResponse.bad_request(
                message=f"Invalid MAC address format: {mac_address}",
                data={"mac_address": mac_address, "timestamp": None},
            )

        # 上课时间全局时段拦截（WOL 无班级上下文，仅按全校时段判断）
        force_send = bool(data.get("force_send", False))
        _admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        if force_send and not has_permission(g.current_user, "notification.force_send"):
            return APIResponse.error(
                message="无强制唤醒权限（需 notification.force_send）",
                data={"mac_address": mac_address, "timestamp": None},
            )
        if not force_send:
            _blocked, _rule = ClassTimeChecker.is_during_class_time()
            if _blocked:
                ClassTimeChecker.log_notify_audit(
                    "wol", None, _admin_id, {"mac_address": mac_address},
                    "GLOBAL_TIME_RULE", "当前处于上课时间，远程开机已暂停", force_send=False,
                )
                return APIResponse.error(
                    message="当前处于上课时间，远程开机已暂停",
                    data={"mac_address": mac_address, "timestamp": None},
                )
        else:
            ClassTimeChecker.log_notify_audit(
                "wol", None, _admin_id, {"mac_address": mac_address}, "FORCE", "强制远程开机", force_send=True
            )

        # 发送Wake-on-LAN魔术包
        success = wake_on_lan(mac_address, broadcast_ip, port)

        if success:
            return APIResponse.success(
                data={
                    "success": True,
                    "message": f"Wake-on-LAN magic packet sent to {mac_address}",
                    "mac_address": mac_address,
                    "timestamp": None,
                }
            )
        else:
            return APIResponse.server_error(
                message="Failed to send magic packet", data={"mac_address": mac_address, "timestamp": None}
            )


@ns_wol.route("/wake/batch")
class WakeOnLANBatch(Resource):

    @ns_wol.expect(wol_broadcast_model)
    @requires_permission("device.manage")
    def post(self):
        """
        Wake up multiple computers via Wake-on-LAN
        """

        data = request.json
        mac_addresses = data.get("mac_addresses", [])
        broadcast_ip = data.get("broadcast_ip", "255.255.255.255")
        port = data.get("port", 9)

        results = {}
        success_count = 0

        # 上课时间全局时段拦截
        force_send = bool(data.get("force_send", False))
        _admin_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        if force_send and not has_permission(g.current_user, "notification.force_send"):
            return APIResponse.error(
                message="无强制唤醒权限（需 notification.force_send）",
                data={"timestamp": datetime.now().isoformat()},
            )
        if not force_send:
            if ClassTimeChecker.is_during_class_time()[0]:
                ClassTimeChecker.log_notify_audit(
                    "wol", None, _admin_id, {"mac_addresses": mac_addresses},
                    "GLOBAL_TIME_RULE", "当前处于上课时间，批量远程开机已暂停", force_send=False,
                )
                return APIResponse.error(
                    message="当前处于上课时间，批量远程开机已暂停",
                    data={"timestamp": datetime.now().isoformat()},
                )
        else:
            ClassTimeChecker.log_notify_audit(
                "wol", None, _admin_id, {"mac_addresses": mac_addresses}, "FORCE", "强制批量远程开机", force_send=True
            )

        for mac_address in mac_addresses:
            mac_clean = mac_address.strip()
            if is_valid_mac(mac_clean):
                success = wake_on_lan(mac_clean, broadcast_ip, port)
                results[mac_clean] = {
                    "success": success,
                    "message": "Magic packet sent" if success else "Failed to send",
                }
                if success:
                    success_count += 1
            else:
                results[mac_clean] = {"success": False, "message": "Invalid MAC address format"}

        return APIResponse.success(
            data={
                "success": True,
                "total": len(mac_addresses),
                "success_count": success_count,
                "results": results,
                "timestamp": datetime.now().isoformat(),
            }
        )


@ns_wol.route("/validate")
class ValidateMAC(Resource):

    @ns_wol.doc(params={"mac": "MAC address to validate"})
    @requires_permission("view_devices")
    def get(self):
        """
        Validate MAC address format
        """

        mac = request.args.get("mac", "")

        is_valid = is_valid_mac(mac)

        return APIResponse.success(
            data={
                "mac_address": mac,
                "valid": is_valid,
                "normalized": mac.replace("-", ":").upper() if is_valid else None,
            }
        )


@ns_wol.route("/status/<mac_address>")
class DeviceStatus(Resource):

    @ns_wol.doc(params={"mac_address": "Device MAC address"})
    @requires_permission("view_devices")
    def get(self, mac_address):
        """
        Check if device is reachable (ping check)
        """

        mac_clean = mac_address.replace("-", ":").upper()
        if not is_valid_mac(mac_clean):
            return APIResponse.bad_request(message="Invalid MAC address format", data={"online": None})

        target_ip = None

        try:
            arp_command = "arp -a" if platform.system().lower() == "windows" else "arp -n"
            arp_result = subprocess.run(arp_command, capture_output=True, text=True, timeout=5)

            arp_pattern = re.compile(r"(\d+\.\d+\.\d+\.\d+)\s+([0-9A-Fa-f:-]+)")
            for match in arp_pattern.finditer(arp_result.stdout):
                ip, mac = match.groups()
                if mac.upper().replace("-", ":") == mac_clean or mac.upper() == mac_clean.replace(":", ""):
                    target_ip = ip
                    break
        except Exception:
            pass

        if not target_ip:
            device = WOLDevice.query.filter_by(mac_address=mac_clean).first()
            if device and hasattr(device, "ip_address") and device.ip_address:
                target_ip = device.ip_address

        if not target_ip:
            return APIResponse.success(
                data={
                    "success": True,
                    "mac_address": mac_address,
                    "online": None,
                    "message": "IP address found not in ARP table, unable to ping",
                }
            )

        param = "-n" if platform.system().lower() == "windows" else "-c"
        command = ["ping", param, "1", "-w", "1000", target_ip]

        try:
            result = subprocess.run(command, capture_output=True, timeout=2)  # noqa: F841
            online = result.returncode == 0
        except Exception:
            online = None

        return APIResponse.success(
            data={
                "success": True,
                "mac_address": mac_address,
                "ip_address": target_ip,
                "online": online,
                "message": (
                    "Device is online"
                    if online
                    else ("Device is offline" if online is not None else "Unable to determine")
                ),
            }
        )


# ========== 设备管理 API ==========


@ns_wol.route("/devices")
class WOLDeviceList(Resource):

    @ns_wol.marshal_list_with(wol_device_model)
    @requires_permission("view_devices")
    def get(self):
        """
        Get all WOL devices from database
        """
        devices = WOLDevice.query.filter_by(is_active=True).all()
        return devices

    @ns_wol.expect(wol_device_model)
    @ns_wol.marshal_with(wol_device_model)
    @requires_permission("manage_devices")
    def post(self):
        """
        Add a new WOL device to database
        """

        data = request.json

        name = data.get("name", "").strip()
        mac_address = data.get("mac_address", "").strip().upper().replace("-", ":")

        if not name:
            return APIResponse.error(message="Device name is required", status_code=400)

        if not is_valid_mac(mac_address):
            return APIResponse.error(message="Invalid MAC address format", status_code=400)

        # 检查MAC地址是否已存在
        existing_device = WOLDevice.query.filter_by(mac_address=mac_address).first()
        if existing_device:
            return APIResponse.error(message="MAC address already exists", status_code=409)

        new_device = WOLDevice(
            name=name,
            mac_address=mac_address,
            broadcast_ip=data.get("broadcast_ip", "255.255.255.255"),
            port=data.get("port", 9),
            description=data.get("description", ""),
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        db.session.add(new_device)
        db.session.commit()

        return new_device, 201


@ns_wol.route("/devices/<int:device_id>")
class WOLDeviceResource(Resource):

    @ns_wol.marshal_with(wol_device_model)
    @requires_permission("view_devices")
    def get(self, device_id):
        """
        Get a single WOL device by ID
        """
        device = get_by_id(WOLDevice, device_id)
        if not device or not device.is_active:
            return APIResponse.error(message="Device not found", status_code=404)
        return device

    @ns_wol.expect(wol_device_model)
    @ns_wol.marshal_with(wol_device_model)
    @requires_permission("manage_devices")
    def put(self, device_id):
        """
        Update an existing WOL device
        """

        data = request.json

        device = get_by_id(WOLDevice, device_id)
        if not device or not device.is_active:
            return APIResponse.error(message="Device not found", status_code=404)

        if "name" in data:
            device.name = data["name"].strip()

        if "mac_address" in data:
            new_mac = data["mac_address"].strip().upper().replace("-", ":")
            if not is_valid_mac(new_mac):
                return APIResponse.error(message="Invalid MAC address format", status_code=400)

            # 检查新MAC是否被其他设备使用
            existing_device = WOLDevice.query.filter(
                WOLDevice.mac_address == new_mac, WOLDevice.id != device_id
            ).first()
            if existing_device:
                return APIResponse.error(message="MAC address already exists", status_code=409)

            device.mac_address = new_mac

        if "broadcast_ip" in data:
            device.broadcast_ip = data["broadcast_ip"]

        if "port" in data:
            device.port = data["port"]

        if "description" in data:
            device.description = data["description"]

        if "is_active" in data:
            device.is_active = data["is_active"]

        device.updated_at = datetime.now()
        db.session.commit()

        return device

    @requires_permission("manage_devices")
    def delete(self, device_id):
        """
        Delete a WOL device (soft delete)
        """
        device = get_by_id(WOLDevice, device_id)
        if not device or not device.is_active:
            return APIResponse.error(message="Device not found", status_code=404)

        device.is_active = False
        device.updated_at = datetime.now()
        db.session.commit()

        return APIResponse.success(
            data={"success": True, "message": "Device deleted successfully", "device_id": device_id}
        )
