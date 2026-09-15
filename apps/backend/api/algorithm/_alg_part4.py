import logging

from io import BytesIO

from flask_restx import Namespace, Resource
from flask import request, send_file
from utils.permission import requires_permission
from utils.response import APIResponse
from utils.params import get_int_arg
from utils.api_cache_middleware import cached_api
from utils.decorators import safe_handle
from utils.excel_utils import ExcelUtils
from services.algorithm_service import AlgorithmService
from services.cluster_service import ClusterService
from services.composite_score_service import CompositeScoreService
from services.warning_service import WarningService
from services.prediction_service import PredictionService
from services.anomaly_service import AnomalyService
from services.rule_recommendation_service import RuleRecommendationService
from services.score_predict_service import ScorePredictService
from services.risk_predict_service import RiskPredictService
from services.attribution_service import AttributionService
from services.engagement_service import EngagementService
from services.rule_engine_service import RuleExecutionEngine
from services.score_distribution_service import ScoreDistributionController, ScoreValidator
from services.score_ecosystem_service import ScoreEcosystem
from services.reward_service import PhoneAccessHandler, RewardSystem, RewardInteractionController
from services.algorithm_export_service import build_algorithm_export_rows

logger = logging.getLogger(__name__)
logger = logging.getLogger(__name__)
ns_algorithm = Namespace("algorithm", description="算法分析相关操作")
from .algorithm_routes import ns_algorithm

@ns_algorithm.route("/score-predict/evaluate")
class ScorePredictEvaluate(Resource):
    @ns_algorithm.doc("get_score_predict_evaluate", description="评估成绩预测模型")
    @ns_algorithm.param("days", "评估数据天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        评估成绩预测模型
        """
        days = get_int_arg("days", default=30)
        result = ScorePredictService.evaluate_score_model(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/risk-predict/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class RiskPredict(Resource):
    @ns_algorithm.doc("get_risk_predict", description="预测学生风险")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        预测学生风险
        """
        days = get_int_arg("days", default=30)
        result = RiskPredictService.predict_risk(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/risk-predict/batch")
class BatchRiskPredict(Resource):
    @ns_algorithm.doc("get_batch_risk_predict", description="批量预测风险")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        批量预测风险
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = RiskPredictService.predict_batch(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/risk-predict/high-risk")
class HighRiskStudents(Resource):
    @ns_algorithm.doc("get_high_risk_students", description="获取高风险学生")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取高风险学生
        """
        days = get_int_arg("days", default=30)
        result = RiskPredictService.get_high_risk_students(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/risk-predict/train")
class RiskPredictTrain(Resource):
    @ns_algorithm.doc("post_risk_predict_train", description="训练风险预测模型")
    @ns_algorithm.param("days", "训练数据天数，默认90")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        训练风险预测模型
        """
        days = get_int_arg("days", default=90)
        result = RiskPredictService.train_risk_model(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/risk-predict/evaluate")
class RiskPredictEvaluate(Resource):
    @ns_algorithm.doc("get_risk_predict_evaluate", description="评估风险预测模型")
    @ns_algorithm.param("days", "评估数据天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        评估风险预测模型
        """
        days = get_int_arg("days", default=30)
        result = RiskPredictService.evaluate_risk_model(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-engine/execute")
class RuleEngineExecute(Resource):
    @ns_algorithm.doc("post_rule_engine_execute", description="执行规则引擎")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        执行规则引擎
        """
        data = request.get_json()
        model_output = data.get("model_output", {})
        user_context = data.get("user_context", {})
        engine = RuleExecutionEngine()
        result = engine.execute_rules(model_output, user_context)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-engine/apply-by-behavior")
class RuleEngineApplyByBehavior(Resource):
    @ns_algorithm.doc("post_rule_engine_apply_by_behavior", description="根据行为类型应用规则")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        根据行为类型应用规则
        """
        data = request.get_json()
        user_id = data.get("user_id")
        behavior_type = data.get("behavior_type")
        context = data.get("context", {})
        engine = RuleExecutionEngine()
        result = engine.apply_rule_by_behavior(user_id, behavior_type, context)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-distribution/statistics")
class ScoreDistributionStats(Resource):
    @ns_algorithm.doc("get_score_distribution_statistics", description="获取评分分布统计")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取评分分布统计
        """
        class_name = request.args.get("class_name")
        controller = ScoreDistributionController()
        result = controller.get_distribution_statistics(class_name)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-distribution/adjust")
class ScoreDistributionAdjust(Resource):
    @ns_algorithm.doc("post_score_distribution_adjust", description="调整评分分布")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        调整评分分布
        """
        class_name = request.args.get("class_name")
        controller = ScoreDistributionController()
        result = controller.adjust_class_scores(class_name)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-distribution/validate")
class ScoreDistributionValidate(Resource):
    @ns_algorithm.doc("post_score_distribution_validate", description="验证评分分布")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        验证评分分布
        """
        data = request.get_json()
        scores = data.get("scores", [])
        controller = ScoreDistributionController()
        result = controller.validate_distribution(scores)
        return APIResponse.success(data=result, message="success")
