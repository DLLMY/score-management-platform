from .devices_routes import ns_devices
from .device_group_routes import ns_device_group
from .box_routes import ns_box
from .wol_routes import ns_wol
from .firmware_routes import ns_firmware

"""
设备管理模块
包含设备管理、设备分组、固件管理、远程唤醒等路由
"""
__all__ = [
    "ns_devices",
    "ns_device_group",
    "ns_box",
    "ns_wol",
    "ns_firmware",
]
