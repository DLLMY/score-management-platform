# -*- coding: utf-8 -*-
# part of api/system/system_routes.py (D2 split)

from flask_restx import Namespace, Resource, fields
from flask_wtf.csrf import generate_csrf
from flask import current_app, request
from config import Config
from utils.response import APIResponse
from utils.pagination import get_pagination
from utils.params import get_int_arg
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api
from utils.decorators import safe_handle
from utils.performance_monitor import performance_monitor
from services.redis_cache_service import get_cache_service
from services.mqtt_service import mqtt_manager
from services.system_config_service import SystemConfigService
from services.frontend_telemetry_service import (
    persist_perf_metric,
    persist_frontend_error,
    bulk_persist_perf_metrics,
)
from models import db, FrontendPerfMetric, FrontendErrorLog, SystemMetric
from datetime import datetime, timedelta
from sqlalchemy import text
import os
import time
import json
import logging
import threading
import psutil
import shutil
from utils.logger import log_warning

from api.system.system_routes import logger, RATE_LIMIT, rate_limit_store, cleanup_rate_limit_store, cleanup_interval, start_rate_limit_cleanup, rate_limit, validate_performance_data, validate_error_data, ns_system, system_config_model, backup_restore_model, backup_info_model, frontend_performance_model, frontend_performance_batch_model, frontend_error_model, _check_system_resources, _check_database_health, _check_redis_health, _check_mqtt_health, _resource_status, _fill_cpu_component, _fill_memory_component, _fill_disk_component

@ns_system.route("/config")
class SystemConfigResource(Resource):

    @ns_system.doc("get_system_config", description="Get system config", security="Bearer")
    @ns_system.response(200, "Success")
    @requires_permission("system.settings")
    def get(self):
        """
        获取系统配置

        获取当前系统的配置信息。
        """
        config = SystemConfigService.get_config()
        if not config:
            config = SystemConfigService.update_config({})
        return APIResponse.success(data=config)

    @ns_system.doc("update_system_config", description="更新系统配置", security="Bearer")
    @ns_system.expect(system_config_model)
    @ns_system.response(200, "更新成功")
    @requires_permission("system.settings")
    def put(self):
        """
        更新系统配置

        更新系统配置信息，需要管理员权限。

        请求体：
        - system_name: 系统名称
        - system_logo: 系统Logo
        - default_score: 默认积分
        - min_score: 最低积分
        - max_score: 最高积分
        - enable_notifications: 启用通知
        - notification_sound: 通知声音
        - auto_save: 自动保存
        - theme: 主题
        - language: 语言
        - device_whitelist_enabled: 设备白名单开关（差异 #4；开启后拒绝未登记设备注册）
        """
        data = ns_system.payload
        config = SystemConfigService.update_config(data)
        if config:
            return APIResponse.success(data=config, message="系统配置更新成功")
        return APIResponse.error(message="更新系统配置失败", status_code=500)

@ns_system.route("/backup")
class SystemBackup(Resource):

    @ns_system.doc("backup_database", description="备份数据库", security="Bearer")
    @ns_system.response(200, "备份成功")
    @ns_system.response(404, "数据库文件不存在")
    @ns_system.response(500, "备份失败")
    @requires_permission("system.backup")
    @safe_handle(default_status=500, message="备份失败")
    def post(self):
        """
        备份数据库

        创建数据库的完整备份。备份文件保存在backups目录下，
        最多保留10个备份文件，超出后自动删除最旧的备份。
        """
        basedir = os.path.abspath(os.path.dirname(__file__))
        # 备份目录统一走 Config.BACKUP_DIR（此前硬编码相对路径，BACKUP_DIR 配置从未生效）

        backup_dir = Config.BACKUP_DIR
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(backup_dir, f"score_management_{timestamp}.db")

        # 源数据库路径从运行时 SQLALCHEMY_DATABASE_URI 推导，避免硬编码相对路径偏差导致 404
        db_uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
        source_path = None
        if db_uri.startswith("sqlite:///"):
            source_path = db_uri[len("sqlite:///"):]
        elif db_uri.startswith("sqlite://"):
            source_path = db_uri[len("sqlite://"):]
        if not source_path:
            source_path = os.path.join(
                os.path.abspath(os.path.join(basedir, "..", "..")),
                "instance",
                "score_management.db",
            )

        os.makedirs(backup_dir, exist_ok=True)

        if os.path.exists(source_path):
            shutil.copy2(source_path, backup_path)

            backups = sorted(
                [f for f in os.listdir(backup_dir) if f.startswith("score_management_")]
            )
            if len(backups) > 10:
                oldest = backups[0]
                os.remove(os.path.join(backup_dir, oldest))

            return APIResponse.success(
                data={"filename": f"score_management_{timestamp}.db"}, message="数据库备份成功"
            )
        return APIResponse.error(message="数据库文件不存在", status_code=404)

@ns_system.route("/backups")
class SystemBackupsList(Resource):

    @ns_system.doc("list_backups", description="获取备份列表", security="Bearer")
    @ns_system.response(200, "成功")
    @requires_permission("system.backup")
    @safe_handle(default_status=500, message="获取备份列表失败")
    def get(self):
        """
        获取备份列表

        获取所有可用数据库备份文件的列表。
        """
        basedir = os.path.abspath(os.path.dirname(__file__))
        backup_dir = Config.BACKUP_DIR

        if not os.path.exists(backup_dir):
            return APIResponse.success(data=[])

        backups = []
        for filename in sorted(os.listdir(backup_dir)):
            if filename.startswith("score_management_") and filename.endswith(".db"):
                filepath = os.path.join(backup_dir, filename)
                stat = os.stat(filepath)
                backups.append(
                    {
                        "filename": filename,
                        "size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    }
                )

        return APIResponse.success(
            data=sorted(backups, key=lambda x: x["created_at"], reverse=True)
        )

@ns_system.route("/restore")
class SystemRestore(Resource):

    @ns_system.doc("restore_database", description="恢复数据库", security="Bearer")
    @ns_system.expect(backup_restore_model)
    @ns_system.response(200, "恢复成功")
    @ns_system.response(400, "请提供备份文件名")
    @ns_system.response(404, "备份文件不存在")
    @ns_system.response(500, "恢复失败")
    @requires_permission("system.backup")
    @safe_handle(default_status=500, message="恢复失败")
    def post(self):
        """
        恢复数据库

        从备份文件恢复数据库，需要管理员权限。
        警告：此操作会覆盖当前的数据库内容。

        请求体：
        - filename: 备份文件名（必填）
        """
        data = ns_system.payload
        filename = data.get("filename")

        if not filename:
            return APIResponse.error(message="请提供备份文件名", status_code=400)
        # F14 修复: 路径穿越防护——只允许备份目录内的文件名
        if filename != os.path.basename(filename):
            return APIResponse.error(message="备份文件名非法", status_code=400)

        basedir = os.path.abspath(os.path.dirname(__file__))
        backup_dir = os.path.join(basedir, "..", "backups")
        backup_path = os.path.join(backup_dir, os.path.basename(filename))
        target_path = os.path.join(basedir, "..", "instance", "score_management.db")

        if not os.path.exists(backup_path):
            return APIResponse.error(message="备份文件不存在", status_code=404)

        # F14 修复: 校验备份文件为有效 SQLite 数据库（防止恢复损坏/伪造文件）
        try:
            with open(backup_path, "rb") as _f:
                magic = _f.read(16)
        except OSError as _e:
            return APIResponse.error(message=f"备份文件不可读: {_e}", status_code=500)
        if not magic.startswith(b"SQLite format 3"):
            return APIResponse.error(message="备份文件不是有效的 SQLite 数据库", status_code=400)

        # F14 修复: 恢复前自动备份当前库（磁盘空间不足时仅告警不阻断恢复）
        try:
            pre_bak = os.path.join(
                backup_dir, f"pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            )
            shutil.copy2(target_path, pre_bak)
        except Exception as _e:
            log_warning(f"[恢复] 当前库自动备份失败（继续恢复）: {_e}", exception=_e)

        shutil.copy2(backup_path, target_path)
        return APIResponse.success(message="数据库恢复成功（恢复前已尝试自动备份当前库）")

@ns_system.route("/clear-cache")
class SystemClearCache(Resource):

    @ns_system.doc("clear_cache", description="清理缓存", security="Bearer")
    @ns_system.response(200, "清理成功")
    @ns_system.response(500, "清理失败")
    @requires_permission("system.cache")
    @safe_handle(default_status=500, message="清理失败")
    def post(self):
        """
        清理缓存

        清理Python缓存文件（__pycache__），需要管理员权限。
        """
        basedir = os.path.abspath(os.path.dirname(__file__))
        cache_dir = os.path.join(basedir, "..", "__pycache__")

        def _clear_pycache(path):
            """逐目录尽力清理 __pycache__：占用/受限目录跳过并告警，不使整请求 500。"""
            try:
                shutil.rmtree(path)
            except OSError as exc:
                log_warning(
                    f"[clear-cache] 清理 {path} 失败（目录占用/受限），已跳过: {exc}", exception=exc
                )

        if os.path.exists(cache_dir):
            _clear_pycache(cache_dir)

        for root, dirs, _files in os.walk(os.path.join(basedir, "..")):
            for dir in dirs:
                if dir == "__pycache__":
                    _clear_pycache(os.path.join(root, dir))

        return APIResponse.success(message="缓存清理成功")

@ns_system.route("/cache-stats")
class SystemCacheStats(Resource):

    @ns_system.doc("get_cache_stats", description="获取缓存统计信息", security="Bearer")
    @ns_system.response(200, "成功")
    @requires_permission("system.cache")
    def get(self):
        """
        获取缓存统计信息

        获取Redis缓存的使用统计信息，包括命中率、操作次数等。
        """
        return get_cache_service().get_stats()

    @ns_system.doc("flush_cache", description="刷新缓存", security="Bearer")
    @ns_system.response(200, "成功")
    @requires_permission("system.cache")
    def post(self):
        """
        刷新缓存

        清空所有缓存数据，需要管理员权限。
        """
        result = get_cache_service().flush_all()
        if result:
            return APIResponse.success(message="缓存刷新成功")
        return APIResponse.error(message="缓存刷新失败", status_code=500)

@ns_system.route("/csrf-token")
class SystemCsrfToken(Resource):

    @ns_system.doc("get_csrf_token", description="获取CSRF令牌")
    @ns_system.response(200, "成功")
    def get(self):
        """
        获取CSRF令牌

        获取用于表单提交的CSRF防护令牌。
        """
        csrf_token = generate_csrf()
        return APIResponse.success(data={"csrf_token": csrf_token})

@ns_system.route("/stats")
class SystemStats(Resource):

    @ns_system.doc("get_system_stats", description="获取系统统计信息")
    @ns_system.response(200, "成功")
    @requires_permission("system.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=500, message="获取系统统计失败")
    def get(self):
        """
        获取系统统计信息

        返回系统的综合统计数据，包括用户数、积分记录数等。
        """
        cache_stats = get_cache_service().get_stats()

        user_count = 0
        record_count = 0
        rule_count = 0
        category_count = 0
        device_count = 0
        admin_count = 0

        # 合并数据库查询，减少连接开销
        # 注意：实际表名为单数（user/score_record/score_rule/score_category/device/admin）
        try:
            with db.engine.connect() as conn:
                results = conn.execute(text("""
                    SELECT
                        (SELECT COUNT(*) FROM user) as user_count,
                        (SELECT COUNT(*) FROM score_record) as record_count,
                        (SELECT COUNT(*) FROM score_rule) as rule_count,
                        (SELECT COUNT(*) FROM score_category) as category_count,
                        (SELECT COUNT(*) FROM device) as device_count,
                        (SELECT COUNT(*) FROM admin) as admin_count
                """)).first()

                if results:
                    user_count = results.user_count or 0
                    record_count = results.record_count or 0
                    rule_count = results.rule_count or 0
                    category_count = results.category_count or 0
                    device_count = results.device_count or 0
                    admin_count = results.admin_count or 0
        except Exception as e:
            logger.warning(f"批量统计查询失败，降级为单表查询: {e}")

            tables = ["user", "score_record", "score_rule", "score_category", "device", "admin"]
            counts = {}

            # 单表降级：任一表失败视为整体不可信——绝不返回部分 0 冒充全量真实值
            try:
                with db.engine.connect() as conn:
                    for table in tables:
                        try:
                            if table not in (
                                "user",
                                "score_record",
                                "score_rule",
                                "score_category",
                                "device",
                                "admin",
                            ):
                                continue
                            counts[table] = (
                                conn.execute(
                                    text(
                                        "SELECT COUNT(*) FROM " + table
                                    )  # nosec B608 - table is whitelisted
                                ).scalar()
                                or 0
                            )
                        except Exception as e2:
                            logger.error(f"系统统计单表 {table} 计数查询失败: {e2}")
                            return APIResponse.error(
                                message=f"系统统计查询失败（{table}），数据不完整",
                                status_code=500,
                            )
            except Exception as e2:
                logger.error(f"系统统计单表降级查询整体失败: {e2}")
                # DB 不可用：返回失败而非伪造全 0（防止前端误信"0 用户 0 记录"为真实值）
                return APIResponse.error(message="数据库不可用，无法获取系统统计", status_code=500)

            # counts 字典 key 与表名一致（单数）——此前用复数 key 取值致降级分支必全 0
            user_count = counts.get("user", 0)
            record_count = counts.get("score_record", 0)
            rule_count = counts.get("score_rule", 0)
            category_count = counts.get("score_category", 0)
            device_count = counts.get("device", 0)
            admin_count = counts.get("admin", 0)

        return {
            "timestamp": datetime.now().isoformat(),
            "users": user_count,
            "records": record_count,
            "rules": rule_count,
            "categories": category_count,
            "devices": device_count,
            "admins": admin_count,
            "cache": cache_stats,
        }
