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

@ns_devices.route("/")
class DeviceList(Resource):

    @ns_devices.doc("list_devices", description="获取设备列表", security="Bearer")
    @ns_devices.param("page", "页码（默认1）")
    @ns_devices.param("per_page", "每页数量（默认20）")
    @ns_devices.param("device_id", "设备标识（模糊搜索）")
    @ns_devices.param("name", "设备名称（模糊搜索）")
    @ns_devices.param("status", "状态（online/offline/error）")
    @ns_devices.param("class_id", "班级ID")
    @ns_devices.response(200, "成功", device_list_response)
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self):
        admin = get_current_admin()
        page, per_page = get_pagination(default=20)
        device_id = request.args.get("device_id")
        name = request.args.get("name")
        status = request.args.get("status")
        class_id = request.args.get("class_id", type=int)
        view = get_device_list_view(admin, page, per_page, device_id, name, status, class_id)
        return APIResponse.success(data=view)

    @ns_devices.doc("create_device", description="创建设备", security="Bearer")
    @ns_devices.expect(device_model)
    @ns_devices.response(201, "创建成功")
    @requires_permission("device.edit")
    def post(self):
        """
        创建设备

        创建新的设备，需要管理员权限。

        请求体：
        - device_id: 设备标识（必填）
        - name: 设备名称（可选，默认"设备 {device_id}"）
        """
        data = ns_devices.payload
        device_id_raw = data.get("device_id")
        if not device_id_raw or not str(device_id_raw).strip():
            return APIResponse.bad_request(message="device_id 为必填项，不能为空")
        try:
            device_id = create_device(data)
        except ValueError as e:
            return APIResponse.bad_request(message=str(e))
        invalidate_cache("api:/api/devices/*")
        return APIResponse.created(data={"device_id": device_id}, message="设备创建成功")

@ns_devices.route("/<int:id>")
@ns_devices.param("id", "设备ID")
class DeviceResource(Resource):

    @ns_devices.doc("get_device", description="获取单个设备详情")
    @ns_devices.response(200, "成功")
    @ns_devices.response(404, "设备不存在")
    @requires_permission("device.view")
    def get(self, id):
        """
        获取单个设备详情

        根据设备ID获取设备的详细信息。
        """
        device = Device.query.get_or_404(id)
        return APIResponse.success(
            data={
                "id": device.id,
                "device_id": device.device_id,
                "name": device.name,
                "status": device.status,
                # is_online 以 last_heartbeat 时效性为准（避免无心跳却显示在线）
                "is_online": is_device_online(device),
                "last_heartbeat": (
                    device.last_heartbeat.isoformat() if device.last_heartbeat else None
                ),
                "wifi_signal": device.wifi_signal,
                "uptime": device.uptime,
                "box_a_status": device.box_a_status,
                "box_b_status": device.box_b_status,
                "system_state": device.system_state,
                "device_type": getattr(device, "device_type", None),
                "class_info_id": device.class_info_id,
                "class_name": device.class_info.name if device.class_info else None,
                "admin_id": device.admin_id,
                "admin_name": device.admin.real_name if device.admin else None,
                "admin_username": device.admin.username if device.admin else None,
                "created_at": device.created_at.isoformat() if device.created_at else None,
                "updated_at": device.updated_at.isoformat() if device.updated_at else None,
            }
        )

    @ns_devices.doc("update_device", description="更新设备", security="Bearer")
    @ns_devices.expect(device_model)
    @ns_devices.response(200, "更新成功")
    @ns_devices.response(404, "设备不存在")
    @requires_permission("device.edit")
    def put(self, id):
        """
        更新设备

        更新指定设备的信息，需要管理员权限。
        """
        device = Device.query.get_or_404(id)
        data = ns_devices.payload
        update_device(device, data)
        invalidate_cache("api:/api/devices/*")
        return APIResponse.success(message="设备更新成功")

    @ns_devices.doc("delete_device", description="删除设备", security="Bearer")
    @ns_devices.response(200, "删除成功")
    @ns_devices.response(404, "设备不存在")
    @requires_permission("device.delete")
    def delete(self, id):
        """
        删除设备

        删除指定的设备，需要管理员权限。
        """
        device = Device.query.get_or_404(id)
        delete_device(device)
        invalidate_cache("api:/api/devices/*")
        return APIResponse.success(message="设备删除成功")

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
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self, id):
        """
        获取设备心跳记录

        获取指定设备的所有心跳历史记录，支持分页。
        """
        page, per_page = get_pagination(default=50)

        device = Device.query.get_or_404(id)
        pagination = (
            DeviceHeartbeat.query.filter_by(device_id=device.device_id)
            .order_by(DeviceHeartbeat.received_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return APIResponse.success(
            data={
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
        )

@ns_devices.route("/device/<string:device_id>/heartbeats")
@ns_devices.param("device_id", "设备标识")
class DeviceHeartbeatsByDeviceId(Resource):
    @ns_devices.doc(
        "get_device_heartbeats_by_device_id",
        description="通过设备标识获取心跳记录",
        params={"page": "页码（默认1）", "per_page": "每页数量（默认50）"},
    )
    @ns_devices.response(200, "成功")
    @ns_devices.response(404, "设备不存在")
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self, device_id):
        """
        通过设备标识获取心跳记录

        使用设备标识（如 phonebox_001）获取心跳历史记录，支持分页。
        """
        page, per_page = get_pagination(default=50)

        device = Device.query.filter_by(device_id=device_id).first_or_404()
        pagination = (
            DeviceHeartbeat.query.filter_by(device_id=device.device_id)
            .order_by(DeviceHeartbeat.received_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return APIResponse.success(
            data={
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
        )

@ns_devices.route("/stats")
class DeviceStats(Resource):

    @ns_devices.doc("get_device_stats", description="获取设备统计信息")
    @ns_devices.response(200, "成功", device_stats_response)
    @requires_permission("device.view")
    @cached_api(ttl=60)
    def get(self):
        view = get_device_stats_view()
        return APIResponse.success(data=view)

@ns_devices.route("/online")
class OnlineDevices(Resource):

    @ns_devices.doc("get_online_devices", description="获取在线设备列表（分页，M9 P0）")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取在线设备列表（分页，M9 P0 / 差异 #13）。

        返回信封 {devices, total, pagination}，消除全表 dump。

        **两段式过滤（差异 #13）**：`is_online` 依赖**每行不同**的
        `heartbeat_timeout`，无法整体下推 SQL，原先实现是「全表加载 + 内存过滤」，
        设备量大时会产生 O(全表) 的 ORM 对象构造。现改为：

          ① SQL 粗筛：取全表 `heartbeat_timeout` 的**最大值**作为安全上界阈值，
             用 `ix_device_last_heartbeat` 索引把明显离线（早于上界仍超时）的行
             在数据库层剔除；
          ② 内存精算：对粗筛结果按每台设备各自的 `heartbeat_timeout` 逐台判定，
             保证结论与原先**逐条等价**（粗筛只做保守剔除，不会漏掉真在线设备）。

        响应由 cached_api 统一缓存（Redis，TTL 30s）。
        """
        page, per_page = get_pagination(default=50)

        # ① SQL 粗筛（保守上界，宁多留不漏判）
        max_timeout = (
            db.session.query(func.max(Device.heartbeat_timeout)).scalar() or 60
        )
        cutoff = datetime.now() - timedelta(seconds=int(max_timeout))
        candidates = (
            Device.query.options(joinedload(Device.class_info), joinedload(Device.admin))
            .filter(
                Device.last_heartbeat.isnot(None),
                Device.last_heartbeat >= cutoff,
                Device.status == "online",
            )
            .all()
        )

        # ② 内存精算（逐台按各自 heartbeat_timeout 判定）
        online_devices = [d for d in candidates if d.is_online]
        total = len(online_devices)
        start = (page - 1) * per_page
        page_items = online_devices[start : start + per_page]
        items = [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "status": d.status,
                "is_online": d.is_online,
                "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                "wifi_signal": d.wifi_signal,
                "class_info_id": d.class_info_id,
                "class_name": d.class_info.name if d.class_info else None,
                "admin_id": d.admin_id,
                "admin_name": d.admin.real_name if d.admin else None,
            }
            for d in page_items
        ]
        pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        return APIResponse.success(
            data={
                "devices": items,
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": pages,
            }
        )

@ns_devices.route("/<int:id>/bind-class")
@ns_devices.param("id", "设备ID")
class BindDeviceClass(Resource):

    @ns_devices.doc("bind_device_class", description="绑定设备到班级", security="Bearer")
    @ns_devices.expect(bind_class_model)
    @ns_devices.response(200, "绑定成功")
    @ns_devices.response(403, "无权绑定到该班级")
    @ns_devices.response(404, "班级不存在")
    @requires_permission("device.edit")
    def post(self, id):
        """
        绑定设备到班级

        将设备绑定到指定的班级，需要设备编辑权限。
        非管理员只能绑定到自己管理的班级。

        请求体：
        - class_id: 班级ID（设为null可解绑设备与班级的关联）
        """
        admin = get_current_admin()
        device = Device.query.get_or_404(id)
        data = request.get_json()
        class_id = data.get("class_id")

        if admin.role not in ("admin", "super_admin"):
            class_ids = get_admin_class_ids(admin.id)
            if class_id and class_id not in class_ids:
                return APIResponse.forbidden(message="无权绑定到该班级")

        if class_id:
            class_info = get_by_id(ClassInfo, class_id)
            if not class_info:
                return APIResponse.not_found(message="班级不存在")

        bind_device_class(device, class_id)
        invalidate_cache("api:/api/devices/*")

        return APIResponse.success(
            data={
                "class_info_id": device.class_info_id,
                "class_name": device.class_info.name if device.class_info else None,
            },
            message="设备绑定班级成功",
        )

@ns_devices.route("/<int:id>/bind-admin")
@ns_devices.param("id", "设备ID")
class BindDeviceAdmin(Resource):

    @ns_devices.doc("bind_device_admin", description="绑定设备到管理员", security="Bearer")
    @ns_devices.expect(bind_admin_model)
    @ns_devices.response(200, "绑定成功")
    @ns_devices.response(403, "只有超级管理员可以绑定管理员")
    @ns_devices.response(404, "管理员不存在")
    @requires_permission("device.edit")
    def post(self, id):
        """
        绑定设备到管理员

        将设备绑定到指定的管理员，只有管理员可以执行此操作。

        请求体：
        - admin_id: 管理员ID（设为null可解绑设备与管理员的关联）
        """
        admin = get_current_admin()

        if admin.role not in ("admin", "super_admin"):
            return APIResponse.forbidden(message="只有管理员可以绑定管理员")

        device = Device.query.get_or_404(id)
        data = request.get_json()
        admin_id = data.get("admin_id")

        if admin_id:
            target_admin = get_by_id(Admin, admin_id)
            if not target_admin:
                return APIResponse.not_found(message="管理员不存在")

        bind_device_admin(device, admin_id)
        invalidate_cache("api:/api/devices/*")

        return APIResponse.success(
            data={
                "admin_id": device.admin_id,
                "admin_name": device.admin.real_name if device.admin else None,
                "admin_username": device.admin.username if device.admin else None,
            },
            message="设备绑定管理员成功",
        )

@ns_devices.route("/class/<int:class_id>")
@ns_devices.param("class_id", "班级ID")
class DevicesByClass(Resource):

    @ns_devices.doc("get_devices_by_class", description="获取班级的设备列表")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self, class_id):
        """
        获取班级的设备列表

        获取绑定到指定班级的所有设备。
        """
        page, per_page = get_pagination(default=20)
        pagination = (
            Device.query.filter_by(class_info_id=class_id)
            .options(joinedload(Device.admin))
            .order_by(Device.id)
            .paginate(page=page, per_page=per_page, error_out=False)
        )
        devices = pagination.items
        return APIResponse.success(
            data=[
                {
                    "id": d.id,
                    "device_id": d.device_id,
                    "name": d.name,
                    "status": d.status,
                    "is_online": is_device_online(d),
                    "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                    "wifi_signal": d.wifi_signal,
                    "admin_name": d.admin.real_name if d.admin else None,
                    "updated_at": d.updated_at.isoformat() if d.updated_at else None,
                }
                for d in devices
            ],
            pagination={
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
            },
        )

@ns_devices.route("/admin/<int:admin_id>")
@ns_devices.param("admin_id", "管理员ID")
class DevicesByAdmin(Resource):

    @ns_devices.doc("get_devices_by_admin", description="获取管理员的设备列表")
    @ns_devices.response(200, "成功")
    @requires_permission("device.view")
    @cached_api(ttl=30)
    def get(self, admin_id):
        """
        获取管理员的设备列表

        获取绑定到指定管理员的所有设备。
        """
        page, per_page = get_pagination(default=20)
        pagination = (
            Device.query.filter_by(admin_id=admin_id)
            .options(joinedload(Device.class_info))
            .order_by(Device.id)
            .paginate(page=page, per_page=per_page, error_out=False)
        )
        devices = pagination.items
        return APIResponse.success(
            data=[
                {
                    "id": d.id,
                    "device_id": d.device_id,
                    "name": d.name,
                    "status": d.status,
                    "is_online": is_device_online(d),
                    "last_heartbeat": d.last_heartbeat.isoformat() if d.last_heartbeat else None,
                    "wifi_signal": d.wifi_signal,
                    "class_name": d.class_info.name if d.class_info else None,
                    "updated_at": d.updated_at.isoformat() if d.updated_at else None,
                }
                for d in devices
            ],
            pagination={
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
            },
        )
