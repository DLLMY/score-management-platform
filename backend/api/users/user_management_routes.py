from flask import request
from flask_restx import Namespace, Resource, fields
from models import User
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache
from utils.response import APIResponse
from utils.pagination import get_pagination
from datetime import datetime
from services.user_service import user_service
from services.unlock_validator import (
    add_to_blacklist,
    remove_from_blacklist,
    set_daily_unlock_limit,
    check_user_blacklist,
    UnlockValidator,
)

ns_user_management = Namespace("user-management", description="用户管理增强功能")

blacklist_request = ns_user_management.model(
    "BlacklistRequest",
    {
        "reason": fields.String(description="禁用原因"),
        "until": fields.DateTime(description="禁用截止时间（可选）"),
    },
)

unlock_limit_request = ns_user_management.model(
    "UnlockLimitRequest", {"limit": fields.Integer(required=True, description="每日开锁次数限制")}
)

# B3 User.to_dict 字段子集（2026-08-23）
USER_BLACKLIST_FIELDS = [
    "id", "name", "card_id", "class_name", "blacklist_reason",
    "blacklist_until", "current_score", "created_at",
]
USER_UNLOCK_FIELDS = [
    "id", "name", "card_id", "class_name", "current_score", "is_active",
    "is_blacklisted", "daily_unlock_limit", "today_unlock_count",
    "last_unlock_date",
]

user_blacklist_response = ns_user_management.model(
    "UserBlacklistResponse",
    {
        "id": fields.Integer(description="用户ID"),
        "name": fields.String(description="用户姓名"),
        "card_id": fields.String(description="卡号"),
        "is_blacklisted": fields.Boolean(description="是否在黑名单"),
        "blacklist_reason": fields.String(description="禁用原因"),
        "blacklist_until": fields.DateTime(description="禁用截止时间"),
        "daily_unlock_limit": fields.Integer(description="每日开锁限制"),
        "today_unlock_count": fields.Integer(description="今日已用次数"),
        "current_score": fields.Integer(description="当前积分"),
    },
)

user_unlock_status_response = ns_user_management.model(
    "UserUnlockStatusResponse",
    {
        "exists": fields.Boolean(description="用户是否存在"),
        "user_id": fields.Integer(description="用户ID"),
        "name": fields.String(description="用户姓名"),
        "current_score": fields.Integer(description="当前积分"),
        "is_blacklisted": fields.Boolean(description="是否在黑名单"),
        "daily_unlock_limit": fields.Integer(description="每日开锁限制"),
        "today_unlock_count": fields.Integer(description="今日已用次数"),
        "remaining": fields.Integer(description="剩余可用次数"),
        "is_active": fields.Boolean(description="是否启用"),
    },
)


@ns_user_management.route("/blacklist")
class UserBlacklist(Resource):

    @ns_user_management.doc("get_blacklisted_users", description="获取黑名单用户列表")
    @ns_user_management.response(200, "成功")
    @requires_permission("user.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取黑名单用户列表

        返回所有被禁用的用户。
        """
        page, per_page = get_pagination(default=20)
        pagination = (
            User.query.filter_by(is_blacklisted=True)
            .order_by(User.id)
            .paginate(page=page, per_page=per_page, error_out=False)
        )
        blacklisted_users = pagination.items

        return APIResponse.success(
            data={
                "users": [
                    u.to_dict(USER_BLACKLIST_FIELDS) for u in blacklisted_users
                ],
                "total": pagination.total,
            },
            pagination={"page": page, "per_page": per_page, "total": pagination.total, "pages": pagination.pages},
        )


@ns_user_management.route("/blacklist/<string:card_id>")
@ns_user_management.param("card_id", "卡号ID")
class UserBlacklistItem(Resource):

    @ns_user_management.doc("add_to_blacklist", description="添加用户到黑名单")
    @ns_user_management.expect(blacklist_request)
    @ns_user_management.response(200, "成功")
    @ns_user_management.response(404, "用户不存在")
    @requires_permission("user.manage")
    def post(self, card_id):
        """
        添加用户到黑名单

        将指定用户加入黑名单，阻止其使用开锁功能。
        """
        data = request.get_json() or {}
        reason = data.get("reason", "管理员工禁用")
        until = data.get("until")

        if until:
            until = datetime.fromisoformat(until)

        success, message = add_to_blacklist(card_id, reason, until)

        if not success:
            return APIResponse.error(message=message, status_code=404)
        invalidate_cache("api:/api/user-management/*")

        return APIResponse.success(message=message)

    @ns_user_management.doc("remove_from_blacklist", description="从黑名单移除用户")
    @ns_user_management.response(200, "成功")
    @ns_user_management.response(404, "用户不存在")
    @requires_permission("user.manage")
    def delete(self, card_id):
        """
        从黑名单移除用户

        允许指定用户重新使用开锁功能。
        """
        success, message = remove_from_blacklist(card_id)

        if not success:
            return APIResponse.error(message=message, status_code=404)
        invalidate_cache("api:/api/user-management/*")

        return APIResponse.success(message=message)


@ns_user_management.route("/unlock-limit/<string:card_id>")
@ns_user_management.param("card_id", "卡号ID")
class UserUnlockLimit(Resource):

    @ns_user_management.doc("get_unlock_limit", description="获取用户开锁限制", security="Bearer")
    @ns_user_management.response(200, "成功")
    @requires_permission("student.view")
    def get(self, card_id):
        """
        获取用户的开锁限制信息
        """
        status = UnlockValidator.get_unlock_status(card_id)
        return APIResponse.success(data=status)

    @ns_user_management.doc("set_unlock_limit", description="设置用户开锁限制")
    @ns_user_management.expect(unlock_limit_request)
    @ns_user_management.response(200, "成功")
    @ns_user_management.response(404, "用户不存在")
    @ns_user_management.response(400, "限制值无效")
    @requires_permission("user.manage")
    def put(self, card_id):
        """
        设置用户每日开锁次数限制

        允许管理员自定义用户的每日开锁次数上限。
        """
        data = request.get_json()
        limit = data.get("limit", 5)

        success, message = set_daily_unlock_limit(card_id, limit)

        if not success:
            status_code = 404 if message == "user_not_found" else 400
            return APIResponse.error(message=message, status_code=status_code)
        invalidate_cache("api:/api/user-management/*")

        return APIResponse.success(message=message)


@ns_user_management.route("/blacklist-check/<string:card_id>")
@ns_user_management.param("card_id", "卡号ID")
class BlacklistCheck(Resource):

    @ns_user_management.doc("check_blacklist", description="检查用户是否在黑名单")
    @ns_user_management.response(200, "成功")
    @requires_permission("student.view")
    def get(self, card_id):
        """
        检查用户是否在黑名单中

        用于快速检查某用户是否可以正常使用开锁功能。
        """
        is_blacklisted, reason = check_user_blacklist(card_id)

        return APIResponse.success(
            data={"is_blacklisted": is_blacklisted, "reason": reason if is_blacklisted else None}
        )


@ns_user_management.route("/user-status")
class UserStatusList(Resource):

    @ns_user_management.doc("get_users_status", description="获取用户状态列表")
    @ns_user_management.param("is_active", "是否启用")
    @ns_user_management.param("is_blacklisted", "是否在黑名单")
    @ns_user_management.response(200, "成功")
    @requires_permission("user.view")
    def get(self):
        """
        获取用户状态列表

        支持按启用状态和黑名单状态筛选。
        """
        is_active = request.args.get("is_active")
        is_blacklisted = request.args.get("is_blacklisted")

        query = User.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == "true")

        if is_blacklisted is not None:
            query = query.filter_by(is_blacklisted=is_blacklisted.lower() == "true")

        page, per_page = get_pagination(default=20)
        pagination = query.order_by(User.id).paginate(
            page=page, per_page=per_page, error_out=False
        )
        users = pagination.items

        return APIResponse.success(
            data={
                "users": [
                    u.to_dict(USER_UNLOCK_FIELDS) for u in users
                ],
                "total": pagination.total,
            },
            pagination={"page": page, "per_page": per_page, "total": pagination.total, "pages": pagination.pages},
        )


@ns_user_management.route("/user/<int:user_id>/toggle-active")
@ns_user_management.param("user_id", "用户ID")
class ToggleUserActive(Resource):

    @ns_user_management.doc("toggle_user_active", description="切换用户启用状态")
    @ns_user_management.response(200, "成功")
    @ns_user_management.response(404, "用户不存在")
    @requires_permission("user.manage")
    def post(self, user_id):
        """
        切换用户启用状态

        将用户标记为启用或禁用。禁用的用户无法使用开锁功能。
        """
        is_active = user_service.toggle_active(user_id)

        if is_active is None:
            return APIResponse.error(message="用户不存在", status_code=404)

        return APIResponse.success(
            data={"is_active": is_active}, message=f'用户已{"启用" if is_active else "禁用"}'
        )
