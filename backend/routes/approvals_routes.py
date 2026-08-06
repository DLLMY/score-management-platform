from flask import request
from flask_restx import Namespace, Resource, fields
from models import db, Approval, User, ScoreRecord
from utils.permission import requires_admin
from datetime import datetime

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


@ns_approvals.route("/")
class ApprovalList(Resource):
    @ns_approvals.doc("list_approvals")
    @requires_admin
    def get(self):
        approvals = Approval.query.all()
        return {
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
            ]
        }

    @ns_approvals.doc("create_approval")
    @ns_approvals.expect(approval_model)
    def post(self):
        data = ns_approvals.payload
        approval = Approval(
            user_id=data.get("user_id"),
            type=data.get("type"),
            title=data.get("title"),
            description=data.get("description"),
            score_change=data.get("score_change"),
        )
        db.session.add(approval)
        db.session.commit()
        return {"success": True, "message": "审批申请创建成功", "approval_id": approval.id}, 201


@ns_approvals.route("/<int:id>")
@ns_approvals.param("id", "审批ID")
class ApprovalResource(Resource):
    @ns_approvals.doc("get_approval")
    def get(self, id):
        approval = Approval.query.get_or_404(id)
        return {
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

    @ns_approvals.doc("update_approval")
    @ns_approvals.expect(approval_model)
    @requires_admin
    def put(self, id):
        approval = Approval.query.get_or_404(id)
        data = ns_approvals.payload
        approval.title = data.get("title", approval.title)
        approval.description = data.get("description", approval.description)
        approval.score_change = data.get("score_change", approval.score_change)
        db.session.commit()
        return {"success": True, "message": "审批更新成功"}

    @ns_approvals.doc("delete_approval")
    @requires_admin
    def delete(self, id):
        approval = Approval.query.get_or_404(id)
        db.session.delete(approval)
        db.session.commit()
        return {"success": True, "message": "审批记录删除成功"}


@ns_approvals.route("/<int:id>/approve")
@ns_approvals.param("id", "审批ID")
class ApprovalApprove(Resource):
    @ns_approvals.doc("approve_approval")
    def post(self, id):
        approval = Approval.query.get_or_404(id)
        data = request.get_json() or {}

        if approval.status != "pending":
            return {"success": False, "message": "该审批已被处理"}, 400

        approval.status = "approved"
        approval.approver_id = data.get("approver_id")
        approval.comment = data.get("comment")
        approval.approve_time = datetime.now()

        user = User.query.get(approval.user_id)
        if user and approval.score_change:
            user.current_score = (user.current_score or 0) + approval.score_change
            user.updated_at = datetime.now()

            record = ScoreRecord(
                user_id=approval.user_id,
                score_change=approval.score_change,
                description=f"审批通过: {approval.title}",
                operator=f"admin_{approval.approver_id}",
            )
            db.session.add(record)

        db.session.commit()
        return {"success": True, "message": "审批已通过"}


@ns_approvals.route("/<int:id>/reject")
@ns_approvals.param("id", "审批ID")
class ApprovalReject(Resource):
    @ns_approvals.doc("reject_approval")
    def post(self, id):
        approval = Approval.query.get_or_404(id)
        data = request.get_json() or {}

        if approval.status != "pending":
            return {"success": False, "message": "该审批已被处理"}, 400

        approval.status = "rejected"
        approval.approver_id = data.get("approver_id")
        approval.comment = data.get("comment")
        approval.approve_time = datetime.now()

        db.session.commit()
        return {"success": True, "message": "审批已拒绝"}


@ns_approvals.route("/pending")
class PendingApprovals(Resource):
    @ns_approvals.doc("get_pending_approvals")
    @requires_admin
    def get(self):
        approvals = Approval.query.filter_by(status="pending").order_by(Approval.created_at.desc()).all()
        return [
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
        ]
