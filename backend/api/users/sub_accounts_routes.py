from flask_restx import Namespace, Resource, fields
from flask import request
from models import db, SubAccount, PermissionLog
from utils.permission import requires_permission, get_current_admin
from utils.security import hash_password, verify_password, generate_subaccount_token
from utils.response import APIResponse
from datetime import datetime
from api.system.security_routes import check_login_rate_limit, record_failed_login, clear_login_attempts
from services.sub_accounts_service import (
    create_sub_account,
    update_sub_account,
    delete_sub_account,
    log_sub_account_action,
)

ns_sub_accounts = Namespace("sub-accounts", description="子账号管理相关操作")


def log_permission_action(action, target_id=None, description=None):
    """记录权限操作日志"""
    try:
        admin = get_current_admin()  # F6: 从真实认证取操作人（原 X-Admin-Id 前端已不发）
        admin_id = admin.id if admin else None
        log_sub_account_action(
            action=action,
            target_id=target_id,
            description=description,
            operator_id=admin_id,
            ip_address=request.remote_addr if request else None,
        )
    except Exception:
        pass


sub_account_model = ns_sub_accounts.model(
    "SubAccount",
    {
        "id": fields.Integer(readOnly=True, description="子账号ID"),
        "parent_admin_id": fields.Integer(required=True, description="父管理员ID"),
        "username": fields.String(required=True, description="用户名"),
        "password": fields.String(description="密码"),
        "real_name": fields.String(description="真实姓名"),
        "phone": fields.String(description="联系电话"),
        "role_type": fields.String(description="角色类型"),
        "permissions": fields.String(description="权限列表"),
        "is_active": fields.Boolean(description="是否启用"),
    },
)

sub_account_response = ns_sub_accounts.model(
    "SubAccountResponse",
    {
        "id": fields.Integer(description="子账号ID"),
        "username": fields.String(description="用户名"),
        "real_name": fields.String(description="真实姓名"),
        "phone": fields.String(description="联系电话"),
        "role_type": fields.String(description="角色类型"),
        "permissions": fields.String(description="权限列表"),
        "is_active": fields.Boolean(description="是否启用"),
        "created_at": fields.String(description="创建时间"),
        "updated_at": fields.String(description="更新时间"),
    },
)

sub_account_list_response = ns_sub_accounts.model(
    "SubAccountListResponse",
    {"sub_accounts": fields.List(fields.Nested(sub_account_response), description="子账号列表")},
)

sub_account_login_response = ns_sub_accounts.model(
    "SubAccountLoginResponse",
    {
        "success": fields.Boolean(description="登录是否成功"),
        "message": fields.String(description="登录消息"),
        "token": fields.String(description="登录令牌"),
        "account": fields.Nested(sub_account_response, description="账号信息"),
    },
)


@ns_sub_accounts.route("/")
class SubAccountList(Resource):

    @ns_sub_accounts.doc("list_sub_accounts", description="获取子账号列表", security="Bearer")
    @ns_sub_accounts.response(200, "成功", sub_account_list_response)
    @requires_permission("user.view")
    def get(self):
        """
        获取子账号列表

        获取系统中所有子账号的列表。
        """
        accounts = SubAccount.query.all()
        return APIResponse.success(
            data={
                "sub_accounts": [
                    {
                        "id": a.id,
                        "parent_admin_id": a.parent_admin_id,
                        "username": a.username,
                        "real_name": a.real_name,
                        "phone": a.phone,
                        "role_type": a.role_type,
                        "permissions": a.permissions,
                        "is_active": a.is_active,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in accounts
                ]
            }
        )

    @ns_sub_accounts.doc("create_sub_account", description="创建子账号", security="Bearer")
    @ns_sub_accounts.expect(sub_account_model)
    @ns_sub_accounts.response(201, "创建成功")
    @ns_sub_accounts.response(400, "请求参数错误")
    @requires_permission("user.manage")
    def post(self):
        """
        创建子账号

        创建新的子账号，需要管理员权限。

        请求体：
        - parent_admin_id: 父管理员ID（必填）
        - username: 用户名（必填）
        - password: 密码（必填）
        - real_name: 真实姓名（可选）
        - phone: 联系电话（可选）
        - role_type: 角色类型（可选，默认dashboard_viewer）
        - permissions: 权限列表（可选）
        - is_active: 是否启用（可选，默认True）
        """
        data = ns_sub_accounts.payload
        password = data.get("password")
        if not password:
            return APIResponse.error(message="请提供密码", status_code=400)

        account = create_sub_account(data)

        # 记录权限日志
        log_permission_action("create", account.id, f"创建子账号: {account.username}")

        return APIResponse.success(data={"account_id": account.id}, message="子账号创建成功", status_code=201)


@ns_sub_accounts.route("/<int:id>")
@ns_sub_accounts.param("id", "子账号ID")
class SubAccountResource(Resource):

    @ns_sub_accounts.doc("get_sub_account", description="获取子账号详情", security="Bearer")
    @ns_sub_accounts.response(200, "成功")
    @ns_sub_accounts.response(404, "子账号不存在")
    @requires_permission("user.view")
    def get(self, id):
        """
        获取子账号详情

        根据ID获取子账号的详细信息。

        参数：
        - id: 子账号ID（路径参数）
        """
        account = SubAccount.query.get_or_404(id)
        return APIResponse.success(
            data={
                "id": account.id,
                "parent_admin_id": account.parent_admin_id,
                "username": account.username,
                "real_name": account.real_name,
                "phone": account.phone,
                "role_type": account.role_type,
                "permissions": account.permissions,
                "is_active": account.is_active,
                "created_at": account.created_at.isoformat() if account.created_at else None,
                "updated_at": account.updated_at.isoformat() if account.updated_at else None,
            }
        )

    @ns_sub_accounts.doc("update_sub_account", description="更新子账号", security="Bearer")
    @ns_sub_accounts.expect(sub_account_model)
    @ns_sub_accounts.response(200, "更新成功")
    @ns_sub_accounts.response(404, "子账号不存在")
    @requires_permission("user.manage")
    def put(self, id):
        """
        更新子账号

        更新指定子账号的信息，需要管理员权限。
        如果密码为空，则不更新密码。

        参数：
        - id: 子账号ID（路径参数）
        """
        account = SubAccount.query.get_or_404(id)
        data = ns_sub_accounts.payload
        update_sub_account(account, data)

        # 记录权限日志
        log_permission_action("update", account.id, f"更新子账号: {account.username}")

        return APIResponse.success(message="子账号更新成功")

    @ns_sub_accounts.doc("delete_sub_account", description="删除子账号", security="Bearer")
    @ns_sub_accounts.response(200, "删除成功")
    @ns_sub_accounts.response(404, "子账号不存在")
    @requires_permission("user.manage")
    def delete(self, id):
        """
        删除子账号

        删除指定的子账号，需要管理员权限。

        参数：
        - id: 子账号ID（路径参数）
        """
        account = SubAccount.query.get_or_404(id)
        username = account.username
        delete_sub_account(account)

        # 记录权限日志
        log_permission_action("delete", id, f"删除子账号: {username}")

        return APIResponse.success(message="子账号删除成功")


@ns_sub_accounts.route("/login")
class SubAccountLogin(Resource):

    @ns_sub_accounts.doc("sub_account_login", description="子账号登录")
    @ns_sub_accounts.expect(sub_account_model)
    @ns_sub_accounts.response(200, "登录成功", sub_account_login_response)
    @ns_sub_accounts.response(401, "用户名或密码错误")
    def post(self):
        """
        子账号登录

        使用用户名和密码登录子账号。

        请求体：
        - username: 用户名（必填）
        - password: 密码（必填）
        """
        data = ns_sub_accounts.payload
        username = data.get("username")
        password = data.get("password")
        ip_address = request.remote_addr

        is_allowed, message, retry_after = check_login_rate_limit(username, ip_address)
        if not is_allowed:
            return APIResponse.error(message=message, status_code=429, retry_after=retry_after)

        account = SubAccount.query.filter_by(username=username).first()
        if account and verify_password(password, account.password) and account.is_active:
            clear_login_attempts(username)
            token_data = generate_subaccount_token(
                subaccount_id=account.id,
                username=account.username,
                role_type=account.role_type,
                parent_admin_id=account.parent_admin_id,
            )
            return APIResponse.success(
                data={
                    "token": token_data["token"],
                    "expires_in": token_data["expires_in"],
                    "account": {
                        "id": account.id,
                        "username": account.username,
                        "role_type": account.role_type,
                        "real_name": account.real_name,
                    },
                },
                message="登录成功",
            )

        record_failed_login(username, ip_address)
        return APIResponse.error(message="用户名或密码错误", status_code=401)
