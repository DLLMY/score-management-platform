from flask import Blueprint, request
from functools import wraps
from utils.response import APIResponse
from utils.api_versioning import version_manager

"""
API版本路由配置
提供版本检测、重定向和兼容性支持
"""
version_bp = Blueprint("version", __name__)


@version_bp.route("/api/version")
def get_api_version():
    return APIResponse.success(
        data={
            "current_version": "v2",
            "supported_versions": version_manager.get_versions(),
            "deprecation_notice": "v1版本将于2025年12月31日停止维护，请尽快升级到v2",
        }
    )


@version_bp.route("/api/v1/compatibility")
def v1_compatibility():
    return APIResponse.success(
        data={
            "message": "v1版本已弃用",
            "replacement": "/api/v2",
            "deprecation_date": "2024-06-01",
            "end_of_life": "2025-12-31",
            "breaking_changes": [
                "student_id字段更名为card_id",
                "响应格式增加api_version字段",
                "分页参数page/size变更为page/per_page",
            ],
        }
    )


@version_bp.before_request
def check_api_version():
    api_version = request.headers.get("X-API-Version")
    if api_version and api_version not in version_manager.get_versions():
        return APIResponse.error(
            message=f"不支持的API版本: {api_version}",
            status_code=400,
            data={"supported_versions": version_manager.get_versions()},
        )


def require_api_version(version: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            header_version = request.headers.get("X-API-Version")
            if header_version and header_version != version:
                return APIResponse.error(
                    message=f"此端点仅支持 {version} 版本", status_code=400, data={"your_version": header_version}
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator


def v1_deprecated_response():
    return APIResponse.error(
        message="此端点在v1版本已弃用，请使用v2版本",
        status_code=410,
        data={
            "v2_endpoint": request.path.replace("/api/v1", "/api/v2"),
            "deprecation_notice": "v1版本将于2025年12月31日停止维护",
        },
    )
