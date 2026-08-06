#!/usr/bin/env python3
"""
API版本路由配置
提供版本检测、重定向和兼容性支持
"""

from flask import Blueprint, request, jsonify
from functools import wraps
from utils.api_versioning import version_manager

version_bp = Blueprint("version", __name__)


@version_bp.route("/api/version")
def get_api_version():
    return jsonify(
        {
            "current_version": "v2",
            "supported_versions": version_manager.get_versions(),
            "deprecation_notice": "v1版本将于2025年12月31日停止维护，请尽快升级到v2",
        }
    )


@version_bp.route("/api/versions")
def list_versions():
    versions_info = {}
    for version in version_manager.get_versions():
        versions_info[version] = {
            "endpoints": version_manager.get_endpoints(version),
            "status": "current" if version == "v2" else "deprecated",
        }
    return jsonify({"versions": versions_info})


@version_bp.route("/api/v1/compatibility")
def v1_compatibility():
    return jsonify(
        {
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
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"不支持的API版本: {api_version}",
                    "supported_versions": version_manager.get_versions(),
                }
            ),
            400,
        )


def require_api_version(version: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            header_version = request.headers.get("X-API-Version")
            if header_version and header_version != version:
                return (
                    jsonify(
                        {"success": False, "message": f"此端点仅支持 {version} 版本", "your_version": header_version}
                    ),
                    400,
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator


def v1_deprecated_response():
    return (
        jsonify(
            {
                "success": False,
                "message": "此端点在v1版本已弃用，请使用v2版本",
                "v2_endpoint": request.path.replace("/api/v1", "/api/v2"),
                "deprecation_notice": "v1版本将于2025年12月31日停止维护",
            }
        ),
        410,
    )
