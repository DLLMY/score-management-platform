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

logger = logging.getLogger(__name__)

ns_nlp = Namespace("nlp", description="NLP智能评分规则管理")

# M10: NLP 推理并发闸门——BERT/jieba 推理是 CPU/内存重型操作，无限制并发会占满
# HTTP worker（报告 PF6）。同一时刻最多 MAX_INFERENCE_CONCURRENCY 个推理在跑，
# 超出直接返回 503（"推理服务繁忙"），前端已有重试/友好提示。获取信号量须在
# 线程锁内（acquire(blocking=False) 失败立即释放，避免计数器泄漏）。
MAX_INFERENCE_CONCURRENCY = 4
_inference_semaphore = threading.BoundedSemaphore(MAX_INFERENCE_CONCURRENCY)

# NLP 训练异步任务存储（进程内 dict）：task_id -> {kind, status, result, error, created_at, finished_at}
# status: running | done | error；result 为 train/train_all 完整返回。
# 2026-08-26 #912：train 与 train-all 均为分钟级同步训练，前端 30s 必超时，
# 统一改为后台线程异步 + 状态轮询端点；共享 running 互斥避免并发训练占满资源。
_train_tasks = {}
_train_lock = threading.Lock()
_train_seq = itertools.count(1)

# 训练任务最长运行时间：超过视为僵尸（可能卡死），熔断为 error 允许新任务接管。
# 万级样本 + 全算法（含 BERT/textcnn 深度学习）训练可能超过 10 分钟，放宽到 30 分钟。
TRAIN_TASK_MAX_RUNNING_SECONDS = 30 * 60

def _break_stale_training_tasks(now=None):
    """running 超过 30 分钟的任务置为 error（熔断），允许新训练任务接管。

    原线程完成/异常后受 _run 的 error 保护不会再覆盖熔断状态（避免僵尸任务
    无限占用互斥锁导致前端永远 already_running）。调用方须持有 _train_lock。
    """
    now = time.time() if now is None else now
    for _tid, t in _train_tasks.items():
        if t["status"] == "running" and t["finished_at"] is None:
            try:
                created_ts = datetime.fromisoformat(t["created_at"]).timestamp()
            except (ValueError, TypeError):
                created_ts = now
            if now - created_ts > TRAIN_TASK_MAX_RUNNING_SECONDS:
                t["status"] = "error"
                t["error"] = "训练超时熔断（超过 30 分钟），任务已终止，请重新发起训练"
                t["finished_at"] = now

def _get_parser():
    """M10: 延迟加载 NLP 解析器（torch 链约 22s，首次调用时才导入，避免拖慢启动）"""
    from services.nlp_enhanced_service import get_nlp_parser

    return get_nlp_parser()

def _get_ml_service():
    """M10: 延迟加载 NLP ML 服务（torch 链约 24s，首次调用时才导入，避免拖慢启动）"""
    from services.nlp_ml_service import NLPMLTrainingService

    return NLPMLTrainingService()

def _acquire_inference_slot():
    """尝试获取推理槽位；成功返回释放函数，繁忙返回 None。"""
    if _inference_semaphore.acquire(blocking=False):
        return _inference_semaphore.release
    return None

def inference_slot_guard(f):
    """推理端点装饰器：槽位繁忙时立即返回 503，不排队占满 worker。"""
    from functools import wraps

    @wraps(f)
    def wrapper(*args, **kwargs):
        release = _acquire_inference_slot()
        if release is None:
            return APIResponse.error(
                message="推理服务繁忙，请稍后重试",
                error_code="INFERENCE_BUSY",
                status_code=503,
            )
        try:
            return f(*args, **kwargs)
        finally:
            release()

    return wrapper

def get_context_memory():
    try:
        cache = get_cache_service()
        memory_data = cache.get("nlp_context_memory")
        if memory_data:
            if isinstance(memory_data, dict):
                return memory_data
            return json.loads(memory_data)
    except Exception as e:
        logger.warning(f"[DEBUG] get_context_memory error: {e}", exc_info=True)
    return {
        "recent_users": [],
        "recent_rules": [],
        "recent_intents": [],
        "max_memory_size": 10,
    }

def save_context_memory(memory):
    try:
        cache = get_cache_service()
        cache.set("nlp_context_memory", memory, ttl=3600)
    except Exception as e:
        logger.warning(f"[DEBUG] save_context_memory error: {e}", exc_info=True)

parse_input_model = ns_nlp.model(
    "ParseInput",
    {
        "text": fields.String(required=True, description="自然语言输入文本"),
    },
)

parse_output_model = ns_nlp.model(
    "ParseOutput",
    {
        "success": fields.Boolean(description="解析是否成功"),
        "input_text": fields.String(description="原始输入文本"),
        "extracted_name": fields.String(description="提取的学生姓名"),
        "user_id": fields.Integer(description="学生ID"),
        "behavior": fields.String(description="行为描述"),
        "intent": fields.String(description="评分意图(add/deduct/unknown)"),
        "confidence": fields.Float(description="匹配置信度"),
        "positive_count": fields.Integer(description="正向关键词数量"),
        "negative_count": fields.Integer(description="负向关键词数量"),
        "matched_rules": fields.List(
            fields.Nested(
                ns_nlp.model(
                    "MatchedRule",
                    {
                        "rule_id": fields.Integer,
                        "behavior_keyword": fields.String,
                        "behavior_description": fields.String,
                        "score_value": fields.Float,
                        "score_type": fields.String,
                        "behavior_tags": fields.List(fields.String),
                        "match_pattern": fields.String,
                        "priority": fields.Integer,
                        "usage_count": fields.Integer,
                        "accuracy_rate": fields.Float,
                        "match_confidence": fields.Float,
                    },
                )
            )
        ),
        "suggestions": fields.List(
            fields.Nested(
                ns_nlp.model(
                    "Suggestion",
                    {
                        "intent": fields.String,
                        "score_value": fields.Float,
                        "description": fields.String,
                        "rule_id": fields.Integer,
                        "similarity": fields.Float,
                    },
                )
            )
        ),
    },
)

rule_model = ns_nlp.model(
    "ScoringRule",
    {
        "behavior_keyword": fields.String(required=True, description="行为关键词"),
        "behavior_description": fields.String(description="行为描述"),
        "score_value": fields.Float(required=True, description="分数值"),
        "score_type": fields.String(required=True, description="评分类型(add/deduct)"),
        "behavior_tags": fields.List(fields.String, description="行为标签"),
        "match_pattern": fields.String(description="匹配模式"),
        "priority": fields.Integer(description="优先级"),
        "created_by": fields.Integer(description="创建者ID"),
    },
)

execute_input_model = ns_nlp.model(
    "ExecuteInput",
    {
        "text": fields.String(required=True, description="自然语言输入文本"),
        "manual_correction": fields.Nested(
            ns_nlp.model(
                "ManualCorrection",
                {
                    "intent": fields.String(description="手动指定意图"),
                    "score_value": fields.Float(description="手动指定分数"),
                    "behavior_tags": fields.List(fields.String, description="行为标签"),
                    "behavior_description": fields.String(description="行为描述"),
                    "created_by": fields.Integer(description="创建者ID"),
                    "feedback_note": fields.String(description="反馈备注"),
                },
            )
        ),
    },
)

train_input_model = ns_nlp.model(
    "TrainInput",
    {
        "trained_by": fields.Integer(description="训练者ID"),
        "algorithm": fields.String(description="算法类型"),
        "use_cross_validation": fields.Boolean(description="是否使用交叉验证", default=False),
        "use_hyperparameter_tuning": fields.Boolean(
            description="是否使用超参数优化", default=False
        ),
        "tuning_method": fields.String(description="优化方法(grid/random)", default="random"),
    },
)

# ==================== 算法分析与优化 API ====================

def _build_feedback_corrections(corrected_name, original_name, corrected_intent, predicted_intent, corrected_score, original_score):
    """构造反馈纠正列表（保留逐一比较语义）。"""
    corrections = []
    if corrected_name and corrected_name != original_name:
        corrections.append(
            {
                "field_type": "name",
                "original_value": original_name,
                "corrected_value": corrected_name,
            }
        )
    if corrected_intent and corrected_intent != predicted_intent:
        corrections.append(
            {
                "field_type": "intent",
                "original_value": predicted_intent,
                "corrected_value": corrected_intent,
            }
        )
    if corrected_score is not None and corrected_score != original_score:
        corrections.append(
            {
                "field_type": "score",
                "original_value": str(original_score) if original_score else None,
                "corrected_value": str(corrected_score),
            }
        )
    return corrections

def _resolve_feedback_user_id():
    """best-effort 获取当前用户 ID（非致命）。"""
    try:
        if hasattr(g, "current_user") and g.current_user:
            return g.current_user.id
    except Exception as e:
        logger.warning("获取 current_user 失败（非致命，已跳过用户关联）: %s", e, exc_info=True)
    return None

import api.nlp._nlp_part1
import api.nlp._nlp_part2
import api.nlp._nlp_part3
