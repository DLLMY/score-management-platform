from flask import request, make_response, jsonify
from flask_restx import Namespace, Resource, fields
from utils.response import APIResponse
from flask_wtf.csrf import generate_csrf
from models import (
    Admin,
    AdminClass,
    ClassInfo,
    get_by_id,
)
from utils.permission import requires_permission, requires_admin, get_current_admin
from utils.api_cache_middleware import cached_api, invalidate_cache
from utils.logger import log_operation, log_login_attempt, logger
from utils.security import (
    is_strong_password,
    verify_password,
    generate_tokens,
    validate_token,
    JWT_ACCESS_TOKEN_EXPIRES,
    set_auth_cookies,
)
from api.system.security_routes import (
    check_login_rate_limit,
    record_failed_login,
    clear_login_attempts,
)
from services.admins_service import (
    create_admin as _service_create_admin,
    update_admin as _service_update_admin,
    delete_admin as _service_delete_admin,
    change_admin_password,
    assign_class_link,
    remove_class_link,
    log_admin_permission_action,
)

try:
    from app import csrf_exempt
except ImportError:

    def csrf_exempt(func):
        return func


ns_admins = Namespace("admins", description="管理员管理相关操作")


def log_permission_action(action, target_type, target_id=None, description=None):
    """记录权限操作日志（F17：落库委托 services.admins_service）"""
    try:
        admin = get_current_admin()  # F6: 从真实认证取操作人（原 X-Admin-Id 前端已不发）
        admin_id = admin.id if admin else None
        log_admin_permission_action(
            action=action,
            target_type=target_type,
            target_id=target_id,
            description=description,
            operator_id=admin_id,
            ip_address=request.remote_addr if request else None,
        )
    except Exception as e:
        logger.warning("记录管理员操作日志失败: %s", e)


ROLE_MAPPING = {
    "admin": "admin",
    "teacher": "teacher",
    "dashboard": "dashboard_viewer",
    "head_teacher": "head_teacher",
    "viewer": "viewer",
}


admin_model = ns_admins.model(
    "Admin",
    {
        "id": fields.Integer(readOnly=True, description="管理员ID"),
        "username": fields.String(required=True, description="用户名"),
        "password": fields.String(required=True, description="密码（至少8位，包含字母和数字）"),
        "role": fields.String(
            description="主角色（admin/teacher/subject_teacher/dashboard_viewer/head_teacher/viewer）"
        ),
        "roles": fields.List(fields.String(), description="角色列表（支持多角色）"),
        "real_name": fields.String(description="真实姓名"),
        "phone": fields.String(description="联系电话"),
        "class_name": fields.String(description="所属班级（教师角色）"),
        "is_active": fields.Boolean(description="账号是否启用"),
    },
)
login_model = ns_admins.model(
    "LoginRequest",
    {
        "username": fields.String(required=True, description="用户名"),
        "password": fields.String(required=True, description="密码"),
    },
)
login_response = ns_admins.model(
    "LoginResponse",
    {
        "success": fields.Boolean(description="是否成功"),
        "message": fields.String(description="提示信息"),
        "access_token": fields.String(description="访问令牌"),
        "refresh_token": fields.String(description="刷新令牌"),
        "admin": fields.Nested(admin_model, description="管理员信息"),
    },
)
change_password_model = ns_admins.model(
    "ChangePasswordRequest",
    {
        "old_password": fields.String(required=True, description="旧密码"),
        "new_password": fields.String(
            required=True, description="新密码（至少8位，包含字母和数字）"
        ),
    },
)
assign_class_model = ns_admins.model(
    "AssignClassRequest",
    {
        "class_id": fields.Integer(required=True, description="班级ID"),
        "is_primary": fields.Boolean(description="是否为主班级，默认false"),
    },
)


@ns_admins.route("/")
class AdminList(Resource):
    @ns_admins.doc("list_admins", description="获取管理员列表", security="Bearer")
    @requires_permission("system.users")
    @cached_api(ttl=30)
    def get(self):
        """
        获取所有管理员列表
        需要管理员权限。返回所有管理员的基本信息。
        """
        admins = Admin.query.all()
        return {
            "admins": [
                {
                    "id": a.id,
                    "username": a.username,
                    "role": a.role,
                    "real_name": a.real_name,
                    "phone": a.phone,
                    "class_name": a.class_name,
                    "is_active": a.is_active,
                    "class_count": len(a.class_links),
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in admins
            ]
        }

    @ns_admins.doc("create_admin", description="创建新管理员", security="Bearer")
    @ns_admins.expect(admin_model)
    @ns_admins.response(201, "创建成功")
    @ns_admins.response(400, "参数错误或密码强度不足")
    @requires_permission("admin")
    def post(self):
        """
        创建新管理员
        创建一个新的管理员账户。需要超级管理员权限。
        参数：
        - username: 用户名（必填）
        - password: 密码（必填，至少8位，包含字母和数字）
        - role: 角色（可选，默认admin）
        - real_name: 真实姓名（可选）
        - phone: 联系电话（可选）
        - class_name: 所属班级（可选，教师角色使用）
        """
        data = ns_admins.payload
        password = data.get("password")
        # 密码强度验证
        if not password or not is_strong_password(password):
            return APIResponse.error(
                message="密码强度不足：至少8位，包含字母和数字", status_code=400
            )
        role = data.get("role", "admin")
        roles = data.get("roles")
        admin = _service_create_admin(
            username=data.get("username"),
            password=password,
            role=role,
            real_name=data.get("real_name"),
            phone=data.get("phone"),
            class_name=data.get("class_name"),
            roles=roles,
        )
        log_permission_action(
            "创建管理员",
            "admin",
            admin.id,
            f"创建管理员: {data.get('username')} ({data.get('real_name')})",
        )
        invalidate_cache("api:/api/admins/*")
        return APIResponse.success(
            data={"admin_id": admin.id}, message="管理员创建成功", status_code=201
        )


@ns_admins.route("/<int:id>")
@ns_admins.param("id", "管理员ID")
class AdminResource(Resource):
    @ns_admins.doc("get_admin", description="获取单个管理员信息", security="Bearer")
    @ns_admins.response(200, "成功")
    @ns_admins.response(404, "管理员不存在")
    @requires_permission("system.users")
    def get(self, id):
        """
        获取单个管理员详细信息
        根据管理员ID获取详细信息。需要管理员权限。
        """
        admin = Admin.query.get_or_404(id)
        return {
            "id": admin.id,
            "username": admin.username,
            "role": admin.role,
            "real_name": admin.real_name,
            "phone": admin.phone,
            "class_name": admin.class_name,
            "is_active": admin.is_active,
            "created_at": admin.created_at.isoformat() if admin.created_at else None,
            "updated_at": admin.updated_at.isoformat() if admin.updated_at else None,
        }

    @ns_admins.doc("update_admin", description="更新管理员信息", security="Bearer")
    @ns_admins.expect(admin_model)
    @ns_admins.response(200, "更新成功")
    @ns_admins.response(404, "管理员不存在")
    @requires_permission("system.users")
    def put(self, id):
        """
        更新管理员信息
        更新指定管理员的信息。需要管理员权限。
        参数：
        - username: 用户名（可选）
        - password: 密码（可选）
        - role: 角色（可选）
        - real_name: 真实姓名（可选）
        - phone: 联系电话（可选）
        - class_name: 所属班级（可选）
        """
        admin = Admin.query.get_or_404(id)
        data = ns_admins.payload
        _service_update_admin(admin, data)
        log_permission_action("更新管理员", "admin", id, f"更新管理员: {admin.username}")
        invalidate_cache("api:/api/admins/*")
        return APIResponse.success(message="管理员更新成功")

    @ns_admins.doc("delete_admin", description="删除管理员", security="Bearer")
    @ns_admins.response(200, "删除成功")
    @ns_admins.response(404, "管理员不存在")
    @requires_permission("admin")
    def delete(self, id):
        """
        删除管理员
        删除指定的管理员账户。需要超级管理员权限。
        """
        admin = Admin.query.get_or_404(id)
        username = admin.username
        # 先清理引用该管理员的子表记录：admin_roles 等 NOT NULL 外键会被删除，
        # scores.entered_by 等可空外键仅解除引用（不会连带删除业务数据）
        _service_delete_admin(admin)
        log_permission_action("删除管理员", "admin", id, f"删除管理员: {username}")
        invalidate_cache("api:/api/admins/*")
        return APIResponse.success(message="管理员删除成功")


@ns_admins.route("/login")
class AdminLogin(Resource):
    @ns_admins.doc("admin_login", description="管理员登录")
    @ns_admins.expect(login_model)
    @ns_admins.response(200, "登录成功", login_response)
    @ns_admins.response(401, "用户名或密码错误")
    @csrf_exempt
    def post(self):
        """
        管理员登录
        使用用户名和密码进行登录，成功后返回JWT令牌。
        请求体：
        - username: 用户名
        - password: 密码
        返回：
        - access_token: 访问令牌（有效期较短）
        - refresh_token: 刷新令牌（有效期较长）
        - admin: 管理员信息
        """
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        ip_address = request.remote_addr
        is_allowed, message, retry_after = check_login_rate_limit(username, ip_address)
        if not is_allowed:
            return APIResponse.error(message=message, status_code=429, retry_after=retry_after)
        admin = Admin.query.filter_by(username=username).first()
        if admin and verify_password(password, admin.password):
            clear_login_attempts(username)
            log_operation(
                operation_type="login",
                target_type="admin",
                target_id=admin.id,
                description=f"管理员登录: {admin.username}",
                after_data={"username": username},
            )
            log_login_attempt(username, success=True)
            tokens = generate_tokens(admin.id, admin.username, admin.role)
            return APIResponse.success(
                data={
                    **tokens,
                    "admin": {
                        "id": admin.id,
                        "username": admin.username,
                        "role": admin.role,
                        "real_name": admin.real_name,
                        "force_password_change": admin.force_password_change or False,
                    },
                },
                message="登录成功",
            )
        record_failed_login(username, ip_address)
        log_operation(
            operation_type="login_failed",
            target_type="admin",
            description=f"登录失败: 用户名={username}",
            after_data={"username": username},
        )
        log_login_attempt(username, success=False, reason="用户名或密码错误")
        return APIResponse.error(message="用户名或密码错误", status_code=401)


@ns_admins.route("/csrf-token")
class AdminCsrfToken(Resource):
    @ns_admins.doc("get_csrf_token", description="获取CSRF令牌")
    @ns_admins.response(200, "成功")
    @requires_permission("system.view")
    def get(self):
        """
        获取CSRF令牌
        获取用于表单提交的CSRF令牌。
        """
        csrf_token = generate_csrf()
        response = make_response(APIResponse.success(data={"csrf_token": csrf_token}))
        response.set_cookie(
            "csrf_token",
            value=csrf_token,
            httponly=False,
            secure=False,
            samesite="Lax",
            max_age=3600,
            path="/",
        )
        return response


@ns_admins.route("/refresh-token")
class AdminRefreshToken(Resource):
    @ns_admins.doc("refresh_token", description="刷新访问令牌")
    @ns_admins.response(200, "刷新成功")
    @ns_admins.response(400, "缺少refresh_token")
    @ns_admins.response(401, "无效的refresh_token或管理员不存在")
    @requires_permission("system.config")
    def post(self):
        """
        刷新访问令牌
        使用refresh_token获取新的access_token。
        请求：refresh_token优先从Cookie获取，若Cookie不存在则从请求体获取
        返回：
        - access_token: 新的访问令牌
        - refresh_token: 新的刷新令牌
        """
        refresh_token = request.cookies.get("refresh_token")
        if not refresh_token:
            data = request.get_json(silent=True)
            if data and data.get("refresh_token"):
                refresh_token = data.get("refresh_token")
        if not refresh_token:
            return APIResponse.error(message="登录状态已失效，请重新登录", status_code=401)
        # 验证refresh token
        payload = validate_token(refresh_token, "refresh")
        if not payload:
            return APIResponse.error(message="无效的refresh_token", status_code=401)
        admin_id = payload.get("admin_id")
        admin = get_by_id(Admin, admin_id)
        if not admin:
            return APIResponse.error(message="管理员不存在", status_code=401)
        # 生成新的令牌
        tokens = generate_tokens(admin.id, admin.username, admin.role)
        log_operation(
            operation_type="token_refresh",
            target_type="admin",
            target_id=admin.id,
            description=f"管理员刷新令牌: {admin.username}",
        )
        # 创建响应并设置新的认证Cookie
        tokens["expires_in"] = int(JWT_ACCESS_TOKEN_EXPIRES.total_seconds())
        response_data, status_code = APIResponse.success(data=tokens, message="令牌刷新成功")
        response = make_response(jsonify(response_data), status_code)
        set_auth_cookies(response, tokens["access_token"], tokens["refresh_token"])
        return response


@ns_admins.route("/<int:id>/change-password")
@ns_admins.param("id", "管理员ID")
class AdminChangePassword(Resource):
    @ns_admins.doc("change_password", description="修改密码", security="Bearer")
    @ns_admins.expect(change_password_model)
    @ns_admins.response(200, "修改成功")
    @ns_admins.response(400, "参数错误或密码强度不足")
    @ns_admins.response(404, "管理员不存在")
    @requires_admin
    def post(self, id):
        """
        修改管理员密码
        修改指定管理员的密码。需要验证旧密码。
        请求体：
        - old_password: 旧密码
        - new_password: 新密码（至少8位，包含字母和数字）
        """
        data = request.get_json()
        old_password = data.get("old_password")
        new_password = data.get("new_password")
        if not old_password or not new_password:
            return APIResponse.error(message="请提供旧密码和新密码", status_code=400)
        # 新密码强度验证
        if not is_strong_password(new_password):
            return APIResponse.error(
                message="新密码强度不足：至少8位，包含字母和数字", status_code=400
            )
        admin = Admin.query.get_or_404(id)
        # 使用bcrypt验证旧密码
        if not verify_password(old_password, admin.password):
            return APIResponse.error(message="旧密码错误", status_code=400)
        change_admin_password(admin, new_password)
        return APIResponse.success(message="密码修改成功")


@ns_admins.route("/<int:admin_id>/assign-class")
@ns_admins.param("admin_id", "管理员ID")
class AdminAssignClass(Resource):
    @ns_admins.doc("assign_class_to_admin", description="为管理员分配班级", security="Bearer")
    @ns_admins.expect(assign_class_model)
    @ns_admins.response(200, "分配成功")
    @ns_admins.response(400, "参数错误")
    @ns_admins.response(404, "管理员或班级不存在")
    @requires_permission("system.users")
    def post(self, admin_id):
        """
        为管理员分配班级
        将班级分配给指定的管理员。需要管理员权限。
        请求体：
        - class_id: 班级ID（必填）
        - is_primary: 是否为主班级（可选，默认false）
        """
        data = request.get_json()
        class_id = data.get("class_id")
        is_primary = data.get("is_primary", False)
        if not class_id:
            return APIResponse.error(message="请提供班级ID", status_code=400)
        _admin = Admin.query.get_or_404(admin_id)  # noqa: F841
        ClassInfo.query.get_or_404(class_id)
        assign_class_link(admin_id, class_id, is_primary)
        invalidate_cache("api:/api/admins/*")
        return APIResponse.success(message="班级分配成功")


@ns_admins.route("/<int:admin_id>/remove-class/<int:class_id>")
@ns_admins.param("admin_id", "管理员ID")
@ns_admins.param("class_id", "班级ID")
class AdminRemoveClass(Resource):
    @ns_admins.doc("remove_class_from_admin", description="移除管理员的班级分配", security="Bearer")
    @ns_admins.response(200, "移除成功")
    @ns_admins.response(404, "未找到关联记录")
    @requires_permission("system.users")
    def post(self, admin_id, class_id):
        """
        移除管理员的班级分配
        从管理员中移除指定班级的关联。需要管理员权限。
        """
        link = AdminClass.query.filter_by(admin_id=admin_id, class_info_id=class_id).first()
        if not link:
            return APIResponse.error(message="未找到关联记录", status_code=404)
        remove_class_link(link)
        invalidate_cache("api:/api/admins/*")
        return APIResponse.success(message="班级移除成功")
