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
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "status": "healthy",
            "components": {},
        }
        cpu_percent, memory, disk = _check_system_resources()
        if cpu_percent is None:
            health_status["status"] = "degraded"
        _check_database_health(health_status)
        _check_redis_health(health_status)
        _check_mqtt_health(health_status)
        _fill_cpu_component(health_status, cpu_percent)
        _fill_memory_component(health_status, memory)
        _fill_disk_component(health_status, disk)
        return APIResponse.success(data=health_status)

@ns_system.route("/performance")
class SystemPerformance(Resource):

    @ns_system.doc("get_system_performance", description="获取系统性能指标")
    @ns_system.response(200, "成功")
    @requires_permission("system.view")
    @safe_handle(default_status=500, message="获取性能指标失败")
    def get(self):
        """
        获取系统性能指标

        返回CPU、内存、磁盘等系统资源使用情况，以及API性能统计。
        """
        cpu_percent = psutil.cpu_percent(interval=None)
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
                "disk": {
                    "total": disk.total,
                    "used": disk.used,
                    "free": disk.free,
                    "percent": disk.percent,
                },
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

@ns_system.route("/frontend-performance")
class FrontendPerformance(Resource):

    @ns_system.doc(
        "submit_frontend_performance", description="上报前端性能指标（匿名允许，限频保护）"
    )
    @ns_system.expect(frontend_performance_model)
    @ns_system.response(200, "成功")
    @ns_system.response(400, "参数错误")
    @ns_system.response(429, "请求过于频繁")
    @rate_limit("frontend_performance")
    @safe_handle(default_status=500, message="接收失败")
    def post(self):
        """
        上报前端性能指标

        接收前端上报的Web Vitals、API请求时间等性能数据。
        限流：60次/分钟
        """
        data = ns_system.payload
        valid, msg = validate_performance_data(data)
        if not valid:
            return APIResponse.error(message=msg, status_code=400)

        persist_perf_metric(data)
        logger.info(
            f'前端性能指标上报: {data.get("type")} - {data.get("name")} = {data.get("value")}'
        )
        return APIResponse.success(message="性能指标接收成功")

@ns_system.route("/frontend-performance/batch")
class FrontendPerformanceBatch(Resource):

    @ns_system.doc(
        "submit_frontend_performance_batch",
        description="批量上报前端性能指标（匿名允许，限频保护）",
    )
    @ns_system.expect(frontend_performance_batch_model)
    @ns_system.response(200, "成功")
    @ns_system.response(400, "参数错误")
    @ns_system.response(429, "请求过于频繁")
    @rate_limit("frontend_performance_batch")
    @safe_handle(default_status=500, message="接收失败")
    def post(self):
        """
        批量上报前端性能指标

        接收多个前端性能指标数据，减少请求次数。
        限流：60次/分钟，单次最多100条
        """
        data = ns_system.payload
        metrics = data.get("metrics", [])

        if not isinstance(metrics, list):
            return APIResponse.error(message="metrics 必须是数组", status_code=400)

        if len(metrics) > 100:
            return APIResponse.error(message="单次最多上报100条指标", status_code=400)

        valid_metrics = []
        for metric in metrics:
            valid, msg = validate_performance_data(metric)
            if not valid:
                logger.warning(f"批量上报中跳过无效数据: {msg}")
                continue
            valid_metrics.append(metric)

        if valid_metrics:
            bulk_persist_perf_metrics(valid_metrics)

        valid_count = len(valid_metrics)
        logger.info(f"批量接收前端性能指标: {valid_count}/{len(metrics)} 条有效")
        return APIResponse.success(message=f"成功接收 {valid_count} 条性能指标")

@ns_system.route("/frontend-error")
class FrontendError(Resource):

    @ns_system.doc("submit_frontend_error", description="上报前端错误（匿名允许，限频保护）")
    @ns_system.expect(frontend_error_model)
    @ns_system.response(200, "成功")
    @ns_system.response(400, "参数错误")
    @ns_system.response(429, "请求过于频繁")
    @rate_limit("frontend_error")
    @safe_handle(default_status=500, message="接收失败")
    def post(self):
        """
        上报前端错误

        接收前端捕获的JavaScript错误、API请求错误等。
        限流：30次/分钟
        """
        data = ns_system.payload
        valid, msg = validate_error_data(data)
        if not valid:
            return APIResponse.error(message=msg, status_code=400)

        persist_frontend_error(data)
        logger.error(f'前端错误上报: {data.get("type")} - {data.get("message")}')
        return APIResponse.success(message="错误信息接收成功")

@ns_system.route("/frontend-metrics")
class FrontendMetricsList(Resource):

    @ns_system.doc("get_frontend_metrics", description="查看已落库的前端性能指标")
    @ns_system.response(200, "成功")
    @requires_permission("ops_center.view")
    @safe_handle(default_status=500, message="获取前端指标失败")
    def get(self):
        """分页查看前端性能/自定义指标上报记录（运维中心）。"""
        metric_type = request.args.get("metric_type")
        name = request.args.get("name")
        hours = get_int_arg("hours", default=24)
        page, per_page = get_pagination(default=50)

        query = FrontendPerfMetric.query
        if metric_type:
            query = query.filter(FrontendPerfMetric.metric_type == metric_type)
        if name:
            query = query.filter(FrontendPerfMetric.name == name)
        if hours > 0:
            since = datetime.now() - timedelta(hours=hours)
            query = query.filter(FrontendPerfMetric.created_at >= since)

        pagination = query.order_by(FrontendPerfMetric.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        items = [
            {
                "id": m.id,
                "metric_type": m.metric_type,
                "name": m.name,
                "value": m.value,
                "unit": m.unit,
                "page": m.page,
                "detail": m.detail,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in pagination.items
        ]
        return APIResponse.success(
            data={
                "items": items,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        )

@ns_system.route("/frontend-errors")
class FrontendErrorList(Resource):

    @ns_system.doc("get_frontend_errors", description="查看已落库的前端错误")
    @ns_system.response(200, "成功")
    @requires_permission("ops_center.view")
    @safe_handle(default_status=500, message="获取前端错误失败")
    def get(self):
        """分页查看前端错误上报记录（运维中心）。"""
        error_type = request.args.get("error_type")
        hours = get_int_arg("hours", default=24)
        page, per_page = get_pagination(default=50)

        query = FrontendErrorLog.query
        if error_type:
            query = query.filter(FrontendErrorLog.error_type == error_type)
        if hours > 0:
            since = datetime.now() - timedelta(hours=hours)
            query = query.filter(FrontendErrorLog.created_at >= since)

        pagination = query.order_by(FrontendErrorLog.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        items = [
            {
                "id": e.id,
                "error_type": e.error_type,
                "message": e.message,
                "page": e.page,
                "url": e.url,
                "method": e.method,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in pagination.items
        ]
        return APIResponse.success(
            data={
                "items": items,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        )

@ns_system.route("/metrics")
class SystemMetricsList(Resource):

    @ns_system.doc("get_system_metrics", description="查看系统指标历史采样")
    @ns_system.response(200, "成功")
    @requires_permission("ops_center.view")
    @safe_handle(default_status=500, message="获取系统指标失败")
    def get(self):
        """分页查看系统指标历史采样（CPU/内存/磁盘/网络），并提供各指标最新值概览。"""
        metric_name = request.args.get("metric_name")
        category = request.args.get("category")
        hours = get_int_arg("hours", default=24)
        page, per_page = get_pagination(default=200)

        query = SystemMetric.query
        if metric_name:
            query = query.filter(SystemMetric.metric_name == metric_name)
        if category:
            query = query.filter(SystemMetric.category == category)
        if hours > 0:
            since = datetime.now() - timedelta(hours=hours)
            query = query.filter(SystemMetric.created_at >= since)

        # 各指标最新值（用于趋势卡片）
        latest = {}
        names = (
            [metric_name]
            if metric_name
            else ["cpu_percent", "memory_percent", "disk_percent", "net_sent", "net_recv"]
        )
        for nm in names:
            row = (
                SystemMetric.query.filter(SystemMetric.metric_name == nm)
                .order_by(SystemMetric.created_at.desc())
                .first()
            )
            if row:
                latest[nm] = {
                    "value": row.metric_value,
                    "unit": row.unit,
                    "updated_at": row.created_at.isoformat() if row.created_at else None,
                }

        pagination = query.order_by(SystemMetric.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        items = [
            {
                "id": s.id,
                "metric_name": s.metric_name,
                "metric_value": s.metric_value,
                "unit": s.unit,
                "category": s.category,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in pagination.items
        ]
        return APIResponse.success(
            data={
                "items": items,
                "latest": latest,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        )
