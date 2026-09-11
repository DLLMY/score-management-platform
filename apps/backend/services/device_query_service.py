"""设备只读查询视图（薄路由下沉）：列表 / 告警 / 基础统计 / 高级统计。

仅含 GET 查询逻辑，不含任何 MQTT 发布或写路径。路由层保留 @cached_api 缓存与信封。
原 routes.get_devices_for_admin 已迁入本模块（仅 DeviceList.get 使用，无写路径依赖）。
"""

from datetime import datetime, timedelta

from sqlalchemy import func

from models import db, Device, DeviceHeartbeat, Alert
from utils.permission import get_admin_class_ids
from services.heartbeat_service import is_device_online


def _get_devices_for_admin(admin):
    """根据管理员权限获取设备查询对象（原 routes.get_devices_for_admin，仅 DeviceList 使用）。"""
    if not admin:
        return Device.query
    if admin.role in ("admin", "super_admin"):
        return Device.query
    class_ids = get_admin_class_ids(admin.id)
    if class_ids:
        return Device.query.filter(
            (Device.class_info_id.in_(class_ids)) | (Device.admin_id == admin.id)
        )
    return Device.query.filter(Device.admin_id == admin.id)


def get_device_list_view(admin, page, per_page, device_id, name, status, class_id):
    """获取设备列表（分页+筛选），返回裸 data dict。"""
    query = _get_devices_for_admin(admin)
    if device_id:
        query = query.filter(Device.device_id.like(f"%{device_id}%"))
    if name:
        query = query.filter(Device.name.like(f"%{name}%"))
    if status:
        query = query.filter(Device.status == status)
    if class_id:
        query = query.filter(Device.class_info_id == class_id)
    pagination = query.order_by(Device.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    devices = pagination.items
    return {
        "devices": [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "status": d.status,
                "is_online": is_device_online(d),
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "wifi_signal": d.wifi_signal,
                "uptime": d.uptime,
                "box_a_status": d.box_a_status,
                "box_b_status": d.box_b_status,
                "system_state": d.system_state,
                "device_type": getattr(d, "device_type", None),
                "class_info_id": d.class_info_id,
                "class_name": d.class_info.name if d.class_info else None,
                "admin_id": d.admin_id,
                "admin_name": d.admin.real_name if d.admin else None,
                "admin_username": d.admin.username if d.admin else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            }
            for d in devices
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }


def get_device_alerts_view(resolved, severity, page, per_page):
    """获取设备告警列表（分页+筛选），返回裸 data dict。"""
    query = Alert.query.filter(Alert.source == "device")
    if resolved:
        query = query.filter(Alert.is_resolved == True)
    else:
        query = query.filter(Alert.is_resolved == False)
    if severity:
        query = query.filter(Alert.severity == severity)
    pagination = query.order_by(Alert.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    alerts = pagination.items
    device_ids = {a.device_id for a in alerts}
    devices = Device.query.filter(Device.device_id.in_(device_ids)).all()
    device_map = {d.device_id: d.name for d in devices}
    return {
        "alerts": [
            {
                "id": a.id,
                "device_id": a.device_id,
                "device_name": device_map.get(a.device_id),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "is_resolved": a.is_resolved,
                "is_read": a.is_read,
                "source": a.source,
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
        "unresolved_count": Alert.query.filter_by(source="device", is_resolved=False).count(),
    }


def get_device_stats_view():
    """获取设备基础统计，返回裸 data dict。"""
    total = Device.query.count()
    error = Device.query.filter_by(status="error").count()
    online_cutoff = datetime.now() - timedelta(seconds=60)
    online = Device.query.filter(Device.last_heartbeat >= online_cutoff).count()
    offline = max(0, total - online - error)
    today = datetime.now().date()
    today_heartbeats = DeviceHeartbeat.query.filter(
        DeviceHeartbeat.received_at >= datetime.combine(today, datetime.min.time())
    ).count()
    recent_heartbeats = (
        DeviceHeartbeat.query.order_by(DeviceHeartbeat.received_at.desc()).limit(100).all()
    )
    return {
        "total_devices": total,
        "online_devices": online,
        "offline_devices": offline,
        "error_devices": error,
        "today_heartbeats": today_heartbeats,
        "recent_activity": [
            {
                "device_id": h.device_id,
                "status": h.status,
                "received_at": h.received_at.isoformat() if h.received_at else None,
            }
            for h in recent_heartbeats[:10]
        ],
    }


def get_device_advanced_stats_view():
    """获取设备高级统计（@cached_api 直接包装裸 dict，须原样返回）。"""
    total = Device.query.count()
    error = Device.query.filter_by(status="error").count()
    online = Device.query.filter(
        Device.last_heartbeat >= datetime.now() - timedelta(seconds=60)
    ).count()
    offline = total - online - error
    avg_signal = (
        db.session.query(func.avg(Device.wifi_signal))
        .filter(Device.wifi_signal.isnot(None))
        .scalar()
    )
    alert_count = Alert.query.filter_by(source="device", is_resolved=False).count()
    critical_alerts = Alert.query.filter_by(
        source="device", is_resolved=False, severity="critical"
    ).count()
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_heartbeats = DeviceHeartbeat.query.filter(
        DeviceHeartbeat.received_at >= today_start
    ).count()
    devices_with_signal = Device.query.filter(Device.wifi_signal.isnot(None)).all()
    signal_distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
    for d in devices_with_signal:
        if d.wifi_signal >= -50:
            signal_distribution["excellent"] += 1
        elif d.wifi_signal >= -70:
            signal_distribution["good"] += 1
        elif d.wifi_signal >= -80:
            signal_distribution["fair"] += 1
        else:
            signal_distribution["poor"] += 1
    return {
        "total_devices": total,
        "online_devices": online,
        "offline_devices": offline,
        "error_devices": error,
        "online_rate": round(online / total * 100, 1) if total > 0 else 0,
        "avg_signal_strength": round(avg_signal, 1) if avg_signal is not None else None,
        "signal_distribution": signal_distribution,
        "today_heartbeats": today_heartbeats,
        "unresolved_alerts": alert_count,
        "critical_alerts": critical_alerts,
    }
