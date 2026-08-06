from datetime import datetime, timedelta
from models import Device, DeviceAlert, db
import logging

logger = logging.getLogger(__name__)


def check_heartbeat_timeout(timeout_seconds: int = 60) -> dict:
    """
    检查心跳超时的设备

    参数:
        timeout_seconds: 超时阈值（秒）

    返回:
        包含超时设备列表和总数的字典
    """
    timeout_threshold = datetime.now() - timedelta(seconds=timeout_seconds)

    logger.info(f"开始检查心跳超时设备，超时阈值: {timeout_threshold}, 超时时间: {timeout_seconds}秒")

    timeout_devices = Device.query.filter(
        Device.last_heartbeat.isnot(None),
        Device.last_heartbeat < timeout_threshold,
        Device.status == "online",
        Device.alert_enabled,
    ).all()

    logger.info(f"发现 {len(timeout_devices)} 台设备心跳超时")

    alerts_created = 0
    for device in timeout_devices:
        existing_alert = DeviceAlert.query.filter_by(
            device_id=device.device_id, alert_type="heartbeat_timeout", is_resolved=False
        ).first()

        if not existing_alert:
            alert = DeviceAlert(
                device_id=device.device_id,
                alert_type="heartbeat_timeout",
                severity="warning",
                message=f"设备 {device.name or device.device_id} 心跳超时",
            )
            db.session.add(alert)
            alerts_created += 1

            device.status = "offline"
            device.last_error = "心跳超时"

            logger.warning(f"设备 {device.device_id} ({device.name}) 心跳超时，已创建告警")

    if alerts_created > 0:
        db.session.commit()
        logger.info(f"已提交 {alerts_created} 条心跳超时告警")

    return {
        "timeout_devices": [
            {
                "device_id": d.device_id,
                "name": d.name,
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "heartbeat_timeout": d.heartbeat_timeout,
            }
            for d in timeout_devices
        ],
        "total_timeout": len(timeout_devices),
        "alerts_created": alerts_created,
    }


def update_device_heartbeat(device_id: str, heartbeat_data: dict = None) -> bool:
    """
    更新设备心跳

    参数:
        device_id: 设备ID
        heartbeat_data: 心跳数据（可选）

    返回:
        是否更新成功
    """
    device = Device.query.filter_by(device_id=device_id).first()

    if not device:
        logger.error(f"未找到设备: {device_id}")
        return False

    device.last_heartbeat = datetime.now()
    device.status = "online"
    device.last_error = None

    if heartbeat_data:
        if "wifi_signal" in heartbeat_data:
            device.wifi_signal = heartbeat_data["wifi_signal"]
        if "battery_level" in heartbeat_data:
            device.battery_level = heartbeat_data["battery_level"]
        if "temperature" in heartbeat_data:
            device.temperature = heartbeat_data["temperature"]

    db.session.commit()
    logger.debug(f"设备 {device_id} 心跳已更新")

    return True


def get_device_heartbeat_status(device_id: str = None) -> dict:
    """
    获取设备心跳状态

    参数:
        device_id: 设备ID（可选，为空则返回所有设备）

    返回:
        设备心跳状态信息
    """
    if device_id:
        devices = Device.query.filter_by(device_id=device_id).all()
    else:
        devices = Device.query.all()

    status_list = []
    now = datetime.now()

    for device in devices:
        status_list.append(
            {
                "device_id": device.device_id,
                "name": device.name,
                "status": device.status,
                "last_heartbeat": device.last_heartbeat.isoformat() if device.last_heartbeat else None,
                "heartbeat_timeout": device.heartbeat_timeout,
                "is_timeout": (
                    device.last_heartbeat is not None
                    and ((now - device.last_heartbeat).total_seconds() > (device.heartbeat_timeout or 60))
                ),
                "last_error": device.last_error,
                "alert_enabled": device.alert_enabled,
            }
        )

    logger.debug(f"获取了 {len(status_list)} 台设备的心跳状态")

    return {
        "devices": status_list,
        "total": len(status_list),
        "online": sum(1 for d in status_list if d["status"] == "online"),
        "offline": sum(1 for d in status_list if d["status"] == "offline"),
        "timeout": sum(1 for d in status_list if d["is_timeout"]),
    }
