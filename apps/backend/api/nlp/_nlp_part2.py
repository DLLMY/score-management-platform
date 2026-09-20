# -*- coding: utf-8 -*-
# part of api/nlp/nlp_routes.py (D2 split)

from flask import request, g, current_app
import time
import json
import logging
import threading
import itertools
from flask_restx import Namespace, Resource, fields
from utils.response import APIResponse
from utils.pagination import get_pagination
from services.nlp_rule_service import NLPRuleManagementService
from services.nlp_service import get_match_results_evaluation
from services.nlp_analyzer_service import nlp_analyzer, AlgorithmBenchmark
from services.nlp_optimizer import get_nlp_optimizer, warmup_nlp
from config.nlp_algorithm import nlp_optimizer, OptimizationStrategy, get_optimizer
from models import NLPCorrection
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache
from utils.decorators import safe_handle
from datetime import datetime
from services.redis_cache_service import get_cache_service
from services.nlp_correction_service import (
    record_corrections,
    update_correction_status,
    delete_correction,
)

import api.nlp.nlp_routes as _mod

from api.nlp.nlp_routes import logger, ns_nlp, MAX_INFERENCE_CONCURRENCY, _inference_semaphore, TRAIN_TASK_MAX_RUNNING_SECONDS, _break_stale_training_tasks, _acquire_inference_slot, inference_slot_guard, get_context_memory, save_context_memory, parse_input_model, parse_output_model, rule_model, execute_input_model, train_input_model, _build_feedback_corrections, _resolve_feedback_user_id

@ns_nlp.route("/model/predict")
class NLPModelPredict(Resource):

    @ns_nlp.doc("nlp_model_predict", description="使用训练好的模型预测规则")
    @requires_permission("algorithm.view")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text")
        algorithm = data.get("algorithm")

        if not text:
            return APIResponse.error(message="文本不能为空")

        ml_service = _mod._get_ml_service()
        result = ml_service.predict(text, algorithm)

        if result:
            return APIResponse.success(data=result, message="预测成功")
        return APIResponse.error(message="模型未训练或加载失败")

@ns_nlp.route("/model/predict-multi")
class NLPModelPredictMulti(Resource):

    @ns_nlp.doc("nlp_model_predict_multi", description="使用多个模型进行预测")
    @requires_permission("algorithm.view")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text")
        top_n = data.get("top_n", 3)

        if not text:
            return APIResponse.error(message="文本不能为空")

        ml_service = _mod._get_ml_service()
        results = ml_service.predict_with_multiple_models(text, top_n)

        if results:
            return APIResponse.success(data=results, message="预测成功")
        return APIResponse.error(message="模型未训练或加载失败")

@ns_nlp.route("/model/ensemble-predict")
class NLPModelEnsemblePredict(Resource):

    @ns_nlp.doc("nlp_model_ensemble_predict", description="使用集成模型进行预测")
    @requires_permission("algorithm.view")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text")

        if not text:
            return APIResponse.error(message="文本不能为空")

        ml_service = _mod._get_ml_service()
        result = ml_service.ensemble_predict(text)

        if result:
            return APIResponse.success(data=result, message="预测成功")
        return APIResponse.error(message="集成预测失败")

@ns_nlp.route("/model/training-history")
class NLPModelTrainingHistory(Resource):

    @ns_nlp.doc("nlp_get_training_history", description="获取模型训练历史")
    @ns_nlp.param("page", "页码")
    @ns_nlp.param("per_page", "每页数量")
    @requires_permission("algorithm.view")
    @cached_api(ttl=30)
    @safe_handle()
    def get(self):
        page, per_page = get_pagination(default=10)

        service = NLPRuleManagementService()
        result = service.get_training_history(page, per_page)

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/model/evaluate")
class NLPModelEvaluate(Resource):

    @ns_nlp.doc("nlp_evaluate_model", description="评估模型性能")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        # 数据诚信修复（P0-1）：nlp_match_results 无 ground-truth 标注列
        # （无 is_correct / predicted_intent / actual_intent），无法计算真实准确率。
        # 严禁伪造 0.85 默认值；无样本时四项指标返回 null，有样本时仅能给出
        # “自动匹配率”这一描述性比率（明确标注非真实准确率）。
        evaluation = get_match_results_evaluation()
        total_count = evaluation["total_count"]
        correct_count = evaluation["correct_count"]

        if total_count == 0:
            return APIResponse.success(
                data={
                    "accuracy_rate": None,
                    "precision": None,
                    "recall": None,
                    "f1_score": None,
                    "total_samples": 0,
                    "correct_count": 0,
                    "incorrect_count": 0,
                },
                message="暂无评估数据，准确率无法计算（已移除伪造的 0.85 默认值，返回 null）",
            )

        # 当前 schema 无 ground-truth，accuracy_rate 实为自动匹配率（非真实准确率）
        auto_match_rate = round(correct_count / total_count, 4)
        incorrect_count = total_count - correct_count
        return APIResponse.success(
            data={
                "accuracy_rate": auto_match_rate,
                "precision": auto_match_rate,
                "recall": auto_match_rate,
                "f1_score": auto_match_rate,
                "total_samples": total_count,
                "correct_count": correct_count,
                "incorrect_count": incorrect_count,
            },
            message="注意：表缺少 ground-truth 标注列，accuracy_rate 为自动匹配率（非真实准确率）",
        )

@ns_nlp.route("/model/dynamic-weighted-predict")
class NLPModelDynamicWeightedPredict(Resource):

    @ns_nlp.doc("nlp_dynamic_weighted_predict", description="使用动态加权融合进行预测")
    @requires_permission("algorithm.view")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text")

        if not text:
            return APIResponse.error(message="文本不能为空")

        ml_service = _mod._get_ml_service()
        result = ml_service.dynamic_weighted_predict(text)

        if result:
            return APIResponse.success(data=result, message="预测成功")
        return APIResponse.error(message="动态加权预测失败")

@ns_nlp.route("/model/predict-with-explanation")
class NLPModelPredictWithExplanation(Resource):

    @ns_nlp.doc("nlp_predict_with_explanation", description="使用模型预测并返回解释")
    @requires_permission("algorithm.view")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text")
        algorithm = data.get("algorithm")

        if not text:
            return APIResponse.error(message="文本不能为空")

        ml_service = _mod._get_ml_service()
        result = ml_service.predict_with_explanation(text, algorithm)

        if result:
            return APIResponse.success(data=result, message="预测成功")
        return APIResponse.error(message="模型未训练或加载失败")

@ns_nlp.route("/model/incremental-train")
class NLPModelIncrementalTrain(Resource):

    @ns_nlp.doc("nlp_incremental_train", description="增量训练模型")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        data = request.get_json()
        texts = data.get("texts", [])
        labels = data.get("labels", [])
        algorithm = data.get("algorithm")

        if not texts or not labels:
            return APIResponse.error(message="训练数据不能为空")

        if len(texts) != len(labels):
            return APIResponse.error(message="文本和标签数量不一致")

        ml_service = _mod._get_ml_service()
        result = ml_service.incremental_train(texts, labels, algorithm)

        if result["success"]:
            return APIResponse.success(data=result, message=result["message"])
        return APIResponse.error(message=result["message"])

@ns_nlp.route("/model/online-train")
class NLPModelOnlineTrain(Resource):

    @ns_nlp.doc("nlp_online_train", description="在线增量训练（单条数据）")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text")
        label = data.get("label")

        if not text or label is None:
            return APIResponse.error(message="文本和标签不能为空")

        ml_service = _mod._get_ml_service()
        result = ml_service.online_train(text, label)

        if result["success"]:
            return APIResponse.success(data=result, message=result["message"])
        return APIResponse.error(message=result["message"])

@ns_nlp.route("/model/explanation")
class NLPModelExplanation(Resource):

    @ns_nlp.doc("nlp_model_explanation", description="获取模型解释信息")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        algorithm = request.args.get("algorithm")

        ml_service = _mod._get_ml_service()
        result = ml_service.get_model_explanation(algorithm)

        if result["success"]:
            return APIResponse.success(data=result, message="获取成功")
        return APIResponse.error(message=result["message"])

@ns_nlp.route("/model/bias-analysis")
class NLPModelBiasAnalysis(Resource):

    @ns_nlp.doc("nlp_model_bias_analysis", description="分析模型偏差和类别分布")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        ml_service = _mod._get_ml_service()
        result = ml_service.analyze_model_bias()

        if result["success"]:
            return APIResponse.success(data=result, message="分析完成")
        return APIResponse.error(message=result["message"])

@ns_nlp.route("/parse/context-aware")
class NLPParseContextAware(Resource):

    @ns_nlp.doc("nlp_context_aware_parse", description="上下文感知解析")
    @requires_permission("score.entry")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")
        context_history = data.get("context_history", [])

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        parser = _mod._get_parser()
        result = parser.parse(text, context_history)

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/parse/entities")
class NLPParseEntities(Resource):

    @ns_nlp.doc("nlp_extract_entities", description="提取文本中的实体")
    @requires_permission("score.entry")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        parser = _mod._get_parser()
        name, _ = parser.extract_name(text)
        entities = parser.extract_entities(text, name)

        return APIResponse.success(data=entities, message="success")

@ns_nlp.route("/parse/multi-intent")
class NLPParseMultiIntent(Resource):

    @ns_nlp.doc("nlp_multi_intent_detection", description="多意图检测")
    @requires_permission("score.entry")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        parser = _mod._get_parser()
        behavior_result = parser.extract_behavior(text)
        intents = parser.multi_intent_detection(text, behavior_result)

        return APIResponse.success(data=intents, message="success")

@ns_nlp.route("/parse/deep-semantic")
class NLPParseDeepSemantic(Resource):

    @ns_nlp.doc("nlp_deep_semantic_match", description="深度语义匹配")
    @requires_permission("score.entry")
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")
        intent = data.get("intent", "add")
        top_n = data.get("top_n", 5)

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        parser = _mod._get_parser()
        matches = parser.deep_semantic_match(text, intent, top_n)

        results = []
        for rule, similarity in matches:
            results.append(
                {
                    "rule_id": rule.id,
                    "behavior_keyword": rule.behavior_keyword,
                    "behavior_description": rule.behavior_description,
                    "score_value": rule.score_value,
                    "score_type": rule.score_type,
                    "similarity": round(similarity, 4),
                }
            )

        return APIResponse.success(data=results, message="success")

@ns_nlp.route("/analysis/comprehensive")
class NLPAnalysisComprehensive(Resource):

    @ns_nlp.doc("nlp_analysis_comprehensive", description="获取NLP算法综合分析报告")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取NLP算法的综合分析报告
        包括意图识别准确性、性能指标、错误分析等
        """
        report = nlp_analyzer.get_comprehensive_report()
        return APIResponse.success(data=report, message="success")
