# -*- coding: utf-8 -*-
# part of api/devices/devices_routes.py (D2 split)

import logging
import time
import json
import threading
import io
import openpyxl
from flask_restx import Namespace, Resource, fields
from models import Device, DeviceHeartbeat, ClassInfo, Admin, get_by_id
from sqlalchemy.orm import joinedload
from utils.permission import requires_permission, get_current_admin, get_admin_class_ids
from utils.response import APIResponse
from utils.decorators import safe_handle
from utils.pagination import get_pagination
from services.heartbeat_service import is_device_online
from services.device_service import (
    create_device,
    update_device,
    delete_device,
    bind_device_class,
    bind_device_admin,
    resolve_device_alert,
    update_device_settings,
    import_devices,
    revoke_device_secret,
)
from services.device_query_service import (
    get_device_list_view,
    get_device_alerts_view,
    get_device_stats_view,
    get_device_advanced_stats_view,
)
from utils.api_cache_middleware import cached_api, invalidate_cache
from datetime import datetime, timedelta
from models import db
from sqlalchemy import func
from models import Alert
from flask import request
from flask import send_file
from flask import Response

import api.devices.devices_routes as _mod

from api.devices.devices_routes import logger, ns_devices, send_ota_upgrade_command, device_model, device_list_response, device_stats_response, bind_class_model, bind_admin_model, _UNLOCK_SPECS, _restart_command_payload, _send_device_restart, _publish_unlock_retry, _start_smart_unlock, ota_upgrade_model

@ns_devices.route("/alerts")
class DeviceAlerts(Resource):

    @ns_devices.doc("get_device_alerts", description="获取设备告警列表")
    @ns_devices.param("resolved", "是否已解决（true/false）")
    @ns_devices.param("severity", "告警级别（info/warning/error/critical）")
    @ns_devices.param("page", "页码（默认1）")
    @ns_devices.param("per_page", "每页数量（默认50）")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self):
        resolved = request.args.get("resolved", "false").lower() == "true"
        severity = request.args.get("severity")
        page, per_page = get_pagination(default=50)
        view = get_device_alerts_view(resolved, severity, page, per_page)
        return APIResponse.success(data=view)

@ns_devices.route("/<int:id>/alerts/<int:alert_id>/resolve")
@ns_devices.param("id", "设备ID")
@ns_devices.param("alert_id", "告警ID")
class ResolveDeviceAlertAlt(Resource):

    @ns_devices.doc(
        "resolve_device_alert_alt", description="解决设备告警（备用路径）", security="Bearer"
    )
    @ns_devices.response(200, "成功")
    @requires_permission("device.edit")
    def post(self, id, alert_id):
        """
        解决设备告警（备用路径）

        将指定告警标记为已解决。
        """
        alert = Alert.query.get_or_404(alert_id)
        resolve_device_alert(alert)
        return APIResponse.success(message="告警已解决")

@ns_devices.route("/<int:id>/alerts")
@ns_devices.param("id", "设备ID")
class DeviceAlertHistory(Resource):

    @ns_devices.doc("get_device_alert_history", description="获取设备告警历史")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    def get(self, id):
        """
        获取设备的告警历史记录

        获取指定设备的所有告警记录。
        """
        device = Device.query.get_or_404(id)
        # F9-A: 仅取来源为设备的告警
        base_query = Alert.query.filter_by(device_id=device.device_id, source="device")
        alerts = base_query.order_by(Alert.created_at.desc()).limit(50).all()

        return APIResponse.success(
            data={
                "alerts": [
                    {
                        "id": a.id,
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
                # total 用真实 count（此前 len(alerts) 被 limit(50) 截断 → 告警>50 时 total 低估）
                "total": base_query.count(),
                "unresolved_count": base_query.filter_by(is_resolved=False).count(),
            }
        )

@ns_devices.route("/<int:id>/remote-control")
@ns_devices.param("id", "设备ID")
class DeviceRemoteControl(Resource):
    @ns_devices.doc("device_remote_control", description="设备远程控制", security="Bearer")
    @ns_devices.expect(
        ns_devices.model(
            "RemoteControl",
            {
                "action": fields.String(
                    required=True, description="操作类型：restart/reboot/unlock_a/unlock_b"
                )
            },
        )
    )
    @ns_devices.response(200, "成功")
    @ns_devices.response(400, "设备不在线")
    @requires_permission("device.edit")
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
            return APIResponse.bad_request(message="需要提供操作类型")

        # 差异 #10：统一走 is_device_online（last_heartbeat 时效性），不再单看 status 字段。
        # 向后兼容：保留 status == "online" 作为兜底 —— 历史数据/测试构造可能只写 status
        # 而无 last_heartbeat，若仅用时效判定会把既有「在线」反转为「离线」。
        if action in ["restart", "unlock_a", "unlock_b"] and not (
            is_device_online(device) or device.status == "online"
        ):
            return APIResponse.bad_request(message="设备不在线，无法执行远程操作")

        if action == "restart":
            return _send_device_restart(device, action)

        if action in _UNLOCK_SPECS:
            return _start_smart_unlock(device, action)

        return APIResponse.bad_request(message=f"不支持的操作类型: {action}")

@ns_devices.route("/advanced-stats")
class DeviceAdvancedStats(Resource):

    @ns_devices.doc("get_device_advanced_stats", description="获取设备高级统计")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=60)
    def get(self):
        return get_device_advanced_stats_view()

@ns_devices.route("/heartbeat-timeout-check")
class HeartbeatTimeoutCheck(Resource):

    @ns_devices.doc("check_heartbeat_timeout", description="检查心跳超时设备")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    def get(self):
        """
        检查心跳超时的设备

        遍历所有设备，检查是否有设备超过心跳间隔未响应。
        返回超时的设备列表，并自动创建告警。
        """
        from services.heartbeat_service import check_heartbeat_timeout

        result = check_heartbeat_timeout()
        return APIResponse.success(data=result)

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
    @requires_permission("device.edit")
    def put(self, id):
        """
        更新设备设置

        更新指定设备的配置选项。
        """
        device = Device.query.get_or_404(id)
        data = request.get_json()

        settings = update_device_settings(device, data)

        return APIResponse.success(
            data={
                "success": True,
                "message": "设备设置已更新",
                "settings": settings,
            }
        )

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
    @requires_permission("device.edit")
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

        if not device_ids:
            return APIResponse.success(
                data={"total": 0, "online_count": 0, "offline_count": 0, "results": []}
            )

        devices = Device.query.filter(Device.id.in_(device_ids)).all()
        device_map = {d.id: d for d in devices}

        results = []
        for device_id in device_ids:
            device = device_map.get(device_id)
            if not device:
                results.append({"device_id": device_id, "success": False, "message": "设备不存在"})
                continue

            # 差异 #10：统一走 is_device_online（last_heartbeat 时效性），
            # 与单设备控制接口保持同一判据，避免批量/单个结论不一致。
            # 向后兼容：同单设备接口，保留 status == "online" 兜底。
            if is_device_online(device) or device.status == "online":
                result = False
                if action == "restart":
                    # 差异 #5：逐台定向发布，避免一台重启引爆全校
                    restart_payload = _restart_command_payload(device, action)
                    result = _mod.publish_mqtt(
                        f"phonebox/control/restart/{device.device_id}", restart_payload
                    )
                    if not result:
                        # 兼容期回退：旧固件只监听广播主题
                        result = _mod.publish_mqtt("phonebox/control/restart", restart_payload)
                elif action == "unlock":
                    unlock_topic_a = "phonebox/unlock/A"
                    _mod.publish_mqtt(unlock_topic_a, "")
                    unlock_topic_b = "phonebox/unlock/B"
                    result = _mod.publish_mqtt(
                        unlock_topic_b, '{"result": "true", "reason": "manual", "current_score": 0}'
                    )
                else:
                    # 未知 action：显式失败，避免上一轮 result 残留造成误报成功
                    results.append(
                        {
                            "device_id": device_id,
                            "device_name": device.name,
                            "success": False,
                            "message": f"不支持的操作类型: {action}",
                        }
                    )
                    continue

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
                    {
                        "device_id": device_id,
                        "device_name": device.name,
                        "success": False,
                        "message": "设备不在线",
                    }
                )

        return APIResponse.success(
            data={
                "success": True,
                "total": len(device_ids),
                "online_count": sum(1 for r in results if r["success"]),
                "offline_count": sum(1 for r in results if not r["success"]),
                "results": results,
            }
        )
