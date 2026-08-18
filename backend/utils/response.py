from flask import request
from datetime import datetime


class APIResponse:

    @staticmethod
    def success(data=None, message="操作成功", code=0, status_code=200, **kwargs):
        response = {"success": True, "code": code, "message": message}
        if data is not None:
            response["data"] = data
        response.update(kwargs)
        return response, status_code

    @staticmethod
    def error(message="操作失败", code=-1, status_code=400, error_code=None, errors=None, data=None, **kwargs):
        response = {"success": False, "code": code, "message": message}
        if error_code:
            response["error_code"] = error_code
        if errors:
            response["errors"] = errors
        if data:
            response["data"] = data

        try:
            response["timestamp"] = datetime.now().isoformat()
            if request:
                response["path"] = request.path
        except Exception:
            pass

        response.update(kwargs)
        return response, status_code

    @staticmethod
    def created(data=None, message="创建成功"):
        response = {"success": True, "code": 0, "message": message}
        if data is not None:
            response["data"] = data
        return response, 201

    @staticmethod
    def not_found(message="资源不存在", error_code="NOT_FOUND"):
        return APIResponse.error(message, code=-1, status_code=404, error_code=error_code)

    @staticmethod
    def unauthorized(message="未授权访问", error_code="UNAUTHORIZED"):
        return APIResponse.error(message, code=-1, status_code=401, error_code=error_code)

    @staticmethod
    def forbidden(message="无权访问", error_code="FORBIDDEN"):
        return APIResponse.error(message, code=-1, status_code=403, error_code=error_code)

    @staticmethod
    def bad_request(message="请求参数错误", errors=None, error_code="BAD_REQUEST", data=None, **kwargs):
        return APIResponse.error(
            message, code=-1, status_code=400, error_code=error_code, errors=errors, data=data, **kwargs
        )

    @staticmethod
    def server_error(message="服务器内部错误", error_code="INTERNAL_ERROR"):
        return APIResponse.error(message, code=-1, status_code=500, error_code=error_code)

    @staticmethod
    def rate_limit(message="请求过于频繁", retry_after=None):
        response = {"success": False, "code": -1, "message": message}
        if retry_after:
            response["retry_after"] = retry_after
        return response, 429

    @staticmethod
    def pagination(data, page, page_size, total):
        pagination = {
            "page": page,
            "per_page": page_size,
            "total": total,
            "pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
        }
        return {"data": data, "pagination": pagination}

    @staticmethod
    def list_response(items, page, page_size, total):
        return {
            "items": items,
            "pagination": {
                "page": page,
                "per_page": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
            },
        }
