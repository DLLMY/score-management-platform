from flask_restx import Namespace, Resource
from flask import request
from utils.permission import requires_permission
from utils.response import APIResponse
from services.anomaly_service import AnomalyService

"""
异常检测API路由模块
提供用户异常检测、突变检测、趋势异常等功能
"""
ns_anomaly = Namespace("anomaly", description="异常检测相关操作")


@ns_anomaly.route("/<int:user_id>")
@ns_anomaly.param("user_id", "用户ID")
class UserAnomaly(Resource):
    @ns_anomaly.doc("get_user_anomaly", description="获取用户异常检测")
    @ns_anomaly.param("days", "历史天数，默认30")
    @ns_anomaly.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_all_anomalies(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_anomaly.route("/batch")
class BatchAnomaly(Resource):
    @ns_anomaly.doc("get_batch_anomaly", description="批量获取异常检测")
    @ns_anomaly.param("class_name", "班级名称(可选)")
    @ns_anomaly.param("days", "历史天数，默认30")
    @ns_anomaly.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.get_all_anomalies(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_anomaly.route("/sudden/<int:user_id>")
@ns_anomaly.param("user_id", "用户ID")
class SuddenChange(Resource):
    @ns_anomaly.doc("get_sudden_change", description="检测突变异常")
    @ns_anomaly.param("days", "历史天数，默认30")
    @ns_anomaly.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_sudden_change(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_anomaly.route("/trend/<int:user_id>")
@ns_anomaly.param("user_id", "用户ID")
class TrendAnomaly(Resource):
    @ns_anomaly.doc("get_trend_anomaly", description="检测趋势异常")
    @ns_anomaly.param("days", "历史天数，默认30")
    @ns_anomaly.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_trend_anomaly(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_anomaly.route("/group/<int:user_id>")
@ns_anomaly.param("user_id", "用户ID")
class GroupAnomaly(Resource):
    @ns_anomaly.doc("get_group_anomaly", description="检测群体异常")
    @ns_anomaly.param("days", "历史天数，默认30")
    @ns_anomaly.response(200, "成功")
    def get(self, user_id):
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_group_anomaly(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))
