from flask_restx import Namespace, Resource
from flask import request
from utils.permission import requires_permission
from utils.response import APIResponse
from services.algorithm_service import AlgorithmService
from services.cluster_service import ClusterService
from services.composite_score_service import CompositeScoreService
from services.score_distribution_service import ScoreDistributionController, ScoreValidator
from services.score_ecosystem_service import ScoreEcosystem
from services.reward_service import PhoneAccessHandler, RewardSystem, RewardInteractionController

"""
综合评分API路由模块
提供综合评分、评分分布、积分生态系统等功能
"""
ns_composite = Namespace("composite", description="综合评分相关操作")


@ns_composite.route("/statistics")
class Statistics(Resource):
    @ns_composite.doc("get_statistics", description="获取综合统计分析")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        try:
            result = AlgorithmService.calculate_statistics(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/cluster")
class Cluster(Resource):
    @ns_composite.doc("get_cluster", description="获取学生分群结果")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        try:
            result = ClusterService.get_cluster_results(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_composite.doc("post_cluster", description="触发分群重新计算")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.param("n_clusters", "聚类数量(默认4)")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        class_name = request.args.get("class_name")
        n_clusters = int(request.args.get("n_clusters", 4))
        try:
            result = ClusterService.perform_clustering(class_name, n_clusters)  # noqa: F841
            return APIResponse.success(data=result, message="分群计算完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/cluster/<int:user_id>")
@ns_composite.param("user_id", "用户ID")
class ClusterByUser(Resource):
    @ns_composite.doc("get_cluster_by_user", description="获取单个学生的分群信息")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        try:
            result = ClusterService.get_cluster_by_user(user_id)  # noqa: F841
            if result:
                return APIResponse.success(data=result, message="success")
            else:
                return APIResponse.error(message="未找到分群信息")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score")
class CompositeScore(Resource):
    @ns_composite.doc("get_composite_score", description="获取综合评分排名")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        class_name = request.args.get("class_name")
        try:
            result = CompositeScoreService.get_composite_scores(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_composite.doc("post_composite_score_recalculate", description="重新计算综合评分")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        class_name = request.args.get("class_name")
        try:
            result = CompositeScoreService.calculate_composite_score(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="综合评分计算完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score/<int:user_id>")
@ns_composite.param("user_id", "用户ID")
class CompositeScoreByUser(Resource):
    @ns_composite.doc("get_composite_score_by_user", description="获取单个学生的综合评分")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        try:
            result = CompositeScoreService.get_student_composite_score(user_id)  # noqa: F841
            if result:
                return APIResponse.success(data=result, message="success")
            else:
                return APIResponse.error(message="未找到综合评分信息")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score/progress")
class CompositeScoreProgress(Resource):
    @ns_composite.doc("get_composite_score_progress", description="获取综合评分计算进度")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        try:
            progress = CompositeScoreService.get_computation_progress()
            return APIResponse.success(data=progress, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score-distribution/statistics")
class ScoreDistributionStats(Resource):
    @ns_composite.doc("get_score_distribution_statistics", description="获取评分分布统计")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.response(200, "成功")
    def get(self):
        class_name = request.args.get("class_name")
        try:
            controller = ScoreDistributionController()
            result = controller.get_distribution_statistics(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score-distribution/adjust")
class ScoreDistributionAdjust(Resource):
    @ns_composite.doc("post_score_distribution_adjust", description="调整评分分布")
    @ns_composite.param("class_name", "班级名称(可选)")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        class_name = request.args.get("class_name")
        try:
            controller = ScoreDistributionController()
            result = controller.adjust_class_scores(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score-distribution/validate")
class ScoreDistributionValidate(Resource):
    @ns_composite.doc("post_score_distribution_validate", description="验证评分分布")
    @ns_composite.response(200, "成功")
    def post(self):
        try:
            data = request.get_json()
            scores = data.get("scores", [])
            controller = ScoreDistributionController()
            result = controller.validate_distribution(scores)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score-validator/detect-outliers")
class ScoreValidatorDetectOutliers(Resource):
    @ns_composite.doc("post_score_validator_detect_outliers", description="检测离群值")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def post(self):
        try:
            data = request.get_json()
            scores = data.get("scores", [])
            validator = ScoreValidator()
            result = validator.detect_outliers(scores)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/score-validator/validate-and-correct")
class ScoreValidatorValidateAndCorrect(Resource):
    @ns_composite.doc("post_score_validator_validate_and_correct", description="校验并修正分数")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            scores = data.get("scores", [])
            validator = ScoreValidator()
            result = validator.validate_and_correct(scores)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/ecosystem/earn")
class ScoreEcosystemEarn(Resource):
    @ns_composite.doc("post_score_ecosystem_earn", description="获取积分")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            behavior_type = data.get("behavior_type")
            context = data.get("context", {})
            ecosystem = ScoreEcosystem()
            result = ecosystem.earn_score(user_id, behavior_type, context)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/ecosystem/spend")
class ScoreEcosystemSpend(Resource):
    @ns_composite.doc("post_score_ecosystem_spend", description="消费积分")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            spending_type = data.get("spending_type")
            amount = data.get("amount", 1)
            ecosystem = ScoreEcosystem()
            result = ecosystem.spend_score(user_id, spending_type, amount)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/ecosystem/earning-rules")
class ScoreEcosystemEarningRules(Resource):
    @ns_composite.doc("get_score_ecosystem_earning_rules", description="获取积分获取规则")
    @ns_composite.response(200, "成功")
    def get(self):
        try:
            ecosystem = ScoreEcosystem()
            result = ecosystem.get_earning_rules()  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/ecosystem/spending-rules")
class ScoreEcosystemSpendingRules(Resource):
    @ns_composite.doc("get_score_ecosystem_spending_rules", description="获取积分消费规则")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        try:
            ecosystem = ScoreEcosystem()
            result = ecosystem.get_spending_rules()  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/ecosystem/balance/<int:user_id>")
@ns_composite.param("user_id", "用户ID")
class ScoreEcosystemBalance(Resource):
    @ns_composite.doc("get_score_ecosystem_balance", description="获取用户积分余额")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        try:
            ecosystem = ScoreEcosystem()
            result = ecosystem.get_user_balance(user_id)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/reward/phone-access")
class RewardPhoneAccess(Resource):
    @ns_composite.doc("post_reward_phone_access", description="处理手机拿取请求")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            access_count = data.get("access_count", 1)
            handler = PhoneAccessHandler()
            result = handler.handle_phone_access(user_id, access_count)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/reward/types")
class RewardTypes(Resource):
    @ns_composite.doc("get_reward_types", description="获取所有奖励类型")
    @ns_composite.response(200, "成功")
    def get(self):
        try:
            system = RewardSystem()
            result = system.get_reward_types()  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/reward/eligible/<int:user_id>")
@ns_composite.param("user_id", "用户ID")
class RewardEligible(Resource):
    @ns_composite.doc("get_reward_eligible", description="获取用户可兑换的奖励")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        try:
            system = RewardSystem()
            result = system.get_user_eligible_rewards(user_id)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/reward/redeem")
class RewardRedeem(Resource):
    @ns_composite.doc("post_reward_redeem", description="兑换奖励")
    @ns_composite.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            reward_type = data.get("reward_type")
            system = RewardSystem()
            result = system.redeem_reward(user_id, reward_type)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_composite.route("/reward/daily-usage/<int:user_id>")
@ns_composite.param("user_id", "用户ID")
class RewardDailyUsage(Resource):
    @ns_composite.doc("get_reward_daily_usage", description="获取用户今日奖励使用情况")
    @ns_composite.response(200, "成功")
    def get(self, user_id):
        try:
            controller = RewardInteractionController()
            result = controller.get_daily_usage(user_id)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))
