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

@ns_algorithm.route("/statistics")
class Statistics(Resource):
    @ns_algorithm.doc("get_statistics", description="获取综合统计分析")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取综合统计分析
        包括描述性统计、相关性分析、分组对比等。
        """
        class_name = request.args.get("class_name")
        result = AlgorithmService.calculate_statistics(class_name)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/cluster")
class Cluster(Resource):
    @ns_algorithm.doc("get_cluster", description="获取学生分群结果")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取学生分群结果
        """
        class_name = request.args.get("class_name")
        result = ClusterService.get_cluster_results(class_name)
        return APIResponse.success(data=result, message="success")

    @ns_algorithm.doc("post_cluster", description="触发分群重新计算")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("n_clusters", "聚类数量(默认4)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        触发分群重新计算
        """
        class_name = request.args.get("class_name")
        n_clusters = get_int_arg("n_clusters", default=4)
        result = ClusterService.perform_clustering(class_name, n_clusters)
        return APIResponse.success(data=result, message="分群计算完成")


@ns_algorithm.route("/cluster/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ClusterByUser(Resource):
    @ns_algorithm.doc("get_cluster_by_user", description="获取单个学生的分群信息")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取单个学生的分群信息
        """
        result = ClusterService.get_cluster_by_user(user_id)
        if result:
            return APIResponse.success(data=result, message="success")
        return APIResponse.error(message="未找到分群信息")


@ns_algorithm.route("/composite-score")
class CompositeScore(Resource):
    @ns_algorithm.doc("get_composite_score", description="获取综合评分排名")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取综合评分排名
        """
        class_name = request.args.get("class_name")
        result = CompositeScoreService.get_composite_scores(class_name)
        return APIResponse.success(data=result, message="success")

    @ns_algorithm.doc("post_composite_score_recalculate", description="重新计算综合评分")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        重新计算综合评分
        """
        class_name = request.args.get("class_name")
        result = CompositeScoreService.calculate_composite_score(class_name)
        return APIResponse.success(data=result, message="综合评分计算完成")


@ns_algorithm.route("/composite-score/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class CompositeScoreByUser(Resource):
    @ns_algorithm.doc("get_composite_score_by_user", description="获取单个学生的综合评分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取单个学生的综合评分
        """
        result = CompositeScoreService.get_student_composite_score(user_id)
        if result:
            return APIResponse.success(data=result, message="success")
        return APIResponse.error(message="未找到综合评分信息")


@ns_algorithm.route("/composite-score/progress")
class CompositeScoreProgress(Resource):
    @ns_algorithm.doc("get_composite_score_progress", description="获取综合评分计算进度")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取综合评分计算进度
        用于前端轮询获取计算进度，显示进度条等UI元素。
        """
        progress = CompositeScoreService.get_computation_progress()
        return APIResponse.success(data=progress, message="success")


@ns_algorithm.route("/warning")
class Warning(Resource):
    @ns_algorithm.doc("get_warning", description="获取风险预警列表")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=30)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取风险预警列表
        """
        class_name = request.args.get("class_name")
        result = WarningService.get_warnings(class_name)
        return APIResponse.success(data=result, message="success")

    @ns_algorithm.doc("post_warning_evaluate", description="执行风险评估")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        执行风险评估
        """
        class_name = request.args.get("class_name")
        result = WarningService.evaluate_risk(class_name)
        return APIResponse.success(data=result, message="风险评估完成")


@ns_algorithm.route("/warning/config")
class WarningConfig(Resource):
    @ns_algorithm.doc("get_warning_config", description="获取预警配置")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取预警配置
        """
        config = WarningService.get_config()
        return APIResponse.success(data=config, message="success")

    @ns_algorithm.doc("post_warning_config", description="更新预警配置")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        更新预警配置
        请求体格式：
        {
            "config_key": "score_threshold",
            "config_value": "30",
            "description": "积分预警阈值"
        }
        """
        data = request.get_json()
        config_key = data.get("config_key")
        config_value = data.get("config_value")
        description = data.get("description", "")
        success = WarningService.update_config(config_key, config_value, description)
        if success:
            return APIResponse.success(message="配置更新成功")
        return APIResponse.error(message="无效的配置键")


@ns_algorithm.route("/warning/<int:warning_id>/resolve")
class WarningResolve(Resource):
    @ns_algorithm.doc("resolve_warning", description="处理预警")
    @ns_algorithm.param("warning_id", "预警ID")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self, warning_id):
        """
        处理预警
        将指定预警标记为已处理
        """
        success = WarningService.resolve_warning(warning_id)
        if success:
            return APIResponse.success(message="预警处理成功")
        return APIResponse.error(message="预警不存在或已处理")


@ns_algorithm.route("/prediction/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class StudentPrediction(Resource):
    @ns_algorithm.doc("get_prediction", description="获取学生积分预测")
    @ns_algorithm.param("days", "预测天数，默认7")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取学生积分预测
        """
        days = get_int_arg("days", default=7)
        result = PredictionService.predict_future_scores(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/prediction/batch")
class BatchPrediction(Resource):
    @ns_algorithm.doc("get_batch_prediction", description="批量获取预测")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "预测天数，默认7")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        批量获取预测
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=7)
        result = PredictionService.predict_batch(class_name, days)
        return APIResponse.success(data=result, message="success")
