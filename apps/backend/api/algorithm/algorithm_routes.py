import logging
from io import BytesIO

from flask import request, send_file
from flask_restx import Namespace, Resource

from services.algorithm_export_service import build_algorithm_export_rows
from services.algorithm_service import AlgorithmService
from services.anomaly_service import AnomalyService
from services.attribution_service import AttributionService
from services.cluster_service import ClusterService
from services.composite_score_service import CompositeScoreService
from services.engagement_service import EngagementService
from services.prediction_service import PredictionService
from services.reward_service import (
    PhoneAccessHandler,
    RewardInteractionController,
    RewardSystem,
)
from services.risk_predict_service import RiskPredictService
from services.rule_engine_service import RuleExecutionEngine
from services.rule_recommendation_service import RuleRecommendationService
from services.score_distribution_service import (
    ScoreDistributionController,
    ScoreValidator,
)
from services.score_ecosystem_service import ScoreEcosystem
from services.score_predict_service import ScorePredictService
from services.warning_service import WarningService
from utils.api_cache_middleware import cached_api
from utils.decorators import safe_handle
from utils.excel_utils import ExcelUtils
from utils.params import get_int_arg
from utils.permission import requires_permission
from utils.response import APIResponse

logger = logging.getLogger(__name__)

"""
算法分析API路由模块
提供统计分析、学生分群、综合评分、风险预警等功能
"""
ns_algorithm = Namespace("algorithm", description="算法分析相关操作")

# 62 个端点类按域拆分到 _alg_partN.py，保持 ns_algorithm 单一定义与注册
import api.algorithm._alg_part1
import api.algorithm._alg_part2
import api.algorithm._alg_part3
import api.algorithm._alg_part4
import api.algorithm._alg_part5
import api.algorithm._alg_part6

