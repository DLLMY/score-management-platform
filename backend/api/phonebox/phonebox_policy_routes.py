"""班主任手机箱自助开箱策略 API。

设计要点（与用户确认）：
  - 班主任可自由决定本班手机箱自助开箱：总开关 / 预设时段 / 一键临时放行。
  - 仅能管理自己班级（class_info_id == Admin.primary_class_id）；admin / super_admin 可管理任意班级。
  - 权限：phonebox.unlock.manage（已授予 teacher 角色）。

评估逻辑在服务层 services/phonebox_policy.py，本路由只负责校验、存取与序列化。
"""

from flask_restx import Namespace, Resource, fields
from flask import request, g
from models import PhoneBoxPolicy, db, ClassInfo
from services import phonebox_policy as policy_service
from utils.permission import requires_permission, get_current_admin
from utils.response import APIResponse
from datetime import datetime

ns_phonebox_policy = Namespace("phonebox-policy", description="班主任手机箱开箱策略")

# ---- 请求/响应模型（仅用于 swagger 文档）----
policy_model = ns_phonebox_policy.model(
    "PhoneBoxPolicy",
    {
        "allow_self_unlock": fields.Boolean(description="是否允许本班自助开箱（总开关）"),
        "unlock_windows": fields.Raw(description="预设允许时段列表，形如 "
                                                 "[{'day':-1,'start_hour':10,'start_minute':0,"
                                                 "'end_hour':10,'end_minute':20}]"),
    },
)

override_model = ns_phonebox_policy.model(
    "PhoneBoxOverride",
    {
        "minutes": fields.Integer(required=True, description="一键放行持续时间（分钟）"),
        "class_info_id": fields.Integer(required=False, description="目标班级ID（admin 用，班主任留空）"),
    },
)

policy_response = ns_phonebox_policy.model(
    "PhoneBoxPolicyResponse",
    {
        "class_info_id": fields.Integer,
        "exists": fields.Boolean,
        "allow_self_unlock": fields.Boolean,
        "unlock_windows": fields.Raw,
        "override_until": fields.String,
        "override_active": fields.Boolean,
        "updated_by": fields.Integer,
        "updated_at": fields.String,
    },
)


def _current_admin():
    admin = getattr(g, "current_user", None)
    if admin is None:
        admin = get_current_admin()
    return admin


def _read_class_info_id():
    """统一从 query string 与 JSON body 两处读取 class_info_id。

    前端不同页面/调用方式可能走 query 或 body，两者都要兼容，
    否则会出现「明明传了 class_info_id 却报未指定」的问题。
    """
    cid = request.args.get("class_info_id", type=int)
    if cid:
        return cid
    payload = None
    try:
        payload = request.get_json(silent=True)
    except Exception:
        payload = None
    if isinstance(payload, dict):
        raw = payload.get("class_info_id")
        if raw not in (None, ""):
            try:
                return int(raw)
            except (TypeError, ValueError):
                return None
    return None


def _resolve_target_class(class_info_id):
    """解析目标班级并做班主任隔离校验。

    Returns:
        (class_info_id or None, error_message or None)
    """
    admin = _current_admin()
    if admin is None:
        return None, "未认证"
    is_super = admin.role in ("admin", "super_admin")
    if class_info_id:
        class_info_id = int(class_info_id)
        if not is_super and admin.primary_class_id != class_info_id:
            return None, "无权管理该班级（仅可管理本人绑定班级）"
        cls = ClassInfo.query.get(class_info_id)
        if cls is None:
            return None, "班级不存在"
        return class_info_id, None
    # 未传 class_info_id：班主任用自己班级
    if not is_super:
        if admin.primary_class_id:
            return admin.primary_class_id, None
        return None, "未绑定班级，无法定位策略"
    return None, "管理员必须指定 class_info_id"


def _serialize(policy, class_info_id):
    if policy is None:
        return {
            "class_info_id": class_info_id,
            "exists": False,
            "allow_self_unlock": True,
            "unlock_windows": [],
            "override_until": None,
            "override_active": False,
            "updated_by": None,
            "updated_at": None,
        }
    now = datetime.now()
    return {
        "class_info_id": policy.class_info_id,
        "exists": True,
        "allow_self_unlock": policy.allow_self_unlock,
        "unlock_windows": policy.unlock_windows or [],
        "override_until": policy.override_until.isoformat() if policy.override_until else None,
        "override_active": bool(policy.override_until and policy.override_until > now),
        "updated_by": policy.updated_by,
        "updated_at": policy.updated_at.isoformat() if policy.updated_at else None,
    }


@ns_phonebox_policy.route("")
class PhoneBoxPolicyResource(Resource):
    @ns_phonebox_policy.doc("get_phonebox_policy", description="获取手机箱开箱策略（班主任取本班，admin 可指定班级）")
    @ns_phonebox_policy.response(200, "成功", policy_response)
    @requires_permission("phonebox.unlock.manage")
    def get(self):
        class_info_id = _read_class_info_id()
        cid, err = _resolve_target_class(class_info_id)
        if err:
            return APIResponse.error(message=err, status_code=403)
        policy = policy_service.get_policy(cid)
        return APIResponse.success(data=_serialize(policy, cid))

    @ns_phonebox_policy.doc("update_phonebox_policy", description="更新手机箱开箱策略（总开关/预设时段）", security="Bearer")
    @ns_phonebox_policy.expect(policy_model)
    @ns_phonebox_policy.response(200, "更新成功", policy_response)
    @requires_permission("phonebox.unlock.manage")
    def put(self):
        class_info_id = _read_class_info_id()
        cid, err = _resolve_target_class(class_info_id)
        if err:
            return APIResponse.error(message=err, status_code=403)
        data = ns_phonebox_policy.payload or {}
        allow = data.get("allow_self_unlock")
        windows = data.get("unlock_windows")
        admin = _current_admin()
        try:
            policy = policy_service.set_policy(
                cid,
                allow_self_unlock=allow if allow is not None else None,
                unlock_windows=windows if windows is not None else None,
                updated_by=admin.id if admin else None,
            )
            return APIResponse.success(data=_serialize(policy, cid))
        except ValueError as e:
            # 时段格式非法属于用户输入问题，返回 400 并带上具体原因
            return APIResponse.error(message=str(e), status_code=400)
        except Exception as e:
            return APIResponse.error(message=f"更新失败: {e}", status_code=500)


@ns_phonebox_policy.route("/override")
class PhoneBoxOverrideResource(Resource):
    @ns_phonebox_policy.doc("one_click_allow", description="一键临时放行本班开箱 N 分钟（含上课期间）", security="Bearer")
    @ns_phonebox_policy.expect(override_model)
    @ns_phonebox_policy.response(200, "成功", policy_response)
    @requires_permission("phonebox.unlock.manage")
    def post(self):
        data = ns_phonebox_policy.payload or {}
        minutes = data.get("minutes")
        if not minutes or int(minutes) <= 0:
            return APIResponse.error(message="minutes 必须为正整数", status_code=400)
        class_info_id = _read_class_info_id()
        cid, err = _resolve_target_class(class_info_id)
        if err:
            return APIResponse.error(message=err, status_code=403)
        admin = _current_admin()
        try:
            policy = policy_service.one_click_allow(
                cid, int(minutes), updated_by=admin.id if admin else None
            )
            return APIResponse.success(data=_serialize(policy, cid))
        except Exception as e:
            return APIResponse.error(message=f"一键放行失败: {e}", status_code=500)


@ns_phonebox_policy.route("/cancel-override")
class PhoneBoxCancelOverrideResource(Resource):
    @ns_phonebox_policy.doc("cancel_override", description="取消一键临时放行", security="Bearer")
    @ns_phonebox_policy.response(200, "成功", policy_response)
    @requires_permission("phonebox.unlock.manage")
    def post(self):
        class_info_id = _read_class_info_id()
        cid, err = _resolve_target_class(class_info_id)
        if err:
            return APIResponse.error(message=err, status_code=403)
        admin = _current_admin()
        policy = policy_service.cancel_override(cid, updated_by=admin.id if admin else None)
        if policy is None:
            # 本班从未配置过策略，返回默认空策略
            return APIResponse.success(data=_serialize(None, cid))
        return APIResponse.success(data=_serialize(policy, cid))
