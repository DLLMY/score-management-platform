import ctypes
import logging
import os
from datetime import datetime

"""
问题诊断与性能监控模块
提供系统健康检查、性能诊断、错误追踪和日志分析功能
"""
logger = logging.getLogger(__name__)
try:
    import psutil

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
            return {"status": "unhealthy", "message": f"数据库连接失败: {e!s}"}

    def check_redis(self):
        """检查Redis连接"""
        try:
            if self.redis_client:
                self.redis_client.ping()
                return {"status": "healthy", "message": "Redis连接正常"}
            return {"status": "unknown", "message": "Redis未配置"}
        except Exception as e:
            return {"status": "unhealthy", "message": f"Redis连接失败: {e!s}"}

    def check_mqtt(self):
        """检查MQTT连接"""
        try:
            if self.mqtt_service:
                if hasattr(self.mqtt_service, "is_connected") and self.mqtt_service.is_connected():
                    return {"status": "healthy", "message": "MQTT连接正常"}
                return {"status": "degraded", "message": "MQTT连接断开"}
            return {"status": "unknown", "message": "MQTT未配置"}
        except Exception as e:
            return {"status": "unhealthy", "message": f"MQTT连接失败: {e!s}"}

    def check_disk_space(self):
        """检查磁盘空间（跨平台兼容）"""
        try:
            if os.name == "nt":
                # Windows 平台
                free_bytes = ctypes.c_ulonglong(0)
                total_bytes = ctypes.c_ulonglong(0)
                ctypes.windll.kernel32.GetDiskFreeSpaceExW(
                    ctypes.c_wchar_p("C:\\"),
                    None,
                    ctypes.pointer(total_bytes),
                    ctypes.pointer(free_bytes),
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
            if free_percent < 20:
                return {"status": "warning", "message": f"磁盘空间较低: {free_percent:.1f}%"}
            return {"status": "healthy", "message": f"磁盘空间正常: {free_percent:.1f}%"}
        except Exception as e:
            return {"status": "unknown", "message": f"无法检查磁盘空间: {e!s}"}

    def check_memory_usage(self):
        """检查内存使用"""
        if not PSUTIL_AVAILABLE:
            return {"status": "unknown", "message": "psutil未安装"}
        try:
            memory = psutil.virtual_memory()
            used_percent = memory.percent
            if used_percent > 90:
                return {"status": "critical", "message": f"内存使用率过高: {used_percent}%"}
            if used_percent > 80:
                return {"status": "warning", "message": f"内存使用率较高: {used_percent}%"}
            return {"status": "healthy", "message": f"内存使用率正常: {used_percent}%"}
        except Exception as e:
            return {"status": "unknown", "message": f"无法检查内存: {e!s}"}

    def check_cpu_usage(self):
        """检查CPU使用"""
        if not PSUTIL_AVAILABLE:
            return {"status": "unknown", "message": "psutil未安装"}
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)  # 缩短检查时间
            if cpu_percent > 95:
                return {"status": "critical", "message": f"CPU使用率过高: {cpu_percent}%"}
            if cpu_percent > 80:
                return {"status": "warning", "message": f"CPU使用率较高: {cpu_percent}%"}
            return {"status": "healthy", "message": f"CPU使用率正常: {cpu_percent}%"}
        except Exception as e:
            return {"status": "unknown", "message": f"无法检查CPU: {e!s}"}

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
                result = check["check"]()
                results["checks"][check["name"]] = result
            except Exception as e:
                results["checks"][check["name"]] = {
                    "status": "error",
                    "message": f"检查执行失败: {e!s}",
                }
        # 确定整体状态
        for _check_name, check_result in results["checks"].items():
            status = check_result.get("status", "unknown")
            if status in ["critical", "unhealthy"]:
                results["status"] = "unhealthy"
                break
            if status == "warning":
                if results["status"] == "healthy":
                    results["status"] = "degraded"
        return results

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


error_tracker = ErrorTracker()
