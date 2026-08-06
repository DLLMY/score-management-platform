from flask_restx import Namespace, Resource, fields
from flask import request, make_response, jsonify
from flask_wtf.csrf import generate_csrf
from models import Admin
from utils.security import generate_tokens, verify_password, set_auth_cookies, clear_auth_cookies
from utils.response import APIResponse
from api.system.security_routes import check_login_rate_limit, record_failed_login, clear_login_attempts
from utils.logger import log_login_attempt

ns_auth = Namespace("auth", description="统一认证接口")

login_model = ns_auth.model(
    "LoginRequest",
    {
        "username": fields.String(required=True, description="用户名"),
        "password": fields.String(required=True, description="密码"),
    },
)


@ns_auth.route("/login")
class Login(Resource):

    @ns_auth.doc("unified_login", description="管理员登录接口")
    @ns_auth.expect(login_model)
    def post(self):
        """
        管理员登录接口

        验证管理员用户名和密码，成功后返回JWT令牌。

        请求体：
        - username: 用户名（必填）
        - password: 密码（必填）

        返回：
        - success: 登录是否成功
        - message: 提示信息
        - token: JWT令牌
        - expires_in: 令牌过期时间（秒）
        - user: 用户信息（包含role字段标识角色类型）
        """
        data = request.get_json()
        if not data:
            return APIResponse.bad_request(message="请求体不能为空")

        username = data.get("username")
        password = data.get("password")
        ip_address = request.remote_addr

        is_allowed, message, retry_after = check_login_rate_limit(username, ip_address)
        if not is_allowed:
            return APIResponse.rate_limit(message=message, retry_after=retry_after)

        # 尝试管理员登录
        admin = Admin.query.filter_by(username=username).first()
        if admin:
            if verify_password(password, admin.password):
                clear_login_attempts(username)
                token_data = generate_tokens(admin.id, admin.username, admin.role)
                log_login_attempt(username, success=True)

                response_data = {
                    "success": True,
                    "code": 0,
                    "message": "登录成功",
                    "expires_in": token_data["expires_in"],
                    "access_token": token_data["access_token"],
                    "refresh_token": token_data["refresh_token"],
                    "data": {
                        "admin": {
                            "id": admin.id,
                            "username": admin.username,
                            "real_name": admin.real_name,
                            "role": admin.role,
                            "force_password_change": admin.force_password_change,
                        }
                    },
                }

                response = make_response(jsonify(response_data))
                set_auth_cookies(response, token_data["access_token"], token_data["refresh_token"])

                csrf_token = generate_csrf()
                response.set_cookie(
                    "csrf_token", value=csrf_token, httponly=False, secure=False, samesite="Lax", max_age=3600, path="/"
                )
                response_data["csrf_token"] = csrf_token

                return response

        # 登录失败
        record_failed_login(username, ip_address)
        log_login_attempt(username, success=False, reason="用户名或密码错误")
        return APIResponse.unauthorized(message="用户名或密码错误")


@ns_auth.route("/logout")
class Logout(Resource):

    @ns_auth.doc("logout", description="登出接口，清除认证Cookie")
    def post(self):
        """
        登出接口，清除认证Cookie

        清除access_token和refresh_token Cookie，实现安全登出。

        返回：
        - success: 登出是否成功
        - message: 提示信息
        """
        response_data = {"success": True, "code": 0, "message": "登出成功"}
        response = make_response(jsonify(response_data))
        clear_auth_cookies(response)
        return response
