"""firmware 防腐层 service（F17 路由服务化，devices 子批3）。

收口固件域（FirmwareVersion / DeviceFirmwareUpdate / OTA 上报与下发记录）的
写入/事务路径 db.session 操作。路由仅保留：
- get_or_404（404 语义）
- 请求级校验（version 必填/唯一、文件类型、is_active 守卫等）
- 文件 I/O（save / MD5 计算 / 文件删除）——非 db.session，留路由
- MQTT 下发等跨切面副作用（batch-upgrade / ota-upgrade）
- 响应构造

逐字节复刻原始 firmware_routes 内的事务逻辑与响应；只读 query 暂缓不动。
OperationLog 写入与原始实现一致并入同一事务单元（原实现固件与 log 分两次 commit）。

迁移中就地修复两处 upload 写路径 500 缺陷（测试先行暴露，见 test_upload_success_with_real_md5）：
- 原日志描述引用未定义变量 sha256 → NameError → 500；改 md5_hex（真 MD5，32 位）。
- 原响应体 "md5": md5 误用 hashlib.md5 模块对象；改 md5_hex（真值）。
均属写路径缺陷修复，未改动任何契约语义。
"""

from datetime import datetime

from models import db, OperationLog, FirmwareVersion, DeviceFirmwareUpdate


def create_firmware_version(data, created_by=None):
    """创建固件版本记录并落库 + 写操作日志。返回新建 id。

    version 必填校验、version 唯一性校验（返回 400）由路由负责，service 只做写入。
    """
    firmware = FirmwareVersion(
        version=data.get("version"),
        description=data.get("description"),
        file_path=data.get("file_path"),
        file_size=data.get("file_size"),
        md5=data.get("md5"),
        min_compatible_version=data.get("min_compatible_version"),
        is_mandatory=data.get("is_mandatory", False),
        is_active=data.get("is_active", True),
        created_by=created_by,
    )
    db.session.add(firmware)
    db.session.commit()

    log = OperationLog(
        operation_type="firmware_create",
        target_type="firmware",
        target_id=firmware.id,
        operator="Admin",
        description=f"Created firmware version: {firmware.version}",
    )
    db.session.add(log)
    db.session.commit()
    return firmware.id


def update_firmware_version(firmware, data):
    """更新固件版本字段（description / is_mandatory / is_active）并提交。"""
    if "description" in data:
        firmware.description = data["description"]
    if "is_mandatory" in data:
        firmware.is_mandatory = data["is_mandatory"]
    if "is_active" in data:
        firmware.is_active = data["is_active"]
    db.session.commit()
    return None


def delete_firmware_version(firmware):
    """删除固件版本记录并提交（文件删除由路由负责，仅落库）。"""
    db.session.delete(firmware)
    db.session.commit()
    return None


def report_ota_status(
    status, device_id, device_name=None, from_version=None, to_version=None, error_message=None
):
    """处理 OTA 上报（started / completed / failed）的事务逻辑。

    入参已从请求解析；device_id / status 非空校验由路由负责。
    started: 新建 in_progress 记录并提交。
    completed / failed: 定位最近 in_progress 记录并更新状态，再写操作日志并提交。
    未知 status: 无操作（路由据此返回通用 success）。
    """
    if status == "started":
        update_record = DeviceFirmwareUpdate(
            device_id=device_id,
            device_name=device_name,
            from_version=from_version,
            to_version=to_version,
            status="in_progress",
            started_at=datetime.now(),
        )
        db.session.add(update_record)
        db.session.commit()
        return

    if status == "completed":
        update_record = (
            DeviceFirmwareUpdate.query.filter_by(
                device_id=device_id, to_version=to_version, status="in_progress"
            )
            .order_by(DeviceFirmwareUpdate.started_at.desc())
            .first()
        )
        if update_record:
            update_record.status = "completed"
            update_record.completed_at = datetime.now()
            db.session.commit()

        log = OperationLog(
            operation_type="firmware_upgrade",
            target_type="device",
            target_id=device_id,
            operator="OTA System",
            description=f"Device {device_name} firmware upgrade successful: {from_version} -> {to_version}",
        )
        db.session.add(log)
        db.session.commit()
        return

    if status == "failed":
        update_record = (
            DeviceFirmwareUpdate.query.filter_by(
                device_id=device_id, to_version=to_version, status="in_progress"
            )
            .order_by(DeviceFirmwareUpdate.started_at.desc())
            .first()
        )
        if update_record:
            update_record.status = "failed"
            update_record.completed_at = datetime.now()
            update_record.error_message = error_message
            db.session.commit()

        log = OperationLog(
            operation_type="firmware_upgrade",
            target_type="device",
            target_id=device_id,
            operator="OTA System",
            description=(
                f"Device {device_name} firmware upgrade failed: "
                f"{from_version} -> {to_version}, error: {error_message}"
            ),
        )
        db.session.add(log)
        db.session.commit()
        return


def create_uploaded_firmware(
    version,
    description,
    file_path,
    file_size,
    md5_hex,
    min_compatible_version,
    is_mandatory,
    created_by=None,
):
    """上传固件：创建 FirmwareVersion 记录并落库 + 写操作日志。返回新建 id。

    文件保存 / MD5 计算 / 扩展名校验由路由负责，service 只做落库。
    md5_hex 为调用方已计算的真实 MD5（32 位），同时写入响应与日志（修复原 sha256 缺陷）。
    """
    firmware = FirmwareVersion(
        version=version,
        description=description,
        file_path=file_path,
        file_size=file_size,
        md5=md5_hex,
        min_compatible_version=min_compatible_version,
        is_mandatory=is_mandatory,
        is_active=True,
        created_by=created_by,
    )
    db.session.add(firmware)
    db.session.commit()

    log = OperationLog(
        operation_type="firmware_upload",
        target_type="firmware",
        target_id=firmware.id,
        operator="Admin",
        description=f"Uploaded firmware: {version} ({file_size} bytes, MD5: {md5_hex})",
    )
    db.session.add(log)
    db.session.commit()
    return firmware.id


def log_batch_upgrade(firmware_id, device_count, target_version):
    """批量升级：写操作日志（MQTT 下发由路由负责）。"""
    log = OperationLog(
        operation_type="firmware_batch_upgrade",
        target_type="firmware",
        target_id=firmware_id,
        operator="Admin",
        description=f"Batch upgrade firmware: {device_count} devices -> {target_version}",
    )
    db.session.add(log)
    db.session.commit()
    return None


def log_ota_upgrade(firmware_id, device_count, version):
    """指定固件 OTA 升级：写操作日志（MQTT 下发由路由负责）。"""
    log = OperationLog(
        operation_type="firmware_ota_upgrade",
        target_type="firmware",
        target_id=firmware_id,
        operator="Admin",
        description=f"OTA upgrade firmware: {device_count} devices -> {version}",
    )
    db.session.add(log)
    db.session.commit()
    return None
