from flask_restx import Namespace, Resource, fields
from flask import request
from services.culture_service import culture_service
from utils.permission import requires_permission

ns_culture = Namespace("culture", description="班级文化管理")

culture_model = ns_culture.model("CultureInput", {
    "class_id": fields.Integer(required=True),
    "category": fields.String(),
    "title": fields.String(),
    "content": fields.String(),
    "image_url": fields.String(),
    "display_order": fields.Integer(default=0),
})


@ns_culture.route("/records")
class CultureList(Resource):
    @ns_culture.doc("list_culture", params={
        "class_id": {"description": "班级ID", "type": int},
        "category": {"description": "分类"},
        "is_active": {"description": "是否活跃"},
    })
    @requires_permission("culture.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        category = request.args.get("category")
        is_active = request.args.get("is_active")
        return culture_service.list_records(
            class_id=class_id,
            category=category,
            is_active=is_active,
        )

    @ns_culture.expect(culture_model)
    @requires_permission("culture.edit")
    def post(self):
        data = request.get_json()
        return culture_service.create_record(data)


@ns_culture.route("/records/<int:record_id>")
class CultureDetail(Resource):
    @requires_permission("culture.view")
    def get(self, record_id):
        records = culture_service.list_records()
        record = next((r for r in records.get("data", []) if r["id"] == record_id), None)
        if not record:
            return {"success": False, "message": "文化记录不存在"}, 404
        return {"success": True, "data": record}

    @requires_permission("culture.edit")
    def put(self, record_id):
        data = request.get_json()
        return culture_service.update_record(record_id, data)

    @requires_permission("culture.edit")
    def delete(self, record_id):
        return culture_service.delete_record(record_id)
