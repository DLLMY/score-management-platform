from flask_restx import Namespace, Resource
from flask import request
from utils.permission import requires_permission
from utils.response import APIResponse
from services.prediction_service import PredictionService
from services.score_predict_service import ScorePredictService

"""
学生行为预测API路由模块
提供积分预测、成绩预测等功能
"""
ns_prediction = Namespace("prediction", description="行为预测相关操作")


@ns_prediction.route("/<int:user_id>")
@ns_prediction.param("user_id", "用户ID")
class StudentPrediction(Resource):
    @ns_prediction.doc("get_prediction", description="获取学生积分预测")
    @ns_prediction.param("days", "预测天数，默认7")
    @ns_prediction.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        days = int(request.args.get("days", 7))
        try:
            result = PredictionService.predict_future_scores(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/batch")
class BatchPrediction(Resource):
    @ns_prediction.doc("get_batch_prediction", description="批量获取预测")
    @ns_prediction.param("class_name", "班级名称(可选)")
    @ns_prediction.param("days", "预测天数，默认7")
    @ns_prediction.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 7))
        try:
            result = PredictionService.predict_batch(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/risk")
class RiskStudents(Resource):
    @ns_prediction.doc("get_risk_students", description="获取有下降风险的学生")
    @ns_prediction.param("days", "预测天数，默认7")
    @ns_prediction.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        days = int(request.args.get("days", 7))
        try:
            result = PredictionService.get_risk_students(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/score/<int:user_id>")
@ns_prediction.param("user_id", "用户ID")
class ScorePredict(Resource):
    @ns_prediction.doc("get_score_predict", description="预测学生考试成绩")
    @ns_prediction.param("days", "统计天数，默认30")
    @ns_prediction.response(200, "成功")
    def get(self, user_id):
        days = int(request.args.get("days", 30))
        try:
            result = ScorePredictService.predict_exam_score(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/score/batch")
class BatchScorePredict(Resource):
    @ns_prediction.doc("get_batch_score_predict", description="批量预测考试成绩")
    @ns_prediction.param("class_name", "班级名称(可选)")
    @ns_prediction.param("days", "统计天数，默认30")
    @ns_prediction.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = ScorePredictService.predict_batch(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/score/distribution")
class ScoreDistribution(Resource):
    @ns_prediction.doc("get_score_distribution", description="获取成绩分布预测")
    @ns_prediction.param("class_name", "班级名称(可选)")
    @ns_prediction.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        try:
            result = ScorePredictService.get_score_distribution(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/score/train")
class ScorePredictTrain(Resource):
    @ns_prediction.doc("post_score_predict_train", description="训练成绩预测模型")
    @ns_prediction.param("days", "训练数据天数，默认90")
    @ns_prediction.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        days = int(request.args.get("days", 90))
        try:
            result = ScorePredictService.train_score_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_prediction.route("/score/evaluate")
class ScorePredictEvaluate(Resource):
    @ns_prediction.doc("get_score_predict_evaluate", description="评估成绩预测模型")
    @ns_prediction.param("days", "评估数据天数，默认30")
    @ns_prediction.response(200, "成功")
    def get(self):
        days = int(request.args.get("days", 30))
        try:
            result = ScorePredictService.evaluate_score_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))
