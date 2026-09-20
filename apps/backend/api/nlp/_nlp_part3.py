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

@ns_nlp.route("/analysis/intent")
class NLPAnalysisIntent(Resource):

    @ns_nlp.doc("nlp_analysis_intent", description="获取意图识别分析报告")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取意图识别的详细分析报告
        """
        report = nlp_analyzer.get_intent_analysis()
        return APIResponse.success(data=report, message="success")

@ns_nlp.route("/analysis/performance")
class NLPAnalysisPerformance(Resource):

    @ns_nlp.doc("nlp_analysis_performance", description="获取性能分析报告")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取算法性能分析报告
        包括响应时间、缓存命中率等
        """
        report = nlp_analyzer.get_performance_analysis()
        return APIResponse.success(data=report, message="success")

@ns_nlp.route("/analysis/errors")
class NLPAnalysisErrors(Resource):

    @ns_nlp.doc("nlp_analysis_errors", description="获取错误分析报告")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取错误分析报告
        """
        report = nlp_analyzer.get_error_analysis()
        return APIResponse.success(data=report, message="success")

@ns_nlp.route("/analysis/suggestions")
class NLPAnalysisSuggestions(Resource):

    @ns_nlp.doc("nlp_analysis_suggestions", description="获取优化建议")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取基于当前指标的系统优化建议
        """
        suggestions = nlp_analyzer.get_optimization_suggestions()
        return APIResponse.success(data=suggestions, message="success")

@ns_nlp.route("/analysis/reset")
class NLPAnalysisReset(Resource):

    @ns_nlp.doc("nlp_analysis_reset", description="重置所有分析指标")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        """
        重置所有分析指标数据
        """
        nlp_analyzer.reset_metrics()
        return APIResponse.success(message="指标已重置")

@ns_nlp.route("/benchmark/intent-classifier")
class NLPBenchmarkIntentClassifier(Resource):

    @ns_nlp.doc("nlp_benchmark_intent", description="基准测试意图分类器")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        """
        对意图分类器进行基准测试
        测试不同算法在不同场景下的性能
        """
        data = request.get_json() or {}
        iterations = data.get("iterations", 10)

        test_cases = [
            {"text": "给张三加分", "expected": "add"},
            {"text": "李四表现优秀", "expected": "add"},
            {"text": "王五迟到扣分", "expected": "deduct"},
            {"text": "赵六打架", "expected": "deduct"},
            {"text": "小明多少分", "expected": "query"},
            {"text": "查看积分", "expected": "query"},
            {"text": "分数清零", "expected": "reset"},
            {"text": "重置积分", "expected": "reset"},
        ]

        parser = _mod._get_parser()
        classifier = parser.intent_classifier

        results = AlgorithmBenchmark.benchmark_intent_classifier(classifier, test_cases, iterations)

        return APIResponse.success(data=results, message="success")

@ns_nlp.route("/optimization/config")
class NLPOptimizationConfig(Resource):

    @ns_nlp.doc("nlp_optimization_config", description="获取优化配置")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取当前NLP算法优化配置
        """
        config = nlp_optimizer.get_config_summary()
        return APIResponse.success(data=config, message="success")

    @ns_nlp.doc("nlp_optimization_set_config", description="设置优化配置")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        """
        设置NLP算法优化策略
        可选策略: accuracy_first, speed_first, balanced
        """
        data = request.get_json()
        strategy = data.get("strategy", "balanced")

        strategy_map = {
            "accuracy_first": OptimizationStrategy.ACCURACY_FIRST,
            "speed_first": OptimizationStrategy.SPEED_FIRST,
            "balanced": OptimizationStrategy.BALANCED,
        }

        if strategy not in strategy_map:
            return APIResponse.error(message=f"无效的策略: {strategy}")

        optimizer = get_optimizer(strategy)
        config = optimizer.get_config_summary()

        return APIResponse.success(data=config, message="优化策略已更新")

@ns_nlp.route("/optimization/auto-tune")
class NLPOptimizationAutoTune(Resource):

    @ns_nlp.doc("nlp_optimization_auto_tune", description="自动优化参数")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        """
        根据当前性能指标自动优化算法参数
        """
        data = request.get_json() or {}
        target_metric = data.get("target_metric", "accuracy")

        # 获取当前性能指标
        perf_metrics = nlp_analyzer.get_performance_analysis()["summary"]
        intent_metrics = nlp_analyzer.get_intent_analysis()["summary"]

        current_params = {
            "tfidf_max_features": 1000,
            "lr_C": 15,
            "cache_ttl": 300,
        }

        if target_metric == "accuracy":
            current_params["accuracy"] = intent_metrics.get("accuracy", 0.8)
        else:
            current_params["latency"] = perf_metrics.get("avg_processing_time", 100)

        optimized = nlp_optimizer.optimize_parameters(current_params, perf_metrics, target_metric)

        return APIResponse.success(
            data={
                "current_params": current_params,
                "optimized_params": optimized,
                "target_metric": target_metric,
            },
            message="参数优化完成",
        )

@ns_nlp.route("/feedback/record")
class NLPFeedbackRecord(Resource):

    @ns_nlp.doc("nlp_feedback_record", description="记录预测反馈和纠正")
    @requires_permission("score.entry")
    @safe_handle(default_status=400, message="记录失败")
    def post(self):
        """
        记录预测结果反馈和用户纠正，用于持续优化算法（自学习）
        """
        data = request.get_json()
        input_text = data.get("text", "")
        predicted_intent = data.get("predicted_intent", "")
        true_intent = data.get("true_intent")
        confidence = data.get("confidence", 0.0)
        processing_time = data.get("processing_time", 0.0)

        corrected_name = data.get("corrected_name")
        corrected_intent = data.get("corrected_intent")
        corrected_score = data.get("corrected_score")
        original_name = data.get("original_name")
        original_score = data.get("original_score")

        if not input_text:
            return APIResponse.error(message="输入文本不能为空")

        nlp_analyzer.record_intent_prediction(predicted_intent, true_intent, confidence)

        nlp_analyzer.record_performance(processing_time, cache_hit=data.get("cache_hit", False))

        if true_intent and predicted_intent != true_intent:
            nlp_analyzer.record_error(
                "intent_mismatch", input_text, expected=true_intent, predicted=predicted_intent
            )

        # #990: 请求结束前将线程局部缓冲原子提交到全局存储
        nlp_analyzer.flush_request_metrics()

        corrections = _build_feedback_corrections(
            corrected_name, original_name, corrected_intent, predicted_intent, corrected_score, original_score
        )
        if corrections:
            user_id = _resolve_feedback_user_id()
            saved = record_corrections(corrections, user_id, input_text, confidence)

            cache_key = input_text.lower().strip()
            # S6-B-P0-4 修复: nlp_analyzer(NLPAlgorithmAnalyzer) 无 _parse_cache → 纠正对已缓存文本永不生效。
            # 改为清真实解析器（EnhancedNLPParserService）的解析缓存。
            try:
                parser = _mod._get_parser()
                if hasattr(parser, "_parse_cache") and cache_key in parser._parse_cache:
                    del parser._parse_cache[cache_key]
            except Exception:
                logging.getLogger(__name__).warning(
                    "NLP best-effort operation failed; exception previously swallowed silently",
                    exc_info=True,
                )

            return APIResponse.success(
                message="反馈已记录，纠正已保存（自学习生效）",
                data={"corrections_saved": saved},
            )

        return APIResponse.success(message="反馈已记录")

@ns_nlp.route("/corrections")
class NLPCorrectionsList(Resource):

    @ns_nlp.doc("nlp_corrections_list", description="获取纠正记录列表")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取所有纠正记录，支持按状态筛选
        """
        status = request.args.get("status")
        page, per_page = get_pagination(default=20)

        query = NLPCorrection.query
        if status:
            query = query.filter(NLPCorrection.status == status)

        query = query.order_by(NLPCorrection.created_at.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return APIResponse.success(
            data={
                "items": [
                    {
                        "id": c.id,
                        "original_text": c.original_text,
                        "field_type": c.field_type,
                        "original_value": c.original_value,
                        "corrected_value": c.corrected_value,
                        "corrected_by": c.corrected_by,
                        "status": c.status,
                        "confidence_after": c.confidence_after,
                        "learn_count": c.learn_count,
                        "last_learned_at": (
                            c.last_learned_at.isoformat() if c.last_learned_at else None
                        ),
                        "created_at": c.created_at.isoformat(),
                        "verified_at": c.verified_at.isoformat() if c.verified_at else None,
                    }
                    for c in pagination.items
                ],
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
            }
        )

@ns_nlp.route("/corrections/<int:correction_id>")
class NLPCorrectionDetail(Resource):

    @ns_nlp.doc("nlp_correction_update", description="更新纠正记录状态")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def put(self, correction_id):
        """
        更新纠正记录状态（approve/reject）
        """
        data = request.get_json()
        status = data.get("status")

        correction = NLPCorrection.query.get_or_404(correction_id)

        if status in ["approved", "rejected", "learned"]:
            update_correction_status(correction, status)
            return APIResponse.success(message="纠正状态已更新")

        return APIResponse.error(message="无效的状态值")

    @ns_nlp.doc("nlp_correction_delete", description="删除纠正记录")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def delete(self, correction_id):
        """
        删除纠正记录
        """
        correction = NLPCorrection.query.get_or_404(correction_id)
        delete_correction(correction)
        return APIResponse.success(message="纠正记录已删除")

@ns_nlp.route("/performance/monitor")
class NLPPerformanceMonitor(Resource):

    @ns_nlp.doc("nlp_performance_monitor", description="实时性能监控")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """
        获取实时性能监控数据
        """
        _mod._get_parser()
        perf = nlp_analyzer.get_performance_analysis()

        return APIResponse.success(
            data={
                "metrics": perf,
                "optimizer": nlp_optimizer.get_config_summary(),
                "timestamp": datetime.now().isoformat(),
            },
            message="success",
        )

@ns_nlp.route("/parse/with-analysis")
class NLPParseWithAnalysis(Resource):

    @ns_nlp.doc("nlp_parse_with_analysis", description="解析并返回详细分析")
    @requires_permission("score.entry")
    @safe_handle()
    def post(self):
        """
        解析文本并返回详细的算法分析信息
        包括每一步的处理时间和决策原因
        """
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        start_time = time.time()
        components = {}

        parser = _mod._get_parser()
        context_memory = get_context_memory()

        # 记录各组件时间
        t0 = time.time()
        name, _ = parser.extract_name(text)
        components["extract_name"] = time.time() - t0

        t1 = time.time()
        intent, confidence = parser.intent_classifier.predict_intent(text)
        components["intent_classifier"] = time.time() - t1

        t2 = time.time()
        behavior_result = parser.extract_behavior(text, name)
        components["extract_behavior"] = time.time() - t2

        t3 = time.time()
        parser.determine_intent(text, behavior_result)
        components["determine_intent"] = time.time() - t3

        result = parser.parse(text, context_history=context_memory)
        total_time = time.time() - start_time

        components["total"] = total_time

        # 记录分析数据
        nlp_analyzer.record_performance(total_time, components=components)

        nlp_analyzer.record_intent_prediction(
            result.get("intent", ""), confidence=result.get("confidence", 0.0)
        )

        nlp_analyzer.add_request_to_history(
            {
                "text": text,
                "intent": result.get("intent"),
                "confidence": result.get("confidence"),
                "processing_time": total_time,
            }
        )

        # #990: 请求结束前将线程局部缓冲原子提交到全局存储
        nlp_analyzer.flush_request_metrics()

        return APIResponse.success(
            data={
                "result": result,
                "analysis": {
                    "components": components,
                    "total_time": round(total_time, 4),
                    "intent": intent,
                    "intent_confidence": confidence,
                },
            },
            message="success",
        )

@ns_nlp.route("/performance/stats")
class NLPPerformanceStats(Resource):

    @ns_nlp.doc("nlp_performance_stats", description="获取NLP性能统计")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        """获取NLP服务性能统计"""
        optimizer = get_nlp_optimizer()
        stats = optimizer.get_stats()

        return APIResponse.success(data=stats, message="success")

@ns_nlp.route("/performance/warmup")
class NLPPerformanceWarmup(Resource):

    @ns_nlp.doc("nlp_performance_warmup", description="触发NLP模型预热")
    @requires_permission("algorithm.manage")
    @safe_handle(default_status=400, message="预热失败")
    def post(self):
        """手动触发NLP模型预热"""
        warmup_nlp()
        optimizer = get_nlp_optimizer()
        stats = optimizer.get_stats()

        return APIResponse.success(data=stats, message="预热完成")

@ns_nlp.route("/performance/clear-cache")
class NLPPerformanceClearCache(Resource):

    @ns_nlp.doc("nlp_clear_cache", description="清空NLP缓存")
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        """清空NLP解析缓存"""
        optimizer = get_nlp_optimizer()
        optimizer._cache.clear()

        return APIResponse.success(message="缓存已清空")
