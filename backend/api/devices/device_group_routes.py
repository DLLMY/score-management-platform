from flask import request
from flask_restx import Namespace, Resource, fields
from models import DeviceGroup, DeviceGroupMapping, Device, get_by_id
from utils.permission import requires_permission
from utils.response import APIResponse
from services.device_service import (
    create_device_group,
    update_device_group,
    delete_device_group,
    add_devices_to_group,
    remove_device_from_group,
)

# -*- coding: utf-8 -*-
"""
设备分组管理路由
"""


ns_device_group = Namespace("device-group", description="设备分组管理")

# ========== API Models ==========
device_group_model = ns_device_group.model(
    "DeviceGroup",
    {
        "id": fields.Integer(readOnly=True, description="分组ID"),
        "name": fields.String(required=True, description="分组名称"),
        "description": fields.String(description="分组描述"),
        "location": fields.String(description="位置"),
        "icon": fields.String(description="图标名称"),
        "color": fields.String(description="颜色"),
        "sort_order": fields.Integer(description="排序"),
        "is_active": fields.Boolean(description="是否启用"),
        "device_count": fields.Integer(description="设备数量"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

device_group_create_model = ns_device_group.model(
    "DeviceGroupCreate",
    {
        "name": fields.String(required=True, description="分组名称"),
        "description": fields.String(description="分组描述"),
        "location": fields.String(description="位置"),
        "icon": fields.String(description="图标名称"),
        "color": fields.String(description="颜色"),
        "sort_order": fields.Integer(description="排序"),
    },
)

device_in_group_model = ns_device_group.model(
    "DeviceInGroup",
    {
        "id": fields.Integer(description="映射ID"),
        "device_id": fields.String(description="设备ID（device.device_id 业务键）"),
        "device": fields.Raw(description="设备信息"),
        "added_at": fields.String(description="添加时间"),
    },
)

device_group_detail_model = ns_device_group.model(
    "DeviceGroupDetail",
    {
        "id": fields.Integer(readOnly=True, description="分组ID"),
        "name": fields.String(required=True, description="分组名称"),
        "description": fields.String(description="分组描述"),
        "location": fields.String(description="位置"),
        "icon": fields.String(description="图标名称"),
        "color": fields.String(description="颜色"),
        "sort_order": fields.Integer(description="排序"),
        "is_active": fields.Boolean(description="是否启用"),
        "device_count": fields.Integer(description="设备数量"),
        "devices": fields.List(fields.Raw(description="设备信息")),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)
# ========== Routes ==========


@ns_device_group.route("/")
class DeviceGroupList(Resource):
    """设备分组列表"""

    @ns_device_group.doc("list_device_groups", description="获取设备分组列表", security="Bearer")
    @ns_device_group.response(200, "成功", [device_group_model])
    @requires_permission("device.view")
    def get(self):
        """获取设备分组列表"""
        # 获取查询参数
        is_active = request.args.get("is_active")

        # 构建查询
        query = DeviceGroup.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == "true")

        # 按排序和名称排序
        groups = query.order_by(DeviceGroup.sort_order.asc(), DeviceGroup.name.asc()).all()

        return APIResponse.success(data=[g.to_dict() for g in groups])

    @ns_device_group.doc("create_device_group", description="创建设备分组", security="Bearer")
    @ns_device_group.response(201, "创建成功", device_group_model)
    @ns_device_group.response(400, "参数错误")
    @ns_device_group.expect(device_group_create_model)
    @requires_permission("device.manage")
    def post(self):
        """创建设备分组"""
        data = request.get_json()

        if not data:
            return APIResponse.bad_request(message="请求数据不能为空")

        # 验证必填字段
        if "name" not in data or not data["name"].strip():
            return APIResponse.bad_request(message="分组名称不能为空")

        name = data["name"].strip()

        # 检查名称是否重复
        existing = DeviceGroup.query.filter_by(name=name).first()
        if existing:
            return APIResponse.bad_request(message="分组名称已存在")

        # 创建分组
        group = create_device_group(data)
        return APIResponse.success(data=group.to_dict(), message="创建成功", status_code=201)


@ns_device_group.route("/<int:group_id>")
class DeviceGroupItem(Resource):
    """单个设备分组操作"""

    @ns_device_group.doc("get_device_group", description="获取设备分组详情", security="Bearer")
    @ns_device_group.response(200, "成功", device_group_detail_model)
    @ns_device_group.response(404, "分组不存在")
    @requires_permission("device.view")
    def get(self, group_id):
        """获取设备分组详情"""
        group = get_by_id(DeviceGroup, group_id)
        if not group:
            return APIResponse.not_found(message="设备分组不存在")

        result = group.to_dict()  # noqa: F841
        result["devices"] = [m.to_dict() for m in group.devices]
        return APIResponse.success(data=result)

    @ns_device_group.doc("update_device_group", description="更新设备分组", security="Bearer")
    @ns_device_group.response(200, "更新成功", device_group_model)
    @ns_device_group.response(400, "参数错误")
    @ns_device_group.response(404, "分组不存在")
    @ns_device_group.expect(device_group_create_model)
    @requires_permission("device.manage")
    def put(self, group_id):
        """更新设备分组"""
        group = get_by_id(DeviceGroup, group_id)
        if not group:
            return APIResponse.not_found(message="设备分组不存在")

        data = request.get_json()
        if not data:
            return APIResponse.bad_request(message="请求数据不能为空")

        # 检查名称是否重复（排除自己）
        if "name" in data and data["name"].strip():
            name = data["name"].strip()
            if name != group.name:
                existing = DeviceGroup.query.filter_by(name=name).first()
                if existing:
                    return APIResponse.bad_request(message="分组名称已存在")

        update_device_group(group, data)
        return APIResponse.success(data=group.to_dict(), message="更新成功")

    @ns_device_group.doc("delete_device_group", description="删除设备分组", security="Bearer")
    @ns_device_group.response(200, "删除成功")
    @ns_device_group.response(404, "分组不存在")
    @requires_permission("device.manage")
    def delete(self, group_id):
        """删除设备分组"""
        group = get_by_id(DeviceGroup, group_id)
        if not group:
            return APIResponse.not_found(message="设备分组不存在")

        delete_device_group(group)

        return APIResponse.success(message="删除成功")


@ns_device_group.route("/<int:group_id>/devices")
class DeviceGroupDevices(Resource):
    """设备分组内的设备管理"""

    @ns_device_group.doc("get_group_devices", description="获取分组内的设备列表", security="Bearer")
    @ns_device_group.response(200, "成功", [device_in_group_model])
    @ns_device_group.response(404, "分组不存在")
    @requires_permission("device.view")
    def get(self, group_id):
        """获取分组内的设备列表"""
        group = get_by_id(DeviceGroup, group_id)
        if not group:
            return APIResponse.not_found(message="设备分组不存在")

        mappings = DeviceGroupMapping.query.filter_by(group_id=group_id).all()
        return APIResponse.success(data=[m.to_dict() for m in mappings])

    @ns_device_group.doc("add_device_to_group", description="添加设备到分组", security="Bearer")
    @ns_device_group.response(201, "添加成功")
    @ns_device_group.response(400, "参数错误")
    @ns_device_group.response(404, "分组或设备不存在")
    @requires_permission("device.manage")
    def post(self, group_id):
        """添加设备到分组"""
        group = get_by_id(DeviceGroup, group_id)
        if not group:
            return APIResponse.not_found(message="设备分组不存在")

        data = request.get_json()
        if not data or "device_ids" not in data:
            return APIResponse.bad_request(message="请提供设备ID列表")

        device_ids = data["device_ids"]
        if not isinstance(device_ids, list):
            return APIResponse.bad_request(message="device_ids必须是数组")

        result = add_devices_to_group(group_id, device_ids)
        return APIResponse.success(
            data=result, message=f"成功添加 {len(result['added'])} 个设备", status_code=201
        )


@ns_device_group.route("/<int:group_id>/devices/<string:device_id>")
class DeviceGroupDeviceItem(Resource):
    """分组内单个设备操作"""

    @ns_device_group.doc("remove_device_from_group", description="从分组中移除设备", security="Bearer")
    @ns_device_group.response(200, "移除成功")
    @ns_device_group.response(404, "映射不存在")
    @requires_permission("device.manage")
    def delete(self, group_id, device_id):
        """从分组中移除设备"""
        ok = remove_device_from_group(group_id, device_id)
        if not ok:
            return APIResponse.not_found(message="设备不在该分组中")

        return APIResponse.success(message="移除成功")


@ns_device_group.route("/stats")
class DeviceGroupStats(Resource):
    """设备分组统计"""

    @ns_device_group.doc("get_device_group_stats", description="获取设备分组统计信息", security="Bearer")
    @ns_device_group.response(200, "成功")
    @requires_permission("device.view")
    def get(self):
        """获取设备分组统计"""
        total_groups = DeviceGroup.query.count()
        active_groups = DeviceGroup.query.filter_by(is_active=True).count()
        total_mappings = DeviceGroupMapping.query.count()

        # 获取每个分组的设备数量
        group_stats = []
        groups = DeviceGroup.query.all()
        for group in groups:
            stats = group.to_dict()
            stats["actual_device_count"] = DeviceGroupMapping.query.filter_by(group_id=group.id).count()
            group_stats.append(stats)

        return APIResponse.success(
            data={
                "total_groups": total_groups,
                "active_groups": active_groups,
                "total_mappings": total_mappings,
                "groups": group_stats,
            }
        )


@ns_device_group.route("/device/<string:device_id>/groups")
class DeviceGroups(Resource):
    """设备所属的分组"""

    @ns_device_group.doc("get_device_groups", description="获取设备所属的分组列表", security="Bearer")
    @ns_device_group.response(200, "成功", [device_group_model])
    @ns_device_group.response(404, "设备不存在")
    @requires_permission("device.view")
    def get(self, device_id):
        """获取设备所属的分组"""
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return APIResponse.not_found(message="设备不存在")

        mappings = DeviceGroupMapping.query.filter_by(device_id=device_id).all()
        groups = []
        for mapping in mappings:
            group = get_by_id(DeviceGroup, mapping.group_id)
            if group:
                group_data = group.to_dict()
                group_data["mapping_id"] = mapping.id
                group_data["added_at"] = (
                    mapping.created_at.strftime("%Y-%m-%d %H:%M:%S") if mapping.created_at else None
                )
                groups.append(group_data)

        return APIResponse.success(data=groups)


@ns_device_group.route("/options")
class DeviceGroupOptions(Resource):
    """设备分组选项（用于下拉选择）"""

    @ns_device_group.doc("get_device_group_options", description="获取设备分组选项列表", security="Bearer")
    @ns_device_group.response(200, "成功")
    @requires_permission("device.view")
    def get(self):
        """获取分组选项"""
        groups = DeviceGroup.query.filter_by(is_active=True).order_by(DeviceGroup.sort_order.asc()).all()

        return APIResponse.success(
            data=[
                {
                    "id": g.id,
                    "name": g.name,
                    "location": g.location,
                    "device_count": DeviceGroupMapping.query.filter_by(group_id=g.id).count(),
                }
                for g in groups
            ]
        )
