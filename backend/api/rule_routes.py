from flask_restx import Namespace, Resource
from flask import request
from utils.permission import requires_permission
from utils.response import APIResponse
from services.rule_recommendation_service import RuleRecommendationService
from services.rule_engine_service import RuleExecutionEngine

"""
规则引擎API路由模块
提供规则推荐、规则引擎执行等功能
"""
ns_rule = Namespace("rule", description="规则引擎相关操作")


@ns_rule.route("/recommend")
class RuleRecommend(Resource):
    @ns_rule.doc("get_rule_recommend", description="获取积分规则推荐")
    @ns_rule.param("class_name", "班级名称(可选)")
    @ns_rule.param("days", "统计天数，默认30")
    @ns_rule.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.get_all_recommendations(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/recommend/new")
class NewRuleRecommend(Resource):
    @ns_rule.doc("get_new_rule_recommend", description="获取新规则推荐")
    @ns_rule.param("class_name", "班级名称(可选)")
    @ns_rule.param("days", "统计天数，默认30")
    @ns_rule.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.find_new_rule_opportunities(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/recommend/optimization")
class RuleOptimization(Resource):
    @ns_rule.doc("get_rule_optimization", description="获取规则优化建议")
    @ns_rule.param("class_name", "班级名称(可选)")
    @ns_rule.param("days", "统计天数，默认30")
    @ns_rule.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.suggest_rule_optimizations(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/recommend/combination")
class RuleCombination(Resource):
    @ns_rule.doc("get_rule_combination", description="获取规则组合建议")
    @ns_rule.param("class_name", "班级名称(可选)")
    @ns_rule.param("days", "统计天数，默认30")
    @ns_rule.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.suggest_rule_combinations(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/recommend/statistics")
class RuleStatistics(Resource):
    @ns_rule.doc("get_rule_statistics", description="获取规则统计信息")
    @ns_rule.param("days", "统计天数，默认30")
    @ns_rule.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.get_rule_statistics(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/recommend/train")
class RuleRecommendTrain(Resource):
    @ns_rule.doc("post_rule_recommend_train", description="训练规则推荐模型")
    @ns_rule.param("days", "训练数据天数，默认90")
    @ns_rule.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        days = int(request.args.get("days", 90))
        try:
            result = RuleRecommendationService.train_recommendation_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/recommend/evaluate")
class RuleRecommendEvaluate(Resource):
    @ns_rule.doc("get_rule_recommend_evaluate", description="评估规则推荐模型")
    @ns_rule.param("days", "评估数据天数，默认30")
    @ns_rule.response(200, "成功")
    def get(self):
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.evaluate_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/engine/execute")
class RuleEngineExecute(Resource):
    @ns_rule.doc("post_rule_engine_execute", description="执行规则引擎")
    @ns_rule.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            model_output = data.get("model_output", {})
            user_context = data.get("user_context", {})
            engine = RuleExecutionEngine()
            result = engine.execute_rules(model_output, user_context)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_rule.route("/engine/apply-by-behavior")
class RuleEngineApplyByBehavior(Resource):
    @ns_rule.doc("post_rule_engine_apply_by_behavior", description="根据行为类型应用规则")
    @ns_rule.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            behavior_type = data.get("behavior_type")
            context = data.get("context", {})
            engine = RuleExecutionEngine()
            result = engine.apply_rule_by_behavior(user_id, behavior_type, context)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))
