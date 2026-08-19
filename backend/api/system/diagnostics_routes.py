import logging

from flask_restx import Namespace, Resource, fields
from utils.diagnostics import HealthChecker, error_tracker
from utils.performance_monitor import PerformanceMonitor
from utils.permission import requires_permission
from utils.response import APIResponse
import os
import psutil
import platform

from datetime import datetime

logger = logging.getLogger(__name__)

"""
系统诊断API路由
提供系统健康检查、性能监控和错误追踪功能
"""
ns_diagnostics = Namespace("diagnostics", description="系统诊断相关操作")
health_status_model = ns_diagnostics.model(
    "HealthStatus",
    {
        "status": fields.String(description="健康状态"),
        "timestamp": fields.String(description="检查时间"),
        "components": fields.Nested(
            ns_diagnostics.model(
                "HealthComponents",
                {
                    "database": fields.Nested(
                        ns_diagnostics.model(
                            "ComponentStatus", {"status": fields.String, "message": fields.String}
                        )
                    ),
                    "redis": fields.Nested(
                        ns_diagnostics.model(
                            "ComponentStatus", {"status": fields.String, "message": fields.String}
                        )
                    ),
                    "mqtt": fields.Nested(
                        ns_diagnostics.model(
                            "ComponentStatus", {"status": fields.String, "message": fields.String}
                        )
                    ),
                    "cpu": fields.Nested(
                        ns_diagnostics.model(
                            "ComponentStatus", {"status": fields.String, "message": fields.String}
                        )
                    ),
                    "memory": fields.Nested(
                        ns_diagnostics.model(
                            "ComponentStatus", {"status": fields.String, "message": fields.String}
                        )
                    ),
                    "disk": fields.Nested(
                        ns_diagnostics.model(
                            "ComponentStatus", {"status": fields.String, "message": fields.String}
                        )
                    ),
                },
            )
        ),
    },
)
performance_model = ns_diagnostics.model(
    "PerformanceData",
    {
        "total_requests": fields.Integer(description="总请求数"),
        "avg_duration": fields.Float(description="平均响应时间(ms)"),
        "slow_request_count": fields.Integer(description="慢请求数"),
        "total_time": fields.Float(description="总耗时(ms)"),
        "slow_requests": fields.List(
            fields.Nested(
                ns_diagnostics.model(
                    "SlowRequest",
                    {
                        "timestamp": fields.String,
                        "method": fields.String,
                        "endpoint": fields.String,
                        "status_code": fields.Integer,
                        "duration": fields.Float,
                    },
                )
            )
        ),
    },
)
error_model = ns_diagnostics.model(
    "ErrorData",
    {
        "recent_errors": fields.List(
            fields.Nested(
                ns_diagnostics.model(
                    "SystemError",
                    {
                        "type": fields.String,
                        "message": fields.String,
                        "timestamp": fields.String,
                        "traceback": fields.String,
                    },
                )
            )
        ),
    },
)
system_model = ns_diagnostics.model(
    "SystemData",
    {
        "system": fields.Nested(
            ns_diagnostics.model(
                "SystemInfo",
                {
                    "platform": fields.String,
                    "platform_version": fields.String,
                    "python_version": fields.String,
                    "cpu_count": fields.Integer,
                },
            )
        ),
        "process": fields.Nested(
            ns_diagnostics.model(
                "ProcessInfo",
                {
                    "pid": fields.Integer,
                    "status": fields.String,
                    "threads": fields.Integer,
                    "create_time": fields.String,
                },
            )
        ),
    },
)


@ns_diagnostics.route("/health")
class HealthCheck(Resource):
    @ns_diagnostics.doc("health_check", description="健康检查")
    @requires_permission("system.view")
    def get(self):
        """系统健康检查"""
        try:
            checker = HealthChecker()
            components = {
                "database": checker.check_database(),
                "redis": checker.check_redis(),
                "mqtt": checker.check_mqtt(),
                "cpu": checker.check_cpu_usage(),
                "memory": checker.check_memory_usage(),
                "disk": checker.check_disk_space(),
            }
            result = {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "components": components,
            }
            # 汇总整体状态
            for comp in components.values():
                if comp.get("status") == "unhealthy" or comp.get("status") == "critical":
                    result["status"] = "unhealthy"
                    break
                if comp.get("status") in ("degraded", "warning"):
                    result["status"] = "degraded"
            return APIResponse.success(data=result)
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/performance")
class PerformanceInfo(Resource):
    @ns_diagnostics.doc("performance_info", description="性能监控")
    @requires_permission("system.settings")
    def get(self):
        """获取性能监控数据"""
        try:
            monitor = PerformanceMonitor()
            metrics = monitor.get_metrics()
            summary = metrics.get_summary() or {}
            overall = summary.get("overall", {}) or {}
            avg_duration_ms = overall.get("avg_response_time", 0) or 0
            total_requests = summary.get("total_requests", 0) or 0
            slow_requests = metrics.get_slow_requests(20)
            result = {
                "total_requests": total_requests,
                "avg_duration": round(avg_duration_ms / 1000.0, 4),  # 转秒，与前端 's' 单位一致
                "slow_request_count": summary.get("slow_request_count", 0) or 0,
                "total_time": round(avg_duration_ms * total_requests / 1000.0, 2),  # 秒
                "slow_requests": slow_requests,
            }
            return APIResponse.success(data=result)
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/errors")
class ErrorInfo(Resource):
    @ns_diagnostics.doc("error_info", description="错误追踪")
    @requires_permission("system.settings")
    def get(self):
        """获取最近错误信息"""
        try:
            recent_errors = error_tracker.get_recent_errors(limit=50)
            result = {
                "recent_errors": recent_errors,
            }
            return APIResponse.success(data=result)
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/system")
class SystemInfo(Resource):
    @ns_diagnostics.doc("system_info", description="系统信息")
    @requires_permission("system.settings")
    def get(self):
        """获取系统信息"""
        try:
            process = psutil.Process()
            result = {  # noqa: F841
                "system": {
                    "platform": platform.system(),
                    "platform_version": platform.version(),
                    "python_version": platform.python_version(),
                    "cpu_count": psutil.cpu_count() or 0,
                },
                "process": {
                    "pid": process.pid,
                    "status": process.status(),
                    "threads": process.num_threads(),
                    "create_time": datetime.fromtimestamp(process.create_time()).isoformat(),
                },
            }
            return APIResponse.success(data=result)
        except ImportError:
            result = {  # noqa: F841
                "system": {
                    "platform": platform.system(),
                    "platform_version": platform.version(),
                    "python_version": platform.python_version(),
                    "cpu_count": os.cpu_count() or 0,
                },
                "process": {
                    "pid": os.getpid(),
                    "status": "running",
                    "threads": 1,
                },
            }
            return APIResponse.success(data=result)
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/memory")
class MemoryInfo(Resource):
    @ns_diagnostics.doc("memory_info", description="内存信息")
    @requires_permission("system.settings")
    def get(self):
        """获取内存使用信息"""
        try:
            checker = HealthChecker()
            memory_info = checker.check_memory_usage()
            return APIResponse.success(data={"memory": memory_info})
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/cpu")
class CPUInfo(Resource):
    @ns_diagnostics.doc("cpu_info", description="CPU信息")
    @requires_permission("system.settings")
    def get(self):
        """获取CPU使用信息"""
        try:
            checker = HealthChecker()
            cpu_info = checker.check_cpu_usage()
            return APIResponse.success(data={"cpu": cpu_info})
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/disk")
class DiskInfo(Resource):
    @ns_diagnostics.doc("disk_info", description="磁盘信息")
    @requires_permission("system.settings")
    def get(self):
        """获取磁盘空间信息"""
        try:
            checker = HealthChecker()
            disk_info = checker.check_disk_space()
            return APIResponse.success(data={"disk": disk_info})
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)


@ns_diagnostics.route("/clear-cache")
class ClearCache(Resource):
    @ns_diagnostics.doc("clear_diagnostics_cache", description="清除诊断缓存")
    @requires_permission("system.settings")
    def post(self):
        """清除性能监控缓存"""
        try:
            monitor = PerformanceMonitor()
            monitor.clear_stats()
            return APIResponse.success(message="缓存已清除")
        except Exception as e:
            logger.error("diagnostics_routes.py: %s", e)
            return APIResponse.error(message="诊断失败，请稍后重试", status_code=500)
