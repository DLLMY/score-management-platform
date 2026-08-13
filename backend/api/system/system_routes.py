from flask_restx import Namespace, Resource, fields
from flask_wtf.csrf import generate_csrf
from flask import request
from utils.response import APIResponse
from utils.permission import requires_permission
from utils.performance_monitor import performance_monitor
from services.cache_service import cache_service
from services.mqtt_service import mqtt_manager
from services.system_config_service import SystemConfigService
from models import db
from datetime import datetime
from sqlalchemy import text
import os
import time
import json
import logging
import threading
import psutil

import shutil

logger = logging.getLogger(__name__)

RATE_LIMIT = {
    "frontend_performance": {"limit": 60, "window": 60},
    # batch：前端默认 5s flush 一次（12 次/分钟），10 次/分钟会必然触发 429 导致性能数据丢失；
    # 放宽到 60 次/分钟（多标签页也有余量），前端另有 429 退避兜底
    "frontend_performance_batch": {"limit": 60, "window": 60},
    "frontend_error": {"limit": 30, "window": 60},
}

rate_limit_store: dict[str, dict[str, float | int]] = {}


def cleanup_rate_limit_store():
    now = time.time()
    max_age = 300
    expired_keys = []

    for store_key, entry in rate_limit_store.items():
        if now - entry["start_time"] > max_age:
            expired_keys.append(store_key)

    for key in expired_keys:
        del rate_limit_store[key]

    if expired_keys:
        logger.debug(f"清理过期限流记录: {len(expired_keys)} 条")


cleanup_interval = 60


def start_rate_limit_cleanup():

    def cleanup_loop():
        while True:
            try:
                cleanup_rate_limit_store()
            except Exception as e:
                logger.error(f"清理限流记录失败: {str(e)}")
            time.sleep(cleanup_interval)

    thread = threading.Thread(target=cleanup_loop, daemon=True)
    thread.start()


start_rate_limit_cleanup()


def rate_limit(key: str):

    def decorator(f):

        def wrapper(*args, **kwargs):
            config = RATE_LIMIT.get(key)
            if not config:
                return f(*args, **kwargs)

            client_ip = request.remote_addr or "unknown"
            store_key = f"{key}_{client_ip}"
            now = time.time()

            entry = rate_limit_store.get(store_key)
            if entry is None:
                entry = {"count": 0, "start_time": now}
                rate_limit_store[store_key] = entry

            if now - entry["start_time"] > config["window"]:
                entry["count"] = 0
                entry["start_time"] = now

            if entry["count"] >= config["limit"]:
                wait_time = int(config["window"] - (now - entry["start_time"]))
                return APIResponse.error(
                    message="请求过于频繁，请稍后再试", status_code=429, headers={"Retry-After": str(wait_time)}
                )

            entry["count"] += 1
            return f(*args, **kwargs)

        return wrapper

    return decorator


def validate_performance_data(data):
    required_fields = ["type", "name", "value"]
    for field in required_fields:
        if field not in data:
            return False, f"缺少必填字段: {field}"

    if not isinstance(data["type"], str) or len(data["type"]) > 100:
        return False, "type 必须是字符串且长度不超过100"

    if not isinstance(data["name"], str) or len(data["name"]) > 200:
        return False, "name 必须是字符串且长度不超过200"

    if not isinstance(data["value"], (int, float)):
        return False, "value 必须是数字"

    if "unit" in data and data["unit"] is not None:
        if not isinstance(data["unit"], str) or len(data["unit"]) > 50:
            return False, "unit 必须是字符串且长度不超过50"

    if "page" in data and data["page"] is not None:
        if not isinstance(data["page"], str) or len(data["page"]) > 200:
            return False, "page 必须是字符串且长度不超过200"

    if "data" in data and data["data"] is not None:

        try:
            json.dumps(data["data"])
        except Exception:
            return False, "data 必须是可序列化的JSON"

    return True, ""


def validate_error_data(data):
    required_fields = ["type", "message"]
    for field in required_fields:
        if field not in data:
            return False, f"缺少必填字段: {field}"

    if not isinstance(data["type"], str) or len(data["type"]) > 100:
        return False, "type 必须是字符串且长度不超过100"

    if not isinstance(data["message"], str) or len(data["message"]) > 2000:
        return False, "message 必须是字符串且长度不超过2000"

    if "stack" in data and data["stack"] is not None:
        if not isinstance(data["stack"], str) or len(data["stack"]) > 5000:
            return False, "stack 必须是字符串且长度不超过5000"

    if "file" in data and data["file"] is not None:
        if not isinstance(data["file"], str) or len(data["file"]) > 500:
            return False, "file 必须是字符串且长度不超过500"

    if "line" in data and data["line"] is not None:
        if not isinstance(data["line"], int):
            return False, "line 必须是整数"

    if "column" in data and data["column"] is not None:
        if not isinstance(data["column"], int):
            return False, "column 必须是整数"

    return True, ""


ns_system = Namespace("system", description="系统管理相关操作")

system_config_model = ns_system.model(
    "SystemConfig",
    {
        "id": fields.Integer(readOnly=True, description="配置ID"),
        "system_name": fields.String(description="系统名称"),
        "system_logo": fields.String(description="系统Logo"),
        "default_score": fields.Integer(description="默认积分"),
        "min_score": fields.Integer(description="最低积分"),
        "max_score": fields.Integer(description="最高积分"),
        "enable_notifications": fields.Boolean(description="启用通知"),
        "notification_sound": fields.Boolean(description="通知声音"),
        "auto_save": fields.Boolean(description="自动保存"),
        "theme": fields.String(description="主题"),
        "language": fields.String(description="语言"),
    },
)

backup_restore_model = ns_system.model(
    "BackupRestore", {"filename": fields.String(required=True, description="备份文件名")}
)

backup_info_model = ns_system.model(
    "BackupInfo",
    {
        "filename": fields.String(description="文件名"),
        "size": fields.Integer(description="文件大小（字节）"),
        "created_at": fields.String(description="创建时间"),
    },
)


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
    def post(self):
        """
        备份数据库

        创建数据库的完整备份。备份文件保存在backups目录下，
        最多保留10个备份文件，超出后自动删除最旧的备份。
        """
        try:
            basedir = os.path.abspath(os.path.dirname(__file__))
            backup_dir = os.path.join(basedir, "..", "backups")
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(backup_dir, f"score_management_{timestamp}.db")
            source_path = os.path.join(basedir, "..", "instance", "score_management.db")

            os.makedirs(backup_dir, exist_ok=True)

            if os.path.exists(source_path):
                shutil.copy2(source_path, backup_path)

                backups = sorted([f for f in os.listdir(backup_dir) if f.startswith("score_management_")])
                if len(backups) > 10:
                    oldest = backups[0]
                    os.remove(os.path.join(backup_dir, oldest))

                return APIResponse.success(
                    data={"filename": f"score_management_{timestamp}.db"}, message="数据库备份成功"
                )
            else:
                return APIResponse.error(message="数据库文件不存在", status_code=404)
        except Exception as e:
            return APIResponse.error(message=f"备份失败: {str(e)}", status_code=500)


@ns_system.route("/backups")
class SystemBackupsList(Resource):

    @ns_system.doc("list_backups", description="获取备份列表", security="Bearer")
    @ns_system.response(200, "成功")
    @requires_permission("system.backup")
    def get(self):
        """
        获取备份列表

        获取所有可用数据库备份文件的列表。
        """
        try:
            basedir = os.path.abspath(os.path.dirname(__file__))
            backup_dir = os.path.join(basedir, "..", "backups")

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

            return APIResponse.success(data=sorted(backups, key=lambda x: x["created_at"], reverse=True))
        except Exception as e:
            return APIResponse.error(message=f"获取备份列表失败: {str(e)}", status_code=500)


@ns_system.route("/restore")
class SystemRestore(Resource):

    @ns_system.doc("restore_database", description="恢复数据库", security="Bearer")
    @ns_system.expect(backup_restore_model)
    @ns_system.response(200, "恢复成功")
    @ns_system.response(400, "请提供备份文件名")
    @ns_system.response(404, "备份文件不存在")
    @ns_system.response(500, "恢复失败")
    @requires_permission("system.backup")
    def post(self):
        """
        恢复数据库

        从备份文件恢复数据库，需要管理员权限。
        警告：此操作会覆盖当前的数据库内容。

        请求体：
        - filename: 备份文件名（必填）
        """
        try:
            data = ns_system.payload
            filename = data.get("filename")

            if not filename:
                return APIResponse.error(message="请提供备份文件名", status_code=400)

            basedir = os.path.abspath(os.path.dirname(__file__))
            backup_dir = os.path.join(basedir, "..", "backups")
            backup_path = os.path.join(backup_dir, filename)
            target_path = os.path.join(basedir, "..", "instance", "score_management.db")

            if not os.path.exists(backup_path):
                return APIResponse.error(message="备份文件不存在", status_code=404)

            shutil.copy2(backup_path, target_path)
            return APIResponse.success(message="数据库恢复成功")
        except Exception as e:
            return APIResponse.error(message=f"恢复失败: {str(e)}", status_code=500)


@ns_system.route("/clear-cache")
class SystemClearCache(Resource):

    @ns_system.doc("clear_cache", description="清理缓存", security="Bearer")
    @ns_system.response(200, "清理成功")
    @ns_system.response(500, "清理失败")
    @requires_permission("system.cache")
    def post(self):
        """
        清理缓存

        清理Python缓存文件（__pycache__），需要管理员权限。
        """
        try:
            basedir = os.path.abspath(os.path.dirname(__file__))
            cache_dir = os.path.join(basedir, "..", "__pycache__")

            if os.path.exists(cache_dir):
                shutil.rmtree(cache_dir)

            for root, dirs, files in os.walk(os.path.join(basedir, "..")):
                for dir in dirs:
                    if dir == "__pycache__":
                        shutil.rmtree(os.path.join(root, dir))

            return APIResponse.success(message="缓存清理成功")
        except Exception as e:
            return APIResponse.error(message=f"清理失败: {str(e)}", status_code=500)


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
        return cache_service.get_stats()

    @ns_system.doc("flush_cache", description="刷新缓存", security="Bearer")
    @ns_system.response(200, "成功")
    @requires_permission("system.cache")
    def post(self):
        """
        刷新缓存

        清空所有缓存数据，需要管理员权限。
        """
        result = cache_service.flush_all()  # noqa: F841
        if result:
            return APIResponse.success(message="缓存刷新成功")
        else:
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


# 性能监控相关端点


@ns_system.route("/health")
class SystemHealth(Resource):

    @ns_system.doc("get_system_health", description="获取系统健康状态")
    @ns_system.response(200, "成功")
    @requires_permission("system.view")
    def get(self):
        """
        获取系统健康状态

        返回系统各组件的健康状态，包括数据库、Redis、MQTT等。
        """
        health_status = {"timestamp": datetime.now().isoformat(), "status": "healthy", "components": {}}

        # 批量获取系统资源信息，减少系统调用次数
        try:
            cpu_percent = psutil.cpu_percent(interval=0.05)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
        except Exception:
            cpu_percent = None
            memory = None
            disk = None
            health_status["status"] = "degraded"

        # 检查数据库连接（单次连接）
        try:
            with db.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            health_status["components"]["database"] = {"status": "healthy", "message": "数据库连接正常"}
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["components"]["database"] = {"status": "unhealthy", "message": f"数据库连接失败: {str(e)}"}

        # 检查Redis缓存
        try:
            redis_stats = cache_service.get_stats()
            health_status["components"]["redis"] = {
                "status": "healthy" if redis_stats.get("redis_available") else "degraded",
                "message": "Redis可用" if redis_stats.get("redis_available") else "使用内存缓存",
                "hit_rate": redis_stats.get("hit_rate", "N/A"),
                "operations": redis_stats.get("total_operations", 0),
            }
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["components"]["redis"] = {"status": "unhealthy", "message": f"Redis连接失败: {str(e)}"}

        # 检查MQTT连接
        try:
            mqtt_connected = False
            mqtt_message = "MQTT未连接"
            if mqtt_manager and hasattr(mqtt_manager, "is_connected"):
                mqtt_connected = mqtt_manager.is_connected
                mqtt_message = "MQTT连接正常" if mqtt_connected else "MQTT连接断开"

            health_status["components"]["mqtt"] = {
                "status": "healthy" if mqtt_connected else "degraded",
                "message": mqtt_message,
            }
        except Exception as e:
            health_status["components"]["mqtt"] = {"status": "unknown", "message": f"MQTT状态检查失败: {str(e)}"}

        # 检查CPU状态
        if cpu_percent is not None:
            if cpu_percent < 80:
                cpu_status = "healthy"
                cpu_message = f"CPU使用率 {cpu_percent}%"
            elif cpu_percent < 95:
                cpu_status = "warning"
                cpu_message = f"CPU使用率较高 {cpu_percent}%"
            else:
                cpu_status = "critical"
                cpu_message = f"CPU使用率过高 {cpu_percent}%"

            health_status["components"]["cpu"] = {
                "status": cpu_status,
                "message": cpu_message,
                "usage_percent": cpu_percent,
            }
        else:
            health_status["components"]["cpu"] = {"status": "unknown", "message": "CPU检查失败"}

        # 检查内存状态
        if memory is not None:
            if memory.percent < 80:
                memory_status = "healthy"
                memory_message = f"内存使用率 {memory.percent}%"
            elif memory.percent < 95:
                memory_status = "warning"
                memory_message = f"内存使用率较高 {memory.percent}%"
            else:
                memory_status = "critical"
                memory_message = f"内存使用率过高 {memory.percent}%"

            health_status["components"]["memory"] = {
                "status": memory_status,
                "message": memory_message,
                "usage_percent": memory.percent,
                "available": memory.available,
            }
        else:
            health_status["components"]["memory"] = {"status": "unknown", "message": "内存检查失败"}

        # 检查磁盘状态
        if disk is not None:
            if disk.percent < 80:
                disk_status = "healthy"
                disk_message = f"磁盘使用率 {disk.percent}%"
            elif disk.percent < 95:
                disk_status = "warning"
                disk_message = f"磁盘使用率较高 {disk.percent}%"
            else:
                disk_status = "critical"
                disk_message = f"磁盘使用率过高 {disk.percent}%"

            health_status["components"]["disk"] = {
                "status": disk_status,
                "message": disk_message,
                "usage_percent": disk.percent,
                "free": disk.free,
            }
        else:
            health_status["components"]["disk"] = {"status": "unknown", "message": "磁盘检查失败"}

        return health_status


@ns_system.route("/performance")
class SystemPerformance(Resource):

    @ns_system.doc("get_system_performance", description="获取系统性能指标")
    @ns_system.response(200, "成功")
    @requires_permission("system.view")
    def get(self):
        """
        获取系统性能指标

        返回CPU、内存、磁盘等系统资源使用情况，以及API性能统计。
        """
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()

            memory = psutil.virtual_memory()

            disk = psutil.disk_usage("/")

            net_io = psutil.net_io_counters()

            process = psutil.Process()
            process_memory = process.memory_info()

            perf_metrics = performance_monitor.get_metrics()
            perf_summary = perf_metrics.get_summary()
            slow_requests = perf_metrics.get_slow_requests(10)
            slow_queries = perf_metrics.get_slow_queries(10)
            suggestions = perf_metrics.get_optimization_suggestions()

            return {
                "timestamp": datetime.now().isoformat(),
                "system": {
                    "cpu": {
                        "percent": cpu_percent,
                        "count": cpu_count,
                        "frequency": {
                            "current": cpu_freq.current if cpu_freq else None,
                            "min": cpu_freq.min if cpu_freq else None,
                            "max": cpu_freq.max if cpu_freq else None,
                        },
                    },
                    "memory": {
                        "total": memory.total,
                        "available": memory.available,
                        "used": memory.used,
                        "percent": memory.percent,
                    },
                    "disk": {"total": disk.total, "used": disk.used, "free": disk.free, "percent": disk.percent},
                    "network": {
                        "bytes_sent": net_io.bytes_sent,
                        "bytes_recv": net_io.bytes_recv,
                        "packets_sent": net_io.packets_sent,
                        "packets_recv": net_io.packets_recv,
                    },
                    "process": {
                        "pid": process.pid,
                        "memory_rss": process_memory.rss,
                        "memory_vms": process_memory.vms,
                        "cpu_percent": process.cpu_percent(),
                        "threads": process.num_threads(),
                    },
                },
                "api_performance": {
                    "uptime": perf_summary["uptime_formatted"],
                    "total_requests": perf_summary["total_requests"],
                    "total_queries": perf_summary["total_queries"],
                    "cache": perf_summary["cache"],
                    "overall": perf_summary["overall"],
                    "request_stats": perf_summary["request_stats"],
                    "query_stats": perf_summary["query_stats"],
                },
                "slow_requests": slow_requests,
                "slow_queries": slow_queries,
                "optimization_suggestions": suggestions,
            }
        except Exception as e:
            return APIResponse.error(message=f"获取性能指标失败: {str(e)}", status_code=500)


frontend_performance_model = ns_system.model(
    "FrontendPerformance",
    {
        "type": fields.String(required=True, description="指标类型"),
        "name": fields.String(required=True, description="指标名称"),
        "value": fields.Float(required=True, description="指标值"),
        "unit": fields.String(description="单位"),
        "page": fields.String(description="页面名称"),
        "timestamp": fields.String(description="时间戳"),
        "user_agent": fields.String(description="用户代理"),
        "screen_width": fields.Integer(description="屏幕宽度"),
        "screen_height": fields.Integer(description="屏幕高度"),
        "data": fields.Raw(description="附加数据"),
    },
)

frontend_performance_batch_model = ns_system.model(
    "FrontendPerformanceBatch",
    {"metrics": fields.List(fields.Nested(frontend_performance_model), required=True, description="性能指标列表")},
)

frontend_error_model = ns_system.model(
    "FrontendError",
    {
        "type": fields.String(required=True, description="错误类型"),
        "message": fields.String(required=True, description="错误消息"),
        "stack": fields.String(description="堆栈信息"),
        "file": fields.String(description="文件路径"),
        "line": fields.Integer(description="行号"),
        "column": fields.Integer(description="列号"),
        "page": fields.String(description="页面名称"),
        "url": fields.String(description="请求URL"),
        "method": fields.String(description="请求方法"),
        "status": fields.Integer(description="HTTP状态码"),
        "timestamp": fields.String(description="时间戳"),
        "user_agent": fields.String(description="用户代理"),
        "data": fields.Raw(description="附加数据"),
    },
)


@ns_system.route("/frontend-performance")
class FrontendPerformance(Resource):

    @ns_system.doc("submit_frontend_performance", description="上报前端性能指标（匿名允许，限频保护）")
    @ns_system.expect(frontend_performance_model)
    @ns_system.response(200, "成功")
    @ns_system.response(400, "参数错误")
    @ns_system.response(429, "请求过于频繁")
    @rate_limit("frontend_performance")
    def post(self):
        """
        上报前端性能指标

        接收前端上报的Web Vitals、API请求时间等性能数据。
        限流：60次/分钟
        """
        try:
            data = ns_system.payload
            valid, msg = validate_performance_data(data)
            if not valid:
                return APIResponse.error(message=msg, status_code=400)

            logger.info(f'前端性能指标上报: {data.get("type")} - {data.get("name")} = {data.get("value")}')
            return APIResponse.success(message="性能指标接收成功")
        except Exception as e:
            logger.error(f"接收前端性能指标失败: {str(e)}")
            return APIResponse.error(message=f"接收失败: {str(e)}", status_code=500)


@ns_system.route("/frontend-performance/batch")
class FrontendPerformanceBatch(Resource):

    @ns_system.doc("submit_frontend_performance_batch", description="批量上报前端性能指标（匿名允许，限频保护）")
    @ns_system.expect(frontend_performance_batch_model)
    @ns_system.response(200, "成功")
    @ns_system.response(400, "参数错误")
    @ns_system.response(429, "请求过于频繁")
    @rate_limit("frontend_performance_batch")
    def post(self):
        """
        批量上报前端性能指标

        接收多个前端性能指标数据，减少请求次数。
        限流：60次/分钟，单次最多100条
        """
        try:
            data = ns_system.payload
            metrics = data.get("metrics", [])

            if not isinstance(metrics, list):
                return APIResponse.error(message="metrics 必须是数组", status_code=400)

            if len(metrics) > 100:
                return APIResponse.error(message="单次最多上报100条指标", status_code=400)

            valid_count = 0
            for metric in metrics:
                valid, msg = validate_performance_data(metric)
                if not valid:
                    logger.warning(f"批量上报中跳过无效数据: {msg}")
                    continue
                valid_count += 1

            logger.info(f"批量接收前端性能指标: {valid_count}/{len(metrics)} 条有效")
            return APIResponse.success(message=f"成功接收 {valid_count} 条性能指标")
        except Exception as e:
            logger.error(f"批量接收前端性能指标失败: {str(e)}")
            return APIResponse.error(message=f"接收失败: {str(e)}", status_code=500)


@ns_system.route("/frontend-error")
class FrontendError(Resource):

    @ns_system.doc("submit_frontend_error", description="上报前端错误（匿名允许，限频保护）")
    @ns_system.expect(frontend_error_model)
    @ns_system.response(200, "成功")
    @ns_system.response(400, "参数错误")
    @ns_system.response(429, "请求过于频繁")
    @rate_limit("frontend_error")
    def post(self):
        """
        上报前端错误

        接收前端捕获的JavaScript错误、API请求错误等。
        限流：30次/分钟
        """
        try:
            data = ns_system.payload
            valid, msg = validate_error_data(data)
            if not valid:
                return APIResponse.error(message=msg, status_code=400)

            logger.error(f'前端错误上报: {data.get("type")} - {data.get("message")}')
            return APIResponse.success(message="错误信息接收成功")
        except Exception as e:
            logger.error(f"接收前端错误失败: {str(e)}")
            return APIResponse.error(message=f"接收失败: {str(e)}", status_code=500)


@ns_system.route("/stats")
class SystemStats(Resource):

    @ns_system.doc("get_system_stats", description="获取系统统计信息")
    @ns_system.response(200, "成功")
    @requires_permission("system.view")
    def get(self):
        """
        获取系统统计信息

        返回系统的综合统计数据，包括用户数、积分记录数等。
        """
        try:
            cache_stats = cache_service.get_stats()

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
                                        text("SELECT COUNT(*) FROM " + table)  # nosec B608 - table is whitelisted
                                    ).scalar()
                                    or 0
                                )
                            except Exception as e2:
                                logger.error(f"系统统计单表 {table} 计数查询失败: {e2}")
                                return APIResponse.error(
                                    message=f"系统统计查询失败（{table}），数据不完整", status_code=500
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
        except Exception as e:
            return APIResponse.error(message=f"获取系统统计失败: {str(e)}", status_code=500)
