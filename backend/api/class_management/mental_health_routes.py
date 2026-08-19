from flask_restx import Namespace, Resource, fields
from flask import request
from services.mental_health_service import mental_health_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache

ns_mental_health = Namespace("mental_health", description="心理健康管理")

record_model = ns_mental_health.model(
    "MentalHealthInput",
    {
        "student_id": fields.Integer(required=True),
        "mood_level": fields.Integer(),
        "stress_level": fields.Integer(),
        "sleep_hours": fields.Float(),
        "notes": fields.String(),
    },
)


@ns_mental_health.route("/records")
class MentalHealthList(Resource):
    @ns_mental_health.doc(
        "list_records",
        params={
            "student_id": {"description": "学生ID", "type": int},
        },
    )
    @requires_permission("mental_health.view")
    @cached_api(ttl=30)
    def get(self):
        student_id = request.args.get("student_id", type=int)
        return mental_health_service.list_records(student_id=student_id)

    @ns_mental_health.expect(record_model)
    @requires_permission("mental_health.edit")
    def post(self):
        data = request.get_json()
        result = mental_health_service.create_record(data)
        invalidate_cache("api:/api/mental_health/*")
        return result


@ns_mental_health.route("/alerts")
class MentalHealthAlerts(Resource):
    @ns_mental_health.doc(
        "list_alerts",
        params={
            "student_id": {"description": "学生ID", "type": int},
            "is_resolved": {"description": "是否已解决"},
        },
    )
    @requires_permission("mental_health.view")
    @cached_api(ttl=30)
    def get(self):
        student_id = request.args.get("student_id", type=int)
        is_resolved = request.args.get("is_resolved")
        return mental_health_service.list_alerts(
            student_id=student_id,
            is_resolved=is_resolved,
        )


@ns_mental_health.route("/alerts/<int:alert_id>/resolve")
class ResolveAlert(Resource):
    @requires_permission("mental_health.edit")
    def post(self, alert_id):
        result = mental_health_service.resolve_alert(alert_id)
        invalidate_cache("api:/api/mental_health/*")
        return result
