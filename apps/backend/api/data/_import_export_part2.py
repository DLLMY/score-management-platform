# -*- coding: utf-8 -*-
# part of api/data/import_export_routes.py (D2 split)

from flask_restx import Namespace, Resource, fields
from flask import request, send_file
from models import User, ScoreRule, ScoreCategory, ScoreRecord
from utils.permission import requires_permission
from utils.response import APIResponse
from utils.decorators import safe_handle
from utils.excel_utils import ExcelUtils, ExcelTemplateGenerator
from utils.backup_utils import BackupManager, BackupScheduler
from utils.transaction_retry import get_import_guard
from services.import_export_service import (
    bulk_import_users,
    bulk_import_rules,
    bulk_import_categories,
    ImportCommitError,
)
from datetime import datetime
import logging
import io
import os

from api.data.import_export_routes import logger, ns_import_export, export_response, import_response, backup_response, backup_list_response, backup_manager, backup_scheduler

@ns_import_export.route("/import/users")
class ImportUsers(Resource):

    @ns_import_export.doc("import_users", params={"file": "Excel或CSV文件"})
    @requires_permission("report.import")
    def post(self):
        """导入用户数据（带事务重试和并发控制）"""
        guard = get_import_guard(max_concurrent=3)
        acquired, import_id = guard.acquire()

        if not acquired:
            return APIResponse.error(
                message="系统繁忙，请稍后重试",
                data={
                    "imported_count": 0,
                    "failed_count": 0,
                    "errors": ["当前导入请求过多，请稍后再试"],
                },
                status_code=429,
            )

        try:
            return self._do_import_users()
        finally:
            guard.release(import_id)

    def _do_import_users(self):
        if "file" not in request.files:
            return APIResponse.bad_request(
                message="请选择要导入的文件",
                data={"imported_count": 0, "failed_count": 0, "errors": ["未上传文件"]},
            )

        file = request.files["file"]
        if file.filename == "":
            return APIResponse.bad_request(
                message="请选择要导入的文件",
                data={"imported_count": 0, "failed_count": 0, "errors": ["文件名为空"]},
            )

        try:
            file_bytes = file.read()
            file_type = ExcelUtils.detect_file_type(file_bytes, file.filename)

            if file_type == "csv":
                result = ExcelUtils.read_csv(file_bytes)
            elif file_type in ["xlsx", "xls"]:
                result = ExcelUtils.read_excel(file_bytes)
            else:
                return APIResponse.bad_request(
                    message="不支持的文件格式",
                    data={
                        "imported_count": 0,
                        "failed_count": 0,
                        "errors": ["仅支持.xlsx、.xls和.csv格式"],
                    },
                )

            # 验证数据（模板/列结构校验，请求级；行级业务校验下沉 service）
            validation = ExcelTemplateGenerator.validate_import_data(
                "user", result["headers"], result["data"]
            )
            if not validation["valid"]:
                return APIResponse.bad_request(
                    message="数据格式验证失败",
                    data={"imported_count": 0, "failed_count": 0, "errors": validation["errors"]},
                )

            # 写入事务下沉 service（逐行校验 + 建模 + 提交/回滚，#629 收口）
            try:
                result = bulk_import_users(result["data"])
            except ImportCommitError as e:
                return APIResponse.server_error(
                    message="导入失败: 数据提交失败，请重试",
                    data={
                        "imported_count": 0,
                        "failed_count": e.imported_count + e.failed_count,
                        "errors": [str(e)],
                    },
                )
            except Exception as e:
                logger.exception("导入失败")
                return APIResponse.server_error(
                    message="导入失败",
                    data={"imported_count": 0, "failed_count": 0, "errors": [str(e)]},
                )

            message = f"导入完成！成功导入 {result['imported_count']} 条记录，失败 {result['failed_count']} 条"
            return APIResponse.success(
                message=message,
                data={
                    "imported_count": result["imported_count"],
                    "failed_count": result["failed_count"],
                    "errors": result["errors"],
                    "messages": result["messages"],
                },
            )

        except Exception as e:
            logger.exception("导入失败")
            return APIResponse.server_error(
                message="导入失败",
                data={"imported_count": 0, "failed_count": 0, "errors": [str(e)]},
            )

@ns_import_export.route("/import/rules")
class ImportRules(Resource):

    @ns_import_export.doc("import_rules", params={"file": "Excel或CSV文件"})
    @requires_permission("rule.manage")
    def post(self):
        """导入规则数据"""
        if "file" not in request.files:
            return APIResponse.bad_request(
                message="请选择要导入的文件",
                data={"imported_count": 0, "failed_count": 0, "errors": ["未上传文件"]},
            )

        file = request.files["file"]
        if file.filename == "":
            return APIResponse.bad_request(
                message="请选择要导入的文件",
                data={"imported_count": 0, "failed_count": 0, "errors": ["文件名为空"]},
            )

        try:
            file_bytes = file.read()
            file_type = ExcelUtils.detect_file_type(file_bytes, file.filename)

            if file_type == "csv":
                result = ExcelUtils.read_csv(file_bytes)
            elif file_type in ["xlsx", "xls"]:
                result = ExcelUtils.read_excel(file_bytes)
            else:
                return APIResponse.bad_request(
                    message="不支持的文件格式",
                    data={
                        "imported_count": 0,
                        "failed_count": 0,
                        "errors": ["仅支持.xlsx、.xls和.csv格式"],
                    },
                )

            # 验证数据
            validation = ExcelTemplateGenerator.validate_import_data(
                "rule", result["headers"], result["data"]
            )
            if not validation["valid"]:
                return APIResponse.bad_request(
                    message="数据格式验证失败",
                    data={"imported_count": 0, "failed_count": 0, "errors": validation["errors"]},
                )

            # 写入事务下沉 service（逐行校验 + 建模 + 提交/回滚，#629 收口）
            result = bulk_import_rules(result["data"])
            message = f"导入完成！成功导入 {result['imported_count']} 条记录，失败 {result['failed_count']} 条"
            return APIResponse.success(
                message=message,
                data={
                    "imported_count": result["imported_count"],
                    "failed_count": result["failed_count"],
                    "errors": result["errors"],
                },
            )

        except Exception as e:
            logger.exception("导入失败")
            return APIResponse.server_error(
                message="导入失败",
                data={"imported_count": 0, "failed_count": 0, "errors": [str(e)]},
            )

@ns_import_export.route("/import/categories")
class ImportCategories(Resource):

    @ns_import_export.doc("import_categories", params={"file": "Excel或CSV文件"})
    @requires_permission("rule.manage")
    def post(self):
        """导入分类数据"""
        if "file" not in request.files:
            return APIResponse.bad_request(
                message="请选择要导入的文件",
                data={"imported_count": 0, "failed_count": 0, "errors": ["未上传文件"]},
            )

        file = request.files["file"]
        if file.filename == "":
            return APIResponse.bad_request(
                message="请选择要导入的文件",
                data={"imported_count": 0, "failed_count": 0, "errors": ["文件名为空"]},
            )

        try:
            file_bytes = file.read()
            file_type = ExcelUtils.detect_file_type(file_bytes, file.filename)

            if file_type == "csv":
                result = ExcelUtils.read_csv(file_bytes)
            elif file_type in ["xlsx", "xls"]:
                result = ExcelUtils.read_excel(file_bytes)
            else:
                return APIResponse.bad_request(
                    message="不支持的文件格式",
                    data={
                        "imported_count": 0,
                        "failed_count": 0,
                        "errors": ["仅支持.xlsx、.xls和.csv格式"],
                    },
                )

            # 验证数据
            validation = ExcelTemplateGenerator.validate_import_data(
                "category", result["headers"], result["data"]
            )
            if not validation["valid"]:
                return APIResponse.bad_request(
                    message="数据格式验证失败",
                    data={"imported_count": 0, "failed_count": 0, "errors": validation["errors"]},
                )

            # 写入事务下沉 service（逐行校验 + 建模 + 提交/回滚，#629 收口）
            result = bulk_import_categories(result["data"])
            message = f"导入完成！成功导入 {result['imported_count']} 条记录，失败 {result['failed_count']} 条"
            return APIResponse.success(
                message=message,
                data={
                    "imported_count": result["imported_count"],
                    "failed_count": result["failed_count"],
                    "errors": result["errors"],
                },
            )

        except Exception as e:
            logger.exception("导入失败")
            return APIResponse.server_error(
                message="导入失败",
                data={"imported_count": 0, "failed_count": 0, "errors": [str(e)]},
            )

@ns_import_export.route("/backup/create")
class CreateBackup(Resource):

    @ns_import_export.doc(
        "create_backup", params={"type": "备份类型: full, incremental, data_only"}
    )
    @requires_permission("system.settings")
    def post(self):
        """创建手动备份"""
        backup_type = request.args.get("type", "full").lower()
        result = backup_manager.create_backup(backup_type)
        if result.get("success"):
            return APIResponse.success(data=result, message=result.get("message"))
        return APIResponse.error(message=result.get("message"), status_code=400)

@ns_import_export.route("/backup/list")
class ListBackups(Resource):

    @ns_import_export.doc("list_backups")
    @requires_permission("system.settings")
    def get(self):
        """获取备份文件列表"""
        backups = backup_manager.list_backups()
        return APIResponse.success(data=backups)

@ns_import_export.route("/backup/restore/<filename>")
class RestoreBackup(Resource):

    @ns_import_export.doc("restore_backup")
    @requires_permission("system.settings")
    def post(self, filename):
        """恢复备份"""
        result = backup_manager.restore_backup(filename)
        if result.get("success"):
            return APIResponse.success(data=result, message=result.get("message"))
        return APIResponse.error(message=result.get("message"), status_code=400)

@ns_import_export.route("/backup/delete/<filename>")
class DeleteBackup(Resource):

    @ns_import_export.doc("delete_backup")
    @requires_permission("system.settings")
    @safe_handle(message="删除失败", default_status=500, error_code="INTERNAL_ERROR")
    def delete(self, filename):
        """删除备份文件"""
        # S8 修复: 路径穿越防护——只允许备份目录内文件名（原 filename="../.." 可越权删除任意文件）
        if filename != os.path.basename(filename) or not filename:
            return APIResponse.error(message="备份文件名非法", status_code=400)
        backup_path = backup_manager.backup_dir / os.path.basename(filename)
        if backup_path.exists():
            backup_path.unlink()
            return APIResponse.success(message="备份文件已删除")
        return APIResponse.not_found(message="备份文件不存在")

@ns_import_export.route("/backup/stats")
class GetBackupStats(Resource):

    @ns_import_export.doc("get_backup_stats")
    @requires_permission("system.settings")
    def get(self):
        """获取备份统计信息"""
        stats = backup_manager.get_backup_stats()
        return APIResponse.success(data=stats)

@ns_import_export.route("/backup/schedule/enable")
class EnableBackupSchedule(Resource):

    @ns_import_export.doc("enable_backup_schedule")
    @requires_permission("system.settings")
    def post(self):
        """启用定时备份（兼容保留：真实开关为 BACKUP_ENABLED 环境变量）"""
        backup_scheduler.enable()
        return APIResponse.success(
            message=(
                "定时备份内存标记已置为启用；但自动备份的真实开关由环境变量 "
                "BACKUP_ENABLED 决定，请在 .env 设置 BACKUP_ENABLED=true 并重启服务后生效"
            )
        )

@ns_import_export.route("/backup/schedule/disable")
class DisableBackupSchedule(Resource):

    @ns_import_export.doc("disable_backup_schedule")
    @requires_permission("system.settings")
    def post(self):
        """禁用定时备份（兼容保留：真实开关为 BACKUP_ENABLED 环境变量）"""
        backup_scheduler.disable()
        return APIResponse.success(
            message=(
                "定时备份内存标记已置为禁用；自动备份的真实开关由环境变量 "
                "BACKUP_ENABLED 决定，未设置或 false 时启动即不注册 02:00 自动备份任务"
            )
        )

@ns_import_export.route("/backup/schedule/status")
class GetBackupScheduleStatus(Resource):

    @ns_import_export.doc("get_backup_schedule_status")
    @requires_permission("system.settings")
    def get(self):
        """获取定时备份状态（权威开关为 BACKUP_ENABLED 环境变量，启动时决定）"""
        from config import Config

        return {
            "success": True,
            # 权威开关：自动备份是否真正启用，由 BACKUP_ENABLED 决定（与启动时注册的 cron 一致）
            "enabled": Config.BACKUP_ENABLED,
            "source": "BACKUP_ENABLED env var (evaluated at startup)",
            "schedule": "cron 02:00 daily (create)",
            "cleanup": "cron 03:00 daily (retention)",
            # 保留 legacy 内存调度器标记，仅为向后兼容展示，不影响真实 cron
            "legacy_scheduler_enabled": backup_scheduler.enabled,
            "legacy_schedule_time": backup_scheduler.schedule_time,
        }

@ns_import_export.route("/backup/schedule/set_time")
class SetBackupScheduleTime(Resource):

    @ns_import_export.doc("set_backup_schedule_time", params={"time": "定时时间，格式HH:MM"})
    @requires_permission("system.settings")
    def post(self):
        """设置定时备份时间（兼容保留：真实 cron 固定为每日 02:00，详见 BACKUP_STRATEGY.md）"""
        time_str = request.args.get("time", "02:00")
        success = backup_scheduler.set_schedule_time(time_str)
        if success:
            return APIResponse.success(
                message=(
                    f"内存调度器时间已更新为 {time_str}；"
                    "但真实自动备份 cron 固定为每日 02:00，调整需在部署层（compose cron / 系统计划任务）配置"
                )
            )
        return APIResponse.bad_request(message="无效的时间格式，请使用HH:MM格式")

@ns_import_export.route("/backup/clean_old")
class CleanOldBackups(Resource):

    @ns_import_export.doc("clean_old_backups")
    @requires_permission("system.settings")
    def post(self):
        """清理过期备份"""
        result = backup_manager.clean_old_backups()
        if result.get("success"):
            return APIResponse.success(data=result, message=result.get("message"))
        return APIResponse.error(message=result.get("message"), status_code=400)
