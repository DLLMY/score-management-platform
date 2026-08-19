from flask_restx import Namespace, Resource
from flask import request
from services.committee_service import committee_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache

ns_committee = Namespace("committee", description="班委名单管理")


@ns_committee.route("/members")
class CommitteeMemberList(Resource):
    @ns_committee.doc(
        "list_members",
        params={
            "class_id": {"description": "班级ID", "type": int},
            "position": {"description": "职务"},
        },
    )
    @requires_permission("class.view")
    @cached_api(ttl=30)
    def get(self):
        class_id = request.args.get("class_id", type=int)
        position = request.args.get("position")
        return committee_service.list_members(class_id=class_id, position=position)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        result = committee_service.create_member(data)
        invalidate_cache("api:/api/committee/*")
        return result


@ns_committee.route("/members/<int:member_id>")
class CommitteeMemberDetail(Resource):
    @requires_permission("class.edit")
    def put(self, member_id):
        data = request.get_json()
        result = committee_service.update_member(member_id, data)
        invalidate_cache("api:/api/committee/*")
        return result

    @requires_permission("class.edit")
    def delete(self, member_id):
        result = committee_service.delete_member(member_id)
        invalidate_cache("api:/api/committee/*")
        return result


@ns_committee.route("/terms")
class CommitteeTermList(Resource):
    @requires_permission("class.view")
    @cached_api(ttl=30)
    def get(self):
        class_id = request.args.get("class_id", type=int)
        return committee_service.list_terms(class_id=class_id)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        result = committee_service.create_term(data)
        invalidate_cache("api:/api/committee/*")
        return result
