from flask_restx import Namespace, Resource, fields
from flask import request
from services.study_group_service import study_group_service
from utils.permission import requires_permission

ns_study_group = Namespace("study_group", description="学习小组管理")

group_model = ns_study_group.model(
    "StudyGroupInput",
    {
        "class_id": fields.Integer(required=True),
        "name": fields.String(required=True),
        "leader_id": fields.Integer(),
        "description": fields.String(),
        "member_ids": fields.List(fields.Integer()),
    },
)

member_model = ns_study_group.model(
    "MemberInput",
    {
        "student_id": fields.Integer(required=True),
    },
)

score_model = ns_study_group.model(
    "ScoreInput",
    {
        "score_change": fields.Float(required=True),
        "reason": fields.String(),
    },
)


@ns_study_group.route("/groups")
class StudyGroupList(Resource):
    @ns_study_group.doc(
        "list_groups",
        params={
            "class_id": {"description": "班级ID", "type": int},
            "is_active": {"description": "是否活跃"},
        },
    )
    @requires_permission("study_group.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        is_active = request.args.get("is_active")
        return study_group_service.list_groups(
            class_id=class_id,
            is_active=is_active,
        )

    @ns_study_group.expect(group_model)
    @requires_permission("study_group.edit")
    def post(self):
        data = request.get_json()
        return study_group_service.create_group(data)


@ns_study_group.route("/groups/<int:group_id>")
class StudyGroupDetail(Resource):
    @requires_permission("study_group.view")
    def get(self, group_id):
        groups = study_group_service.list_groups()
        group = next((g for g in groups.get("data", []) if g["id"] == group_id), None)
        if not group:
            return {"success": False, "message": "学习小组不存在"}, 404
        return {"success": True, "data": group}

    @requires_permission("study_group.edit")
    def put(self, group_id):
        data = request.get_json()
        return study_group_service.update_group(group_id, data)

    @requires_permission("study_group.edit")
    def delete(self, group_id):
        return study_group_service.delete_group(group_id)


@ns_study_group.route("/groups/<int:group_id>/members")
class GroupMembers(Resource):
    @ns_study_group.expect(member_model)
    @requires_permission("study_group.edit")
    def post(self, group_id):
        data = request.get_json()
        return study_group_service.add_member(group_id, data["student_id"])

    @ns_study_group.expect(member_model)
    @requires_permission("study_group.edit")
    def delete(self, group_id):
        data = request.get_json()
        return study_group_service.remove_member(group_id, data["student_id"])


@ns_study_group.route("/groups/<int:group_id>/score")
class GroupScore(Resource):
    @ns_study_group.expect(score_model)
    @requires_permission("study_group.edit")
    def post(self, group_id):
        data = request.get_json()
        return study_group_service.add_score(
            group_id,
            data["score_change"],
            data.get("reason", ""),
        )
