from flask_restx import Namespace, Resource
from flask import request
from utils.permission import requires_permission
from utils.response import APIResponse
from services.risk_predict_service import RiskPredictService
from services.warning_service import WarningService

"""
风险评估API路由模块
提供风险预测、风险预警等功能
"""
ns_risk = Namespace("risk", description="风险评估相关操作")


@ns_risk.route("/predict/<int:user_id>")
@ns_risk.param("user_id", "用户ID")
class RiskPredict(Resource):
    @ns_risk.doc("get_risk_predict", description="预测学生风险")
    @ns_risk.param("days", "统计天数，默认30")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.predict_risk(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/predict/batch")
class BatchRiskPredict(Resource):
    @ns_risk.doc("get_batch_risk_predict", description="批量预测风险")
    @ns_risk.param("class_name", "班级名称(可选)")
    @ns_risk.param("days", "统计天数，默认30")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.predict_batch(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/predict/high-risk")
class HighRiskStudents(Resource):
    @ns_risk.doc("get_high_risk_students", description="获取高风险学生")
    @ns_risk.param("days", "统计天数，默认30")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.get_high_risk_students(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/predict/train")
class RiskPredictTrain(Resource):
    @ns_risk.doc("post_risk_predict_train", description="训练风险预测模型")
    @ns_risk.param("days", "训练数据天数，默认90")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        days = int(request.args.get("days", 90))
        try:
            result = RiskPredictService.train_risk_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/predict/evaluate")
class RiskPredictEvaluate(Resource):
    @ns_risk.doc("get_risk_predict_evaluate", description="评估风险预测模型")
    @ns_risk.param("days", "评估数据天数，默认30")
    @ns_risk.response(200, "成功")
    def get(self):
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.evaluate_risk_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/warning")
class Warning(Resource):
    @ns_risk.doc("get_warning", description="获取风险预警列表")
    @ns_risk.param("class_name", "班级名称(可选)")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        try:
            result = WarningService.get_warnings(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_risk.doc("post_warning_evaluate", description="执行风险评估")
    @ns_risk.param("class_name", "班级名称(可选)")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        class_name = request.args.get("class_name")
        try:
            result = WarningService.evaluate_risk(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="风险评估完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/warning/<int:warning_id>/resolve")
@ns_risk.param("warning_id", "预警ID")
class WarningResolve(Resource):
    @ns_risk.doc("post_warning_resolve", description="解决预警")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self, warning_id):
        try:
            success = WarningService.resolve_warning(warning_id)
            if success:
                return APIResponse.success(message="预警已解决")
            else:
                return APIResponse.error(message="未找到预警记录")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_risk.route("/warning/config")
class WarningConfig(Resource):
    @ns_risk.doc("get_warning_config", description="获取预警配置")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        try:
            config = WarningService.get_config()
            return APIResponse.success(data=config, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_risk.doc("post_warning_config", description="更新预警配置")
    @ns_risk.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            config_key = data.get("config_key")
            config_value = data.get("config_value")
            description = data.get("description", "")
            success = WarningService.update_config(config_key, config_value, description)
            if success:
                return APIResponse.success(message="配置更新成功")
            else:
                return APIResponse.error(message="无效的配置键")
        except Exception as e:
            return APIResponse.error(message=str(e))
