from flask import request, send_file
from flask_restx import Namespace, Resource, fields
from models import db, OperationLog, FirmwareVersion, DeviceFirmwareUpdate
from datetime import datetime
from utils.permission import requires_admin
from werkzeug.utils import secure_filename
import os
import hashlib
import time

ns_firmware = Namespace("firmware", description="固件管理相关操作")

firmware_version_model = ns_firmware.model(
    "FirmwareVersion",
    {
        "version": fields.String(required=True, description="固件版本号"),
        "description": fields.String(description="版本描述"),
        "file_path": fields.String(description="固件文件路径"),
        "file_size": fields.Integer(description="文件大小(字节)"),
        "md5": fields.String(description="MD5校验值"),
        "min_compatible_version": fields.String(description="最低兼容版本"),
        "is_mandatory": fields.Boolean(description="是否强制更新"),
        "is_active": fields.Boolean(description="是否启用"),
    },
)


@ns_firmware.route("/versions")
class FirmwareVersions(Resource):
    @ns_firmware.doc("list_firmware_versions", description="获取固件版本列表")
    @ns_firmware.param("is_active", "是否启用")
    @ns_firmware.response(200, "成功")
    @requires_admin
    def get(self):
        """
        获取固件版本列表

        返回所有已上传的固件版本信息。
        """
        is_active = request.args.get("is_active")

        query = FirmwareVersion.query

        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == "true")

        versions = query.order_by(FirmwareVersion.created_at.desc()).all()

        return {
            "versions": [
                {
                    "id": v.id,
                    "version": v.version,
                    "description": v.description,
                    "file_size": v.file_size,
                    "md5": v.md5,
                    "min_compatible_version": v.min_compatible_version,
                    "is_mandatory": v.is_mandatory,
                    "is_active": v.is_active,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in versions
            ],
            "total": len(versions),
        }

    @ns_firmware.doc("create_firmware_version", description="创建固件版本记录")
    @ns_firmware.expect(firmware_version_model)
    @ns_firmware.response(201, "创建成功")
    @requires_admin
    def post(self):
        """
        创建固件版本记录

        记录新上传的固件版本信息。
        """
        data = request.get_json()

        existing = FirmwareVersion.query.filter_by(version=data["version"]).first()
        if existing:
            return {"success": False, "message": "该版本号已存在"}, 400

        firmware = FirmwareVersion(
            version=data["version"],
            description=data.get("description"),
            file_path=data.get("file_path"),
            file_size=data.get("file_size"),
            md5=data.get("md5"),
            min_compatible_version=data.get("min_compatible_version"),
            is_mandatory=data.get("is_mandatory", False),
            is_active=data.get("is_active", True),
            created_by=getattr(request, "admin_id", None),
        )

        db.session.add(firmware)
        db.session.commit()

        log = OperationLog(
            operation_type="firmware_create",
            target_type="firmware",
            target_id=firmware.id,
            operator="Admin",
            description=f"创建固件版本: {firmware.version}",
        )
        db.session.add(log)
        db.session.commit()

        return {"success": True, "message": "固件版本已创建", "id": firmware.id}, 201


@ns_firmware.route("/versions/<int:id>")
@ns_firmware.param("id", "固件ID")
class FirmwareVersionItem(Resource):
    @ns_firmware.doc("get_firmware_version", description="获取固件版本详情")
    @ns_firmware.response(200, "成功")
    @ns_firmware.response(404, "不存在")
    @requires_admin
    def get(self, id):
        """
        获取固件版本详情
        """
        firmware = FirmwareVersion.query.get_or_404(id)

        return {
            "id": firmware.id,
            "version": firmware.version,
            "description": firmware.description,
            "file_path": firmware.file_path,
            "file_size": firmware.file_size,
            "md5": firmware.md5,
            "min_compatible_version": firmware.min_compatible_version,
            "is_mandatory": firmware.is_mandatory,
            "is_active": firmware.is_active,
            "created_at": firmware.created_at.isoformat() if firmware.created_at else None,
        }

    @ns_firmware.doc("update_firmware_version", description="更新固件版本")
    @ns_firmware.expect(firmware_version_model)
    @ns_firmware.response(200, "成功")
    @requires_admin
    def put(self, id):
        """
        更新固件版本信息
        """
        firmware = FirmwareVersion.query.get_or_404(id)
        data = request.get_json()

        if "description" in data:
            firmware.description = data["description"]
        if "is_mandatory" in data:
            firmware.is_mandatory = data["is_mandatory"]
        if "is_active" in data:
            firmware.is_active = data["is_active"]

        db.session.commit()

        return {"success": True, "message": "固件版本已更新"}

    @ns_firmware.doc("delete_firmware_version", description="删除固件版本")
    @ns_firmware.response(200, "成功")
    @ns_firmware.response(404, "不存在")
    @requires_admin
    def delete(self, id):
        """
        删除固件版本

        只允许删除未激活的版本。
        """
        firmware = FirmwareVersion.query.get_or_404(id)

        if firmware.is_active:
            return {"success": False, "message": "无法删除已激活的版本"}, 400

        if firmware.file_path and os.path.exists(firmware.file_path):
            try:
                os.remove(firmware.file_path)
            except Exception:
                pass

        db.session.delete(firmware)
        db.session.commit()

        return {"success": True, "message": "固件版本已删除"}


@ns_firmware.route("/ota/check")
class OTACheck(Resource):
    @ns_firmware.doc("ota_check", description="检查固件更新")
    @ns_firmware.param("device_id", "设备ID")
    @ns_firmware.param("current_version", "当前固件版本")
    @ns_firmware.response(200, "成功")
    def get(self):
        """
        设备检查固件更新

        设备启动时或定期调用此接口检查是否有可用更新。
        """
        device_id = request.args.get("device_id")
        current_version = request.args.get("current_version")

        if not device_id or not current_version:
            return {"success": False, "message": "缺少参数"}, 400

        latest_firmware = (
            FirmwareVersion.query.filter(FirmwareVersion.is_active == True)  # noqa: E712
            .order_by(FirmwareVersion.created_at.desc())
            .first()
        )

        if not latest_firmware:
            return {"has_update": False, "message": "暂无固件更新"}

        if self._compare_versions(latest_firmware.version, current_version) <= 0:
            return {"has_update": False, "message": "已是最新版本"}

        if latest_firmware.min_compatible_version:
            if self._compare_versions(current_version, latest_firmware.min_compatible_version) < 0:
                return {"has_update": False, "message": "当前版本过低，需要先升级到中间版本"}

        return {
            "has_update": True,
            "version": latest_firmware.version,
            "description": latest_firmware.description,
            "file_size": latest_firmware.file_size,
            "md5": latest_firmware.md5,
            "download_url": f"/api/firmware/download/{latest_firmware.id}",
            "is_mandatory": latest_firmware.is_mandatory,
        }

    @staticmethod
    def _compare_versions(v1, v2):
        def parse(v):
            return [int(x) for x in v.split(".")]

        v1_parts = parse(v1)
        v2_parts = parse(v2)

        for i in range(max(len(v1_parts), len(v2_parts))):
            p1 = v1_parts[i] if i < len(v1_parts) else 0
            p2 = v2_parts[i] if i < len(v2_parts) else 0
            if p1 != p2:
                return 1 if p1 > p2 else -1
        return 0


@ns_firmware.route("/ota/report")
class OTAReport(Resource):
    @ns_firmware.doc("ota_report", description="上报固件升级结果")
    @ns_firmware.response(200, "成功")
    def post(self):
        """
        设备上报固件升级状态

        设备在固件下载完成或升级完成后上报状态。
        """
        data = request.get_json()

        device_id = data.get("device_id")
        device_name = data.get("device_name")
        from_version = data.get("from_version")
        to_version = data.get("to_version")
        status = data.get("status")
        error_message = data.get("error_message")

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

            return {"success": True, "message": "已开始升级"}

        elif status == "completed":
            update_record = (
                DeviceFirmwareUpdate.query.filter_by(device_id=device_id, to_version=to_version, status="in_progress")
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
                description=f"设备 {device_name} 固件升级成功: {from_version} -> {to_version}",
            )
            db.session.add(log)
            db.session.commit()

            return {"success": True, "message": "升级完成"}

        elif status == "failed":
            update_record = (
                DeviceFirmwareUpdate.query.filter_by(device_id=device_id, to_version=to_version, status="in_progress")
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
                description=f"设备 {device_name} 固件升级失败: {from_version} -> {to_version}, 错误: {error_message}",
            )
            db.session.add(log)
            db.session.commit()

            return {"success": True, "message": "已记录失败状态"}

        return {"success": True}


@ns_firmware.route("/upgrade-records")
class UpgradeRecords(Resource):
    @ns_firmware.doc("get_upgrade_records", description="获取升级记录")
    @ns_firmware.param("device_id", "设备ID")
    @ns_firmware.param("status", "升级状态")
    @ns_firmware.response(200, "成功")
    @requires_admin
    def get(self):
        """
        获取设备升级记录

        查看所有固件升级的历史记录。
        """
        device_id = request.args.get("device_id")
        status = request.args.get("status")

        query = DeviceFirmwareUpdate.query

        if device_id:
            query = query.filter_by(device_id=device_id)
        if status:
            query = query.filter_by(status=status)

        records = query.order_by(DeviceFirmwareUpdate.created_at.desc()).limit(100).all()

        return {
            "records": [
                {
                    "id": r.id,
                    "device_id": r.device_id,
                    "device_name": r.device_name,
                    "from_version": r.from_version,
                    "to_version": r.to_version,
                    "status": r.status,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "error_message": r.error_message,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in records
            ],
            "total": len(records),
        }


@ns_firmware.route("/batch-upgrade")
class BatchUpgrade(Resource):
    @ns_firmware.doc("batch_upgrade", description="批量升级设备固件")
    @ns_firmware.expect(
        ns_firmware.model(
            "BatchUpgradeRequest",
            {
                "device_ids": fields.List(fields.String, required=True, description="设备ID列表"),
                "target_version": fields.String(required=True, description="目标固件版本"),
            },
        )
    )
    @ns_firmware.response(200, "成功")
    @requires_admin
    def post(self):
        """
        批量升级设备固件

        一次向多个设备下发固件升级指令。
        """
        data = request.get_json()
        device_ids = data.get("device_ids", [])
        target_version = data.get("target_version")

        firmware = FirmwareVersion.query.filter_by(version=target_version, is_active=True).first()

        if not firmware:
            return {"success": False, "message": "目标版本不存在或未激活"}, 404

        from services.mqtt_manager import mqtt_manager

        results = []
        for device_id in device_ids:
            mqtt_manager.publish_ota_command(
                device_id,
                {
                    "version": firmware.version,
                    "download_url": f"/api/firmware/download/{firmware.id}",
                    "md5": firmware.md5,
                    "is_mandatory": firmware.is_mandatory,
                },
            )

            results.append({"device_id": device_id, "status": "command_sent"})

        log = OperationLog(
            operation_type="firmware_batch_upgrade",
            target_type="firmware",
            target_id=firmware.id,
            operator="Admin",
            description=f"批量升级固件: {len(device_ids)} 台设备 -> {target_version}",
        )
        db.session.add(log)
        db.session.commit()

        return {"success": True, "message": f"已向 {len(device_ids)} 台设备下发升级指令", "results": results}


FIRMWARE_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "firmware")
ALLOWED_EXTENSIONS = {"bin", "hex", "fw"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def ensure_upload_folder():
    if not os.path.exists(FIRMWARE_UPLOAD_FOLDER):
        os.makedirs(FIRMWARE_UPLOAD_FOLDER)
        print(f"[Firmware] 创建上传目录: {FIRMWARE_UPLOAD_FOLDER}")


@ns_firmware.route("/upload")
class FirmwareUpload(Resource):
    @ns_firmware.doc("upload_firmware", description="上传固件文件")
    @ns_firmware.expect(
        ns_firmware.model(
            "FirmwareUpload",
            {
                "version": fields.String(required=True, description="固件版本号"),
                "description": fields.String(description="版本描述"),
                "min_compatible_version": fields.String(description="最低兼容版本"),
                "is_mandatory": fields.Boolean(description="是否强制更新", default=False),
            },
        )
    )
    @ns_firmware.response(200, "成功")
    @ns_firmware.response(400, "参数错误")
    @requires_admin
    def post(self):
        """
        上传固件文件

        上传新的固件文件到服务器，并创建固件版本记录。
        """
        ensure_upload_folder()

        if "file" not in request.files:
            return {"success": False, "message": "没有上传文件"}, 400

        file = request.files["file"]
        version = request.form.get("version")
        description = request.form.get("description", "")
        min_compatible_version = request.form.get("min_compatible_version", "")
        is_mandatory = request.form.get("is_mandatory", "false").lower() == "true"

        if not version:
            return {"success": False, "message": "需要提供版本号"}, 400

        if file.filename == "":
            return {"success": False, "message": "没有选择文件"}, 400

        if not allowed_file(file.filename):
            return {"success": False, "message": "不支持的文件类型，仅支持 bin/hex/fw"}, 400

        existing = FirmwareVersion.query.filter_by(version=version).first()
        if existing:
            return {"success": False, "message": f"版本号 {version} 已存在"}, 400

        filename = secure_filename(f"firmware_{version}_{int(time.time())}.bin")
        file_path = os.path.join(FIRMWARE_UPLOAD_FOLDER, filename)

        try:
            file.save(file_path)
            file_size = os.path.getsize(file_path)

            with open(file_path, "rb") as f:
                md5_hash = hashlib.md5(usedforsecurity=False)
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
                md5 = md5_hash.hexdigest()

            firmware = FirmwareVersion(
                version=version,
                description=description,
                file_path=file_path,
                file_size=file_size,
                md5=md5,
                min_compatible_version=min_compatible_version,
                is_mandatory=is_mandatory,
                is_active=True,
                created_by=getattr(request, "admin_id", None),
            )
            db.session.add(firmware)
            db.session.commit()

            log = OperationLog(
                operation_type="firmware_upload",
                target_type="firmware",
                target_id=firmware.id,
                operator="Admin",
                description=f"上传固件: {version} ({file_size} bytes, MD5: {md5})",
            )
            db.session.add(log)
            db.session.commit()

            return {
                "success": True,
                "message": "固件上传成功",
                "firmware": {
                    "id": firmware.id,
                    "version": firmware.version,
                    "file_size": file_size,
                    "md5": md5,
                    "description": description,
                    "is_mandatory": is_mandatory,
                },
            }

        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            return {"success": False, "message": f"上传失败: {str(e)}"}, 500


@ns_firmware.route("/download/<int:id>")
@ns_firmware.param("id", "固件ID")
class FirmwareDownload(Resource):
    @ns_firmware.doc("download_firmware", description="下载固件文件")
    @ns_firmware.response(200, "成功")
    @ns_firmware.response(404, "不存在")
    def get(self, id):
        """
        下载固件文件

        根据固件ID下载固件文件。
        """
        firmware = FirmwareVersion.query.get_or_404(id)

        if not firmware.file_path or not os.path.exists(firmware.file_path):
            return {"success": False, "message": "固件文件不存在"}, 404

        return send_file(
            firmware.file_path,
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=f"firmware_{firmware.version}.bin",
        )


@ns_firmware.route("/latest")
class FirmwareLatest(Resource):
    @ns_firmware.doc("get_latest_firmware", description="获取最新固件")
    @ns_firmware.response(200, "成功")
    def get(self):
        """
        获取最新固件信息

        返回最新激活的固件版本信息，供设备检查更新使用。
        """
        latest_firmware = (
            FirmwareVersion.query.filter(FirmwareVersion.is_active == True)  # noqa: E712
            .order_by(FirmwareVersion.created_at.desc())
            .first()
        )

        if not latest_firmware:
            return {"has_update": False, "message": "暂无固件"}

        return {
            "has_update": True,
            "version": latest_firmware.version,
            "description": latest_firmware.description,
            "file_size": latest_firmware.file_size,
            "md5": latest_firmware.md5,
            "is_mandatory": latest_firmware.is_mandatory,
            "created_at": latest_firmware.created_at.isoformat() if latest_firmware.created_at else None,
        }


@ns_firmware.route("/ota-status")
class OTAStatus(Resource):
    @ns_firmware.doc("get_ota_status", description="获取OTA升级状态")
    @ns_firmware.param("device_id", "设备ID")
    @ns_firmware.response(200, "成功")
    @requires_admin
    def get(self):
        """
        获取OTA升级状态

        查看当前正在进行的OTA升级进度和历史记录。
        """
        device_id = request.args.get("device_id")

        query = DeviceFirmwareUpdate.query

        if device_id:
            query = query.filter_by(device_id=device_id)

        records = query.order_by(DeviceFirmwareUpdate.created_at.desc()).limit(50).all()

        in_progress = [r for r in records if r.status == "in_progress"]
        completed = [r for r in records if r.status == "completed"]
        failed = [r for r in records if r.status == "failed"]

        return {
            "summary": {
                "in_progress_count": len(in_progress),
                "completed_count": len(completed),
                "failed_count": len(failed),
                "total_count": len(records),
            },
            "in_progress": [
                {
                    "id": r.id,
                    "device_id": r.device_id,
                    "device_name": r.device_name,
                    "from_version": r.from_version,
                    "to_version": r.to_version,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                }
                for r in in_progress
            ],
            "recent": [
                {
                    "id": r.id,
                    "device_id": r.device_id,
                    "device_name": r.device_name,
                    "from_version": r.from_version,
                    "to_version": r.to_version,
                    "status": r.status,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "error_message": r.error_message,
                }
                for r in records[:20]
            ],
        }
