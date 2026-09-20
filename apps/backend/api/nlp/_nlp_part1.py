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

@ns_nlp.route("/parse")
class NLPParse(Resource):

    @ns_nlp.doc("nlp_parse", description="解析自然语言文本")
    @ns_nlp.expect(parse_input_model)
    @ns_nlp.response(200, "成功", parse_output_model)
    @requires_permission("score.entry")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        optimizer = get_nlp_optimizer()
        parser = _mod._get_parser()
        context_memory = get_context_memory()

        result = optimizer.parse_with_cache(
            text, lambda t: parser.parse(t, context_history=context_memory)
        )

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/execute")
class NLPExecute(Resource):

    @ns_nlp.doc("nlp_execute", description="执行评分")
    @ns_nlp.expect(execute_input_model)
    @requires_permission("score.entry")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")
        manual_correction = data.get("manual_correction")

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        parser = _mod._get_parser()
        context_memory = get_context_memory()
        result = parser.execute_scoring(
            text, manual_correction, context_history=context_memory
        )

        if result["success"]:
            if result.get("parse_result"):
                user_name = result["parse_result"].get("extracted_name")
                rule_id = result["parse_result"].get("matched_rules", [{}])[0].get("rule_id")
                intent = result["parse_result"].get("intent")

                if user_name:
                    context_memory["recent_users"] = [
                        u for u in context_memory["recent_users"] if u != user_name
                    ]
                    context_memory["recent_users"].append(user_name)
                    if len(context_memory["recent_users"]) > context_memory["max_memory_size"]:
                        context_memory["recent_users"].pop(0)

                if rule_id:
                    context_memory["recent_rules"] = [
                        r for r in context_memory["recent_rules"] if r != rule_id
                    ]
                    context_memory["recent_rules"].append(rule_id)
                    if len(context_memory["recent_rules"]) > context_memory["max_memory_size"]:
                        context_memory["recent_rules"].pop(0)

                if intent:
                    context_memory["recent_intents"] = [
                        i for i in context_memory["recent_intents"] if i != intent
                    ]
                    context_memory["recent_intents"].append(intent)
                    if len(context_memory["recent_intents"]) > context_memory["max_memory_size"]:
                        context_memory["recent_intents"].pop(0)

                save_context_memory(context_memory)

            return APIResponse.success(data=result, message="评分成功")
        return APIResponse.error(message=result["message"], data=result)

@ns_nlp.route("/batch-parse")
class NLPPBatchParse(Resource):

    @ns_nlp.doc("nlp_batch_parse", description="批量解析自然语言文本")
    @requires_permission("score.entry")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        texts = data.get("texts", [])

        if not texts:
            return APIResponse.error(message="文本列表不能为空")

        optimizer = get_nlp_optimizer()
        parser = _mod._get_parser()

        results = optimizer.batch_parse(texts, lambda t: parser.parse(t))

        return APIResponse.success(data=results, message="success")

@ns_nlp.route("/sentiment")
class NLPSentiment(Resource):

    @ns_nlp.doc("nlp_sentiment", description="情感分析")
    @ns_nlp.expect(parse_input_model)
    @requires_permission("algorithm.view")
    @inference_slot_guard
    @safe_handle()
    def post(self):
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return APIResponse.error(message="输入文本不能为空")

        parser = _mod._get_parser()
        result = parser.analyze_sentiment(text)

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/rules")
class NLPRuleList(Resource):

    @ns_nlp.doc("nlp_get_rules", description="获取规则列表")
    @ns_nlp.param("page", "页码")
    @ns_nlp.param("per_page", "每页数量")
    @ns_nlp.param("keyword", "关键词")
    @ns_nlp.param("score_type", "评分类型")
    @ns_nlp.param("sort_by", "排序字段")
    @ns_nlp.param("sort_order", "排序顺序")
    @requires_permission("rule.view")
    @cached_api(ttl=30)
    @safe_handle()
    def get(self):
        page, per_page = get_pagination(default=20)
        keyword = request.args.get("keyword")
        score_type = request.args.get("score_type")
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = request.args.get("sort_order", "desc")

        service = NLPRuleManagementService()
        result = service.get_rules(
            page, per_page, keyword, score_type, sort_by, sort_order
        )

        return APIResponse.success(data=result, message="success")

    @ns_nlp.doc("nlp_create_rule", description="创建评分规则")
    @ns_nlp.expect(rule_model)
    @requires_permission("rule.manage")
    @safe_handle()
    def post(self):
        data = request.get_json()

        required_fields = ["behavior_keyword", "score_value", "score_type"]
        for field in required_fields:
            if field not in data:
                return APIResponse.error(message=f"{field}不能为空")

        service = NLPRuleManagementService()
        result = service.create_rule(data)

        if result["success"]:
            return APIResponse.success(data=result, message="规则创建成功")
        return APIResponse.error(message=result["message"], data=result)

@ns_nlp.route("/rules/<int:rule_id>")
class NLPRule(Resource):

    @ns_nlp.doc("nlp_get_rule", description="获取单个规则")
    @requires_permission("rule.view")
    @safe_handle()
    def get(self, rule_id):
        service = NLPRuleManagementService()
        result = service.get_rule(rule_id)

        if result:
            return APIResponse.success(data=result, message="success")
        return APIResponse.error(message="规则不存在")

    @ns_nlp.doc("nlp_update_rule", description="更新评分规则")
    @requires_permission("rule.manage")
    @safe_handle()
    def put(self, rule_id):
        data = request.get_json()
        service = NLPRuleManagementService()
        result = service.update_rule(rule_id, data)

        if result["success"]:
            invalidate_cache("api:/api/nlp/*")
            return APIResponse.success(data=result, message="规则更新成功")
        return APIResponse.error(message=result["message"])

    @ns_nlp.doc("nlp_delete_rule", description="删除评分规则")
    @requires_permission("rule.manage")
    @safe_handle()
    def delete(self, rule_id):
        service = NLPRuleManagementService()
        result = service.delete_rule(rule_id)

        if result["success"]:
            invalidate_cache("api:/api/nlp/*")
            return APIResponse.success(message="规则删除成功")
        return APIResponse.error(message=result["message"])

@ns_nlp.route("/rules/<int:rule_id>/usage")
class NLPRuleUsage(Resource):

    @ns_nlp.doc("nlp_get_rule_usage", description="获取规则使用记录")
    @ns_nlp.param("page", "页码")
    @ns_nlp.param("per_page", "每页数量")
    @requires_permission("rule.view")
    @safe_handle()
    def get(self, rule_id):
        page, per_page = get_pagination(default=20)

        service = NLPRuleManagementService()
        result = service.get_rule_usage(rule_id, page, per_page)

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/rules/statistics")
class NLPRuleStatistics(Resource):

    @ns_nlp.doc("nlp_get_statistics", description="获取规则统计信息")
    @requires_permission("rule.view")
    @cached_api(ttl=60)
    @safe_handle()
    def get(self):
        service = NLPRuleManagementService()
        result = service.get_rule_statistics()

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/rules/suggest")
class NLPRuleSuggest(Resource):

    @ns_nlp.doc("nlp_suggest_rules", description="推荐相似规则")
    @ns_nlp.param("keyword", "行为关键词")
    @requires_permission("rule.view")
    @safe_handle()
    def get(self):
        keyword = request.args.get("keyword", "")

        if not keyword:
            return APIResponse.error(message="关键词不能为空")

        service = NLPRuleManagementService()
        result = service.suggest_similar_rules(keyword)

        return APIResponse.success(data=result, message="success")

@ns_nlp.route("/rules/batch-import")
class NLPRuleBatchImport(Resource):

    @ns_nlp.doc("nlp_batch_import_rules", description="批量导入规则")
    @requires_permission("rule.manage")
    @safe_handle()
    def post(self):
        data = request.get_json()
        rules_data = data.get("rules", [])

        if not rules_data:
            return APIResponse.error(message="规则数据不能为空")

        service = NLPRuleManagementService()
        result = service.batch_import_rules(rules_data)

        if result["success"]:
            invalidate_cache("api:/api/nlp/*")
            return APIResponse.success(data=result, message=result["message"])
        return APIResponse.error(message=result["message"])

@ns_nlp.route("/model/train")
class NLPModelTrain(Resource):
    """训练规则匹配模型（单算法）。

    2026-08-26 #912 实机修复：单算法训练 + 调参/交叉验证同样分钟级，前端 30s
    必超时 504。与 train-all 统一异步化：POST 立即返回 task_id，轮询
    GET /api/nlp/model/train/status。train 与 train-all 共享 running 互斥。
    """

    @ns_nlp.doc("nlp_train_model", description="训练规则匹配模型（异步，返回 task_id 后轮询状态）")
    @ns_nlp.expect(train_input_model)
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        data = request.get_json() or {}
        trained_by = data.get("trained_by")
        algorithm = data.get("algorithm")
        use_cross_validation = data.get("use_cross_validation", False)
        use_hyperparameter_tuning = data.get("use_hyperparameter_tuning", False)
        tuning_method = data.get("tuning_method", "random")

        with _mod._train_lock:
            _break_stale_training_tasks()
            if any(t["status"] == "running" for t in _mod._train_tasks.values()):
                return APIResponse.success(
                    data={"status": "already_running"},
                    message="已有训练任务正在进行中，请稍后再试",
                )
            now = time.time()
            expired = [
                tid
                for tid, t in _mod._train_tasks.items()
                if t["status"] != "running" and (now - t["finished_at"]) > 3600
            ]
            for tid in expired:
                _mod._train_tasks.pop(tid, None)
            task_id = f"train-{next(_mod._train_seq)}"
            _mod._train_tasks[task_id] = {
                "kind": "single",
                "status": "running",
                "result": None,
                "error": None,
                "created_at": datetime.utcnow().isoformat(),
                "finished_at": None,
            }

        def _run():
            try:
                # current_app 是 ContextVar proxy，后台线程不继承请求上下文，
                # 必须用请求内捕获的真实 app 对象建新上下文
                with _train_app.app_context():
                    ml_service = _mod._get_ml_service()
                    result = ml_service.train(
                        algorithm,
                        trained_by,
                        use_cross_validation,
                        use_hyperparameter_tuning,
                        tuning_method,
                    )
                # 熔断保护：若外部已将该任务熔断为 error，不再覆盖状态
                if _mod._train_tasks[task_id]["status"] != "error":
                    _mod._train_tasks[task_id]["result"] = result
                    _mod._train_tasks[task_id]["status"] = "done"
            except Exception as exc:  # 训练异常必须落状态，避免前端轮询永远 running
                logger.error("train 后台任务异常: %s", exc, exc_info=True)
                if _mod._train_tasks[task_id]["status"] != "error":
                    _mod._train_tasks[task_id]["error"] = str(exc)
                    _mod._train_tasks[task_id]["status"] = "error"
            finally:
                _mod._train_tasks[task_id]["finished_at"] = time.time()

        _train_app = current_app._get_current_object()

        threading.Thread(target=_run, name=f"train-{task_id}", daemon=True).start()
        return APIResponse.success(
            data={"task_id": task_id, "status": "started"},
            message="训练任务已启动",
        )

@ns_nlp.route("/model/train/status")
class NLPModelTrainStatus(Resource):

    @ns_nlp.doc("nlp_train_status", description="查询单算法训练异步任务状态")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        task_id = request.args.get("task_id")
        if not task_id:
            return APIResponse.error(message="缺少 task_id 参数")
        task = _mod._train_tasks.get(task_id)
        if not task:
            return APIResponse.error(message="训练任务不存在或已过期")
        return APIResponse.success(
            data={
                "status": task["status"],
                "result": task["result"],
                "error": task["error"],
            },
            message="查询成功",
        )

@ns_nlp.route("/model/train-all")
class NLPModelTrainAll(Resource):
    """训练所有算法并自动选择最佳模型。

    2026-08-26 #912 实机修复：train-all 是分钟级同步训练（全部算法 + 交叉验证，
    含 BERT 等重模型），前端 fetch 30s 必超时 504。改为后台线程异步执行 +
    状态轮询端点（GET /api/nlp/model/train-all/status）。任务状态存进程内 dict
    （开发/单进程部署安全；若将来多 worker 需迁移 Redis/DB）。
    """

    @ns_nlp.doc(
        "nlp_train_all_models",
        description="训练所有算法并自动选择最佳模型（异步，返回 task_id 后轮询状态）",
    )
    @requires_permission("algorithm.manage")
    @safe_handle()
    def post(self):
        data = request.get_json() or {}
        trained_by = data.get("trained_by")

        with _mod._train_lock:
            _break_stale_training_tasks()
            if any(t["status"] == "running" for t in _mod._train_tasks.values()):
                return APIResponse.success(
                    data={"status": "already_running"},
                    message="已有训练任务正在进行中，请稍后再试",
                )
            # 惰性清理 1 小时前的终态任务，避免 dict 无限增长
            now = time.time()
            expired = [
                tid
                for tid, t in _mod._train_tasks.items()
                if t["status"] != "running" and (now - t["finished_at"]) > 3600
            ]
            for tid in expired:
                _mod._train_tasks.pop(tid, None)
            task_id = f"trainall-{next(_mod._train_seq)}"
            _mod._train_tasks[task_id] = {
                "kind": "all",
                "status": "running",
                "result": None,
                "error": None,
                "created_at": datetime.utcnow().isoformat(),
                "finished_at": None,
            }

        def _run():
            try:
                # current_app 是 ContextVar proxy，后台线程不继承请求上下文，
                # 必须用请求内捕获的真实 app 对象建新上下文
                with _train_app.app_context():
                    ml_service = _mod._get_ml_service()
                    result = ml_service.train_all(trained_by)
                # 熔断保护：若外部已将该任务熔断为 error，不再覆盖状态
                if _mod._train_tasks[task_id]["status"] != "error":
                    _mod._train_tasks[task_id]["result"] = result
                    _mod._train_tasks[task_id]["status"] = "done"
            except Exception as exc:  # 训练异常必须落状态，避免前端轮询永远 running
                logger.error("train_all 后台任务异常: %s", exc, exc_info=True)
                if _mod._train_tasks[task_id]["status"] != "error":
                    _mod._train_tasks[task_id]["error"] = str(exc)
                    _mod._train_tasks[task_id]["status"] = "error"
            finally:
                _mod._train_tasks[task_id]["finished_at"] = time.time()

        _train_app = current_app._get_current_object()

        threading.Thread(target=_run, name=f"train-all-{task_id}", daemon=True).start()
        return APIResponse.success(
            data={"task_id": task_id, "status": "started"},
            message="训练任务已启动",
        )

@ns_nlp.route("/model/train-all/status")
class NLPModelTrainAllStatus(Resource):

    @ns_nlp.doc("nlp_train_all_status", description="查询 train-all 异步训练任务状态")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        task_id = request.args.get("task_id")
        if not task_id:
            return APIResponse.error(message="缺少 task_id 参数")
        task = _mod._train_tasks.get(task_id)
        if not task:
            return APIResponse.error(message="训练任务不存在或已过期")
        return APIResponse.success(
            data={
                "status": task["status"],
                "result": task["result"],
                "error": task["error"],
            },
            message="查询成功",
        )

@ns_nlp.route("/model/algorithms")
class NLPModelAlgorithms(Resource):

    @ns_nlp.doc("nlp_get_algorithms", description="获取可用算法列表")
    @requires_permission("algorithm.view")
    @cached_api(ttl=60)
    @safe_handle()
    def get(self):
        ml_service = _mod._get_ml_service()
        algorithms = ml_service.get_available_algorithms()

        return APIResponse.success(data=algorithms, message="获取成功")

@ns_nlp.route("/model/evaluate-all")
class NLPModelEvaluateAll(Resource):

    @ns_nlp.doc("nlp_evaluate_all_models", description="评估所有算法性能")
    @requires_permission("algorithm.view")
    @safe_handle()
    def get(self):
        ml_service = _mod._get_ml_service()
        result = ml_service.evaluate_all()

        if result["success"]:
            return APIResponse.success(data=result, message="评估完成")
        return APIResponse.error(message=result["message"], data=result)
