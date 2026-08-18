from flask_restx import Namespace, Resource
from services.dashboard_service import dashboard_service
from utils.response import APIResponse
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api

ns_dashboard = Namespace("dashboard", description="仪表板数据相关操作")


@ns_dashboard.route("/data")
class DashboardData(Resource):

    @ns_dashboard.doc("get_dashboard_data", security="Bearer")
    @requires_permission("view_dashboard")
    @cached_api(ttl=120)
    def get(self):
        result = dashboard_service.get_dashboard_data()
        return APIResponse.success(data=result)


@ns_dashboard.route("/stats")
class DashboardStats(Resource):

    @ns_dashboard.doc("get_dashboard_stats", security="Bearer")
    @requires_permission("view_dashboard")
    @cached_api(ttl=60)
    def get(self):
        try:
            data = dashboard_service.get_dashboard_data()
            stats = {
                "total_students": data.get("total_students", 0) if isinstance(data, dict) else 0,
                "total_subjects": data.get("total_subjects", 0) if isinstance(data, dict) else 0,
                "total_score_records": data.get("total_records", 0) if isinstance(data, dict) else 0,
                "today_records": data.get("today_records", 0) if isinstance(data, dict) else 0,
                "positive_ratio": data.get("positive_ratio", 0) if isinstance(data, dict) else 0,
            }
            return APIResponse.success(data=stats)
        except Exception as e:  # noqa: BLE001
            # 诚实失败：不伪装成"全 0"的假统计（用户会误信为真实数据）
            return APIResponse.error(message="仪表盘统计数据加载失败: %s" % e)
