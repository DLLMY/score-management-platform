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

logger = logging.getLogger(__name__)

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
def check_rule_limits(user_id, rule_id):
    """
    检查规则的每日上限和最小间隔限制

    Args:
        user_id (int): 用户ID
        rule_id (int): 规则ID

    Returns:
        tuple: (是否通过校验, 错误信息)
    """
    rule = get_by_id(ScoreRule, rule_id)
    if not rule:
        return True, None

    now = datetime.now()
    today_start = datetime.combine(now.date(), datetime.min.time())

    if rule.daily_limit > 0:
        today_count = ScoreRecord.query.filter(
            ScoreRecord.student_id == user_id,
            ScoreRecord.rule_id == rule_id,
            ScoreRecord.created_at >= today_start,
        ).count()
        if today_count >= rule.daily_limit:
            return False, f"该规则今日已使用{today_count}次，达到上限{rule.daily_limit}次"

    if rule.min_interval > 0:
        # F1 修复: Query 对象恒真，须 .first() 取记录，否则 last_record.created_at 抛 AttributeError → 500
        last_record = (
            ScoreRecord.query.filter(
                ScoreRecord.student_id == user_id, ScoreRecord.rule_id == rule_id
            )
            .order_by(ScoreRecord.created_at.desc())
            .first()
        )
        if last_record:
            time_diff = (now - last_record.created_at).total_seconds()
            if time_diff < rule.min_interval:
                remaining = int(rule.min_interval - time_diff)
                return False, f"距离上次使用该规则还需{remaining}秒"

    return True, None
def _resolve_score_entry_change(user_id, rule_id, score_change, description):
    """解析积分录入的规则分支（只读校验，不写 session）。

    返回 (ok, message, score_change, description)。ok 为 False 时 message 为 400 文案。
    与原实现一致：提供 rule_id 时以规则分值覆盖 score_change，并在未给出说明时补默认说明；
    未提供 rule_id 时必须显式给出 score_change。
    """
    if rule_id:
        rule = get_by_id(ScoreRule, rule_id)
        if not rule:
            return False, "规则不存在", score_change, description
        is_allowed, limit_message = check_rule_limits(user_id, rule_id)
        if not is_allowed:
            return False, limit_message, score_change, description
        score_change = rule.score
        if not description:
            description = f"执行规则: {rule.name}"
    elif score_change is None:
        return False, "必须提供规则ID或积分变化", score_change, description
    return True, None, score_change, description
def _compute_rank_change(before_score, score_change):
    """计算积分变动前后的排名（只读；不改写积分）。

    返回 (before_rank, before_rank_name, after_rank, after_rank_name)。
    """
    from api.scores.rank_routes import (
        _find_rank_by_score_binary_search,
        _get_active_rank_rules_cached,
    )

    before_rules = _get_active_rank_rules_cached()
    before_rank = _find_rank_by_score_binary_search(before_rules, before_score)
    before_rank_name = before_rank.get("name") if before_rank else "无等级"

    # 仅预测变动后排名（基于 before_score + score_change，不改积分）
    after_rank = _find_rank_by_score_binary_search(before_rules, before_score + score_change)
    after_rank_name = after_rank.get("name") if after_rank else "无等级"
    return before_rank, before_rank_name, after_rank, after_rank_name
def _notify_rank_change(
    user,
    user_name,
    user_id,
    before_score,
    score_change,
    before_rank,
    before_rank_name,
    after_rank,
    after_rank_name,
):
    """排名发生变化时发送 MQTT 通知（失败仅告警），并返回已导入的 publish_mqtt。

    原实现在本块内做局部 ``from api.monitoring.mqtt_routes import publish_mqtt``，该名字在
    调用方作用域供后续积分变动通知复用。这里把绑定结果显式返回，以逐字保持
    「排名未变化（或 import 失败）时后续通知块引用到未绑定名」的既有语义。
    """
    if before_rank_name == after_rank_name:
        return None
    publish_mqtt = None
    try:
        from api.monitoring.mqtt_routes import publish_mqtt

        # 支持字典和对象两种格式
        rank_icon = (
            after_rank.get("icon")
            if isinstance(after_rank, dict)
            else getattr(after_rank, "icon", "Minus")
        )
        rank_color = (
            after_rank.get("color")
            if isinstance(after_rank, dict)
            else getattr(after_rank, "color", "#9CA3AF")
        )
        notification = {
            "type": "rank_change",
            "user_id": user_id,
            "user_name": user_name,
            "card_id": user.card_id,
            "before_score": before_score,
            "after_score": user.current_score,
            "score_change": score_change,
            "before_rank": before_rank_name,
            "after_rank": after_rank_name,
            "rank_icon": rank_icon or "Minus",
            "rank_color": rank_color or "#9CA3AF",
            "timestamp": datetime.now().isoformat(),
        }
        publish_mqtt("phonebox/rank_change", notification)
        publish_mqtt(f"phonebox/rank_change/{user.card_id}", notification)
        logger.info(
            f"[Rank] 排名变动通知已发送: {user_name} {before_rank_name} -> {after_rank_name}"
        )
    except Exception as e:
        logger.warning(f"[Rank] 发送排名变动通知失败: {e}", exc_info=True)
    return publish_mqtt
def _notify_score_change(publish_mqtt_fn, user, user_name, user_id, rule_id, score_change, description):
    """发送积分变动通知（远程客户端积分窗口 + 管理员通知）；失败仅告警。

    ``publish_mqtt_fn`` 由 :func:`_notify_rank_change` 返回（可为 None）。与原实现一致，
    仅当它非 None 时才把局部变量 ``publish_mqtt`` 绑定起来，因此在排名未变化（或前一块
    import 失败）时，下方 ``if allowed:`` 分支里的 ``publish_mqtt(...)`` 会抛
    UnboundLocalError 并被 except 吞掉 —— 这是既有行为（含副作用发生位置），
    不在本次纯复杂度重构中改变。
    """
    try:
        if publish_mqtt_fn is not None:
            publish_mqtt = publish_mqtt_fn

        # 构建积分变化消息文本
        score_change_str = f"{score_change:+g}" if score_change > 0 else str(score_change)
        text_parts = [
            f"学生:{user_name}",
            f"{score_change_str}分",
            f"原因:{description or '积分变动'}",
        ]
        # 如果有规则名称，添加到原因中
        if rule_id:
            rule = get_by_id(ScoreRule, rule_id)
            if rule and rule.name:
                text_parts[2] = f"原因:{rule.name}"

        score_change_text = ", ".join(text_parts)

        allowed, check_message, reason_code, rule_info = ClassTimeChecker.is_notification_allowed(
            target_class_info_id=getattr(user, "class_info_id", None), force_send=False
        )
        if allowed:
            score_notification = {
                "type": "score_change",
                "text": score_change_text,
                "popup": True,
                "timestamp": datetime.now().isoformat(),
            }
            publish_mqtt("phonebox/remote/notify", score_notification)
            logger.info(f"[ScoreChange] 积分变动通知已发送: {score_change_text}")
        else:
            ClassTimeChecker.log_notify_audit(
                "score_change",
                getattr(user, "class_info_id", None),
                None,
                {"text": score_change_text},
                reason_code or "GLOBAL_TIME_RULE",
                check_message,
                force_send=False,
            )
            logger.info(f"[ScoreChange] 积分变动通知被拦截（上课时间）: {score_change_text}")

        create_admin_notification(
            title="积分变动通知",
            message=score_change_text,
            notify_type="success" if (score_change or 0) > 0 else "warning",
            priority="medium",
            extra_data={
                "user_id": user_id,
                "user_name": user_name,
                "score_change": score_change,
                "rule_id": rule_id,
                "description": description,
            },
        )
    except Exception as e:
        logger.warning(f"[ScoreChange] 发送积分变动通知失败: {e}", exc_info=True)
def _invalidate_score_caches():
    """清除 statistics 相关缓存（失败仅告警）。"""
    try:
        invalidated = get_cache_service().invalidate_by_tag("statistics")
        logger.info(f"[Cache] 积分录入后清除了 {invalidated} 个statistics相关缓存")
    except Exception as e:
        logger.warning(f"[Cache] 清除缓存失败: {e}", exc_info=True)
    invalidate_cache("api:/api/records/*")
def _recalc_composite_score(user_id):
    """触发单个用户综合评分增量更新，返回 (是否已更新, 状态)。"""
    updated = False
    status = "ok"
    try:
        from services.score_recalc import enqueue_or_recalc_user_score

        result = enqueue_or_recalc_user_score(user_id)
        if result:
            updated = True
            logger.info(
                f"[CompositeScore] 用户{user_id}综合评分已更新: {result.get('composite_score')}"
            )
    except Exception as e:
        logger.warning(f"[CompositeScore] 综合评分更新失败: {e}", exc_info=True)
        status = "recalculate_failed"
    return updated, status
def _resolve_batch_entry_rule(rule_id, description, score_change):
    """解析批量录入单行的规则分支。返回 (ok, message, rule, score_change, description)。"""
    if rule_id:
        rule = get_by_id(ScoreRule, rule_id)
        if not rule:
            return False, f"规则{rule_id}不存在", None, score_change, description
        if description is None:
            description = f"执行规则: {rule.name}"
        score_change = rule.score
        return True, None, rule, score_change, description
    return True, None, None, score_change, description
def _build_batch_record(user, user_id, rule_id, score_change, description, operator):
    """构造批量录入的记录对象与目标分值（不写 session）。返回 (record, new_score)。"""
    record = ScoreRecord(
        student_id=user_id,
        rule_id=rule_id,
        score_change=score_change,
        description=description,
        operator=operator,
    )
    return record, (user.current_score or 0) + score_change
def _validate_batch_entry(entry, index, allowed_classes, operator):
    """校验批量录入单条 entry（只读，不写 session）。

    返回 (record_item, error)：成功时 error 为 None，失败时 record_item 为 None。
    """
    user_id = entry.get("user_id")
    rule_id = entry.get("rule_id")
    score_change = entry.get("score_change")
    description = entry.get("description")

    if not user_id:
        return None, {"index": index, "error": "user_id不能为空"}

    if score_change is None:
        return None, {"index": index, "error": "score_change不能为空"}

    # 处理规则
    ok, message, rule, score_change, description = _resolve_batch_entry_rule(
        rule_id, description, score_change
    )
    if not ok:
        return None, {"index": index, "error": message}

    # 验证学生存在
    user = get_by_id(User, user_id)
    if not user:
        return None, {"index": index, "error": f"学生{user_id}不存在"}

    # 数据隔离检查（F12: 用预计算的 allowed_classes 集合，合并进学生查询避免重复查库）
    if allowed_classes is not None and user.class_name not in allowed_classes:
        return None, {"index": index, "error": "无权为该学生创建记录"}

    # 验证规则限制
    if rule:
        is_allowed, limit_message = check_rule_limits(user_id, rule.id)
        if not is_allowed:
            return None, {"index": index, "error": limit_message}

    # 仅构造记录与目标分值，暂不写 session
    record, new_score = _build_batch_record(
        user, user_id, rule_id, score_change, description, operator
    )
    return (
        {
            "index": index,
            "record": record,
            "user": user,
            "score_change": score_change,
            "new_score": new_score,
        },
        None,
    )
def _recalc_composite_scores_after_batch(created_records, results):
    """批量录入后对涉及学生触发综合评分重算（异步入队，无 broker 时同步回退）。"""
    status = "ok"
    if results:
        try:
            for uid in {item["user"].id for item in created_records}:
                enqueue_or_recalc_user_score(uid)
        except Exception as e:
            logger.error("批量录入后综合评分重算失败: %s", e, exc_info=True)
    return status
