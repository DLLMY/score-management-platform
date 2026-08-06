from flask_restx import Namespace, Resource, fields
from flask import request
from services.seating_service import seating_service
from utils.permission import requires_permission

ns_seating = Namespace("seating", description="座次表管理")

seating_chart_model = ns_seating.model(
    "SeatingChartInput",
    {
        "class_id": fields.Integer(required=True),
        "name": fields.String(required=True),
        "rows": fields.Integer(default=8),
        "columns": fields.Integer(default=8),
        "strategy": fields.String(default="manual"),
    },
)


@ns_seating.route("/charts")
class SeatingChartList(Resource):
    @ns_seating.doc(
        "list_seating_charts",
        params={
            "class_id": {"description": "班级ID", "type": int},
            "keyword": {"description": "搜索关键词"},
        },
    )
    @requires_permission("class.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        keyword = request.args.get("keyword", "")
        return seating_service.list_charts(class_id=class_id, keyword=keyword)

    @ns_seating.expect(seating_chart_model)
    @requires_permission("class.edit")
    def post(self):
        data = request.get_json()
        return seating_service.create_chart(data)


@ns_seating.route("/charts/<int:chart_id>")
class SeatingChartDetail(Resource):
    @requires_permission("class.view")
    def get(self, chart_id):
        return seating_service.get_chart(chart_id)

    @requires_permission("class.edit")
    def put(self, chart_id):
        data = request.get_json()
        return seating_service.update_chart(chart_id, data)

    @requires_permission("class.edit")
    def delete(self, chart_id):
        return seating_service.delete_chart(chart_id)


@ns_seating.route("/charts/<int:chart_id>/auto-arrange")
class AutoArrangeSeating(Resource):
    @requires_permission("class.edit")
    def post(self, chart_id):
        data = request.get_json()
        return seating_service.auto_arrange(chart_id, data.get("strategy", "manual"), data.get("class_id", 1))


@ns_seating.route("/charts/<int:chart_id>/seats")
class UpdateSeat(Resource):
    @requires_permission("class.edit")
    def put(self, chart_id):
        data = request.get_json()
        return seating_service.update_seat(chart_id, data.get("row"), data.get("col"), data.get("student_id"))
