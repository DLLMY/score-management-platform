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

logger = logging.getLogger(__name__)

RATE_LIMIT = {
    "frontend_performance": {"limit": 60, "window": 60},
    # batch：前端默认 5s flush 一次（12 次/分钟），10 次/分钟会必然触发 429 导致性能数据丢失；
    # 放宽到 60 次/分钟（多标签页也有余量），前端另有 429 退避兜底
    "frontend_performance_batch": {"limit": 60, "window": 60},
    "frontend_error": {"limit": 30, "window": 60},
}

rate_limit_store: dict[str, dict[str, float | int]] = {}

from utils.logger import log_warning

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
                    message="请求过于频繁，请稍后再试",
                    status_code=429,
                    headers={"Retry-After": str(wait_time)},
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

    if (
        "unit" in data
        and data["unit"] is not None
        and (not isinstance(data["unit"], str) or len(data["unit"]) > 50)
    ):
        return False, "unit 必须是字符串且长度不超过50"

    if (
        "page" in data
        and data["page"] is not None
        and (not isinstance(data["page"], str) or len(data["page"]) > 200)
    ):
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

    if (
        "stack" in data
        and data["stack"] is not None
        and (not isinstance(data["stack"], str) or len(data["stack"]) > 5000)
    ):
        return False, "stack 必须是字符串且长度不超过5000"

    if (
        "file" in data
        and data["file"] is not None
        and (not isinstance(data["file"], str) or len(data["file"]) > 500)
    ):
        return False, "file 必须是字符串且长度不超过500"

    if "line" in data and data["line"] is not None and not isinstance(data["line"], int):
        return False, "line 必须是整数"

    if "column" in data and data["column"] is not None and not isinstance(data["column"], int):
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
        # 差异 #4 阶段 1：设备白名单开关（默认 false = 允许未登记设备上报即注册）
        "device_whitelist_enabled": fields.Boolean(description="设备白名单开关"),
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

# 性能监控相关端点

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
    {
        "metrics": fields.List(
            fields.Nested(frontend_performance_model), required=True, description="性能指标列表"
        )
    },
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

# ---------- 运维中心：前端遥测 / 系统指标查看 ----------

def _check_system_resources():
    """批量采集 CPU/内存/磁盘；失败返回 (None, None, None) 并标记 degraded。"""
    try:
        return psutil.cpu_percent(interval=None), psutil.virtual_memory(), psutil.disk_usage("/")
    except Exception:
        return None, None, None

def _check_database_health(health_status):
    try:
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health_status["components"]["database"] = {"status": "healthy", "message": "数据库连接正常"}
    except Exception:
        logger.exception("系统健康检查: 数据库连接检查失败")
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {"status": "unhealthy", "message": "数据库连接失败"}

def _check_redis_health(health_status):
    try:
        redis_stats = get_cache_service().get_stats()
        health_status["components"]["redis"] = {
            "status": "healthy" if redis_stats.get("redis_available") else "degraded",
            "message": "Redis可用" if redis_stats.get("redis_available") else "使用内存缓存",
            "hit_rate": redis_stats.get("hit_rate", "N/A"),
            "operations": redis_stats.get("total_operations", 0),
        }
    except Exception:
        health_status["status"] = "unhealthy"
        health_status["components"]["redis"] = {"status": "unhealthy", "message": "Redis连接失败"}

def _check_mqtt_health(health_status):
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
    except Exception:
        logger.exception("系统健康检查: MQTT状态检查失败")
        health_status["components"]["mqtt"] = {"status": "unknown", "message": "MQTT状态检查失败"}

def _resource_status(label, percent, warn=80, crit=95):
    if percent < warn:
        return "healthy", f"{label}使用率 {percent}%"
    if percent < crit:
        return "warning", f"{label}使用率较高 {percent}%"
    return "critical", f"{label}使用率过高 {percent}%"

def _fill_cpu_component(health_status, cpu_percent):
    if cpu_percent is None:
        health_status["components"]["cpu"] = {"status": "unknown", "message": "CPU检查失败"}
        return
    status, message = _resource_status("CPU", cpu_percent)
    health_status["components"]["cpu"] = {
        "status": status,
        "message": message,
        "usage_percent": cpu_percent,
    }

def _fill_memory_component(health_status, memory):
    if memory is None:
        health_status["components"]["memory"] = {"status": "unknown", "message": "内存检查失败"}
        return
    status, message = _resource_status("内存", memory.percent)
    health_status["components"]["memory"] = {
        "status": status,
        "message": message,
        "usage_percent": memory.percent,
        "available": memory.available,
    }

def _fill_disk_component(health_status, disk):
    if disk is None:
        health_status["components"]["disk"] = {"status": "unknown", "message": "磁盘检查失败"}
        return
    status, message = _resource_status("磁盘", disk.percent)
    health_status["components"]["disk"] = {
        "status": status,
        "message": message,
        "usage_percent": disk.percent,
        "free": disk.free,
    }

import api.system._system_part1
import api.system._system_part2
