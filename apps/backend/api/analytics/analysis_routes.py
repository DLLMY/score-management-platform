from flask_restx import Namespace, Resource
from flask import request
from services.analysis_service import analysis_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api
from utils.response import APIResponse
from utils.params import get_int_arg

ns_analysis = Namespace("analysis", description="数据分析相关操作")


@ns_analysis.route("/user/<int:user_id>")
@ns_analysis.param("user_id", "用户ID")
class UserAnalysis(Resource):

    @ns_analysis.doc("get_user_analysis")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        return APIResponse.success(data=analysis_service.get_user_analysis(user_id))


@ns_analysis.route("/class/<string:class_identifier>")
@ns_analysis.param("class_identifier", "班级名称或班级ID")
class ClassAnalysis(Resource):

    @ns_analysis.doc("get_class_analysis")
    @requires_permission("algorithm.view")
    def get(self, class_identifier):
        # 兼容按班级 ID（数字串）或班级名称查询，统一前端 class_id 传参
        if class_identifier.isdigit():
            from models import ClassInfo

            class_info = ClassInfo.query.get(int(class_identifier))
            class_name = class_info.name if class_info else class_identifier
        else:
            class_name = class_identifier
        return APIResponse.success(data=analysis_service.get_class_analysis(class_name))


@ns_analysis.route("/unlock-stats")
class UnlockStats(Resource):

    @ns_analysis.doc("get_unlock_stats", description="获取开锁统计数据")
    @ns_analysis.param("start_date", "开始日期(YYYY-MM-DD)")
    @ns_analysis.param("end_date", "结束日期(YYYY-MM-DD)")
    @ns_analysis.param("device_id", "设备ID")
    @ns_analysis.param("class_name", "班级名称")
    @ns_analysis.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    def get(self):
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        device_id = request.args.get("device_id")
        class_name = request.args.get("class_name")
        return APIResponse.success(
            data=analysis_service.get_unlock_stats(start_date, end_date, device_id, class_name)
        )


@ns_analysis.route("/class-ranking")
class ClassRanking(Resource):

    @ns_analysis.doc("get_class_ranking", description="获取班级排名")
    @ns_analysis.param("sort_by", "排序字段(score/unlock_count/avg_score)")
    @ns_analysis.param("order", "排序方向(desc/asc)")
    @ns_analysis.param("limit", "返回数量限制")
    @ns_analysis.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    def get(self):
        sort_by = request.args.get("sort_by", "total_score")
        order = request.args.get("order", "desc")
        limit = min(get_int_arg("limit", default=20), 200)
        return APIResponse.success(data=analysis_service.get_class_ranking(sort_by, order, limit))


@ns_analysis.route("/student-ranking")
class StudentRanking(Resource):

    @ns_analysis.doc("get_student_ranking", description="获取学生排名")
    @ns_analysis.param("class_name", "班级名称(可选)")
    @ns_analysis.param("sort_by", "排序字段(score/unlock_count)")
    @ns_analysis.param("order", "排序方向(desc/asc)")
    @ns_analysis.param("limit", "返回数量限制")
    @ns_analysis.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    def get(self):
        class_name = request.args.get("class_name")
        sort_by = request.args.get("sort_by", "score")
        order = request.args.get("order", "desc")
        limit = min(get_int_arg("limit", default=20), 200)
        return analysis_service.get_student_ranking(class_name, sort_by, order, limit)


@ns_analysis.route("/class-compare")
class ClassCompare(Resource):

    @ns_analysis.doc("get_class_compare", description="班级对比分析")
    @ns_analysis.param("class_names", "班级名称列表，逗号分隔")
    @ns_analysis.param("period", "统计周期(7d/30d/90d)")
    @ns_analysis.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    def get(self):
        class_names_param = request.args.get("class_names", "")
        period = request.args.get("period", "30d")
        class_names = [c.strip() for c in class_names_param.split(",") if c.strip()]

        if not class_names:
            return APIResponse.error(message="请至少选择一个班级", status_code=400)

        return APIResponse.success(data=analysis_service.get_class_compare(class_names, period))


@ns_analysis.route("/dashboard-summary")
class DashboardSummary(Resource):

    @ns_analysis.doc("get_dashboard_summary", description="获取仪表盘汇总数据")
    @ns_analysis.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    def get(self):
        return APIResponse.success(data=analysis_service.get_dashboard_summary())
