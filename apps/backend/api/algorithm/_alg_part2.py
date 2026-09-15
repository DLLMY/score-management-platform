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

@ns_algorithm.route("/prediction/risk")
class RiskStudents(Resource):
    @ns_algorithm.doc("get_risk_students", description="获取有下降风险的学生")
    @ns_algorithm.param("days", "预测天数，默认7")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取有下降风险的学生
        """
        days = get_int_arg("days", default=7)
        result = PredictionService.get_risk_students(days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/anomaly/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class UserAnomaly(Resource):
    @ns_algorithm.doc("get_user_anomaly", description="获取用户异常检测")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取用户异常检测
        """
        days = get_int_arg("days", default=30)
        result = AnomalyService.detect_all_anomalies(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/anomaly/batch")
class BatchAnomaly(Resource):
    @ns_algorithm.doc("get_batch_anomaly", description="批量获取异常检测")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        批量获取异常检测
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = AnomalyService.get_all_anomalies(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/anomaly/sudden/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class SuddenChange(Resource):
    @ns_algorithm.doc("get_sudden_change", description="检测突变异常")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        检测突变异常
        """
        days = get_int_arg("days", default=30)
        result = AnomalyService.detect_sudden_change(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/anomaly/trend/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class TrendAnomaly(Resource):
    @ns_algorithm.doc("get_trend_anomaly", description="检测趋势异常")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        检测趋势异常
        """
        days = get_int_arg("days", default=30)
        result = AnomalyService.detect_trend_anomaly(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/anomaly/group/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class GroupAnomaly(Resource):
    @ns_algorithm.doc("get_group_anomaly", description="检测群体异常")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        检测群体异常
        """
        days = get_int_arg("days", default=30)
        result = AnomalyService.detect_group_anomaly(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/engagement/batch")
class BatchEngagement(Resource):
    @ns_algorithm.doc("get_batch_engagement", description="批量计算班级参与度排名")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        批量计算某班级（或全部）学生的参与度指数并排名。
        单生异常被隔离进 failed_students，不影响整体。
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = EngagementService.batch_rank(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/engagement/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class UserEngagement(Resource):
    @ns_algorithm.doc("get_user_engagement", description="获取学生参与度指数")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取学生参与度指数（0-100）
        综合出勤率、作业提交率、积分活跃度与请假天数评估。
        """
        days = get_int_arg("days", default=30)
        result = EngagementService.calculate_engagement(user_id, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/engagement/<int:user_id>/weekly-trend")
@ns_algorithm.param("user_id", "用户ID")
class UserEngagementTrend(Resource):
    @ns_algorithm.doc("get_user_engagement_trend", description="获取学生参与度周趋势")
    @ns_algorithm.param("weeks", "历史周数，默认8")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取学生参与度周趋势（由远及近的时间序列，用于折线图展示）。
        """
        weeks = get_int_arg("weeks", default=8)
        result = EngagementService.weekly_trend(user_id, weeks)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-recommend")
class RuleRecommend(Resource):
    @ns_algorithm.doc("get_rule_recommend", description="获取积分规则推荐")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取积分规则推荐
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = RuleRecommendationService.get_all_recommendations(class_name, days)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/rule-recommend/new")
class NewRuleRecommend(Resource):
    @ns_algorithm.doc("get_new_rule_recommend", description="获取新规则推荐")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取新规则推荐
        """
        class_name = request.args.get("class_name")
        days = get_int_arg("days", default=30)
        result = RuleRecommendationService.find_new_rule_opportunities(
            class_name, days
        )
        return APIResponse.success(data=result, message="success")
