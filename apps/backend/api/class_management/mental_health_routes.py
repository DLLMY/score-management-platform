from flask_restx import Namespace, Resource, fields
from flask import request
from services.mental_health_service import mental_health_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache
from utils.pagination import get_pagination

# path 显式下沉到 Namespace：与 api_versioning 的 add_namespace(path="/mental-health") 一致，
# 保证 tests/conftest.py 动态注册（add_namespace 不带 path）时 URL 仍为连字符 /mental-health。
ns_mental_health = Namespace("mental_health", description="心理健康管理", path="/mental-health")

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
            "class_id": {"description": "班级ID（班主任隔离自动叠加）", "type": int},
        },
    )
    @requires_permission("mental_health.view")
    @cached_api(ttl=30)
    def get(self):
        student_id = request.args.get("student_id", type=int)
        class_id = request.args.get("class_id", type=int)
        page, per_page = get_pagination(default=50)
        return mental_health_service.list_records(
            student_id=student_id, class_id=class_id, page=page, per_page=per_page
        )

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
            "class_id": {"description": "班级ID（班主任隔离自动叠加）", "type": int},
        },
    )
    @requires_permission("mental_health.view")
    @cached_api(ttl=30)
    def get(self):
        student_id = request.args.get("student_id", type=int)
        is_resolved = request.args.get("is_resolved")
        class_id = request.args.get("class_id", type=int)
        page, per_page = get_pagination(default=50)
        return mental_health_service.list_alerts(
            student_id=student_id,
            is_resolved=is_resolved,
            class_id=class_id,
            page=page,
            per_page=per_page,
        )


@ns_mental_health.route("/alerts/<int:alert_id>/resolve")
class ResolveAlert(Resource):
    @requires_permission("mental_health.edit")
    def post(self, alert_id):
        result = mental_health_service.resolve_alert(alert_id)
        invalidate_cache("api:/api/mental_health/*")
        return result
