from datetime import datetime
from flask import jsonify
from functools import wraps
import os
import ctypes
import platform
import logging

"""
问题诊断与性能监控模块
提供系统健康检查、性能诊断、错误追踪和日志分析功能
"""
logger = logging.getLogger(__name__)
try:
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil not installed, system metrics will be limited")


class HealthChecker:
    """健康检查器"""

    def __init__(self, app=None, db=None, redis_client=None, mqtt_service=None):
        self.app = app
        self.db = db
        self.redis_client = redis_client
        self.mqtt_service = mqtt_service
        self.checks = []

    def register_check(self, name, check_func, critical=True):
        """注册健康检查"""
        self.checks.append({"name": name, "check": check_func, "critical": critical})

    def check_database(self):
        """检查数据库连接"""
        try:
            if self.db:
                self.db.session.execute("SELECT 1")
                return {"status": "healthy", "message": "数据库连接正常"}
            return {"status": "unknown", "message": "数据库未配置"}
        except Exception as e:
            return {"status": "unhealthy", "message": f"数据库连接失败: {str(e)}"}

    def check_redis(self):
        """检查Redis连接"""
        try:
            if self.redis_client:
                self.redis_client.ping()
                return {"status": "healthy", "message": "Redis连接正常"}
            return {"status": "unknown", "message": "Redis未配置"}
        except Exception as e:
            return {"status": "unhealthy", "message": f"Redis连接失败: {str(e)}"}

    def check_mqtt(self):
        """检查MQTT连接"""
        try:
            if self.mqtt_service:
                if hasattr(self.mqtt_service, "is_connected") and self.mqtt_service.is_connected():
                    return {"status": "healthy", "message": "MQTT连接正常"}
                return {"status": "degraded", "message": "MQTT连接断开"}
            return {"status": "unknown", "message": "MQTT未配置"}
        except Exception as e:
            return {"status": "unhealthy", "message": f"MQTT连接失败: {str(e)}"}

    def check_disk_space(self):
        """检查磁盘空间（跨平台兼容）"""
        try:
            if os.name == "nt":
                # Windows 平台
                free_bytes = ctypes.c_ulonglong(0)
                total_bytes = ctypes.c_ulonglong(0)
                ctypes.windll.kernel32.GetDiskFreeSpaceExW(
                    ctypes.c_wchar_p("C:\\"), None, ctypes.pointer(total_bytes), ctypes.pointer(free_bytes)
                )
                free_space = free_bytes.value
                total_space = total_bytes.value
            else:
                # Unix/Linux 平台
                disk = os.statvfs("/")
                free_space = disk.f_bavail * disk.f_frsize
                total_space = disk.f_blocks * disk.f_frsize
            if total_space == 0:
                return {"status": "unknown", "message": "无法获取磁盘信息"}
            free_percent = (free_space / total_space) * 100
            if free_percent < 10:
                return {"status": "critical", "message": f"磁盘空间不足: {free_percent:.1f}%"}
            elif free_percent < 20:
                return {"status": "warning", "message": f"磁盘空间较低: {free_percent:.1f}%"}
            return {"status": "healthy", "message": f"磁盘空间正常: {free_percent:.1f}%"}
        except Exception as e:
            return {"status": "unknown", "message": f"无法检查磁盘空间: {str(e)}"}

    def check_memory_usage(self):
        """检查内存使用"""
        if not PSUTIL_AVAILABLE:
            return {"status": "unknown", "message": "psutil未安装"}
        try:
            memory = psutil.virtual_memory()
            used_percent = memory.percent
            if used_percent > 90:
                return {"status": "critical", "message": f"内存使用率过高: {used_percent}%"}
            elif used_percent > 80:
                return {"status": "warning", "message": f"内存使用率较高: {used_percent}%"}
            return {"status": "healthy", "message": f"内存使用率正常: {used_percent}%"}
        except Exception as e:
            return {"status": "unknown", "message": f"无法检查内存: {str(e)}"}

    def check_cpu_usage(self):
        """检查CPU使用"""
        if not PSUTIL_AVAILABLE:
            return {"status": "unknown", "message": "psutil未安装"}
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)  # 缩短检查时间
            if cpu_percent > 95:
                return {"status": "critical", "message": f"CPU使用率过高: {cpu_percent}%"}
            elif cpu_percent > 80:
                return {"status": "warning", "message": f"CPU使用率较高: {cpu_percent}%"}
            return {"status": "healthy", "message": f"CPU使用率正常: {cpu_percent}%"}
        except Exception as e:
            return {"status": "unknown", "message": f"无法检查CPU: {str(e)}"}

    def run_all_checks(self):
        """运行所有健康检查"""
        results = {"timestamp": datetime.now().isoformat(), "status": "healthy", "checks": {}}
        # 内置检查
        results["checks"]["database"] = self.check_database()
        results["checks"]["redis"] = self.check_redis()
        results["checks"]["mqtt"] = self.check_mqtt()
        results["checks"]["disk"] = self.check_disk_space()
        results["checks"]["memory"] = self.check_memory_usage()
        results["checks"]["cpu"] = self.check_cpu_usage()
        # 自定义检查
        for check in self.checks:
            try:
                result = check["check"]()  # noqa: F841
                results["checks"][check["name"]] = result
            except Exception as e:
                results["checks"][check["name"]] = {"status": "error", "message": f"检查执行失败: {str(e)}"}
        # 确定整体状态
        for check_name, check_result in results["checks"].items():
            status = check_result.get("status", "unknown")
            if status in ["critical", "unhealthy"]:
                results["status"] = "unhealthy"
                break
            elif status == "warning":
                if results["status"] == "healthy":
                    results["status"] = "degraded"
        return results

    def register_endpoint(self, app):
        """注册健康检查端点"""

        @app.route("/api/health")
        def health_check():
            results = self.run_all_checks()
            # 根据状态返回不同HTTP状态码
            if results["status"] == "unhealthy":
                return jsonify(results), 503
            elif results["status"] == "degraded":
                return jsonify(results), 206
            return jsonify(results), 200

        @app.route("/api/health/<check_name>")
        def health_check_single(check_name):
            check_methods = {
                "database": self.check_database,
                "redis": self.check_redis,
                "mqtt": self.check_mqtt,
                "disk": self.check_disk_space,
                "memory": self.check_memory_usage,
                "cpu": self.check_cpu_usage,
            }
            if check_name in check_methods:
                result = check_methods[check_name]()  # noqa: F841
                status_code = 200 if result["status"] == "healthy" else 503
                return jsonify(result), status_code
            return jsonify({"error": "Unknown check"}), 404


class PerformanceDiagnostic:
    """性能诊断工具"""

    def __init__(self):
        self.timings = {}
        self.counters = {}
        self.peak_values = {}

    def start_timer(self, name):
        """开始计时"""
        self.timings[name] = {"start": time.time(), "count": self.timings.get(name, {}).get("count", 0)}

    def end_timer(self, name):
        """结束计时并返回耗时"""
        if name in self.timings:
            elapsed = time.time() - self.timings[name]["start"]
            self.timings[name] = {"elapsed": elapsed, "count": self.timings[name]["count"] + 1}
            return elapsed
        return None

    def increment_counter(self, name, value=1):
        """增加计数器"""
        self.counters[name] = self.counters.get(name, 0) + value

    def record_peak(self, name, value):
        """记录峰值"""
        if name not in self.peak_values or value > self.peak_values[name]:
            self.peak_values[name] = value

    def get_stats(self):
        """获取性能统计"""
        return {
            "timestamp": datetime.now().isoformat(),
            "timings": self.timings,
            "counters": self.counters,
            "peak_values": self.peak_values,
        }

    def reset(self):
        """重置统计数据"""
        self.timings = {}
        self.counters = {}
        self.peak_values = {}


class ErrorTracker:
    """错误追踪器"""

    def __init__(self):
        self.errors = []
        self.error_counts = {}
        self.last_error_time = None

    def record_error(self, error_type, message, traceback=None, context=None):
        """记录错误"""
        error = {
            "timestamp": datetime.now().isoformat(),
            "type": error_type,
            "message": str(message),
            "traceback": traceback,
            "context": context,
            "request_id": context.get("request_id") if context else None,
        }
        self.errors.append(error)
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        self.last_error_time = datetime.now()
        # 保留最近1000条错误记录
        if len(self.errors) > 1000:
            self.errors = self.errors[-1000:]
        logger.error(f"[{error_type}] {message}")

    def get_recent_errors(self, limit=50):
        """获取最近的错误"""
        return self.errors[-limit:]

    def get_error_summary(self):
        """获取错误摘要"""
        return {
            "total_errors": len(self.errors),
            "error_counts": self.error_counts,
            "last_error_time": self.last_error_time.isoformat() if self.last_error_time else None,
            "recent_errors": self.get_recent_errors(10),
        }

    def clear_errors(self):
        """清除错误记录"""
        self.errors = []
        self.error_counts = {}
        self.last_error_time = None


class RequestProfiler:
    """请求性能分析器"""

    def __init__(self):
        self.requests = []
        self.slow_requests = []
        self.total_requests = 0
        self.total_time = 0

    def profile_request(self, endpoint, method, status_code, duration, context=None):
        """记录请求信息"""
        request_info = {
            "timestamp": datetime.now().isoformat(),
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "duration": duration,
            "context": context,
        }
        self.requests.append(request_info)
        self.total_requests += 1
        self.total_time += duration
        # 记录慢请求（超过2秒）
        if duration > 2:
            self.slow_requests.append(request_info)
        # 保留最近1000条请求记录
        if len(self.requests) > 1000:
            self.requests = self.requests[-1000:]
        # 保留最近100条慢请求记录
        if len(self.slow_requests) > 100:
            self.slow_requests = self.slow_requests[-100:]

    def get_request_stats(self):
        """获取请求统计"""
        if self.total_requests == 0:
            avg_duration = 0
        else:
            avg_duration = self.total_time / self.total_requests
        return {
            "total_requests": self.total_requests,
            "total_time": round(self.total_time, 2),
            "avg_duration": round(avg_duration, 3),
            "slow_request_count": len(self.slow_requests),
            "recent_requests": self.requests[-20:],
            "slow_requests": self.slow_requests[-10:],
        }

    def reset(self):
        """重置统计"""
        self.requests = []
        self.slow_requests = []
        self.total_requests = 0
        self.total_time = 0


class DiagnosticMiddleware:
    """诊断中间件"""

    def __init__(self, app, profiler):
        self.app = app
        self.profiler = profiler

    def __call__(self, environ, start_response):
        start_time = time.time()

        def wrapped_start_response(status, headers, exc_info=None):
            # 解析状态码
            status_code = int(status.split()[0])
            # 记录请求时间
            duration = time.time() - start_time
            # 获取请求信息
            endpoint = environ.get("PATH_INFO", "")
            method = environ.get("REQUEST_METHOD", "GET")
            # 记录性能数据
            self.profiler.profile_request(endpoint, method, status_code, duration)
            return start_response(status, headers, exc_info)

        return self.app(environ, wrapped_start_response)


def timing_decorator(func):
    """性能计时装饰器"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)  # noqa: F841
            return result
        finally:
            duration = time.time() - start_time
            logger.debug(f"Function {func.__name__} took {duration:.3f}s")

    return wrapper


def get_system_info():
    """获取系统信息"""
    if not PSUTIL_AVAILABLE:
        return {"error": "psutil not installed"}
    try:
        return {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": round(psutil.virtual_memory().total / (1024**3), 2),
            "memory_available": round(psutil.virtual_memory().available / (1024**3), 2),
            "disk_total": round(psutil.disk_usage("/").total / (1024**3), 2) if os.name != "nt" else "N/A",
            "disk_available": round(psutil.disk_usage("/").free / (1024**3), 2) if os.name != "nt" else "N/A",
            "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat(),
        }
    except Exception as e:
        logger.error(f"获取系统信息失败: {e}")
        return {"error": str(e)}


def get_process_info():
    """获取进程信息"""
    if not PSUTIL_AVAILABLE:
        return {"error": "psutil not installed"}
    try:
        process = psutil.Process()
        return {
            "pid": process.pid,
            "name": process.name(),
            "status": process.status(),
            "cpu_percent": process.cpu_percent(),
            "memory_percent": process.memory_percent(),
            "memory_rss": round(process.memory_info().rss / (1024**2), 2),
            "memory_vms": round(process.memory_info().vms / (1024**2), 2),
            "threads": process.num_threads(),
            "open_files": len(process.open_files()) if hasattr(process, "open_files") else "N/A",
            "connections": len(process.connections()) if hasattr(process, "connections") else "N/A",
            "create_time": datetime.fromtimestamp(process.create_time()).isoformat(),
        }
    except Exception as e:
        logger.error(f"获取进程信息失败: {e}")
        return {"error": str(e)}


def register_diagnostic_endpoints(app, health_checker, profiler, error_tracker):
    """注册诊断端点"""

    @app.route("/api/diagnostics/system")
    def get_system_diagnostics():
        """获取系统诊断信息"""
        return jsonify({"system": get_system_info(), "process": get_process_info()})

    @app.route("/api/diagnostics/performance")
    def get_performance_diagnostics():
        """获取性能诊断信息"""
        return jsonify(profiler.get_request_stats())

    @app.route("/api/diagnostics/errors")
    def get_error_diagnostics():
        """获取错误诊断信息"""
        return jsonify(error_tracker.get_error_summary())

    @app.route("/api/diagnostics/errors/clear", methods=["POST"])
    def clear_errors():
        """清除错误记录"""
        error_tracker.clear_errors()
        return jsonify({"success": True, "message": "错误记录已清除"})

    @app.route("/api/diagnostics/profile/reset", methods=["POST"])
    def reset_profiler():
        """重置性能分析器"""
        profiler.reset()
        return jsonify({"success": True, "message": "性能分析器已重置"})

    @app.route("/api/diagnostics/request/<request_id>")
    def get_request_details(request_id):
        """获取请求详情"""
        requests = profiler.requests
        matching = [r for r in requests if r.get("context", {}).get("request_id") == request_id]
        if matching:
            return jsonify(matching[0])
        return jsonify({"error": "Request not found"}), 404


health_checker = HealthChecker()
performance_diagnostic = PerformanceDiagnostic()
error_tracker = ErrorTracker()
request_profiler = RequestProfiler()
