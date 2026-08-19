from flask_restx import Namespace, Resource
from flask import request
from services.parent_service import parent_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache

ns_parent = Namespace("parent", description="家长联系管理")


@ns_parent.route("/contacts")
class ParentContactList(Resource):
    @requires_permission("class.view")
    @cached_api(ttl=30)
    def get(self):
        keyword = request.args.get("keyword", "")
        return parent_service.list_contacts(keyword=keyword)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        result = parent_service.create_contact(data)
        invalidate_cache("api:/api/parent/*")
        return result


@ns_parent.route("/contacts/<int:contact_id>")
class ParentContactDetail(Resource):
    @requires_permission("class.view")
    def get(self, contact_id):
        return parent_service.get_contact(contact_id)

    @requires_permission("class.edit")
    def put(self, contact_id):
        data = request.get_json()
        result = parent_service.update_contact(contact_id, data)
        invalidate_cache("api:/api/parent/*")
        return result

    @requires_permission("class.edit")
    def delete(self, contact_id):
        result = parent_service.delete_contact(contact_id)
        invalidate_cache("api:/api/parent/*")
        return result


@ns_parent.route("/logs")
class ContactLogList(Resource):
    @requires_permission("class.view")
    @cached_api(ttl=30)
    def get(self):
        parent_id = request.args.get("parent_id", type=int)
        is_resolved = request.args.get("is_resolved")
        return parent_service.list_contact_logs(parent_id=parent_id, is_resolved=is_resolved)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        result = parent_service.create_contact_log(data)
        invalidate_cache("api:/api/parent/*")
        return result


@ns_parent.route("/logs/<int:log_id>/resolve")
class ResolveLog(Resource):
    @requires_permission("class.edit")
    def post(self, log_id):
        result = parent_service.resolve_log(log_id)
        invalidate_cache("api:/api/parent/*")
        return result
