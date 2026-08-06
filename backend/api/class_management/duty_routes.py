from flask_restx import Namespace, Resource, fields
from flask import request
from services.duty_service import duty_service
from utils.permission import requires_permission

ns_duty = Namespace("duty", description="值日生表管理")


@ns_duty.route("/groups")
class DutyGroupList(Resource):
    @ns_duty.doc(
        "list_duty_groups",
        params={
            "class_id": {"description": "班级ID", "type": int},
            "keyword": {"description": "搜索关键词"},
        },
    )
    @requires_permission("class.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        keyword = request.args.get("keyword", "")
        return duty_service.list_groups(class_id=class_id, keyword=keyword)

    @ns_duty.expect(
        ns_duty.model(
            "DutyGroupInput",
            {
                "class_id": fields.Integer(required=True),
                "name": fields.String(required=True),
                "day_of_week": fields.String(),
                "area": fields.String(),
            },
        )
    )
    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        return duty_service.create_group(data)


@ns_duty.route("/groups/<int:group_id>")
class DutyGroupDetail(Resource):
    @requires_permission("class.edit")
    def put(self, group_id):
        data = request.get_json()
        return duty_service.update_group(group_id, data)

    @requires_permission("class.edit")
    def delete(self, group_id):
        return duty_service.delete_group(group_id)


@ns_duty.route("/assignments")
class DutyAssignmentList(Resource):
    @requires_permission("class.view")
    def get(self):
        group_id = request.args.get("group_id", type=int)
        student_id = request.args.get("student_id", type=int)
        date = request.args.get("date")
        return duty_service.list_assignments(group_id=group_id, student_id=student_id, date=date)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        return duty_service.create_assignment(data)


@ns_duty.route("/assignments/<int:assignment_id>/complete")
class CompleteDuty(Resource):
    @requires_permission("class.edit")
    def post(self, assignment_id):
        return duty_service.mark_complete(assignment_id)


@ns_duty.route("/rotate")
class RotateDuty(Resource):
    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        return duty_service.rotate_assignments(data.get("class_id"), data.get("period", "weekly"))
