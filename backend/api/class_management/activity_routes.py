from flask_restx import Namespace, Resource, fields
from flask import request
from services.activity_service import activity_service
from utils.permission import requires_permission

ns_activity = Namespace("activity", description="文体活动管理")

activity_model = ns_activity.model("ActivityInput", {
    "class_id": fields.Integer(required=True),
    "title": fields.String(required=True),
    "description": fields.String(),
    "activity_type": fields.String(),
    "start_date": fields.String(),
    "end_date": fields.String(),
    "location": fields.String(),
    "organizer": fields.String(),
})

register_model = ns_activity.model("RegisterInput", {
    "student_id": fields.Integer(required=True),
})


@ns_activity.route("")
class ActivityList(Resource):
    @ns_activity.doc("list_activities", params={
        "class_id": {"description": "班级ID", "type": int},
        "is_published": {"description": "是否已发布"},
    })
    @requires_permission("activity.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        is_published = request.args.get("is_published")
        return activity_service.list_activities(
            class_id=class_id,
            is_published=is_published,
        )

    @ns_activity.expect(activity_model)
    @requires_permission("activity.edit")
    def post(self):
        data = request.get_json()
        return activity_service.create_activity(data)


@ns_activity.route("/<int:activity_id>")
class ActivityDetail(Resource):
    @requires_permission("activity.view")
    def get(self, activity_id):
        activities = activity_service.list_activities()
        activity = next((a for a in activities.get("data", []) if a["id"] == activity_id), None)
        if not activity:
            return {"success": False, "message": "活动不存在"}, 404
        return {"success": True, "data": activity}

    @requires_permission("activity.edit")
    def put(self, activity_id):
        data = request.get_json()
        return activity_service.update_activity(activity_id, data)

    @requires_permission("activity.edit")
    def delete(self, activity_id):
        return activity_service.delete_activity(activity_id)


@ns_activity.route("/<int:activity_id>/register")
class ActivityRegister(Resource):
    @ns_activity.expect(register_model)
    @requires_permission("activity.edit")
    def post(self, activity_id):
        data = request.get_json()
        return activity_service.register_student(activity_id, data["student_id"])

    @ns_activity.expect(register_model)
    @requires_permission("activity.edit")
    def delete(self, activity_id):
        data = request.get_json()
        return activity_service.cancel_registration(activity_id, data["student_id"])
