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

@ns_algorithm.route("/rule-recommend/optimization")
class RuleOptimization(Resource):
    @ns_algorithm.doc("get_rule_optimization", description="获取规则优化建议")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取规则优化建议
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = RuleRecommendationService.suggest_rule_optimizations(
            class_name, days
        )
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-recommend/combination")
class RuleCombination(Resource):
    @ns_algorithm.doc("get_rule_combination", description="获取规则组合建议")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取规则组合建议
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = RuleRecommendationService.suggest_rule_combinations(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-recommend/statistics")
class RuleStatistics(Resource):
    @ns_algorithm.doc("get_rule_statistics", description="获取规则统计信息")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取规则统计信息
        """
        days = get_int_arg("days", default=30)
        result = RuleRecommendationService.get_rule_statistics(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-recommend/train")
class RuleRecommendTrain(Resource):
    @ns_algorithm.doc("post_rule_recommend_train", description="训练规则推荐模型")
    @ns_algorithm.param("days", "训练数据天数，默认90")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        训练规则推荐模型
        """
        days = get_int_arg("days", default=90)
        result = RuleRecommendationService.train_recommendation_model(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-recommend/evaluate")
class RuleRecommendEvaluate(Resource):
    @ns_algorithm.doc("get_rule_recommend_evaluate", description="评估规则推荐模型")
    @ns_algorithm.param("days", "评估数据天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        评估规则推荐模型
        """
        days = get_int_arg("days", default=30)
        result = RuleRecommendationService.evaluate_model(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-predict/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ScorePredict(Resource):
    @ns_algorithm.doc("get_score_predict", description="预测学生考试成绩")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        预测学生考试成绩
        """
        days = get_int_arg("days", default=30)
        result = ScorePredictService.predict_exam_score(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/attribution/batch")
class BatchScoreAttribution(Resource):
    @ns_algorithm.doc("get_batch_score_attribution", description="批量成绩波动归因分析")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        批量分析某班级全部学生的成绩波动归因（近期 vs 前期：
        学业成绩/行为积分/出勤/作业完成）。单生异常被隔离，不影响整体。
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = AttributionService.batch_analyze(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/attribution/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ScoreAttribution(Resource):
    @ns_algorithm.doc("get_score_attribution", description="成绩波动归因分析")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        分析学生成绩波动归因（近期 vs 前期：学业成绩/行为积分/出勤/作业完成）
        """
        days = get_int_arg("days", default=30)
        result = AttributionService.analyze_score_attribution(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-predict/batch")
class BatchScorePredict(Resource):
    @ns_algorithm.doc("get_batch_score_predict", description="批量预测考试成绩")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        批量预测考试成绩
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = ScorePredictService.predict_batch(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-predict/distribution")
class ScoreDistribution(Resource):
    @ns_algorithm.doc("get_score_distribution", description="获取成绩分布预测")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取成绩分布预测
        """
        class_name = request.args.get("class_name")
        result = ScorePredictService.get_score_distribution(class_name)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-predict/train")
class ScorePredictTrain(Resource):
    @ns_algorithm.doc("post_score_predict_train", description="训练成绩预测模型")
    @ns_algorithm.param("days", "训练数据天数，默认90")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        训练成绩预测模型
        """
        days = get_int_arg("days", default=90)
        result = ScorePredictService.train_score_model(days)
        return APIResponse.success(data=result, message="success")
