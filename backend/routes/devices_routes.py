from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Device, DeviceHeartbeat, ClassInfo, Admin, DeviceAlert
from utils.permission import requires_admin, requires_permission, get_current_admin, get_admin_class_ids
from services.mqtt_service import publish_mqtt
from datetime import datetime, timedelta
from sqlalchemy import func
import json

ns_devices = Namespace("devices", description="设备管理相关操作")

device_model = ns_devices.model(
    "Device",
    {
        "id": fields.Integer(readOnly=True, description="设备ID"),
        "device_id": fields.String(required=True, description="设备标识"),
        "name": fields.String(description="设备名称"),
        "status": fields.String(readOnly=True, description="状态（online/offline/error）"),
        "wifi_signal": fields.Integer(description="WiFi信号强度"),
        "uptime": fields.Integer(description="运行时间（秒）"),
    },
)

device_list_response = ns_devices.model(
    "DeviceListResponse",
    {
        "id": fields.Integer(description="设备ID"),
        "device_id": fields.String(description="设备标识"),
        "name": fields.String(description="设备名称"),
        "status": fields.String(description="状态"),
        "is_online": fields.Boolean(description="是否在线"),
        "last_heartbeat": fields.String(description="最后心跳时间"),
        "wifi_signal": fields.Integer(description="WiFi信号强度"),
        "uptime": fields.Integer(description="运行时间"),
        "box_a_status": fields.String(description="Box A状态"),
        "box_b_status": fields.String(description="Box B状态"),
        "system_state": fields.String(description="系统状态"),
        "class_info_id": fields.Integer(description="班级ID"),
        "class_name": fields.String(description="班级名称"),
        "admin_id": fields.Integer(description="管理员ID"),
        "admin_name": fields.String(description="管理员姓名"),
        "admin_username": fields.String(description="管理员用户名"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

device_stats_response = ns_devices.model(
    "DeviceStatsResponse",
    {
        "total_devices": fields.Integer(description="设备总数"),
        "online_devices": fields.Integer(description="在线设备数"),
        "offline_devices": fields.Integer(description="离线设备数"),
        "error_devices": fields.Integer(description="故障设备数"),
        "today_heartbeats": fields.Integer(description="今日心跳数"),
        "recent_activity": fields.List(fields.Raw, description="最近活动"),
    },
)


def get_devices_for_admin(admin):
    """根据管理员权限获取设备列表"""
    if not admin:
        return Device.query.filter_by(status="online").all()

    if admin.role == "admin":
        return Device.query.all()

    class_ids = get_admin_class_ids(admin.id)
    if class_ids:
        return Device.query.filter((Device.class_info_id.in_(class_ids)) | (Device.admin_id == admin.id)).all()

    return Device.query.filter(Device.admin_id == admin.id).all()


@ns_devices.route("/")
class DeviceList(Resource):
    @ns_devices.doc("list_devices", description="获取设备列表", security="Bearer")
    @ns_devices.response(200, "成功", device_list_response)
    @requires_admin
    def get(self):
        """
        获取设备列表

        获取当前管理员有权访问的所有设备列表。
        超级管理员可以看到所有设备，普通管理员只能看到自己班级或绑定到自己的设备。
        """
        admin = get_current_admin()
        devices = get_devices_for_admin(admin)

        return [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "status": d.status,
                "is_online": d.status == "online",
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "wifi_signal": d.wifi_signal,
                "uptime": d.uptime,
                "box_a_status": d.box_a_status,
                "box_b_status": d.box_b_status,
                "system_state": d.system_state,
                "class_info_id": d.class_info_id,
                "class_name": d.class_info.name if d.class_info else None,
                "admin_id": d.admin_id,
                "admin_name": d.admin.real_name if d.admin else None,
                "admin_username": d.admin.username if d.admin else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            }
            for d in devices
        ]

    @ns_devices.doc("create_device", description="创建设备", security="Bearer")
    @ns_devices.expect(device_model)
    @ns_devices.response(201, "创建成功")
    @requires_admin
    def post(self):
        """
        创建设备

        创建新的设备，需要管理员权限。

        请求体：
        - device_id: 设备标识（必填）
        - name: 设备名称（可选，默认"设备 {device_id}"）
        """
        data = ns_devices.payload
        device = Device(device_id=data.get("device_id"), name=data.get("name", f'设备 {data.get("device_id")}'))
        db.session.add(device)
        db.session.commit()
        return {"success": True, "message": "设备创建成功", "device_id": device.id}, 201


@ns_devices.route("/<int:id>")
@ns_devices.param("id", "设备ID")
class DeviceResource(Resource):
    @ns_devices.doc("get_device", description="获取单个设备详情")
    @ns_devices.response(200, "成功")
    @ns_devices.response(404, "设备不存在")
    def get(self, id):
        """
        获取单个设备详情

        根据设备ID获取设备的详细信息。
        """
        device = Device.query.get_or_404(id)
        return {
            "id": device.id,
            "device_id": device.device_id,
            "name": device.name,
            "status": device.status,
            "is_online": device.status == "online",
            "last_heartbeat": device.last_heartbeat.isoformat() if device.last_heartbeat else None,
            "wifi_signal": device.wifi_signal,
            "uptime": device.uptime,
            "box_a_status": device.box_a_status,
            "box_b_status": device.box_b_status,
            "system_state": device.system_state,
            "class_info_id": device.class_info_id,
            "class_name": device.class_info.name if device.class_info else None,
            "admin_id": device.admin_id,
            "admin_name": device.admin.real_name if device.admin else None,
            "admin_username": device.admin.username if device.admin else None,
            "created_at": device.created_at.isoformat() if device.created_at else None,
            "updated_at": device.updated_at.isoformat() if device.updated_at else None,
        }

    @ns_devices.doc("update_device", description="更新设备", security="Bearer")
    @ns_devices.expect(device_model)
    @ns_devices.response(200, "更新成功")
    @ns_devices.response(404, "设备不存在")
    @requires_admin
    def put(self, id):
        """
        更新设备

        更新指定设备的信息，需要管理员权限。
        """
        device = Device.query.get_or_404(id)
        data = ns_devices.payload
        device.name = data.get("name", device.name)
        device.updated_at = datetime.now()
        db.session.commit()
        return {"success": True, "message": "设备更新成功"}

    @ns_devices.doc("delete_device", description="删除设备", security="Bearer")
    @ns_devices.response(200, "删除成功")
    @ns_devices.response(404, "设备不存在")
    @requires_admin
    def delete(self, id):
        """
        删除设备

        删除指定的设备，需要管理员权限。
        """
        device = Device.query.get_or_404(id)
        db.session.delete(device)
        db.session.commit()
        return {"success": True, "message": "设备删除成功"}


@ns_devices.route("/<int:id>/heartbeats")
@ns_devices.param("id", "设备ID")
class DeviceHeartbeats(Resource):
    @ns_devices.doc(
        "get_device_heartbeats",
        description="获取设备心跳记录",
        params={"page": "页码（默认1）", "per_page": "每页数量（默认50）"},
    )
    @ns_devices.response(200, "成功")
    @ns_devices.response(404, "设备不存在")
    def get(self, id):
        """
        获取设备心跳记录

        获取指定设备的所有心跳历史记录，支持分页。
        """
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        device = Device.query.get_or_404(id)
        pagination = (
            DeviceHeartbeat.query.filter_by(device_id=device.device_id)
            .order_by(DeviceHeartbeat.received_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return {
            "heartbeats": [
                {
                    "id": h.id,
                    "timestamp": h.timestamp,
                    "status": h.status,
                    "wifi_signal": h.wifi_signal,
                    "uptime": h.uptime,
                    "box_a_status": h.box_a_status,
                    "box_b_status": h.box_b_status,
                    "system_state": h.system_state,
                    "received_at": h.received_at.isoformat() if h.received_at else None,
                }
                for h in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }


@ns_devices.route("/stats")
class DeviceStats(Resource):
    @ns_devices.doc("get_device_stats", description="获取设备统计信息")
    @ns_devices.response(200, "成功", device_stats_response)
    def get(self):
        """
        获取设备统计信息

        获取所有设备的统计数据，包括在线/离线数量、今日心跳数等。
        """
        total = Device.query.count()
        online = Device.query.filter_by(status="online").count()
        offline = Device.query.filter_by(status="offline").count()
        error = Device.query.filter_by(status="error").count()

        today = datetime.now().date()
        today_heartbeats = DeviceHeartbeat.query.filter(
            DeviceHeartbeat.received_at >= datetime.combine(today, datetime.min.time())
        ).count()

        recent_heartbeats = DeviceHeartbeat.query.order_by(DeviceHeartbeat.received_at.desc()).limit(100).all()

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


@ns_devices.route("/online")
class OnlineDevices(Resource):
    @ns_devices.doc("get_online_devices", description="获取在线设备列表")
    @ns_devices.response(200, "成功")
    def get(self):
        """
        获取在线设备列表

        获取所有当前在线的设备列表。
        """
        devices = Device.query.filter_by(status="online").all()
        return [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "status": d.status,
                "is_online": True,
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "wifi_signal": d.wifi_signal,
                "class_info_id": d.class_info_id,
                "class_name": d.class_info.name if d.class_info else None,
                "admin_id": d.admin_id,
                "admin_name": d.admin.real_name if d.admin else None,
            }
            for d in devices
        ]


bind_class_model = ns_devices.model(
    "BindClassRequest", {"class_id": fields.Integer(description="班级ID（设为null可解绑）")}
)


@ns_devices.route("/<int:id>/bind-class")
@ns_devices.param("id", "设备ID")
class BindDeviceClass(Resource):
    @ns_devices.doc("bind_device_class", description="绑定设备到班级", security="Bearer")
    @ns_devices.expect(bind_class_model)
    @ns_devices.response(200, "绑定成功")
    @ns_devices.response(403, "无权绑定到该班级")
    @ns_devices.response(404, "班级不存在")
    @requires_admin
    def post(self, id):
        """
        绑定设备到班级

        将设备绑定到指定的班级，需要管理员权限。
        非超级管理员只能绑定到自己管理的班级。

        请求体：
        - class_id: 班级ID（设为null可解绑设备与班级的关联）
        """
        admin = get_current_admin()
        device = Device.query.get_or_404(id)
        data = request.get_json()
        class_id = data.get("class_id")

        if admin.role != "admin":
            class_ids = get_admin_class_ids(admin.id)
            if class_id and class_id not in class_ids:
                return {"success": False, "message": "无权绑定到该班级"}, 403

        if class_id:
            class_info = ClassInfo.query.get(class_id)
            if not class_info:
                return {"success": False, "message": "班级不存在"}, 404
            device.class_info_id = class_id
        else:
            device.class_info_id = None

        device.updated_at = datetime.now()
        db.session.commit()

        return {
            "success": True,
            "message": "设备绑定班级成功",
            "class_info_id": device.class_info_id,
            "class_name": device.class_info.name if device.class_info else None,
        }


bind_admin_model = ns_devices.model(
    "BindAdminRequest", {"admin_id": fields.Integer(description="管理员ID（设为null可解绑）")}
)


@ns_devices.route("/<int:id>/bind-admin")
@ns_devices.param("id", "设备ID")
class BindDeviceAdmin(Resource):
    @ns_devices.doc("bind_device_admin", description="绑定设备到管理员", security="Bearer")
    @ns_devices.expect(bind_admin_model)
    @ns_devices.response(200, "绑定成功")
    @ns_devices.response(403, "只有超级管理员可以绑定管理员")
    @ns_devices.response(404, "管理员不存在")
    @requires_admin
    def post(self, id):
        """
        绑定设备到管理员

        将设备绑定到指定的管理员，只有超级管理员可以执行此操作。

        请求体：
        - admin_id: 管理员ID（设为null可解绑设备与管理员的关联）
        """
        admin = get_current_admin()

        if admin.role != "admin":
            return {"success": False, "message": "只有超级管理员可以绑定管理员"}, 403

        device = Device.query.get_or_404(id)
        data = request.get_json()
        admin_id = data.get("admin_id")

        if admin_id:
            target_admin = Admin.query.get(admin_id)
            if not target_admin:
                return {"success": False, "message": "管理员不存在"}, 404
            device.admin_id = admin_id
        else:
            device.admin_id = None

        device.updated_at = datetime.now()
        db.session.commit()

        return {
            "success": True,
            "message": "设备绑定管理员成功",
            "admin_id": device.admin_id,
            "admin_name": device.admin.real_name if device.admin else None,
            "admin_username": device.admin.username if device.admin else None,
        }


@ns_devices.route("/class/<int:class_id>")
@ns_devices.param("class_id", "班级ID")
class DevicesByClass(Resource):
    @ns_devices.doc("get_devices_by_class", description="获取班级的设备列表")
    @ns_devices.response(200, "成功")
    def get(self, class_id):
        """
        获取班级的设备列表

        获取绑定到指定班级的所有设备。
        """
        devices = Device.query.filter_by(class_info_id=class_id).all()
        return [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "status": d.status,
                "is_online": d.status == "online",
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "wifi_signal": d.wifi_signal,
                "admin_name": d.admin.real_name if d.admin else None,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            }
            for d in devices
        ]


@ns_devices.route("/admin/<int:admin_id>")
@ns_devices.param("admin_id", "管理员ID")
class DevicesByAdmin(Resource):
    @ns_devices.doc("get_devices_by_admin", description="获取管理员的设备列表")
    @ns_devices.response(200, "成功")
    def get(self, admin_id):
        """
        获取管理员的设备列表

        获取绑定到指定管理员的所有设备。
        """
        devices = Device.query.filter_by(admin_id=admin_id).all()
        return [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "status": d.status,
                "is_online": d.status == "online",
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "wifi_signal": d.wifi_signal,
                "class_name": d.class_info.name if d.class_info else None,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            }
            for d in devices
        ]


@ns_devices.route("/alerts")
class DeviceAlerts(Resource):
    @ns_devices.doc("get_device_alerts", description="获取设备告警列表")
    @ns_devices.param("resolved", "是否已解决（true/false）")
    @ns_devices.param("severity", "告警级别（info/warning/error/critical）")
    @ns_devices.response(200, "成功")
    def get(self):
        """
        获取设备告警列表

        获取所有设备的告警记录，支持按状态和级别筛选。
        """
        resolved = request.args.get("resolved", "false").lower() == "true"
        severity = request.args.get("severity")

        query = DeviceAlert.query

        if resolved:
            query = query.filter(DeviceAlert.is_resolved == True)  # noqa: E712
        else:
            query = query.filter(DeviceAlert.is_resolved == False)  # noqa: E712

        if severity:
            query = query.filter(DeviceAlert.severity == severity)

        alerts = query.order_by(DeviceAlert.created_at.desc()).limit(100).all()

        return {
            "alerts": [
                {
                    "id": a.id,
                    "device_id": a.device_id,
                    "device_name": (
                        Device.query.filter_by(device_id=a.device_id).first().name
                        if Device.query.filter_by(device_id=a.device_id).first()
                        else None
                    ),
                    "alert_type": a.alert_type,
                    "severity": a.severity,
                    "message": a.message,
                    "is_resolved": a.is_resolved,
                    "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in alerts
            ],
            "total": len(alerts),
            "unresolved_count": DeviceAlert.query.filter_by(is_resolved=False).count(),
        }


@ns_devices.route("/<int:id>/resolve-alert/<int:alert_id>")
@ns_devices.param("id", "设备ID")
@ns_devices.param("alert_id", "告警ID")
class ResolveDeviceAlert(Resource):
    @ns_devices.doc("resolve_device_alert", description="解决设备告警", security="Bearer")
    @ns_devices.response(200, "成功")
    @requires_admin
    def post(self, id, alert_id):
        """
        解决设备告警

        将指定告警标记为已解决。
        """
        alert = DeviceAlert.query.get_or_404(alert_id)
        alert.is_resolved = True
        alert.resolved_at = datetime.now()
        db.session.commit()
        return {"success": True, "message": "告警已解决"}


@ns_devices.route("/<int:id>/alerts")
@ns_devices.param("id", "设备ID")
class DeviceAlertHistory(Resource):
    @ns_devices.doc("get_device_alert_history", description="获取设备告警历史")
    @ns_devices.response(200, "成功")
    def get(self, id):
        """
        获取设备的告警历史记录

        获取指定设备的所有告警记录。
        """
        device = Device.query.get_or_404(id)
        alerts = (
            DeviceAlert.query.filter_by(device_id=device.device_id)
            .order_by(DeviceAlert.created_at.desc())
            .limit(50)
            .all()
        )

        return {
            "alerts": [
                {
                    "id": a.id,
                    "alert_type": a.alert_type,
                    "severity": a.severity,
                    "message": a.message,
                    "is_resolved": a.is_resolved,
                    "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in alerts
            ],
            "total": len(alerts),
            "unresolved_count": DeviceAlert.query.filter_by(device_id=device.device_id, is_resolved=False).count(),
        }


@ns_devices.route("/<int:id>/remote-control")
@ns_devices.param("id", "设备ID")
class DeviceRemoteControl(Resource):
    @ns_devices.doc("device_remote_control", description="设备远程控制", security="Bearer")
    @ns_devices.expect(
        ns_devices.model(
            "RemoteControl",
            {"action": fields.String(required=True, description="操作类型：restart/reboot/unlock_a/unlock_b")},
        )
    )
    @ns_devices.response(200, "成功")
    @ns_devices.response(400, "设备不在线")
    @requires_permission("manage_devices")
    def post(self, id):
        """
        设备远程控制

        对指定设备执行远程操作，包括重启和远程开锁。
        需要设备在线才能执行操作。

        操作类型：
        - restart: 重启设备
        - unlock_a: 打开A箱（班主任远程开锁，无需验证）
        - unlock_b: 打开B箱（需要验证积分）
        """
        device = Device.query.get_or_404(id)
        data = request.get_json()
        action = data.get("action")

        if not action:
            return {"success": False, "message": "需要提供操作类型"}, 400

        if action in ["restart", "unlock_a", "unlock_b"]:
            if device.status != "online":
                return {"success": False, "message": "设备不在线，无法执行远程操作"}, 400

        if action == "restart":
            restart_topic = "phonebox/control/restart"
            result = publish_mqtt(restart_topic, '{"command": "restart"}')
            if result:
                return {"success": True, "message": "重启指令已发送", "action": action, "device_id": device.device_id}
            else:
                return {"success": False, "message": "MQTT发送失败，请检查连接"}, 500

        elif action == "unlock_a":
            unlock_topic = "phonebox/unlock/A"
            result = publish_mqtt(unlock_topic, "")
            if result:
                return {
                    "success": True,
                    "message": "A箱开锁指令已发送",
                    "action": action,
                    "device_id": device.device_id,
                }
            else:
                return {"success": False, "message": "MQTT发送失败，请检查连接"}, 500

        elif action == "unlock_b":
            unlock_topic = "phonebox/unlock/B"
            result = publish_mqtt(unlock_topic, '{"result": "true", "reason": "manual", "current_score": 0}')
            if result:
                return {
                    "success": True,
                    "message": "B箱开锁指令已发送（手动开锁）",
                    "action": action,
                    "device_id": device.device_id,
                }
            else:
                return {"success": False, "message": "MQTT发送失败，请检查连接"}, 500

        else:
            return {"success": False, "message": f"不支持的操作类型: {action}"}, 400


@ns_devices.route("/advanced-stats")
class DeviceAdvancedStats(Resource):
    @ns_devices.doc("get_device_advanced_stats", description="获取设备高级统计")
    @ns_devices.response(200, "成功")
    def get(self):
        """
        获取设备高级统计信息

        获取更详细的设备统计，包括信号强度分布、在线时长等。
        """
        total = Device.query.count()
        online = Device.query.filter_by(status="online").count()
        offline = Device.query.filter_by(status="offline").count()
        error = Device.query.filter_by(status="error").count()

        avg_signal = db.session.query(func.avg(Device.wifi_signal)).filter(Device.wifi_signal.isnot(None)).scalar() or 0

        alert_count = DeviceAlert.query.filter_by(is_resolved=False).count()
        critical_alerts = DeviceAlert.query.filter_by(is_resolved=False, severity="critical").count()

        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_heartbeats = DeviceHeartbeat.query.filter(DeviceHeartbeat.received_at >= today_start).count()

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
            "avg_signal_strength": round(avg_signal, 1),
            "signal_distribution": signal_distribution,
            "today_heartbeats": today_heartbeats,
            "unresolved_alerts": alert_count,
            "critical_alerts": critical_alerts,
        }


@ns_devices.route("/heartbeat-timeout-check")
class HeartbeatTimeoutCheck(Resource):
    @ns_devices.doc("check_heartbeat_timeout", description="检查心跳超时设备")
    @ns_devices.response(200, "成功")
    def get(self):
        """
        检查心跳超时的设备

        遍历所有设备，检查是否有设备超过心跳间隔未响应。
        返回超时的设备列表，并自动创建告警。
        """
        timeout_threshold = datetime.now() - timedelta(seconds=60)
        timeout_devices = Device.query.filter(
            Device.last_heartbeat < timeout_threshold, Device.status == "online", Device.alert_enabled == True  # noqa: E712, E501
        ).all()

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

        if alerts_created > 0:
            db.session.commit()

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


@ns_devices.route("/<int:id>/settings")
@ns_devices.param("id", "设备ID")
class DeviceSettings(Resource):
    @ns_devices.doc("update_device_settings", description="更新设备设置", security="Bearer")
    @ns_devices.expect(
        ns_devices.model(
            "DeviceSettings",
            {
                "alert_enabled": fields.Boolean(description="是否启用告警"),
                "heartbeat_timeout": fields.Integer(description="心跳超时时间（秒）"),
                "name": fields.String(description="设备名称"),
            },
        )
    )
    @ns_devices.response(200, "成功")
    @requires_admin
    def put(self, id):
        """
        更新设备设置

        更新指定设备的配置选项。
        """
        device = Device.query.get_or_404(id)
        data = request.get_json()

        if "alert_enabled" in data:
            device.alert_enabled = data["alert_enabled"]
        if "heartbeat_timeout" in data:
            device.heartbeat_timeout = data["heartbeat_timeout"]
        if "name" in data:
            device.name = data["name"]

        device.updated_at = datetime.now()
        db.session.commit()

        return {
            "success": True,
            "message": "设备设置已更新",
            "settings": {
                "alert_enabled": device.alert_enabled,
                "heartbeat_timeout": device.heartbeat_timeout,
                "name": device.name,
            },
        }


@ns_devices.route("/batch-control")
class BatchDeviceControl(Resource):
    @ns_devices.doc("batch_device_control", description="批量设备控制", security="Bearer")
    @ns_devices.expect(
        ns_devices.model(
            "BatchControl",
            {
                "device_ids": fields.List(fields.Integer, required=True, description="设备ID列表"),
                "action": fields.String(required=True, description="操作类型：restart/unlock"),
            },
        )
    )
    @ns_devices.response(200, "成功")
    @ns_devices.response(400, "设备不在线")
    @requires_admin
    def post(self):
        """
        批量设备控制

        对多个设备同时执行远程操作。
        只对在线设备执行操作。

        操作类型：
        - restart: 重启设备
        - unlock: 打开所有箱门
        """
        data = request.get_json()
        device_ids = data.get("device_ids", [])
        action = data.get("action")

        results = []
        for device_id in device_ids:
            device = Device.query.get(device_id)
            if not device:
                results.append({"device_id": device_id, "success": False, "message": "设备不存在"})
                continue

            if device.status == "online":
                if action == "restart":
                    restart_topic = "phonebox/control/restart"
                    result = publish_mqtt(restart_topic, '{"command": "restart"}')
                elif action == "unlock":
                    unlock_topic_a = "phonebox/unlock/A"
                    publish_mqtt(unlock_topic_a, "")
                    unlock_topic_b = "phonebox/unlock/B"
                    result = publish_mqtt(unlock_topic_b, '{"result": "true", "reason": "manual", "current_score": 0}')

                if result:
                    results.append(
                        {
                            "device_id": device_id,
                            "device_name": device.name,
                            "success": True,
                            "message": f"指令已发送: {action}",
                        }
                    )
                else:
                    results.append(
                        {
                            "device_id": device_id,
                            "device_name": device.name,
                            "success": False,
                            "message": "MQTT发送失败",
                        }
                    )
            else:
                results.append(
                    {"device_id": device_id, "device_name": device.name, "success": False, "message": "设备不在线"}
                )

        return {
            "success": True,
            "total": len(device_ids),
            "online_count": sum(1 for r in results if r["success"]),
            "offline_count": sum(1 for r in results if not r["success"]),
            "results": results,
        }


ota_upgrade_model = ns_devices.model(
    "OTAUpgrade",
    {
        "firmware_url": fields.String(required=True, description="固件下载URL"),
        "version": fields.String(description="目标固件版本"),
        "force": fields.Boolean(description="是否强制升级（忽略版本检查）", default=False),
    },
)


@ns_devices.route("/<int:id>/ota-upgrade")
@ns_devices.param("id", "设备ID")
class DeviceOTAUpgrade(Resource):
    @ns_devices.doc("device_ota_upgrade", description="设备OTA固件升级", security="Bearer")
    @ns_devices.expect(ota_upgrade_model)
    @ns_devices.response(200, "成功")
    @ns_devices.response(400, "设备不在线")
    @requires_admin
    def post(self, id):
        """
        设备OTA固件升级

        向指定设备发送OTA固件升级指令。
        需要设备在线才能执行升级。

        请求体：
        - firmware_url: 固件下载URL（必填）
        - version: 目标固件版本（可选）
        - force: 是否强制升级，忽略版本检查（可选，默认false）
        """
        device = Device.query.get_or_404(id)

        if device.status != "online":
            return {"success": False, "message": "设备不在线，无法执行OTA升级"}, 400

        data = request.get_json()
        firmware_url = data.get("firmware_url")
        version = data.get("version", "")
        force = data.get("force", False)

        if not firmware_url:
            return {"success": False, "message": "需要提供固件下载URL"}, 400

        ota_payload = {
            "action": "update",
            "url": firmware_url,
            "version": version,
            "force": force,
            "timestamp": int(datetime.now().timestamp()),
        }

        ota_topic = f"phonebox/ota/{device.device_id}"
        result = publish_mqtt(ota_topic, json.dumps(ota_payload))

        if result:
            return {
                "success": True,
                "message": "OTA升级指令已发送，设备将自动下载并升级",
                "device_id": device.device_id,
                "firmware_url": firmware_url,
                "version": version,
                "force": force,
            }
        else:
            return {"success": False, "message": "MQTT发送失败，请检查连接"}, 500


@ns_devices.route("/ota-upgrade-all")
class DeviceOTAUpgradeAll(Resource):
    @ns_devices.doc("device_ota_upgrade_all", description="批量OTA固件升级", security="Bearer")
    @ns_devices.expect(ota_upgrade_model)
    @ns_devices.response(200, "成功")
    @requires_admin
    def post(self):
        """
        批量OTA固件升级

        向所有在线设备发送OTA固件升级指令。

        请求体：
        - firmware_url: 固件下载URL（必填）
        - version: 目标固件版本（可选）
        - force: 是否强制升级，忽略版本检查（可选，默认false）
        """
        data = request.get_json()
        firmware_url = data.get("firmware_url")
        version = data.get("version", "")
        force = data.get("force", False)

        if not firmware_url:
            return {"success": False, "message": "需要提供固件下载URL"}, 400

        online_devices = Device.query.filter_by(status="online").all()

        if not online_devices:
            return {"success": False, "message": "没有在线设备"}, 400

        ota_payload = {
            "action": "update",
            "url": firmware_url,
            "version": version,
            "force": force,
            "timestamp": int(datetime.now().timestamp()),
        }

        ota_topic = "phonebox/ota"
        result = publish_mqtt(ota_topic, json.dumps(ota_payload))

        if result:
            return {
                "success": True,
                "message": f"OTA升级指令已发送到 {len(online_devices)} 个在线设备",
                "online_count": len(online_devices),
                "firmware_url": firmware_url,
                "version": version,
                "force": force,
            }
        else:
            return {"success": False, "message": "MQTT发送失败，请检查连接"}, 500
