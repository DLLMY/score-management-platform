"""请假（硬件端）管理 REST 端点（#411 / F6）。

提供：
  - GET  /api/leave/active  ：当前生效中的请假列表（F6，供班主任/管理端查看）
  - GET  /api/leave/pending ：待审批的请假列表（F2 审批模式）
  - POST /api/leave/{id}/cancel：教师代销假（取消待审批或生效中的请假）

权限沿用 phonebox.unlock.manage（与 phonebox-policy 一致），由班主任/管理员操作。
硬件端请假主链路在 services/leave_service.py（MQTT 上行处理 + 下行回包），
本文件是管理端只读/代销假的补充入口。
"""

import json
import logging
from datetime import datetime

from flask import g
from flask_restx import Namespace, Resource, fields

from models import Approval, User
from utils.decorators import safe_handle
from utils.permission import get_current_admin, requires_permission
from utils.response import APIResponse

logger = logging.getLogger(__name__)

ns_leave = Namespace("leave", description="请假（硬件端）管理")

leave_model = ns_leave.model(
    "LeaveApproval",
    {
        "id": fields.Integer(description="请假记录ID"),
        "student_id": fields.Integer(description="学生ID"),
        "user_name": fields.String(description="学生姓名"),
        "leave_type": fields.String(description="请假类型 sick/personal/other"),
        "status": fields.String(description="状态 pending/approved/cancelled/expired/rejected"),
        "start_time": fields.String(description="请假开始时间(ISO8601)"),
        "end_time": fields.String(description="请假结束时间(ISO8601)"),
        "card_id": fields.String(description="请假刷卡卡号"),
        "device_id": fields.String(description="提交设备ID"),
        "created_at": fields.String(description="创建时间(ISO8601)"),
    },
)


def _serialize_leave(a):
    d = a.to_dict()
    user = a.user
    d["user_name"] = user.name if user else None
    return d


@ns_leave.route("/active")
class LeaveActiveResource(Resource):
    @ns_leave.doc("list_active_leaves", description="当前生效中的请假列表（F6）")
    @ns_leave.response(200, "成功", leave_model)
    @requires_permission("phonebox.unlock.manage")
    def get(self):
        now = datetime.now()
        admin = get_current_admin()
        is_super = admin is not None and admin.role in ("admin", "super_admin")
        query = (
            Approval.query.join(User, Approval.student_id == User.id)
            .filter(Approval.type == "leave", Approval.status == "approved", Approval.end_time > now)
        )
        if not is_super:
            query = query.filter(
                User.class_info_id == (admin.primary_class_id if admin else None)
            )
        leaves = query.order_by(Approval.end_time.asc()).all()
        return APIResponse.success(data=[_serialize_leave(a) for a in leaves])


@ns_leave.route("/pending")
class LeavePendingResource(Resource):
    @ns_leave.doc("list_pending_leaves", description="待审批的请假列表（F2 审批模式）")
    @ns_leave.response(200, "成功", leave_model)
    @requires_permission("phonebox.unlock.manage")
    def get(self):
        admin = get_current_admin()
        is_super = admin is not None and admin.role in ("admin", "super_admin")
        query = (
            Approval.query.join(User, Approval.student_id == User.id)
            .filter(Approval.type == "leave", Approval.status == "pending")
        )
        if not is_super:
            query = query.filter(
                User.class_info_id == (admin.primary_class_id if admin else None)
            )
        leaves = query.order_by(Approval.created_at.desc()).all()
        return APIResponse.success(data=[_serialize_leave(a) for a in leaves])


@ns_leave.route("/<int:leave_id>/cancel")
class LeaveCancelResource(Resource):
    @ns_leave.doc(
        "teacher_cancel_leave",
        description="教师代销假（取消待审批/生效中的请假）",
        security="Bearer",
    )
    @ns_leave.response(200, "成功", leave_model)
    @requires_permission("phonebox.unlock.manage")
    @safe_handle(message="代销假失败", default_status=500)
    def post(self, leave_id):
        admin = get_current_admin()
        leave = Approval.query.get(leave_id)
        if leave is None or leave.type != "leave":
            return APIResponse.error(message="请假记录不存在", status_code=404)
        if leave.status in ("cancelled", "expired", "rejected"):
            return APIResponse.error(message="该请假已结束，无法代销假", status_code=400)
        # 班级隔离：班主任仅可操作本班学生的请假，admin/super_admin 不受限
        if admin is not None and admin.role not in ("admin", "super_admin"):
            if leave.user is None or leave.user.class_info_id != admin.primary_class_id:
                return APIResponse.error(message="无权操作其他班级的请假", status_code=403)

        leave.status = "cancelled"
        leave.approver_id = admin.id if admin else None
        from models import db

        db.session.commit()

        # 通知设备端（若有）：该生请假已结束，下次刷卡查询将得到 on_leave=false
        if leave.device_id:
            try:
                from services.mqtt_service import publish_mqtt

                payload = {
                    "device_id": leave.device_id,
                    "type": "leave_cancel",
                    "r": {"ok": True, "status": "cancelled", "explain": "教师已代销假"},
                }
                publish_mqtt(
                    f"phonebox/leave/{leave.device_id}",
                    json.dumps(payload, ensure_ascii=False),
                )
            except Exception as e:
                logger.warning("[Leave] 代销假下发设备失败（已忽略）: %s", e, exc_info=True)

        return APIResponse.success(data=_serialize_leave(leave))
