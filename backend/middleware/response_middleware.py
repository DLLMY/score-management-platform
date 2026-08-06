import json


class ResponseMiddleware:

    def __init__(self, app=None):
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        app.after_request(self.format_response)
        app.register_error_handler(Exception, self.handle_exception)

    def format_response(self, response):
        if response.is_json:
            try:
                data = response.get_json()
            except Exception:
                data = None

            if data is not None:
                if "success" not in data:
                    if isinstance(data, dict) and "items" in data and "pagination" in data:
                        wrapped_data = {"success": True, "code": 0, "message": "操作成功", "data": data}
                    elif isinstance(data, dict) and "data" in data and "pagination" in data:
                        wrapped_data = {"success": True, "code": 0, "message": "操作成功", **data}
                    elif isinstance(data, (list, dict)):
                        wrapped_data = {"success": True, "code": 0, "message": "操作成功", "data": data}
                    else:
                        wrapped_data = {"success": True, "code": 0, "message": "操作成功", "data": data}

                    response.data = json.dumps(wrapped_data, ensure_ascii=False).encode("utf-8")
                    response.content_length = len(response.data)

        return response

    def handle_exception(self, e):
        from utils.response import APIResponse

        response, status_code = APIResponse.server_error(str(e))

        return response, status_code
