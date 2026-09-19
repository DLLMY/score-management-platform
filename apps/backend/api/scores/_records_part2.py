# -*- coding: utf-8 -*-
# part of api/scores/records_routes.py (D2 split)

import logging
from flask import request
from flask_restx import Namespace, Resource, fields
from utils.response import APIResponse
from utils.pagination import get_pagination
from models import ScoreRecord, User, ScoreRule, get_by_id
from utils.permission import (
    requires_permission,
    get_current_admin,
    get_allowed_classes,
    can_access_student,
)
from utils.logger import log_operation
from services.redis_cache_service import get_cache_service
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.class_time_checker import ClassTimeChecker
from services.score_record_service import (
    create_record,
    create_score_entry,
    delete_record,
    commit_batch_score_entry,
    serialize_score_record,
    get_record_statistics_view,
    get_record_list_view,
    get_record_list_by_user_view,
    get_score_entry_view,
)
from services.score_recalc import enqueue_or_recalc_user_score
from datetime import datetime
try:
    from app import csrf_exempt
except ImportError:

    def csrf_exempt(f):
        return f
try:
    from api.system.admin_notifications_routes import create_admin_notification
except ImportError:
    import logging

    def create_admin_notification(**kwargs):
        logging.getLogger(__name__).warning(
            "admin_notifications_routes 导入失败，成绩变动相关的管理员通知被静默丢弃"
        )
        return
from .score_record_orchestration import (
    check_rule_limits,
    _resolve_score_entry_change,
    _compute_rank_change,
    _notify_rank_change,
    _notify_score_change,
    _invalidate_score_caches,
    _recalc_composite_score,
    _resolve_batch_entry_rule,
    _build_batch_record,
    _validate_batch_entry,
    _recalc_composite_scores_after_batch,
)

from api.scores.records_routes import logger, ns_records, record_model, record_list_response, record_statistics_response

@ns_records.route("/score-entry")
class ScoreEntryResource(Resource):

    @ns_records.doc("score_entry_data", description="获取积分录入页面所需数据")
    @ns_records.response(200, "成功")
    @requires_permission("score.entry")
    def get(self):
        """
        获取积分录入页面所需数据

        返回用于积分录入的规则列表和学生列表数据。
        非管理员用户只能看到关联班级的学生。
        权限隔离与数据聚合已下沉到 score_record_service.get_score_entry_view。
        """
        # 尝试从缓存获取
        cache_key = "score_entry_data"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return APIResponse.success(data=cached_result)

        # 权限隔离与数据聚合已下沉到 score_record_service.get_score_entry_view
        admin = get_current_admin()
        view = get_score_entry_view(admin)
        if "error" in view:
            return APIResponse.error(message=view["error"], status_code=view["status"])
        result = view["data"]

        # 缓存结果，有效期5分钟
        get_cache_service().set(cache_key, result, ttl=300)
        return APIResponse.success(data=result)

    @ns_records.doc("create_score_entry", description="创建积分录入记录", security="Bearer")
    @ns_records.response(201, "创建成功")
    @ns_records.response(400, "请求参数错误")
    @ns_records.response(429, "请求过于频繁")
    @requires_permission("score.entry")
    def post(self):
        """
        创建积分录入记录

        批量或单个创建积分记录，支持根据规则ID或直接输入分数。
        非管理员用户只能为关联班级的学生创建记录。

        请求体：
        - user_id: 学生ID（必填）
        - rule_id: 规则ID（与score_change二选一）
        - score_change: 积分变化（与rule_id二选一，正数加分，负数扣分）
        - description: 操作说明
        - operator: 操作人（默认system）
        """
        data = request.get_json()

        user_id = data.get("user_id")
        rule_id = data.get("rule_id")
        score_change = data.get("score_change")
        description = data.get("description")
        operator = data.get("operator", "system")

        # 验证必填参数
        if not user_id:
            return APIResponse.error(message="学生ID不能为空", status_code=400)

        # 数据隔离检查
        if not can_access_student(user_id):
            return APIResponse.error(message="无权为该学生创建记录", status_code=403)

        # 如果提供了规则ID，获取规则对应的分数并检查限制
        ok, message, score_change, description = _resolve_score_entry_change(
            user_id, rule_id, score_change, description
        )
        if not ok:
            return APIResponse.error(message=message, status_code=400)

        # 学生存在性校验 + 排名对比用的 before/after 计算（只读；积分原子累加收口到 service，避免路由侧重复累加）
        user = get_by_id(User, user_id)
        if not user:
            return APIResponse.error(message="学生不存在", status_code=400)

        before_score = user.current_score or 0
        user_name = user.name

        # 使用缓存获取排名规则（仅用于排名变动通知的 before/after 对比，不改写积分）
        before_rank, before_rank_name, after_rank, after_rank_name = _compute_rank_change(
            before_score, score_change
        )

        # 事务收口到 service：排名计算 + 设置积分 + log_operation（commit 前设 operation_log_id）+ add + commit
        result, err = create_score_entry(
            {
                "user_id": user_id,
                "rule_id": rule_id,
                "score_change": score_change,
                "description": description,
                "operator": operator,
            }
        )
        if err:
            return APIResponse.error(message=err, status_code=400)
        record = result["record"]

        # 检查排名是否发生变化，如果变化则发送通知；未变化时返回 None（保持后续通知块的既有失败语义）
        publish_mqtt = _notify_rank_change(
            user,
            user_name,
            user_id,
            before_score,
            score_change,
            before_rank,
            before_rank_name,
            after_rank,
            after_rank_name,
        )

        # 发送积分变动通知到远程客户端（积分窗口显示）
        _notify_score_change(
            publish_mqtt, user, user_name, user_id, rule_id, score_change, description
        )

        # 清除统计缓存
        _invalidate_score_caches()

        # 触发综合评分增量更新
        composite_score_updated, composite_score_status = _recalc_composite_score(user_id)

        return (
            APIResponse.success(
                data={
                    "record_id": record.id,
                    "user_name": user_name,
                    "score_change": score_change,
                    "new_score": user.current_score,
                    "rank_changed": before_rank_name != after_rank_name,
                    "before_rank": before_rank_name,
                    "after_rank": after_rank_name,
                    "composite_score_updated": composite_score_updated,
                    "composite_score": composite_score_status,
                },
                message="积分录入成功",
            ),
            201,
        )

@ns_records.route("/batch-entry")
class BatchScoreEntryResource(Resource):

    @ns_records.doc("batch_score_entry", description="批量积分录入", security="Bearer")
    @ns_records.response(200, "批量录入完成")
    @ns_records.response(400, "请求参数错误")
    @requires_permission("score.entry")
    def post(self):
        """
        批量积分录入

        一次为多个学生录入积分，适用于班级表扬等场景。
        非管理员用户只能为关联班级的学生创建记录。

        请求体：
        - entries: 数组，每项包含：
          - user_id: 学生ID（必填）
          - rule_id: 规则ID（可选）
          - score_change: 积分变化（必填，正数加分，负数扣分）
          - description: 操作说明（可选）
        - operator: 操作人（默认batch_admin）
        """
        data = request.get_json()

        entries = data.get("entries", [])
        operator = data.get("operator", "batch_admin")

        if not entries:
            return APIResponse.error(message="entries不能为空", status_code=400)

        if not isinstance(entries, list):
            return APIResponse.error(message="entries必须是数组", status_code=400)

        results = []
        errors = []
        created_records = []

        # F3 修复: 先做纯校验收集（只读，不修改任何对象/session），失败行零副作用；
        # 全部校验通过后再统一修改 current_score + add + 单次 commit。
        # 原实现行内 add/改分，行内异常仅 except 不 rollback → 失败行的积分变更残留 session，
        # 后续行基于污染值累加，末次 commit 全部落库 → 积分被改但无记录的数据错乱。
        # F12 修复: 权限隔离集合一次性计算（原每条 _can_access_student ≈ 3 次查询 → N 条 3N 次）
        _perm_admin = get_current_admin()
        _allowed_classes = get_allowed_classes(_perm_admin.id) if _perm_admin else None

        for i, entry in enumerate(entries):
            try:
                record_item, err = _validate_batch_entry(entry, i, _allowed_classes, operator)
                if err is not None:
                    errors.append(err)
                    continue
                created_records.append(record_item)
            except Exception as e:
                errors.append({"index": i, "error": str(e)})

        # 批量提交（仅成功行）：事务收口到 service（add + 原子累加 + 单次 commit）
        results, commit_errors = commit_batch_score_entry(created_records)
        errors.extend(commit_errors)

        # 清除统计缓存
        try:
            get_cache_service().invalidate_by_tag("statistics")
        except Exception as e:
            logger.warning("批量录入后清除 statistics 缓存失败: %s", e, exc_info=True)
        invalidate_cache("api:/api/records/*")

        # R4: 批量录入后对涉及学生触发综合评分重算（异步入队，无 broker 时同步回退）
        composite_score_status = _recalc_composite_scores_after_batch(created_records, results)

        status_code = 200 if results else 400
        if not results:
            # 全部失败：返回业务失败（success:False），避免前端只读 body.success 误判成功
            return APIResponse.error(
                message=f"批量录入全部失败，共{len(errors)}条",
                data={"results": results, "errors": errors},
                status_code=status_code,
            )
        return (
            APIResponse.success(
                data={
                    "results": results,
                    "errors": errors,
                    "composite_score": composite_score_status,
                },
                message=f"批量录入完成，成功{len(results)}条，失败{len(errors)}条",
            ),
            status_code,
        )

@ns_records.route("/<int:id>")
@ns_records.param("id", "记录ID")
class RecordResource(Resource):

    @ns_records.doc("get_record", description="获取单个记录详情")
    @ns_records.response(200, "成功", record_model)
    @ns_records.response(404, "记录不存在")
    @requires_permission("score.view")
    def get(self, id):
        """
        获取单个记录详情

        根据记录ID获取积分记录的详细信息。
        非管理员用户只能查看关联班级的学生记录。
        """
        record = ScoreRecord.query.get_or_404(id)
        if not can_access_student(record.student_id):
            return APIResponse.error(message="无权查看该记录", status_code=403)
        # 复用统一序列化（score_record_service.serialize_score_record），消除内联字典重复
        return APIResponse.success(data=serialize_score_record(record))

    @ns_records.doc("delete_record", description="删除积分记录", security="Bearer")
    @ns_records.response(200, "删除成功")
    @ns_records.response(404, "记录不存在")
    @requires_permission("score.delete")
    def delete(self, id):
        """
        删除积分记录

        删除指定的积分记录。删除时会回滚学生的积分。
        非管理员用户只能删除关联班级的学生记录。

        请求体：
        - confirm: 是否确认删除（必填，必须为true）
        """
        record = ScoreRecord.query.get_or_404(id)

        # 数据隔离检查
        if not can_access_student(record.student_id):
            return APIResponse.error(message="无权删除该记录", status_code=403)

        data = request.get_json() or {}
        if not data.get("confirm"):
            user_name = record.user.name if record.user else "未知用户"
            return APIResponse.error(
                message=f'请确认删除操作。即将删除记录：{user_name} {"+" if record.score_change > 0 else ""}{record.score_change}分',
                status_code=400,
                data={
                    "record_info": {
                        **record.to_dict(
                            [
                                "id",
                                "user_id",
                                "user_name",
                                "score_change",
                                "description",
                                "created_at",
                            ]
                        ),
                        "user_name": user_name,
                    },
                    "requires_confirm": True,
                },
            )

        # 复用统一序列化（score_record_service.serialize_score_record），消除内联字典重复
        before_data = serialize_score_record(record)

        # 事务收口到 service：R5 原子回滚积分 + delete + commit
        before_score, after_score, user_name = delete_record(record)

        after_data = (
            {
                "user_id": record.student_id,
                "user_name": user_name,
                "before_score": before_score,
                "after_score": after_score,
                "score_change": -record.score_change,
            }
            if user_name != "未知用户"
            else None
        )

        log_operation(
            operation_type="delete",
            target_type="record",
            target_id=id,
            description=f'删除积分记录: {user_name} {"+" if record.score_change > 0 else ""}{record.score_change}分',
            before_data=before_data,
            after_data=after_data,
        )

        # 清除统计缓存
        try:
            invalidated = get_cache_service().invalidate_by_tag("statistics")
            logger.info(f"[Cache] 删除记录后清除了 {invalidated} 个statistics相关缓存")
        except Exception as e:
            logger.warning(f"[Cache] 清除缓存失败: {e}", exc_info=True)
        invalidate_cache("api:/api/records/*")

        # R4: 删除回滚后触发综合评分重算（异步入队，无 broker 时同步回退）
        composite_score_status = "ok"
        try:
            enqueue_or_recalc_user_score(record.student_id)
        except Exception as e:
            logger.error(
                "删除记录后综合评分重算失败 record=%s student_id=%s: %s",
                id,
                record.student_id,
                e,
                exc_info=True,
            )
            composite_score_status = "recalculate_failed"

        logger.info(
            f"[Record] 删除记录: id={id}, user={user_name}, score_change={record.score_change}"
        )

        return APIResponse.success(
            data={
                "rollback_score": -record.score_change,
                "composite_score": composite_score_status,
            },
            message="记录删除成功",
        )
