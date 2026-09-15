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

@ns_algorithm.route("/reward/daily-usage/<int:user_id>")
@ns_algorithm.param("user_id", "用户ID")
class RewardDailyUsage(Resource):
    @ns_algorithm.doc("get_reward_daily_usage", description="获取用户今日奖励使用情况")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self, user_id):
        """
        获取用户今日奖励使用情况
        """
        controller = RewardInteractionController()
        result = controller.get_daily_usage(user_id)
        return APIResponse.success(data=result, message="success")


@ns_algorithm.route("/all")
class AlgorithmAll(Resource):
    @ns_algorithm.doc("get_all_algorithm_data", description="获取所有算法数据")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.view")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def get(self):
        """
        获取所有算法数据
        """
        statistics = AlgorithmService().get_statistics()
        clusters = ClusterService().get_clusters()
        warnings = WarningService().get_warnings()
        return APIResponse.success(
            data={"statistics": statistics, "clusters": clusters, "warnings": warnings}
        )


@ns_algorithm.route("/run")
class AlgorithmRun(Resource):
    @ns_algorithm.doc("run_algorithm_analysis", description="运行算法分析")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        运行算法分析
        """
        result = AlgorithmService().run_analysis()
        return APIResponse.success(data=result, message="算法分析完成")


@ns_algorithm.route("/cluster/recalculate")
class ClusterRecalculate(Resource):
    @ns_algorithm.doc("recalculate_clusters", description="重新计算分群")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        重新计算学生分群
        """
        service = ClusterService()
        result = service.recalculate_clusters()
        return APIResponse.success(data=result, message="分群重新计算完成")


@ns_algorithm.route("/composite-score/recalculate")
class CompositeScoreRecalculate(Resource):
    @ns_algorithm.doc("recalculate_composite_scores", description="重新计算综合评分")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        重新计算所有学生的综合评分
        """
        service = CompositeScoreService()
        result = service.recalculate_all()
        return APIResponse.success(data=result, message="综合评分重新计算完成")


@ns_algorithm.route("/warning/evaluate")
class WarningEvaluate(Resource):
    @ns_algorithm.doc("evaluate_warnings", description="评估风险预警")
    @ns_algorithm.response(200, "成功")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="算法计算失败，请稍后重试")
    def post(self):
        """
        评估所有风险预警
        """
        service = WarningService()
        result = service.evaluate_all()
        return APIResponse.success(data=result, message="预警评估完成")


ALGORITHM_EXPORT_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@ns_algorithm.route("/export")
class AlgorithmExport(Resource):
    @ns_algorithm.doc(
        "get_algorithm_export", description="导出算法分析结果为 Excel（参与度/归因/风险）"
    )
    @ns_algorithm.param(
        "tab", "导出类型: engagement(参与度排名) / attribution(班级归因) / risk(风险评估)"
    )
    @ns_algorithm.param("class_name", "班级名称(可选，为空导出全部)")
    @ns_algorithm.param("days", "统计天数，默认30")
    @ns_algorithm.response(200, "Excel 文件流")
    @requires_permission("algorithm.view")
    def get(self):
        """按 tab 导出对应算法分析结果为 xlsx。

        - engagement: 参与度排名榜（排名/参与度/等级/出勤/作业/活跃/请假）
        - attribution: 班级成绩波动归因（成绩变化/主要因子/置信度/状态）
        - risk: 风险评估（总体风险/风险分/风险因素）
        """
        tab = (request.args.get("tab") or "engagement").lower()
        class_name = request.args.get("class_name") or None
        try:
            days = get_int_arg("days", default=30)
        except (TypeError, ValueError):
            days = 30
        try:
            sheet_name, headers, rows = build_algorithm_export_rows(tab, class_name, days)
        except ValueError as e:
            return APIResponse.bad_request(message=str(e))
        content = ExcelUtils.export_to_excel(
            [{"name": sheet_name, "headers": headers, "data": rows}]
        )
        safe = (class_name or "全部").replace("/", "_")
        filename = f"{safe}_{sheet_name}.xlsx"
        return send_file(
            BytesIO(content),
            mimetype=ALGORITHM_EXPORT_MIME,
            as_attachment=True,
            download_name=filename,
        )
