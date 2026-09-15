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

@ns_algorithm.route("/score-validator/detect-outliers")
class ScoreValidatorDetectOutliers(Resource):
    @ns_algorithm.doc("post_score_validator_detect_outliers", description="检测离群值")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        检测离群值
        """
        data = request.get_json()
        scores = data.get("scores", [])
        validator = ScoreValidator()
        result = validator.detect_outliers(scores)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-validator/validate-and-correct")
class ScoreValidatorValidateAndCorrect(Resource):
    @ns_algorithm.doc("post_score_validator_validate_and_correct", description="校验并修正分数")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        校验并修正分数
        """
        data = request.get_json()
        scores = data.get("scores", [])
        validator = ScoreValidator()
        result = validator.validate_and_correct(scores)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-ecosystem/earn")
class ScoreEcosystemEarn(Resource):
    @ns_algorithm.doc("post_score_ecosystem_earn", description="获取积分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        获取积分
        """
        data = request.get_json()
        user_id = data.get("user_id")
        behavior_type = data.get("behavior_type")
        context = data.get("context", {})
        ecosystem = ScoreEcosystem()
        result = ecosystem.earn_score(user_id, behavior_type, context)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-ecosystem/spend")
class ScoreEcosystemSpend(Resource):
    @ns_algorithm.doc("post_score_ecosystem_spend", description="消费积分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        消费积分
        """
        data = request.get_json()
        user_id = data.get("user_id")
        spending_type = data.get("spending_type")
        amount = data.get("amount", 1)
        ecosystem = ScoreEcosystem()
        result = ecosystem.spend_score(user_id, spending_type, amount)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-ecosystem/earning-rules")
class ScoreEcosystemEarningRules(Resource):
    @ns_algorithm.doc("get_score_ecosystem_earning_rules", description="获取积分获取规则")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取积分获取规则
        """
        ecosystem = ScoreEcosystem()
        result = ecosystem.get_earning_rules()
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-ecosystem/spending-rules")
class ScoreEcosystemSpendingRules(Resource):
    @ns_algorithm.doc("get_score_ecosystem_spending_rules", description="获取积分消费规则")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取积分消费规则
        """
        ecosystem = ScoreEcosystem()
        result = ecosystem.get_spending_rules()
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/score-ecosystem/balance/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ScoreEcosystemBalance(Resource):
    @ns_algorithm.doc("get_score_ecosystem_balance", description="获取用户积分余额")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取用户积分余额
        """
        ecosystem = ScoreEcosystem()
        result = ecosystem.get_user_balance(user_id)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/reward/phone-access")
class RewardPhoneAccess(Resource):
    @ns_algorithm.doc("post_reward_phone_access", description="处理手机拿取请求")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        处理手机拿取请求
        """
        data = request.get_json()
        user_id = data.get("user_id")
        access_count = data.get("access_count", 1)
        handler = PhoneAccessHandler()
        result = handler.handle_phone_access(user_id, access_count)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/reward/types")
class RewardTypes(Resource):
    @ns_algorithm.doc("get_reward_types", description="获取所有奖励类型")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取所有奖励类型
        """
        system = RewardSystem()
        result = system.get_reward_types()
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/reward/eligible/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class RewardEligible(Resource):
    @ns_algorithm.doc("get_reward_eligible", description="获取用户可兑换的奖励")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取用户可兑换的奖励
        """
        system = RewardSystem()
        result = system.get_user_eligible_rewards(user_id)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/reward/redeem")
class RewardRedeem(Resource):
    @ns_algorithm.doc("post_reward_redeem", description="兑换奖励")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        兑换奖励
        """
        data = request.get_json()
        user_id = data.get("user_id")
        reward_type = data.get("reward_type")
        system = RewardSystem()
        result = system.redeem_reward(user_id, reward_type)
        return APIResponse.success(data=result, message="success")
