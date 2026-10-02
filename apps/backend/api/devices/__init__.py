from .box_routes import ns_box
from .device_group_routes import ns_device_group
from .devices_routes import ns_devices
from .firmware_routes import ns_firmware
from .wol_routes import ns_wol

"""
设备管理模块
包含设备管理、设备分组、固件管理、远程唤醒等路由
"""
__all__ = [
    "ns_box",
    "ns_device_group",
    "ns_devices",
    "ns_firmware",
    "ns_wol",
]
