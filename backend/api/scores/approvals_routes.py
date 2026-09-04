from flask import request
import json
import logging
from flask_restx import Namespace, Resource, fields
from models import Approval, User, SystemConfig, get_by_id
from utils.permission import (
    requires_permission,
    get_current_admin,
    get_allowed_classes,
    can_access_student,
)
from utils.response import APIResponse
from utils.pagination import get_pagination
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.class_time_checker import ClassTimeChecker
from datetime import datetime
from sqlalchemy.orm import joinedload

from services.approval_service import (
    create_approval,
    update_approval,
    delete_approval,
    approve_approval,
    reject_approval,
)
from utils.logger import log_info, log_warning, log_debug

try:
    from services.mqtt_manager import mqtt_manager
    from api.monitoring.mqtt_routes import publish_mqtt

    mqtt_available = True
except ImportError:
    mqtt_available = False
    log_warning("[Approvals] MQTT模块未导入，审批通知功能不可用")

try:
    from api.system.admin_notifications_routes import create_admin_notification
except ImportError:
    import logging

    def create_admin_notification(**kwargs):
        logging.getLogger(__name__).warning(
            "admin_notifications_routes 导入失败，审批相关的管理员通知被静默丢弃"
        )
        return None


ns_approvals = Namespace("approvals", description="审批相关操作")

approval_model = ns_approvals.model(
    "Approval",
    {
        "id": fields.Integer(readOnly=True, description="审批ID"),
        "user_id": fields.Integer(required=True, description="学生ID"),
        "type": fields.String(required=True, description="审批类型"),
        "title": fields.String(description="标题"),
        "description": fields.String(description="描述"),
        "score_change": fields.Float(description="积分变化"),
        "status": fields.String(readOnly=True, description="状态"),
        "approver_id": fields.Integer(description="审批人ID"),
        "comment": fields.String(description="审批意见"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
    },
)


def apply_score_limit(score):
    """应用积分上下限"""
    config = SystemConfig.query.first()
    min_score = config.min_score if config else 0
    max_score = config.max_score if config else 100
    return max(min_score, min(score, max_score))


def _execute_approve(approval, data):
    """单条审批通过完整链路（单条/批量共用）。返回 (ok, message, detail)。"""
    if not can_access_student(approval.student_id):
        return False, "无权审批该申请", {"code": 403}
    if approval.status != "pending":
        return False, "该审批已被处理", {"code": 400}

    # 事务收口到 service：状态/审批人/意见/时间 + 原子积分累加 + 生成 ScoreRecord + 单一提交
    result = approve_approval(approval, data)
    user = result["user"]
    actual_change = result["actual_change"]

    # R4: 审批通过改分后触发综合评分重算（原仅 score-entry 触发 → 两套行为）
    if user:
        try:
            from services.composite_score_service import CompositeScoreService

            CompositeScoreService.recalculate_user_score(user.id)
        except Exception as e:
            logging.getLogger(__name__).error(
                "[CompositeScore] 审批通过重算综合分失败 user_id=%s: %s", user.id, e
            )

    # D3/R4: 审批结果写入学生通知中心（学生端 /notifications 可见）
    if user:
        try:
            from services.notification_service import create_approval_result_notification

            create_approval_result_notification(
                user_id=user.id,
                title="审批通过",
                content="您的申请「%s」已审批通过%s"
                % (
                    approval.title,
                    "，积分变动 %+g 分" % actual_change if actual_change else "",
                ),
            )
        except Exception as e:
            log_warning(f"[Approval] 审批结果通知写入失败: {e}", exception=e)

    # 更新用户缓存
    if mqtt_available and user:
        mqtt_manager.set_cached_user(user.card_id, user)

    # 发送审批结果通知到设备端
    if mqtt_available and user:
        notification = {
            "type": "approval_result",
            "approval_id": approval.id,
            "user_name": user.name,
            "card_id": user.card_id,
            "score_change": approval.score_change,
            "new_points": user.current_score,
            "status": "approved",
            "comment": approval.comment,
            "timestamp": datetime.now().isoformat(),
        }
        publish_mqtt("phonebox/notification", json.dumps(notification))
        publish_mqtt(f"phonebox/notification/{user.card_id}", json.dumps(notification))

    # 发送积分变动通知到远程客户端（积分窗口显示）
    if mqtt_available and user:
        try:
            score_change_str = (
                f"{approval.score_change:+g}" if approval.score_change > 0 else str(approval.score_change)
            )
            score_change_text = f"学生:{user.name}, {score_change_str}分, 原因:审批通过-{approval.title}"

            allowed, check_message, reason_code, rule_info = (
                ClassTimeChecker.is_notification_allowed(
                    target_class_info_id=getattr(user, "class_info_id", None), force_send=False
                )
            )
            if allowed:
                score_notification = {
                    "type": "score_change",
                    "text": score_change_text,
                    "popup": True,
                    "timestamp": datetime.now().isoformat(),
                }
                publish_mqtt("phonebox/remote/notify", score_notification)
            else:
                ClassTimeChecker.log_notify_audit(
                    "score_change",
                    getattr(user, "class_info_id", None),
                    None,
                    {"text": score_change_text},
                    reason_code or "GLOBAL_TIME_RULE",
                    check_message,
                    force_send=False,
                )

            create_admin_notification(
                title="审批通过通知",
                message=score_change_text,
                type="success",
                priority="medium",
                extra_data={
                    "approval_id": approval.id,
                    "user_id": approval.student_id,
                    "user_name": user.name,
                    "score_change": approval.score_change,
                    "title": approval.title,
                },
            )
        except Exception as e:
            log_warning(f"[ScoreChange] 审批积分变动通知发送失败: {e}", exception=e)

    invalidate_cache("api:/api/approvals/*")
    return True, "审批已通过", {
        "approval_id": approval.id,
        "user_name": user.name if user else None,
        "score_change": approval.score_change,
        "new_points": user.current_score if user else None,
        "notification_sent": mqtt_available,
    }


def _execute_reject(approval, data):
    """单条审批拒绝完整链路（单条/批量共用）。返回 (ok, message, detail)。"""
    if not can_access_student(approval.student_id):
        return False, "无权审批该申请", {"code": 403}
    if approval.status != "pending":
        return False, "该审批已被处理", {"code": 400}

    # 事务收口到 service：状态/审批人/意见/时间 + 单一提交
    result = reject_approval(approval, data)
    user = result["user"]

    # D3/R4: 拒绝结果写入学生通知中心
    if user:
        try:
            from services.notification_service import create_approval_result_notification

            create_approval_result_notification(
                user_id=user.id,
                title="审批未通过",
                content="您的申请「%s」未通过审批：%s"
                % (approval.title, approval.comment or "审批未通过"),
            )
        except Exception as e:
            log_warning(f"[Approval] 审批结果通知写入失败: {e}", exception=e)

    if mqtt_available and user:
        notification = {
            "type": "approval_result",
            "approval_id": approval.id,
            "user_name": user.name,
            "card_id": user.card_id,
            "score_change": approval.score_change,
            "new_points": user.current_score,
            "status": "rejected",
            "comment": approval.comment,
            "timestamp": datetime.now().isoformat(),
        }
        publish_mqtt("phonebox/notification", json.dumps(notification))
        publish_mqtt(f"phonebox/notification/{user.card_id}", json.dumps(notification))

    invalidate_cache("api:/api/approvals/*")
    return True, "审批已拒绝", {
        "approval_id": approval.id,
        "comment": approval.comment,
        "notification_sent": mqtt_available,
    }


def _apply_approval_data_isolation(query):
    """对审批查询应用数据隔离：非管理员只能查看关联班级的审批"""
    admin = get_current_admin()
    if not admin:
        return query
    allowed_classes = get_allowed_classes(admin.id)
    if allowed_classes is None:
        return query
    if not allowed_classes:
        return query.filter(False)
    return query.join(User).filter(User.class_name.in_(allowed_classes))


@ns_approvals.route("/")
class ApprovalList(Resource):
    @ns_approvals.doc(
        "list_approvals",
        params={
            "page": "页码（默认1）",
            "per_page": "每页数量（默认10）",
            "status": "状态筛选（pending/approved/rejected）",
        },
    )
    @requires_permission("score.view")
    @cached_api(ttl=30)
    def get(self):
        """获取审批列表。非管理员用户只能查看关联班级的审批。"""
        page, per_page = get_pagination(default=10)
        status = request.args.get("status")

        query = Approval.query.options(joinedload(Approval.user))
        if status:
            query = query.filter_by(status=status)

        # 数据隔离
        query = _apply_approval_data_isolation(query)

        pagination = query.order_by(Approval.created_at.desc()).paginate(
            page=page, per_page=per_page
        )
        approvals = pagination.items

        return APIResponse.success(
            data={
                "approvals": [
                    {
                        "id": a.id,
                        "user_id": a.student_id,
                        "student_id": a.student_id,
                        "user_name": a.user.name if a.user else None,
                        "type": a.type,
                        "title": a.title,
                        "description": a.description,
                        "score_change": a.score_change,
                        "status": a.status,
                        "approver_id": a.approver_id,
                        "comment": a.comment,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                        "approve_time": a.approve_time.isoformat() if a.approve_time else None,
                    }
                    for a in approvals
                ],
                "pagination": {
                    "page": pagination.page,
                    "per_page": pagination.per_page,
                    "total": pagination.total,
                    "pages": pagination.pages,
                },
            }
        )

    @ns_approvals.doc("create_approval")
    @ns_approvals.expect(approval_model)
    @requires_permission("score.entry")
    def post(self):
        """创建审批申请。非管理员用户只能为关联班级的学生创建申请。"""
        data = ns_approvals.payload

        user_id = data.get("user_id")
        if not user_id:
            return APIResponse.error(message="学生ID不能为空", status_code=400)

        # 数据隔离检查
        if not can_access_student(user_id):
            return APIResponse.error(message="无权为该学生创建审批申请", status_code=403)

        user = get_by_id(User, user_id)
        if not user:
            return APIResponse.error(message="学生不存在", status_code=404)

        approval_id, err = create_approval(data)
        if err:
            return APIResponse.error(message=err, status_code=400)
        invalidate_cache("api:/api/approvals/*")
        return APIResponse.success(
            data={"approval_id": approval_id}, message="审批申请创建成功", status_code=201
        )


@ns_approvals.route("/<int:id>")
@ns_approvals.param("id", "审批ID")
class ApprovalResource(Resource):

    @ns_approvals.doc("get_approval")
    @requires_permission("score.view")
    def get(self, id):
        """获取单个审批详情。非管理员用户只能查看关联班级的审批。"""
        approval = Approval.query.options(joinedload(Approval.user)).get_or_404(id)
        if not can_access_student(approval.student_id):
            return APIResponse.error(message="无权查看该审批", status_code=403)
        return APIResponse.success(
            data={
                "id": approval.id,
                "user_id": approval.student_id,
                "student_id": approval.student_id,
                "user_name": approval.user.name if approval.user else None,
                "type": approval.type,
                "title": approval.title,
                "description": approval.description,
                "score_change": approval.score_change,
                "status": approval.status,
                "approver_id": approval.approver_id,
                "comment": approval.comment,
                "created_at": approval.created_at.isoformat() if approval.created_at else None,
                "approve_time": (
                    approval.approve_time.isoformat() if approval.approve_time else None
                ),
            }
        )

    @ns_approvals.doc("update_approval")
    @ns_approvals.expect(approval_model)
    @requires_permission("score.edit")
    def put(self, id):
        """更新审批申请。非管理员用户只能更新关联班级的审批。"""
        approval = Approval.query.get_or_404(id)
        if not can_access_student(approval.student_id):
            return APIResponse.error(message="无权更新该审批", status_code=403)
        data = ns_approvals.payload
        update_approval(approval, data)
        invalidate_cache("api:/api/approvals/*")
        return APIResponse.success(message="审批更新成功")

    @ns_approvals.doc("delete_approval")
    @requires_permission("score.delete")
    def delete(self, id):
        """删除审批记录。非管理员用户只能删除关联班级的审批。"""
        approval = Approval.query.get_or_404(id)
        if not can_access_student(approval.student_id):
            return APIResponse.error(message="无权删除该审批", status_code=403)
        delete_approval(approval)
        invalidate_cache("api:/api/approvals/*")
        return APIResponse.success(message="审批记录删除成功")


@ns_approvals.route("/<int:id>/approve")
@ns_approvals.param("id", "审批ID")
class ApprovalApprove(Resource):

    @ns_approvals.doc("approve_approval")
    @requires_permission("score.approve")
    def post(self, id):
        """批准审批。需要审批权限。非管理员用户只能审批关联班级的申请。"""
        approval = Approval.query.get_or_404(id)
        ok, message, detail = _execute_approve(approval, request.get_json() or {})
        if not ok:
            return APIResponse.error(message=message, status_code=detail.get("code", 400))
        return APIResponse.success(data=detail, message=message)
@ns_approvals.route("/<int:id>/reject")
@ns_approvals.param("id", "审批ID")
class ApprovalReject(Resource):

    @ns_approvals.doc("reject_approval")
    @requires_permission("score.approve")
    def post(self, id):
        """拒绝审批。需要审批权限。非管理员用户只能审批关联班级的申请。"""
        approval = Approval.query.get_or_404(id)
        ok, message, detail = _execute_reject(approval, request.get_json() or {})
        if not ok:
            return APIResponse.error(message=message, status_code=detail.get("code", 400))
        return APIResponse.success(data=detail, message=message)
@ns_approvals.route("/batch-approve")
class ApprovalBatchApprove(Resource):

    @ns_approvals.doc("batch_approve_approvals", description="批量通过审批（逐条处理，返回逐条结果）")
    @requires_permission("score.approve")
    def post(self):
        """批量通过。逐条执行完整审批链路；单条失败不影响其余。"""
        data = request.get_json() or {}
        ids = data.get("ids") or []
        comment = data.get("comment")
        if not ids:
            return APIResponse.error(message="请选择要审批的申请")
        if len(ids) > 100:
            return APIResponse.error(message="单次最多批量审批 100 条")
        results = []
        for aid in ids:
            approval = Approval.query.get(aid)
            if not approval:
                results.append({"id": aid, "success": False, "message": "申请不存在"})
                continue
            try:
                ok, message, _detail = _execute_approve(approval, {"comment": comment})
                results.append({"id": aid, "success": ok, "message": message})
            except Exception as e:
                results.append({"id": aid, "success": False, "message": str(e)})
        ok_count = sum(1 for r in results if r["success"])
        return APIResponse.success(
            data={
                "results": results,
                "success_count": ok_count,
                "failed_count": len(results) - ok_count,
            },
            message="成功 %d 条，失败 %d 条" % (ok_count, len(results) - ok_count),
        )


@ns_approvals.route("/batch-reject")
class ApprovalBatchReject(Resource):

    @ns_approvals.doc("batch_reject_approvals", description="批量拒绝审批（逐条处理，返回逐条结果）")
    @requires_permission("score.approve")
    def post(self):
        """批量拒绝。逐条执行完整审批链路；单条失败不影响其余。"""
        data = request.get_json() or {}
        ids = data.get("ids") or []
        comment = data.get("comment")
        if not ids:
            return APIResponse.error(message="请选择要拒绝的申请")
        if len(ids) > 100:
            return APIResponse.error(message="单次最多批量拒绝 100 条")
        results = []
        for aid in ids:
            approval = Approval.query.get(aid)
            if not approval:
                results.append({"id": aid, "success": False, "message": "申请不存在"})
                continue
            try:
                ok, message, _detail = _execute_reject(approval, {"comment": comment})
                results.append({"id": aid, "success": ok, "message": message})
            except Exception as e:
                results.append({"id": aid, "success": False, "message": str(e)})
        ok_count = sum(1 for r in results if r["success"])
        return APIResponse.success(
            data={
                "results": results,
                "success_count": ok_count,
                "failed_count": len(results) - ok_count,
            },
            message="成功 %d 条，失败 %d 条" % (ok_count, len(results) - ok_count),
        )


@ns_approvals.route("/pending")
class PendingApprovals(Resource):

    @ns_approvals.doc(
        "get_pending_approvals", params={"page": "页码（默认1）", "per_page": "每页数量（默认10）"}
    )
    @requires_permission("score.view")
    @cached_api(ttl=30)
    def get(self):
        """获取待审批列表。非管理员用户只能查看关联班级的待审批。"""
        page, per_page = get_pagination(default=10)

        query = Approval.query.filter_by(status="pending")
        # 数据隔离
        query = _apply_approval_data_isolation(query)

        pagination = query.order_by(Approval.created_at.desc()).paginate(
            page=page, per_page=per_page
        )
        approvals = pagination.items

        return APIResponse.success(
            data={
                "approvals": [
                    {
                        "id": a.id,
                        "user_id": a.student_id,
                        "student_id": a.student_id,
                        "user_name": a.user.name if a.user else None,
                        "type": a.type,
                        "title": a.title,
                        "description": a.description,
                        "score_change": a.score_change,
                        "status": a.status,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in approvals
                ],
                "pagination": {
                    "page": pagination.page,
                    "per_page": pagination.per_page,
                    "total": pagination.total,
                    "pages": pagination.pages,
                },
            }
        )
