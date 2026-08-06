from flask_restx import Namespace, Resource
from flask import request
from services.parent_service import parent_service
from utils.permission import requires_permission

ns_parent = Namespace("parent", description="家长联系管理")


@ns_parent.route("/contacts")
class ParentContactList(Resource):
    @requires_permission("class.view")
    def get(self):
        keyword = request.args.get("keyword", "")
        return parent_service.list_contacts(keyword=keyword)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        return parent_service.create_contact(data)


@ns_parent.route("/contacts/<int:contact_id>")
class ParentContactDetail(Resource):
    @requires_permission("class.view")
    def get(self, contact_id):
        return parent_service.get_contact(contact_id)

    @requires_permission("class.edit")
    def put(self, contact_id):
        data = request.get_json()
        return parent_service.update_contact(contact_id, data)

    @requires_permission("class.edit")
    def delete(self, contact_id):
        return parent_service.delete_contact(contact_id)


@ns_parent.route("/logs")
class ContactLogList(Resource):
    @requires_permission("class.view")
    def get(self):
        parent_id = request.args.get("parent_id", type=int)
        is_resolved = request.args.get("is_resolved")
        return parent_service.list_contact_logs(parent_id=parent_id, is_resolved=is_resolved)

    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        return parent_service.create_contact_log(data)


@ns_parent.route("/logs/<int:log_id>/resolve")
class ResolveLog(Resource):
    @requires_permission("class.edit")
    def post(self, log_id):
        return parent_service.resolve_log(log_id)
