"""全局写请求缓存自动失效钩子。

背景（2026-08-20 系统性根治"幽灵资源"）：cached_api 的 GET 缓存需在数据变更后失效，
此前依赖各写端点手动调 invalidate_cache —— 漏调即导致列表返回旧数据（前端反复删反复 404、
分配后列表不刷新等连环问题）。本钩子做兜底：任何 POST/PUT/DELETE/PATCH 请求（2xx/3xx/4xx，
404 资源不存在也失效）自动清除对应集合缓存。

设计原则：宽匹配多清无害（多一次 DELETE），漏清有害（幽灵数据）——故对写请求路径前缀
统一失效该集合缓存，并按 CACHE_RELATED_SEGMENTS 关联映射失效相邻集合（如 classes ↔
admin-classes）。各端点保留的手动 invalidate_cache 仍生效（双保险）。
"""

from flask import request

logger = None  # 延迟导入避免循环


# 写端点影响的关联集合（防止跨域残留）。宽匹配多清无害、漏清有害。
CACHE_RELATED_SEGMENTS = {
    "admin-classes": {"classes", "admin-classes"},
    "classes": {"classes", "admin-classes"},
    "subjects": {"subjects"},
    "users": {"users", "records", "algorithm", "dashboard"},
    "records": {"records", "users", "algorithm", "dashboard", "rank", "analysis"},
    "approvals": {"approvals", "records", "users"},
    "notify_templates": {"notify_templates"},
    "scheduled_notify": {"scheduled_notify", "notify_templates"},
    "notify_history": {"notify_history"},
    "devices": {"devices"},
    "firmware": {"firmware", "devices"},
    "rules": {"rules"},
    "score-categories": {"score-categories"},
    "rank-rules": {"rank-rules"},
    "time-rules": {"time-rules"},
    "class-periods": {"class-periods"},
    "exams": {"exams", "scores", "rank", "analysis"},
    "scores": {"scores", "exams", "rank", "analysis"},
    "course-schedules": {"course-schedules"},
    "admin_notifications": {"admin_notifications", "notifications"},
    "notifications": {"notifications", "admin_notifications"},
    "alerts": {"alerts", "notifications"},
    "system": {"system"},
    "admins": {"admins", "rbac", "permission-logs"},
    "rbac": {"rbac", "admins", "permission-logs"},
    "import_export": {"import_export", "scores", "records", "exams", "classes", "subjects", "students", "users"},
    "exam-import": {"exam-import", "scores", "records", "exams", "classes", "subjects", "students", "users"},
    "nlp": {"nlp"},
    "mqtt": {"mqtt"},
    "operation-logs": {"operation-logs"},
    "security": {"security"},
    "dashboard": {"dashboard"},
    "algorithm": {"algorithm"},
}

# 追加型日志集合：operation-logs / permission-logs 由"任何写动作作为副作用"追加，
# 自身没有写端点，但必须保证每次写请求都失效（否则日志列表永远显示旧数据）。
# 宽匹配多清无害、漏清有害 —— 故对每一个写请求强制失效这些段。
ALWAYS_INVALIDATE_ON_WRITE = {"operation-logs", "permission-logs"}


def register_cache_invalidation(app):
    @app.after_request
    def auto_invalidate_cache(response):
        if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
            return response
        status = response.status_code
        if not (200 <= status < 500):
            return response
        try:
            from utils.api_cache_middleware import invalidate_cache

            parts = [p for p in request.path.split("/") if p]
            if len(parts) < 2 or parts[0] != "api":
                return response
            segment = parts[1]
            patterns = {f"api:/api/{segment}/*"}
            for related in CACHE_RELATED_SEGMENTS.get(segment, ()):
                patterns.add(f"api:/api/{related}/*")
            # 追加型日志：每次写都强制失效（与写请求段无关）
            for always in ALWAYS_INVALIDATE_ON_WRITE:
                patterns.add(f"api:/api/{always}/*")
            for p in patterns:
                invalidate_cache(p)
        except Exception:
            # 失效失败不影响请求主流程（下次 GET 走 skip_cache 或 TTL 过期自愈）
            pass
        return response
