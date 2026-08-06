from flask_restx import Namespace, Resource, fields
from flask import request
from services.study_guide_service import study_guide_service
from utils.permission import requires_permission

ns_study_guide = Namespace("study_guide", description="学法指导管理")

guide_model = ns_study_guide.model("StudyGuideInput", {
    "class_id": fields.Integer(required=True),
    "title": fields.String(required=True),
    "guide_type": fields.String(),
    "content": fields.String(),
    "target_audience": fields.String(),
})

plan_model = ns_study_guide.model("ImprovementPlanInput", {
    "student_id": fields.Integer(required=True),
    "plan_type": fields.String(default="tutorial"),
    "subject_id": fields.Integer(),
    "target_score": fields.Float(),
    "current_score": fields.Float(),
    "plan_content": fields.String(),
    "start_date": fields.String(),
    "end_date": fields.String(),
})

progress_model = ns_study_guide.model("ProgressInput", {
    "progress": fields.Integer(required=True),
})


@ns_study_guide.route("/guides")
class StudyGuideList(Resource):
    @ns_study_guide.doc("list_guides", params={
        "class_id": {"description": "班级ID", "type": int},
        "guide_type": {"description": "指导类型"},
        "is_published": {"description": "是否已发布"},
    })
    @requires_permission("study_guide.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        guide_type = request.args.get("guide_type")
        is_published = request.args.get("is_published")
        return study_guide_service.list_guides(
            class_id=class_id,
            guide_type=guide_type,
            is_published=is_published,
        )

    @ns_study_guide.expect(guide_model)
    @requires_permission("study_guide.edit")
    def post(self):
        data = request.get_json()
        return study_guide_service.create_guide(data)


@ns_study_guide.route("/guides/<int:guide_id>")
class StudyGuideDetail(Resource):
    @ns_study_guide.expect(guide_model)
    @requires_permission("study_guide.edit")
    def put(self, guide_id):
        data = request.get_json()
        return study_guide_service.update_guide(guide_id, data)

    @requires_permission("study_guide.edit")
    def delete(self, guide_id):
        return study_guide_service.delete_guide(guide_id)


@ns_study_guide.route("/plans")
class ImprovementPlanList(Resource):
    @ns_study_guide.doc("list_plans", params={
        "student_id": {"description": "学生ID", "type": int},
        "plan_type": {"description": "计划类型"},
        "is_completed": {"description": "是否完成"},
    })
    @requires_permission("study_guide.view")
    def get(self):
        student_id = request.args.get("student_id", type=int)
        plan_type = request.args.get("plan_type")
        is_completed = request.args.get("is_completed")
        return study_guide_service.list_plans(
            student_id=student_id,
            plan_type=plan_type,
            is_completed=is_completed,
        )

    @ns_study_guide.expect(plan_model)
    @requires_permission("study_guide.edit")
    def post(self):
        data = request.get_json()
        return study_guide_service.create_plan(data)


@ns_study_guide.route("/plans/<int:plan_id>/progress")
class UpdatePlanProgress(Resource):
    @ns_study_guide.expect(progress_model)
    @requires_permission("study_guide.edit")
    def put(self, plan_id):
        data = request.get_json()
        return study_guide_service.update_plan_progress(plan_id, data["progress"])
