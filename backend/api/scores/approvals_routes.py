from flask import request
import json
from flask_restx import Namespace, Resource, fields
from models import db, Approval, User, ScoreRecord, SystemConfig, get_by_id
from utils.permission import requires_permission, get_current_admin, get_allowed_classes
from utils.response import APIResponse
from services.class_time_checker import ClassTimeChecker
from datetime import datetime
from sqlalchemy.orm import joinedload

try:
    from services.mqtt_manager import mqtt_manager
    from api.monitoring.mqtt_routes import publish_mqtt

    mqtt_available = True
except ImportError:
    mqtt_available = False
    print("[Approvals] MQTT模块未导入，审批通知功能不可用")

try:
    from api.system.admin_notifications_routes import create_admin_notification
except ImportError:

    def create_admin_notification(**kwargs):
        pass


ns_approvals = Namespace("approvals", description="审批相关操作")

approval_model = ns_approvals.model(
    "Approval",
    {
        "id": fields.Integer(readOnly=True, description="审批ID"),
        "user_id": fields.Integer(required=True, description="学生ID"),
        "type": fields.String(required=True, description="审批类型"),
        "title": fields.String(description="标题"),
        "description": fields.String(description="描述"),
        "score_change": fields.Integer(description="积分变化"),
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


def _can_access_approval_user(user_id):
    """检查当前管理员是否有权限审批指定学生的申请"""
    admin = get_current_admin()
    if not admin:
        return False
    allowed_classes = get_allowed_classes(admin.id)
    if allowed_classes is None:
        return True
    user = get_by_id(User, user_id)
    if not user:
        return False
    return user.class_name in allowed_classes


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
    def get(self):
        """获取审批列表。非管理员用户只能查看关联班级的审批。"""
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)
        status = request.args.get("status")

        query = Approval.query.options(joinedload(Approval.user))
        if status:
            query = query.filter_by(status=status)

        # 数据隔离
        query = _apply_approval_data_isolation(query)

        pagination = query.order_by(Approval.created_at.desc()).paginate(page=page, per_page=per_page)
        approvals = pagination.items

        return APIResponse.success(
            data={
                "approvals": [
                    {
                        "id": a.id,
                        "user_id": a.user_id,
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
        if not _can_access_approval_user(user_id):
            return APIResponse.error(message="无权为该学生创建审批申请", status_code=403)

        user = get_by_id(User, user_id)
        if not user:
            return APIResponse.error(message="学生不存在", status_code=404)

        approval = Approval(
            user_id=user_id,
            type=data.get("type"),
            title=data.get("title"),
            description=data.get("description"),
            score_change=data.get("score_change"),
        )
        db.session.add(approval)
        db.session.commit()
        return APIResponse.success(data={"approval_id": approval.id}, message="审批申请创建成功", status_code=201)


@ns_approvals.route("/<int:id>")
@ns_approvals.param("id", "审批ID")
class ApprovalResource(Resource):

    @ns_approvals.doc("get_approval")
    @requires_permission("score.view")
    def get(self, id):
        """获取单个审批详情。非管理员用户只能查看关联班级的审批。"""
        approval = Approval.query.options(joinedload(Approval.user)).get_or_404(id)
        if not _can_access_approval_user(approval.user_id):
            return APIResponse.error(message="无权查看该审批", status_code=403)
        return APIResponse.success(
            data={
                "id": approval.id,
                "user_id": approval.user_id,
                "user_name": approval.user.name if approval.user else None,
                "type": approval.type,
                "title": approval.title,
                "description": approval.description,
                "score_change": approval.score_change,
                "status": approval.status,
                "approver_id": approval.approver_id,
                "comment": approval.comment,
                "created_at": approval.created_at.isoformat() if approval.created_at else None,
                "approve_time": approval.approve_time.isoformat() if approval.approve_time else None,
            }
        )

    @ns_approvals.doc("update_approval")
    @ns_approvals.expect(approval_model)
    @requires_permission("score.edit")
    def put(self, id):
        """更新审批申请。非管理员用户只能更新关联班级的审批。"""
        approval = Approval.query.get_or_404(id)
        if not _can_access_approval_user(approval.user_id):
            return APIResponse.error(message="无权更新该审批", status_code=403)
        data = ns_approvals.payload
        approval.title = data.get("title", approval.title)
        approval.description = data.get("description", approval.description)
        approval.score_change = data.get("score_change", approval.score_change)
        db.session.commit()
        return APIResponse.success(message="审批更新成功")

    @ns_approvals.doc("delete_approval")
    @requires_permission("score.delete")
    def delete(self, id):
        """删除审批记录。非管理员用户只能删除关联班级的审批。"""
        approval = Approval.query.get_or_404(id)
        if not _can_access_approval_user(approval.user_id):
            return APIResponse.error(message="无权删除该审批", status_code=403)
        db.session.delete(approval)
        db.session.commit()
        return APIResponse.success(message="审批记录删除成功")


@ns_approvals.route("/<int:id>/approve")
@ns_approvals.param("id", "审批ID")
class ApprovalApprove(Resource):

    @ns_approvals.doc("approve_approval")
    @requires_permission("score.approve")
    def post(self, id):
        """批准审批。需要审批权限。非管理员用户只能审批关联班级的申请。"""
        approval = Approval.query.get_or_404(id)
        if not _can_access_approval_user(approval.user_id):
            return APIResponse.error(message="无权审批该申请", status_code=403)
        data = request.get_json() or {}

        if approval.status != "pending":
            return APIResponse.error(message="该审批已被处理", status_code=400)

        approval.status = "approved"
        approval.approver_id = data.get("approver_id")
        approval.comment = data.get("comment", "审批通过")
        approval.approve_time = datetime.now()

        user = get_by_id(User, approval.user_id)
        if user and approval.score_change:
            before_score = user.current_score or 0
            user.current_score = apply_score_limit(before_score + approval.score_change)
            user.updated_at = datetime.now()

            actual_change = user.current_score - before_score

            record = ScoreRecord(
                user_id=approval.user_id,
                score_change=actual_change,
                description=f"审批通过: {approval.title}",
                operator=f"admin_{approval.approver_id}",
            )
            db.session.add(record)

        db.session.commit()

        # 更新用户缓存
        if mqtt_available and user:
            mqtt_manager.set_cached_user(user.card_id, user)
            print(f"[Approval] 已更新用户缓存: card_id={user.card_id}, new_score={user.current_score}")

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
            # 发送到通用通知主题
            publish_mqtt("phonebox/notification", json.dumps(notification))
            # 发送到用户特定主题
            publish_mqtt(f"phonebox/notification/{user.card_id}", json.dumps(notification))
            print(f"[Approval] 已发送审批通过通知: card_id={user.card_id}")

        # 发送积分变动通知到远程客户端（积分窗口显示）
        if mqtt_available and user:
            try:
                score_change_str = (
                    f"{approval.score_change:+d}" if approval.score_change > 0 else str(approval.score_change)
                )
                score_change_text = f"学生:{user.name}, {score_change_str}分, 原因:审批通过-{approval.title}"

                allowed, check_message, reason_code, rule_info = ClassTimeChecker.is_notification_allowed(
                    target_class_info_id=getattr(user, "class_info_id", None), force_send=False
                )
                if allowed:
                    score_notification = {
                        "type": "score_change",
                        "text": score_change_text,
                        "popup": True,
                        "timestamp": datetime.now().isoformat(),
                    }
                    publish_mqtt("phonebox/remote/notify", score_notification)
                    print(f"[ScoreChange] 审批积分变动通知已发送: {score_change_text}")
                else:
                    ClassTimeChecker.log_notify_audit(
                        "score_change", getattr(user, "class_info_id", None), None,
                        {"text": score_change_text}, reason_code or "GLOBAL_TIME_RULE", check_message, force_send=False,
                    )
                    print(f"[ScoreChange] 审批积分变动通知被拦截（上课时间）: {score_change_text}")

                create_admin_notification(
                    title="审批通过通知",
                    message=score_change_text,
                    type="success",
                    priority="medium",
                    extra_data={
                        "approval_id": approval.id,
                        "user_id": approval.user_id,
                        "user_name": user.name,
                        "score_change": approval.score_change,
                        "title": approval.title,
                    },
                )
            except Exception as e:
                print(f"[ScoreChange] 审批积分变动通知发送失败: {e}")

        return APIResponse.success(
            data={
                "approval_id": approval.id,
                "user_name": user.name if user else None,
                "score_change": approval.score_change,
                "new_points": user.current_score if user else None,
                "notification_sent": mqtt_available,
            },
            message="审批已通过",
        )


@ns_approvals.route("/<int:id>/reject")
@ns_approvals.param("id", "审批ID")
class ApprovalReject(Resource):

    @ns_approvals.doc("reject_approval")
    @requires_permission("score.approve")
    def post(self, id):
        """拒绝审批。需要审批权限。非管理员用户只能审批关联班级的申请。"""
        approval = Approval.query.get_or_404(id)
        if not _can_access_approval_user(approval.user_id):
            return APIResponse.error(message="无权审批该申请", status_code=403)
        data = request.get_json() or {}

        if approval.status != "pending":
            return APIResponse.error(message="该审批已被处理", status_code=400)

        approval.status = "rejected"
        approval.approver_id = data.get("approver_id")
        approval.comment = data.get("comment", "审批未通过")
        approval.approve_time = datetime.now()

        user = get_by_id(User, approval.user_id)

        db.session.commit()

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
            print(f"[Approval] 已发送审批拒绝通知: card_id={user.card_id}")

        return APIResponse.success(
            data={"approval_id": approval.id, "comment": approval.comment, "notification_sent": mqtt_available},
            message="审批已拒绝",
        )


@ns_approvals.route("/pending")
class PendingApprovals(Resource):

    @ns_approvals.doc("get_pending_approvals", params={"page": "页码（默认1）", "per_page": "每页数量（默认10）"})
    @requires_permission("score.view")
    def get(self):
        """获取待审批列表。非管理员用户只能查看关联班级的待审批。"""
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)

        query = Approval.query.filter_by(status="pending")
        # 数据隔离
        query = _apply_approval_data_isolation(query)

        pagination = query.order_by(Approval.created_at.desc()).paginate(page=page, per_page=per_page)
        approvals = pagination.items

        return APIResponse.success(
            data={
                "approvals": [
                    {
                        "id": a.id,
                        "user_id": a.user_id,
                        "user_name": a.user.name if a.user else None,
                        "type": a.type,
                        "title": a.title,
                        "description": a.description,
                        "score_change": a.score_change,
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
