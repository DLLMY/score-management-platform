from flask_restx import Namespace, Resource, fields
from flask import request
from services.homework_service import homework_service
from utils.permission import requires_permission

ns_homework = Namespace("homework", description="作业检查管理")

homework_model = ns_homework.model("HomeworkInput", {
    "class_id": fields.Integer(required=True),
    "subject_id": fields.Integer(),
    "title": fields.String(required=True),
    "description": fields.String(),
    "assigned_date": fields.String(),
    "due_date": fields.String(required=True),
})

submission_model = ns_homework.model("SubmissionInput", {
    "student_id": fields.Integer(required=True),
})

check_model = ns_homework.model("CheckInput", {
    "notes": fields.String(),
})


@ns_homework.route("/assignments")
class HomeworkList(Resource):
    @ns_homework.doc("list_homework", params={
        "class_id": {"description": "班级ID", "type": int},
        "subject_id": {"description": "科目ID", "type": int},
        "is_completed": {"description": "是否完成"},
    })
    @requires_permission("homework.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        subject_id = request.args.get("subject_id", type=int)
        is_completed = request.args.get("is_completed")
        return homework_service.list_assignments(
            class_id=class_id,
            subject_id=subject_id,
            is_completed=is_completed,
        )

    @ns_homework.expect(homework_model)
    @requires_permission("homework.edit")
    def post(self):
        data = request.get_json()
        return homework_service.create_assignment(data)


@ns_homework.route("/assignments/<int:assignment_id>")
class HomeworkDetail(Resource):
    @requires_permission("homework.view")
    def get(self, assignment_id):
        return homework_service.get_assignment(assignment_id)

    @ns_homework.expect(homework_model)
    @requires_permission("homework.edit")
    def put(self, assignment_id):
        data = request.get_json()
        return homework_service.update_assignment(assignment_id, data)

    @requires_permission("homework.edit")
    def delete(self, assignment_id):
        return homework_service.delete_assignment(assignment_id)


@ns_homework.route("/assignments/<int:assignment_id>/submit")
class HomeworkSubmit(Resource):
    @ns_homework.expect(submission_model)
    @requires_permission("homework.check")
    def post(self, assignment_id):
        data = request.get_json()
        return homework_service.mark_submitted(assignment_id, data["student_id"])


@ns_homework.route("/assignments/<int:assignment_id>/check")
class HomeworkCheck(Resource):
    @ns_homework.expect(check_model)
    @requires_permission("homework.check")
    def post(self, assignment_id):
        data = request.get_json()
        return homework_service.mark_checked(
            assignment_id,
            data["student_id"],
            data.get("notes", ""),
        )
