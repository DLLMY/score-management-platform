from flask_restx import Namespace, Resource, fields
from flask import request
from models import Admin, SubAccount
from utils.security import generate_tokens, generate_subaccount_token, verify_password
from routes.security_routes import check_login_rate_limit, record_failed_login, clear_login_attempts
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
    @ns_auth.doc("unified_login", description="统一登录接口，自动识别用户角色")
    @ns_auth.expect(login_model)
    def post(self):
        """
        统一登录接口，自动识别用户角色

        根据用户名自动识别是管理员还是子账号（班主任/教师），
        然后进行相应的登录验证。

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
            return {"success": False, "message": "请求体不能为空"}, 400

        username = data.get("username")
        password = data.get("password")
        ip_address = request.remote_addr

        is_allowed, message, retry_after = check_login_rate_limit(username, ip_address)
        if not is_allowed:
            return {"success": False, "message": message, "retry_after": retry_after}, 429

        # 尝试管理员登录
        admin = Admin.query.filter_by(username=username).first()
        if admin:
            if verify_password(password, admin.password):
                clear_login_attempts(username)
                token_data = generate_tokens(admin.id, admin.username, admin.role)
                log_login_attempt(username, success=True)
                return {
                    "success": True,
                    "message": "登录成功",
                    "access_token": token_data["access_token"],
                    "refresh_token": token_data["refresh_token"],
                    "expires_in": token_data["expires_in"],
                    "user": {
                        "id": admin.id,
                        "username": admin.username,
                        "real_name": admin.real_name,
                        "role": admin.role,
                        "role_type": "admin",
                    },
                }

        # 尝试子账号登录（班主任/教师）
        subaccount = SubAccount.query.filter_by(username=username).first()
        if subaccount and subaccount.is_active:
            if verify_password(password, subaccount.password):
                clear_login_attempts(username)
                token_data = generate_subaccount_token(
                    subaccount.id, subaccount.username, subaccount.role_type, subaccount.parent_admin_id
                )
                log_login_attempt(username, success=True)
                return {
                    "success": True,
                    "message": "登录成功",
                    "token": token_data["token"],
                    "expires_in": token_data["expires_in"],
                    "user": {
                        "id": subaccount.id,
                        "username": subaccount.username,
                        "real_name": subaccount.real_name,
                        "role": subaccount.role_type,
                        "role_type": "subaccount",
                    },
                }

        # 登录失败
        record_failed_login(username, ip_address)
        log_login_attempt(username, success=False, reason="用户名或密码错误")
        return {"success": False, "message": "用户名或密码错误"}, 401
