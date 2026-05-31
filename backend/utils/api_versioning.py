#!/usr/bin/env python3
"""
API版本管理模块
支持v1和v2版本共存，提供版本迁移和兼容性支持
"""

from functools import wraps
from flask import request, jsonify, Blueprint
from typing import Dict, Callable, Optional, Any
import semver

class APIVersionManager:
    def __init__(self):
        self.versions: Dict[str, Dict[str, Callable]] = {
            'v1': {},
            'v2': {}
        }
        self.deprecated_endpoints: Dict[str, str] = {}
        self.current_version = 'v2'

    def register_endpoint(self, version: str, endpoint: str, handler: Callable):
        if version not in self.versions:
            self.versions[version] = {}
        self.versions[version][endpoint] = handler

    def register_deprecated(self, old_endpoint: str, new_endpoint: str):
        self.deprecated_endpoints[old_endpoint] = new_endpoint

    def get_versions(self) -> list:
        return list(self.versions.keys())

    def get_endpoints(self, version: str) -> list:
        return list(self.versions.get(version, {}).keys())

version_manager = APIVersionManager()

def version_required(required_version: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            api_version = request.headers.get('X-API-Version', 'v1')
            if semver.compare(f"{required_version}.0", f"{api_version}.0") > 0:
                return jsonify({
                    'success': False,
                    'message': f'此API需要版本 {required_version} 或更高版本',
                    'current_version': api_version,
                    'required_version': required_version
                }), 400
            return func(*args, **kwargs)
        return wrapper
    return decorator

def api_version_prefix(version: str, prefix: str = '/api'):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            request.api_version = version
            request.api_prefix = f"{prefix}/{version}"
            return func(*args, **kwargs)
        return wrapper
    return decorator

def deprecate_warning(old_name: str, new_name: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            from flask import make_response
            response = func(*args, **kwargs)
            if hasattr(response, 'headers'):
                response.headers['X-Deprecated'] = f'请使用 {new_name} 替代'
                response.headers['X-Replacement'] = new_name
            return response
        return wrapper
    return decorator

class VersionedBlueprint(Blueprint):
    def __init__(self, name: str, import_name: str, version: str = 'v1', url_prefix: str = None):
        if url_prefix is None:
            url_prefix = f'/api/{version}'
        super().__init__(name, import_name, url_prefix=url_prefix)
        self.api_version = version

class APIVersionResponse:
    @staticmethod
    def success(data: Any = None, message: str = '成功', meta: dict = None):
        response = {
            'success': True,
            'message': message,
            'data': data,
            'api_version': getattr(request, 'api_version', 'v1'),
            'timestamp': None
        }
        if meta:
            response['meta'] = meta
        return jsonify(response)

    @staticmethod
    def error(message: str, code: int = 400, errors: list = None):
        response = {
            'success': False,
            'message': message,
            'error_code': code,
            'api_version': getattr(request, 'api_version', 'v1')
        }
        if errors:
            response['errors'] = errors
        return jsonify(response), code

    @staticmethod
    def paginated(items: list, page: int, per_page: int, total: int):
        return jsonify({
            'success': True,
            'data': items,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            },
            'api_version': getattr(request, 'api_version', 'v1')
        })

class VersionMigration:
    MIGRATIONS = {
        'v1_to_v2': {
            'user': {
                'old_field': 'student_id',
                'new_field': 'card_id',
                'transform': lambda x: x
            },
            'response': {
                'removed': ['created_date'],
                'added': ['created_at'],
                'transform': lambda data: {**data, 'created_at': data.pop('created_date', None)}
            }
        }
    }

    @classmethod
    def migrate_request(cls, version_from: str, version_to: str, data: dict):
        key = f"{version_from}_to_{version_to}"
        if key in cls.MIGRATIONS:
            migration = cls.MIGRATIONS[key]
            for field, field_migration in migration.items():
                if field in data and 'transform' in field_migration:
                    data[field] = field_migration['transform'](data[field])
        return data

    @classmethod
    def migrate_response(cls, version_from: str, version_to: str, data: dict):
        key = f"{version_from}_to_{version_to}"
        if key in cls.MIGRATIONS:
            migration = cls.MIGRATIONS[key]
            if 'response' in migration:
                resp_migration = migration['response']
                if 'transform' in resp_migration:
                    data = resp_migration['transform'](data)
        return data
