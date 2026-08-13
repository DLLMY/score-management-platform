from flask_restx import Namespace, Resource
from flask import request
from utils.permission import requires_permission
from utils.response import APIResponse
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

"""
算法分析API路由模块
提供统计分析、学生分群、综合评分、风险预警等功能
"""
ns_algorithm = Namespace("algorithm", description="算法分析相关操作")


@ns_algorithm.route("/statistics")
class Statistics(Resource):
    @ns_algorithm.doc("get_statistics", description="获取综合统计分析")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取综合统计分析
        包括描述性统计、相关性分析、分组对比等。
        """
        class_name = request.args.get("class_name")
        try:
            result = AlgorithmService.calculate_statistics(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/cluster")
class Cluster(Resource):
    @ns_algorithm.doc("get_cluster", description="获取学生分群结果")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取学生分群结果
        """
        class_name = request.args.get("class_name")
        try:
            result = ClusterService.get_cluster_results(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_algorithm.doc("post_cluster", description="触发分群重新计算")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("n_clusters", "聚类数量(默认4)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        触发分群重新计算
        """
        class_name = request.args.get("class_name")
        n_clusters = int(request.args.get("n_clusters", 4))
        try:
            result = ClusterService.perform_clustering(class_name, n_clusters)  # noqa: F841
            return APIResponse.success(data=result, message="分群计算完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/cluster/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ClusterByUser(Resource):
    @ns_algorithm.doc("get_cluster_by_user", description="获取单个学生的分群信息")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取单个学生的分群信息
        """
        try:
            result = ClusterService.get_cluster_by_user(user_id)  # noqa: F841
            if result:
                return APIResponse.success(data=result, message="success")
            else:
                return APIResponse.error(message="未找到分群信息")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/composite-score")
class CompositeScore(Resource):
    @ns_algorithm.doc("get_composite_score", description="获取综合评分排名")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取综合评分排名
        """
        class_name = request.args.get("class_name")
        try:
            result = CompositeScoreService.get_composite_scores(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_algorithm.doc("post_composite_score_recalculate", description="重新计算综合评分")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        重新计算综合评分
        """
        class_name = request.args.get("class_name")
        try:
            result = CompositeScoreService.calculate_composite_score(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="综合评分计算完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/composite-score/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class CompositeScoreByUser(Resource):
    @ns_algorithm.doc("get_composite_score_by_user", description="获取单个学生的综合评分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取单个学生的综合评分
        """
        try:
            result = CompositeScoreService.get_student_composite_score(user_id)  # noqa: F841
            if result:
                return APIResponse.success(data=result, message="success")
            else:
                return APIResponse.error(message="未找到综合评分信息")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/composite-score/progress")
class CompositeScoreProgress(Resource):
    @ns_algorithm.doc("get_composite_score_progress", description="获取综合评分计算进度")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取综合评分计算进度
        用于前端轮询获取计算进度，显示进度条等UI元素。
        """
        try:
            progress = CompositeScoreService.get_computation_progress()
            return APIResponse.success(data=progress, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/warning")
class Warning(Resource):
    @ns_algorithm.doc("get_warning", description="获取风险预警列表")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取风险预警列表
        """
        class_name = request.args.get("class_name")
        try:
            result = WarningService.get_warnings(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_algorithm.doc("post_warning_evaluate", description="执行风险评估")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        执行风险评估
        """
        class_name = request.args.get("class_name")
        try:
            result = WarningService.evaluate_risk(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="风险评估完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/warning/config")
class WarningConfig(Resource):
    @ns_algorithm.doc("get_warning_config", description="获取预警配置")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取预警配置
        """
        try:
            config = WarningService.get_config()
            return APIResponse.success(data=config, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))

    @ns_algorithm.doc("post_warning_config", description="更新预警配置")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
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


@ns_algorithm.route("/warning/<int:warning_id>/resolve")
class WarningResolve(Resource):
    @ns_algorithm.doc("resolve_warning", description="处理预警")
    @ns_algorithm.param("warning_id", "预警ID")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self, warning_id):
        """
        处理预警
        将指定预警标记为已处理
        """
        try:
            success = WarningService.resolve_warning(warning_id)
            if success:
                return APIResponse.success(message="预警处理成功")
            else:
                return APIResponse.error(message="预警不存在或已处理")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/prediction/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class StudentPrediction(Resource):
    @ns_algorithm.doc("get_prediction", description="获取学生积分预测")
    @ns_algorithm.param("days", "预测天数，默认7")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取学生积分预测
        """
        days = int(request.args.get("days", 7))
        try:
            result = PredictionService.predict_future_scores(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/prediction/batch")
class BatchPrediction(Resource):
    @ns_algorithm.doc("get_batch_prediction", description="批量获取预测")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "预测天数，默认7")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        批量获取预测
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 7))
        try:
            result = PredictionService.predict_batch(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/prediction/risk")
class RiskStudents(Resource):
    @ns_algorithm.doc("get_risk_students", description="获取有下降风险的学生")
    @ns_algorithm.param("days", "预测天数，默认7")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取有下降风险的学生
        """
        days = int(request.args.get("days", 7))
        try:
            result = PredictionService.get_risk_students(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/anomaly/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class UserAnomaly(Resource):
    @ns_algorithm.doc("get_user_anomaly", description="获取用户异常检测")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取用户异常检测
        """
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_all_anomalies(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/anomaly/batch")
class BatchAnomaly(Resource):
    @ns_algorithm.doc("get_batch_anomaly", description="批量获取异常检测")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        批量获取异常检测
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.get_all_anomalies(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/anomaly/sudden/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class SuddenChange(Resource):
    @ns_algorithm.doc("get_sudden_change", description="检测突变异常")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        检测突变异常
        """
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_sudden_change(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/anomaly/trend/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class TrendAnomaly(Resource):
    @ns_algorithm.doc("get_trend_anomaly", description="检测趋势异常")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        检测趋势异常
        """
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_trend_anomaly(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/anomaly/group/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class GroupAnomaly(Resource):
    @ns_algorithm.doc("get_group_anomaly", description="检测群体异常")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        检测群体异常
        """
        days = int(request.args.get("days", 30))
        try:
            result = AnomalyService.detect_group_anomaly(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/engagement/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class UserEngagement(Resource):
    @ns_algorithm.doc("get_user_engagement", description="获取学生参与度指数")
    @ns_algorithm.param("days", "历史天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取学生参与度指数（0-100）
        综合出勤率、作业提交率、积分活跃度与请假天数评估。
        """
        days = int(request.args.get("days", 30))
        try:
            result = EngagementService.calculate_engagement(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend")
class RuleRecommend(Resource):
    @ns_algorithm.doc("get_rule_recommend", description="获取积分规则推荐")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取积分规则推荐
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.get_all_recommendations(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend/new")
class NewRuleRecommend(Resource):
    @ns_algorithm.doc("get_new_rule_recommend", description="获取新规则推荐")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取新规则推荐
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.find_new_rule_opportunities(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend/optimization")
class RuleOptimization(Resource):
    @ns_algorithm.doc("get_rule_optimization", description="获取规则优化建议")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取规则优化建议
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.suggest_rule_optimizations(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend/combination")
class RuleCombination(Resource):
    @ns_algorithm.doc("get_rule_combination", description="获取规则组合建议")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取规则组合建议
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.suggest_rule_combinations(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend/statistics")
class RuleStatistics(Resource):
    @ns_algorithm.doc("get_rule_statistics", description="获取规则统计信息")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取规则统计信息
        """
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.get_rule_statistics(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend/train")
class RuleRecommendTrain(Resource):
    @ns_algorithm.doc("post_rule_recommend_train", description="训练规则推荐模型")
    @ns_algorithm.param("days", "训练数据天数，默认90")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        训练规则推荐模型
        """
        days = int(request.args.get("days", 90))
        try:
            result = RuleRecommendationService.train_recommendation_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-recommend/evaluate")
class RuleRecommendEvaluate(Resource):
    @ns_algorithm.doc("get_rule_recommend_evaluate", description="评估规则推荐模型")
    @ns_algorithm.param("days", "评估数据天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        评估规则推荐模型
        """
        days = int(request.args.get("days", 30))
        try:
            result = RuleRecommendationService.evaluate_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-predict/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ScorePredict(Resource):
    @ns_algorithm.doc("get_score_predict", description="预测学生考试成绩")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        预测学生考试成绩
        """
        days = int(request.args.get("days", 30))
        try:
            result = ScorePredictService.predict_exam_score(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/attribution/batch")
class BatchScoreAttribution(Resource):
    @ns_algorithm.doc("get_batch_score_attribution", description="批量成绩波动归因分析")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        批量分析某班级全部学生的成绩波动归因（近期 vs 前期：
        学业成绩/行为积分/出勤/作业完成）。单生异常被隔离，不影响整体。
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = AttributionService.batch_analyze(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/attribution/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ScoreAttribution(Resource):
    @ns_algorithm.doc("get_score_attribution", description="成绩波动归因分析")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        分析学生成绩波动归因（近期 vs 前期：学业成绩/行为积分/出勤/作业完成）
        """
        days = int(request.args.get("days", 30))
        try:
            result = AttributionService.analyze_score_attribution(user_id, days)
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-predict/batch")
class BatchScorePredict(Resource):
    @ns_algorithm.doc("get_batch_score_predict", description="批量预测考试成绩")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        批量预测考试成绩
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = ScorePredictService.predict_batch(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-predict/distribution")
class ScoreDistribution(Resource):
    @ns_algorithm.doc("get_score_distribution", description="获取成绩分布预测")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取成绩分布预测
        """
        class_name = request.args.get("class_name")
        try:
            result = ScorePredictService.get_score_distribution(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-predict/train")
class ScorePredictTrain(Resource):
    @ns_algorithm.doc("post_score_predict_train", description="训练成绩预测模型")
    @ns_algorithm.param("days", "训练数据天数，默认90")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        训练成绩预测模型
        """
        days = int(request.args.get("days", 90))
        try:
            result = ScorePredictService.train_score_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-predict/evaluate")
class ScorePredictEvaluate(Resource):
    @ns_algorithm.doc("get_score_predict_evaluate", description="评估成绩预测模型")
    @ns_algorithm.param("days", "评估数据天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        评估成绩预测模型
        """
        days = int(request.args.get("days", 30))
        try:
            result = ScorePredictService.evaluate_score_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/risk-predict/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class RiskPredict(Resource):
    @ns_algorithm.doc("get_risk_predict", description="预测学生风险")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        预测学生风险
        """
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.predict_risk(user_id, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/risk-predict/batch")
class BatchRiskPredict(Resource):
    @ns_algorithm.doc("get_batch_risk_predict", description="批量预测风险")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        批量预测风险
        """
        class_name = request.args.get("class_name")
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.predict_batch(class_name, days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/risk-predict/high-risk")
class HighRiskStudents(Resource):
    @ns_algorithm.doc("get_high_risk_students", description="获取高风险学生")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取高风险学生
        """
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.get_high_risk_students(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/risk-predict/train")
class RiskPredictTrain(Resource):
    @ns_algorithm.doc("post_risk_predict_train", description="训练风险预测模型")
    @ns_algorithm.param("days", "训练数据天数，默认90")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        训练风险预测模型
        """
        days = int(request.args.get("days", 90))
        try:
            result = RiskPredictService.train_risk_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/risk-predict/evaluate")
class RiskPredictEvaluate(Resource):
    @ns_algorithm.doc("get_risk_predict_evaluate", description="评估风险预测模型")
    @ns_algorithm.param("days", "评估数据天数，默认30")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        评估风险预测模型
        """
        days = int(request.args.get("days", 30))
        try:
            result = RiskPredictService.evaluate_risk_model(days)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-engine/execute")
class RuleEngineExecute(Resource):
    @ns_algorithm.doc("post_rule_engine_execute", description="执行规则引擎")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        执行规则引擎
        """
        try:
            data = request.get_json()
            model_output = data.get("model_output", {})
            user_context = data.get("user_context", {})
            engine = RuleExecutionEngine()
            result = engine.execute_rules(model_output, user_context)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/rule-engine/apply-by-behavior")
class RuleEngineApplyByBehavior(Resource):
    @ns_algorithm.doc("post_rule_engine_apply_by_behavior", description="根据行为类型应用规则")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        根据行为类型应用规则
        """
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


@ns_algorithm.route("/score-distribution/statistics")
class ScoreDistributionStats(Resource):
    @ns_algorithm.doc("get_score_distribution_statistics", description="获取评分分布统计")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取评分分布统计
        """
        class_name = request.args.get("class_name")
        try:
            controller = ScoreDistributionController()
            result = controller.get_distribution_statistics(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-distribution/adjust")
class ScoreDistributionAdjust(Resource):
    @ns_algorithm.doc("post_score_distribution_adjust", description="调整评分分布")
    @ns_algorithm.param("class_name", "班级名称(可选)")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        调整评分分布
        """
        class_name = request.args.get("class_name")
        try:
            controller = ScoreDistributionController()
            result = controller.adjust_class_scores(class_name)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-distribution/validate")
class ScoreDistributionValidate(Resource):
    @ns_algorithm.doc("post_score_distribution_validate", description="验证评分分布")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        验证评分分布
        """
        try:
            data = request.get_json()
            scores = data.get("scores", [])
            controller = ScoreDistributionController()
            result = controller.validate_distribution(scores)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-validator/detect-outliers")
class ScoreValidatorDetectOutliers(Resource):
    @ns_algorithm.doc("post_score_validator_detect_outliers", description="检测离群值")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        检测离群值
        """
        try:
            data = request.get_json()
            scores = data.get("scores", [])
            validator = ScoreValidator()
            result = validator.detect_outliers(scores)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-validator/validate-and-correct")
class ScoreValidatorValidateAndCorrect(Resource):
    @ns_algorithm.doc("post_score_validator_validate_and_correct", description="校验并修正分数")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        校验并修正分数
        """
        try:
            data = request.get_json()
            scores = data.get("scores", [])
            validator = ScoreValidator()
            result = validator.validate_and_correct(scores)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-ecosystem/earn")
class ScoreEcosystemEarn(Resource):
    @ns_algorithm.doc("post_score_ecosystem_earn", description="获取积分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        获取积分
        """
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


@ns_algorithm.route("/score-ecosystem/spend")
class ScoreEcosystemSpend(Resource):
    @ns_algorithm.doc("post_score_ecosystem_spend", description="消费积分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        消费积分
        """
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


@ns_algorithm.route("/score-ecosystem/earning-rules")
class ScoreEcosystemEarningRules(Resource):
    @ns_algorithm.doc("get_score_ecosystem_earning_rules", description="获取积分获取规则")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取积分获取规则
        """
        try:
            ecosystem = ScoreEcosystem()
            result = ecosystem.get_earning_rules()  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-ecosystem/spending-rules")
class ScoreEcosystemSpendingRules(Resource):
    @ns_algorithm.doc("get_score_ecosystem_spending_rules", description="获取积分消费规则")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取积分消费规则
        """
        try:
            ecosystem = ScoreEcosystem()
            result = ecosystem.get_spending_rules()  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/score-ecosystem/balance/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class ScoreEcosystemBalance(Resource):
    @ns_algorithm.doc("get_score_ecosystem_balance", description="获取用户积分余额")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取用户积分余额
        """
        try:
            ecosystem = ScoreEcosystem()
            result = ecosystem.get_user_balance(user_id)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/reward/phone-access")
class RewardPhoneAccess(Resource):
    @ns_algorithm.doc("post_reward_phone_access", description="处理手机拿取请求")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        处理手机拿取请求
        """
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            access_count = data.get("access_count", 1)
            handler = PhoneAccessHandler()
            result = handler.handle_phone_access(user_id, access_count)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/reward/types")
class RewardTypes(Resource):
    @ns_algorithm.doc("get_reward_types", description="获取所有奖励类型")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取所有奖励类型
        """
        try:
            system = RewardSystem()
            result = system.get_reward_types()  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/reward/eligible/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class RewardEligible(Resource):
    @ns_algorithm.doc("get_reward_eligible", description="获取用户可兑换的奖励")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取用户可兑换的奖励
        """
        try:
            system = RewardSystem()
            result = system.get_user_eligible_rewards(user_id)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/reward/redeem")
class RewardRedeem(Resource):
    @ns_algorithm.doc("post_reward_redeem", description="兑换奖励")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        兑换奖励
        """
        try:
            data = request.get_json()
            user_id = data.get("user_id")
            reward_type = data.get("reward_type")
            system = RewardSystem()
            result = system.redeem_reward(user_id, reward_type)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/reward/daily-usage/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class RewardDailyUsage(Resource):
    @ns_algorithm.doc("get_reward_daily_usage", description="获取用户今日奖励使用情况")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self, user_id):
        """
        获取用户今日奖励使用情况
        """
        try:
            controller = RewardInteractionController()
            result = controller.get_daily_usage(user_id)  # noqa: F841
            return APIResponse.success(data=result, message="success")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/all")
class AlgorithmAll(Resource):
    @ns_algorithm.doc("get_all_algorithm_data", description="获取所有算法数据")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    def get(self):
        """
        获取所有算法数据
        """
        try:
            statistics = AlgorithmService().get_statistics()
            clusters = ClusterService().get_clusters()
            warnings = WarningService().get_warnings()
            return APIResponse.success(data={"statistics": statistics, "clusters": clusters, "warnings": warnings})
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/run")
class AlgorithmRun(Resource):
    @ns_algorithm.doc("run_algorithm_analysis", description="运行算法分析")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        运行算法分析
        """
        try:
            result = AlgorithmService().run_analysis()  # noqa: F841
            return APIResponse.success(data=result, message="算法分析完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/cluster/recalculate")
class ClusterRecalculate(Resource):
    @ns_algorithm.doc("recalculate_clusters", description="重新计算分群")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        重新计算学生分群
        """
        try:
            service = ClusterService()
            result = service.recalculate_clusters()  # noqa: F841
            return APIResponse.success(data=result, message="分群重新计算完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/composite-score/recalculate")
class CompositeScoreRecalculate(Resource):
    @ns_algorithm.doc("recalculate_composite_scores", description="重新计算综合评分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        重新计算所有学生的综合评分
        """
        try:
            service = CompositeScoreService()
            result = service.recalculate_all()  # noqa: F841
            return APIResponse.success(data=result, message="综合评分重新计算完成")
        except Exception as e:
            return APIResponse.error(message=str(e))


@ns_algorithm.route("/warning/evaluate")
class WarningEvaluate(Resource):
    @ns_algorithm.doc("evaluate_warnings", description="评估风险预警")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    def post(self):
        """
        评估所有风险预警
        """
        try:
            service = WarningService()
            result = service.evaluate_all()  # noqa: F841
            return APIResponse.success(data=result, message="预警评估完成")
        except Exception as e:
            return APIResponse.error(message=str(e))
