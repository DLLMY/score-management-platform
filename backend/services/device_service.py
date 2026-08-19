"""devices 防腐层 service（F17 路由服务化）。

收口设备域（Device + DeviceGroup）的写入/事务路径 db.session 操作，路由仅保留：
- get_or_404 / get_by_id（404 语义）
- 请求级校验与权限隔离（如 bind_class 的 403、bind_admin 的 403/404）
- 跨切面副作用（MQTT 下发等，设备域本批写入端点无 DB 外副作用）
- 响应构造

所有写入遵循 F17 铁律：逐字节复刻响应体/状态码/错误信息，只读 query 暂缓不动。
本文件与原始 devices_routes / device_group_routes 内的事务逻辑一一对应，行为完全等价。
"""

import openpyxl
from datetime import datetime

from models import (
    db,
    Device,
    DeviceGroup,
    DeviceGroupMapping,
    ClassInfo,
    Admin,
    ScoreRecord,
    get_by_id,
)
from utils.validation import validate_device_id, validate_name

# ============ Device 实体事务 ============


def create_device(data):
    """创建设备并落库。返回新设备 id。

    校验（device_id 非空）由路由负责，service 只做写入。name 缺省按原始逻辑回退为
    '设备 {device_id}'（device_id 为 None 时为 '设备 None'，与原实现一致）。
    """
    device = Device(
        device_id=data.get("device_id"),
        name=data.get("name", f'设备 {data.get("device_id")}'),
    )
    db.session.add(device)
    db.session.commit()
    return device.id


def update_device(device, data):
    """更新设备名称并提交。"""
    device.name = data.get("name", device.name)
    device.updated_at = datetime.now()
    db.session.commit()
    return None


def delete_device(device):
    """删除设备并提交。"""
    db.session.delete(device)
    db.session.commit()
    return None


def bind_device_class(device, class_info_id):
    """绑定/解绑设备到班级（class_info_id 可能为 None 表示解绑）。

    班级存在性校验与权限隔离（403）由路由负责，service 只做字段写入与提交。
    """
    device.class_info_id = class_info_id
    device.updated_at = datetime.now()
    db.session.commit()
    return None


def bind_device_admin(device, admin_id):
    """绑定/解绑设备到管理员（admin_id 可能为 None 表示解绑）。

    管理员存在性校验与权限隔离（403）由路由负责，service 只做字段写入与提交。
    """
    device.admin_id = admin_id
    device.updated_at = datetime.now()
    db.session.commit()
    return None


def resolve_device_alert(alert):
    """将告警标记为已解决（is_resolved=True + resolved_at）并提交。"""
    alert.is_resolved = True
    alert.resolved_at = datetime.now()
    db.session.commit()
    return None


def update_device_settings(device, data):
    """更新设备设置（alert_enabled / heartbeat_timeout / name）并提交。

    返回 settings dict 供路由复刻响应体。
    """
    if "alert_enabled" in data:
        device.alert_enabled = data["alert_enabled"]
    if "heartbeat_timeout" in data:
        device.heartbeat_timeout = data["heartbeat_timeout"]
    if "name" in data:
        device.name = data["name"]

    device.updated_at = datetime.now()
    db.session.commit()
    return {
        "alert_enabled": device.alert_enabled,
        "heartbeat_timeout": device.heartbeat_timeout,
        "name": device.name,
    }


def import_devices(file):
    """批量导入设备（Excel）的事务核心。

    入参 file 为 Flask request.files 中的文件对象。返回与原始路由一致的响应 data dict：
        {"success": bool, "total": int, "success_count": int, "failed_count": int, "messages": list}

    致命错误（文件损坏等）向上抛出，由路由外层 try/except 做 rollback + server_error，
    与原始实现一致。逐行异常在循环内捕获并计入 failed（不阻断其余行）。
    """
    wb = openpyxl.load_workbook(file)
    sheet = wb.active

    success_count = 0
    failed_count = 0
    messages = []

    headers = [cell.value for cell in sheet[1]]

    # M7：预扫描收集查询键（strip 后去重、跳过空值），把逐行 N+1 查询改为批量预取
    all_rows = list(sheet.iter_rows(min_row=2, values_only=True))

    device_ids = set()
    class_names = set()
    admin_names = set()
    for row in all_rows:
        row_dict = dict(zip(headers, row))
        raw_device_id = (
            row_dict.get("设备标识") or row_dict.get("device_id") or row_dict.get("设备ID")
        )
        if raw_device_id is not None and str(raw_device_id).strip():
            device_ids.add(str(raw_device_id).strip())
        raw_class_name = row_dict.get("班级名称") or row_dict.get("class_name")
        if raw_class_name and str(raw_class_name).strip():
            class_names.add(str(raw_class_name).strip())
        raw_admin_name = row_dict.get("管理员姓名") or row_dict.get("admin_name")
        if raw_admin_name and str(raw_admin_name).strip():
            admin_names.add(str(raw_admin_name).strip())

    # 批量预查询三个 map（admin 先 real_name 后 username 兜底，setdefault 保证 real_name 优先）
    device_map = {}
    if device_ids:
        device_map = {
            d.device_id: d
            for d in Device.query.filter(Device.device_id.in_(device_ids)).all()
        }

    class_map = {}
    if class_names:
        class_map = {
            c.name: c for c in ClassInfo.query.filter(ClassInfo.name.in_(class_names)).all()
        }

    admin_map = {}
    if admin_names:
        admins = Admin.query.filter(Admin.real_name.in_(admin_names)).all()
        admin_map = {a.real_name: a for a in admins}
        remaining = [n for n in admin_names if n not in admin_map]
        if remaining:
            for a in Admin.query.filter(Admin.username.in_(remaining)).all():
                admin_map.setdefault(a.username, a)

    for row in all_rows:
        try:
            row_dict = dict(zip(headers, row))

            device_id = (
                row_dict.get("设备标识") or row_dict.get("device_id") or row_dict.get("设备ID")
            )
            name = row_dict.get("设备名称") or row_dict.get("name")
            class_name = row_dict.get("班级名称") or row_dict.get("class_name")
            admin_name = row_dict.get("管理员姓名") or row_dict.get("admin_name")

            row_errors = []

            if not device_id:
                row_errors.append({"field": "device_id", "message": "设备标识不能为空"})
            elif not isinstance(device_id, (int, str)) or len(str(device_id).strip()) == 0:
                row_errors.append({"field": "device_id", "message": "设备标识格式无效"})
            elif len(str(device_id).strip()) > 100:
                row_errors.append(
                    {"field": "device_id", "message": "设备标识长度超过限制（最大100字符）"}
                )
            else:
                device_id_str = str(device_id).strip()
                is_valid, msg = validate_device_id(device_id_str)
                if not is_valid:
                    row_errors.append({"field": "device_id", "message": msg})

            if name and (not isinstance(name, str) or len(name.strip()) > 200):
                row_errors.append(
                    {"field": "name", "message": "设备名称长度超过限制（最大200字符）"}
                )
            elif name:
                is_valid, msg = validate_name(name.strip())
                if not is_valid:
                    row_errors.append({"field": "name", "message": msg})

            existing_device = device_map.get(str(device_id))
            if existing_device:
                row_errors.append(
                    {"field": "device_id", "message": f'设备 "{str(device_id)}" 已存在'}
                )

            class_info = None
            if class_name:
                if not isinstance(class_name, str) or len(class_name.strip()) == 0:
                    row_errors.append(
                        {"field": "class_name", "message": "班级名称格式无效，必须为非空字符串"}
                    )
                elif len(class_name.strip()) > 100:
                    row_errors.append(
                        {"field": "class_name", "message": "班级名称长度超过限制（最大100字符）"}
                    )
                else:
                    class_info = class_map.get(class_name.strip())
                    if not class_info:
                        row_errors.append(
                            {
                                "field": "class_name",
                                "message": f'班级 "{class_name}" 在系统中不存在',
                            }
                        )

            admin = None
            if admin_name:
                if not isinstance(admin_name, str) or len(admin_name.strip()) == 0:
                    row_errors.append(
                        {"field": "admin_name", "message": "管理员姓名格式无效，必须为非空字符串"}
                    )
                elif len(admin_name.strip()) > 50:
                    row_errors.append(
                        {"field": "admin_name", "message": "管理员姓名长度超过限制（最大50字符）"}
                    )
                else:
                    admin = admin_map.get(admin_name.strip())
                    if not admin:
                        row_errors.append(
                            {
                                "field": "admin_name",
                                "message": f'管理员 "{admin_name}" 在系统中不存在',
                            }
                        )
                    else:
                        if admin.role not in ["admin", "teacher"]:
                            row_errors.append(
                                {
                                    "field": "admin_name",
                                    "message": f'用户 "{admin_name}" 的角色不是管理员或教师，无法担任设备管理员',
                                }
                            )

            if row_errors:
                failed_count += 1
                messages.append(
                    {
                        "action": "失败",
                        "message": "; ".join(
                            [f'{err["field"]}: {err["message"]}' for err in row_errors]
                        ),
                        "row_data": row_dict,
                        "error_fields": [err["field"] for err in row_errors],
                    }
                )
                continue

            new_device = Device(
                device_id=str(device_id),
                name=name or str(device_id),
                class_info_id=class_info.id if class_info else None,
                admin_id=admin.id if admin else None,
                status="offline",
            )

            db.session.add(new_device)
            success_count += 1
            messages.append(
                {"action": "成功", "message": f"创建设备 {str(device_id)}", "row_data": row_dict}
            )

        except Exception as e:
            failed_count += 1
            messages.append(
                {
                    "action": "失败",
                    "message": str(e),
                    "row_data": dict(zip(headers, row)) if row else None,
                    "error_fields": ["system"],
                }
            )

    db.session.commit()

    return {
        "success": True,
        "total": success_count + failed_count,
        "success_count": success_count,
        "failed_count": failed_count,
        "messages": messages,
    }


# ============ 积分盒子 / WOL 写入事务（devices 子批2，F17） ============


def box_add_score(user, rule):
    """积分盒子刷卡：为用户累加规则积分并落库 ScoreRecord。

    前置校验链路（用户存在、设备在线、规则启用、规则归属权限、每日/间隔限速）
    由路由 box_routes.BoxVerify.post 负责，service 只做积分累加 + 明细写入 + 提交。
    返回更新后的 current_score 供路由复刻响应体。
    """
    user.current_score += rule.score
    record = ScoreRecord(
        student_id=user.id,
        rule_id=rule.id,
        score_change=rule.score,
        description=rule.description,
    )
    db.session.add(record)
    db.session.commit()
    return user.current_score


def create_wol_device(data):
    """创建 WOL 设备并落库。返回新设备 ORM 实体（供路由 marshal_with 序列化 + 返回元组）。

    前置校验（name 非空、MAC 格式、MAC 唯一性）由路由负责，service 只做字段写入与提交。
    data 中的 mac_address 已由路由统一大小写并校验（"AA:BB:CC:DD:EE:FF" 形态）。
    """
    mac_address = data.get("mac_address")
    device = Device(
        device_id=f"wol-{mac_address}",
        name=data.get("name", "").strip(),
        device_type="wol",
        mac_address=mac_address,
        broadcast_ip=data.get("broadcast_ip", "255.255.255.255"),
        wol_port=data.get("port", 9),
        wol_description=data.get("description", ""),
        wake_on_lan_enabled=True,
        wake_count=0,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.session.add(device)
    db.session.commit()
    return device


def update_wol_device(device, data):
    """更新 WOL 设备字段并提交。

    MAC 格式校验与唯一性校验（返回 400/409）由路由负责，service 仅应用已通过校验的字段。
    mac_address 由路由传入已统一的 "AA:BB:CC:DD:EE:FF" 形态，此处幂等规范化一次。
    """
    if "name" in data:
        device.name = data["name"].strip()
    if "mac_address" in data:
        device.mac_address = data["mac_address"].strip().upper().replace("-", ":")
    if "broadcast_ip" in data:
        device.broadcast_ip = data["broadcast_ip"]
    if "port" in data:
        device.wol_port = data["port"]
    if "description" in data:
        device.wol_description = data["description"]
    if "is_active" in data:
        device.is_active = data["is_active"]
    device.updated_at = datetime.now()
    db.session.commit()
    return device


def delete_wol_device(device):
    """软删除 WOL 设备（is_active=False）并提交。"""
    device.is_active = False
    device.updated_at = datetime.now()
    db.session.commit()
    return None


# ============ DeviceGroup 实体事务 ============


def create_device_group(data):
    """创建设备分组并落库。返回新分组 ORM 实体（供路由 to_dict）。

    前置校验（name 非空 + 名称不重复）由路由负责，service 只做写入。
    """
    group = DeviceGroup(
        name=data["name"].strip(),
        description=data.get("description", ""),
        location=data.get("location", ""),
        icon=data.get("icon", "Layers"),
        color=data.get("color", "#3B82F6"),
        sort_order=data.get("sort_order", 0),
        is_active=data.get("is_active", True),
    )
    db.session.add(group)
    db.session.commit()
    return group


def update_device_group(group, data):
    """更新设备分组字段并提交。

    名称重复校验（返回 400）由路由负责；本函数仅应用已通过校验的字段。
    """
    if "name" in data and data["name"].strip():
        group.name = data["name"].strip()
    if "description" in data:
        group.description = data["description"]
    if "location" in data:
        group.location = data["location"]
    if "icon" in data:
        group.icon = data["icon"]
    if "color" in data:
        group.color = data["color"]
    if "sort_order" in data:
        group.sort_order = data["sort_order"]
    if "is_active" in data:
        group.is_active = data["is_active"]

    group.updated_at = datetime.now()
    db.session.commit()
    return None


def delete_device_group(group):
    """删除分组并清理其映射记录，统一提交。"""
    DeviceGroupMapping.query.filter_by(group_id=group.id).delete()
    db.session.delete(group)
    db.session.commit()
    return None


def add_devices_to_group(group_id, device_ids):
    """批量添加设备到分组的事务核心。返回 {added, failed} 与原始路由一致。

    设备存在性 / 是否已在该组 的校验（产生 failed 列表项）随事务一并处理，
    逐条写映射后统一提交并刷新 group.device_count。
    """
    added = []
    failed = []

    for device_id in device_ids:
        device = Device.query.filter_by(device_id=str(device_id)).first()
        if not device:
            failed.append({"device_id": device_id, "reason": "设备不存在"})
            continue

        # 检查是否已存在
        existing = DeviceGroupMapping.query.filter_by(
            group_id=group_id, device_id=device_id
        ).first()
        if existing:
            failed.append({"device_id": device_id, "reason": "设备已在分组中"})
            continue

        mapping = DeviceGroupMapping(group_id=group_id, device_id=device_id)
        db.session.add(mapping)
        added.append(device_id)

    db.session.commit()

    # 更新设备计数
    group = get_by_id(DeviceGroup, group_id)
    if group:
        group.device_count = DeviceGroupMapping.query.filter_by(group_id=group_id).count()
        db.session.commit()

    return {"added": added, "failed": failed}


def remove_device_from_group(group_id, device_id):
    """从分组移除单台设备的映射并更新计数。

    返回 False 表示映射不存在（路由据此返回 404），否则返回 True。
    """
    mapping = DeviceGroupMapping.query.filter_by(group_id=group_id, device_id=device_id).first()

    if not mapping:
        return False

    db.session.delete(mapping)
    db.session.commit()

    # 更新设备计数
    group = get_by_id(DeviceGroup, group_id)
    if group:
        group.device_count = DeviceGroupMapping.query.filter_by(group_id=group_id).count()
        db.session.commit()

    return True
