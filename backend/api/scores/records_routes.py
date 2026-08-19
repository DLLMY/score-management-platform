import logging
from flask import request
from flask_restx import Namespace, Resource, fields
from utils.response import APIResponse
from utils.pagination import get_pagination
from models import db, ScoreRecord, User, ScoreRule, get_by_id
from utils.permission import requires_permission, get_current_admin, get_allowed_classes
from utils.logger import log_operation
from services.redis_cache_service import get_cache_service
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.class_time_checker import ClassTimeChecker
from services.score_record_service import (
    create_record,
    create_score_entry,
    delete_record,
    commit_batch_score_entry,
)
from datetime import datetime
from sqlalchemy.orm import joinedload

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
        return None


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


def _apply_score_data_isolation(query):
    """对成绩查询应用数据隔离：非管理员只能查看关联班级的数据"""
    from sqlalchemy import exists

    admin = get_current_admin()
    if not admin:
        return query
    allowed_classes = get_allowed_classes(admin.id)
    if allowed_classes is None:
        return query
    if not allowed_classes:
        return query.filter(False)
    return query.filter(
        exists().where((User.id == ScoreRecord.student_id) & (User.class_name.in_(allowed_classes)))
    )


def _can_access_student(user_id):
    """检查当前管理员是否有权限操作指定学生"""
    if user_id is None:
        return False
    admin = get_current_admin()
    if not admin:
        return False
    allowed_classes = get_allowed_classes(admin.id)
    if allowed_classes is None:
        return True
    user = get_by_id(User, user_id)
    if not user:
        return False
    return user.class_name in allowed_classes


ns_records = Namespace("records", description="积分记录相关操作")

record_model = ns_records.model(
    "ScoreRecord",
    {
        "id": fields.Integer(readOnly=True, description="记录ID"),
        "user_id": fields.Integer(required=True, description="学生ID"),
        "rule_id": fields.Integer(description="规则ID"),
        "score_change": fields.Float(required=True, description="积分变化（正数加分，负数扣分）"),
        "description": fields.String(description="操作说明"),
        "operator": fields.String(description="操作人"),
        "created_at": fields.DateTime(readOnly=True, description="创建时间"),
    },
)

record_list_response = ns_records.model(
    "RecordListResponse",
    {
        "records": fields.List(fields.Nested(record_model), description="记录列表"),
        "total": fields.Integer(description="总记录数"),
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "pages": fields.Integer(description="总页数"),
    },
)

record_statistics_response = ns_records.model(
    "RecordStatistics",
    {
        "total_records": fields.Integer(description="总记录数"),
        "total_add": fields.Float(description="累计加分"),
        "total_subtract": fields.Float(description="累计扣分"),
        "net_change": fields.Float(description="净变化"),
        "today_count": fields.Integer(description="今日记录数"),
    },
)


@ns_records.route("/")
class RecordList(Resource):
    @ns_records.doc(
        "list_records",
        description="获取积分记录列表",
        params={
            "page": "页码（默认1）",
            "per_page": "每页数量（默认50）",
            "user_id": "学生ID筛选",
            "rule_id": "规则ID筛选",
            "start_date": "开始日期（ISO格式）",
            "end_date": "结束日期（ISO格式）",
        },
    )
    @ns_records.response(200, "成功", record_list_response)
    @requires_permission("score.view")
    @cached_api(ttl=30)
    def get(self):
        """
        获取积分记录列表

        支持分页、学生筛选、规则筛选和日期范围筛选。
        非管理员用户只能查看关联班级的数据。
        """
        page, per_page = get_pagination(default=50)
        user_id = request.args.get("user_id", type=int)
        rule_id = request.args.get("rule_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        # 性能优化：使用 joinedload 预加载关联数据，消除 N+1 查询
        query = ScoreRecord.query.options(
            joinedload(ScoreRecord.user), joinedload(ScoreRecord.rule)
        )
        if user_id:
            query = query.filter(ScoreRecord.student_id == user_id)
        if rule_id:
            query = query.filter(ScoreRecord.rule_id == rule_id)
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
            except ValueError:
                return APIResponse.bad_request(message="start_date 格式非法（应为 ISO 日期）")
            query = query.filter(ScoreRecord.created_at >= start_dt)
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
            except ValueError:
                return APIResponse.bad_request(message="end_date 格式非法（应为 ISO 日期）")
            query = query.filter(ScoreRecord.created_at <= end_dt)

        # 数据隔离：非管理员只能查看关联班级的数据
        query = _apply_score_data_isolation(query)

        pagination = query.order_by(ScoreRecord.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return APIResponse.success(
            data={
                "records": [
                    {
                        "id": r.id,
                        "user_id": r.student_id,
                        "student_id": r.student_id,
                        "user_name": r.user.name if r.user else None,
                        "rule_id": r.rule_id,
                        "rule_name": r.rule.name if r.rule else None,
                        "score_change": r.score_change,
                        "description": r.description,
                        "operator": r.operator,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in pagination.items
                ],
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        )

    @ns_records.doc("create_record", description="创建积分记录", security="Bearer")
    @ns_records.expect(record_model)
    @ns_records.response(201, "创建成功")
    @ns_records.response(400, "请求参数错误")
    @requires_permission("score.entry")
    def post(self):
        """
        创建积分记录

        创建新的积分变动记录。同时会更新学生的当前积分。
        非管理员用户只能为关联班级的学生创建记录。

        请求体：
        - user_id: 学生ID（必填）
        - rule_id: 规则ID
        - score_change: 积分变化（必填，正数加分，负数扣分）
        - description: 操作说明
        - operator: 操作人（默认system）
        """
        data = request.get_json() or ns_records.payload

        user_id = data.get("user_id")
        if user_id is None:
            return APIResponse.bad_request(message="user_id 为必填项")
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return APIResponse.bad_request(message="user_id 必须为整数")

        score_change = data.get("score_change")
        if score_change is None:
            return APIResponse.bad_request(message="score_change 为必填项")
        try:
            score_change = float(score_change)
        except (TypeError, ValueError):
            return APIResponse.bad_request(message="score_change 必须为数字")

        # 数据隔离检查
        if not _can_access_student(user_id):
            return APIResponse.error(message="无权为该学生创建记录", status_code=403)

        try:
            record, user_name = create_record(
                {
                    "user_id": user_id,
                    "rule_id": data.get("rule_id"),
                    "score_change": score_change,
                    "description": data.get("description"),
                    "operator": data.get("operator", "system"),
                }
            )
        except Exception as e:
            db.session.rollback()
            logger.error("%s: %s", "创建积分记录失败", e)
            return APIResponse.error(message="创建积分记录失败", status_code=500)

        # R4: 手动创建积分记录同样触发综合评分重算（原仅 score-entry 路径触发 → 两套行为）
        try:
            from services.composite_score_service import CompositeScoreService

            CompositeScoreService.recalculate_user_score(user_id)
        except Exception:
            pass

        # 记录操作日志（失败不影响主流程）
        try:
            log_operation(
                operation_type="score_change",
                target_type="record",
                target_id=record.id,
                description=(
                    f"积分变动: {user_name} "
                    f'{"+" if score_change > 0 else ""}'
                    f"{score_change}分"
                ),
                after_data=data,
            )
        except Exception:
            pass

        invalidate_cache("api:/api/records/*")

        return APIResponse.success(
            data={"record_id": record.id}, message="记录创建成功", status_code=201
        )


@ns_records.route("/user/<int:user_id>")
@ns_records.param("user_id", "用户ID")
class RecordByUser(Resource):
    @ns_records.doc(
        "get_records_by_user",
        description="获取指定学生的积分记录",
        params={"page": "页码（默认1）", "per_page": "每页数量（默认50）"},
    )
    @ns_records.response(200, "成功", record_list_response)
    @requires_permission("score.view")
    def get(self, user_id):
        """
        获取指定学生的积分记录

        根据学生ID获取该学生的所有积分变动记录。
        非管理员用户只能查看关联班级的学生记录。
        """
        # 数据隔离检查
        if not _can_access_student(user_id):
            return APIResponse.error(message="无权查看该学生的记录", status_code=403)

        page, per_page = get_pagination(default=50)

        # 性能优化：使用 joinedload 预加载关联数据，消除 N+1 查询
        pagination = (
            ScoreRecord.query.options(joinedload(ScoreRecord.user), joinedload(ScoreRecord.rule))
            .filter_by(student_id=user_id)
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return APIResponse.success(
            data={
                "records": [
                    {
                        "id": r.id,
                        "user_id": r.student_id,
                        "student_id": r.student_id,
                        "user_name": r.user.name if r.user else None,
                        "rule_id": r.rule_id,
                        "rule_name": r.rule.name if r.rule else None,
                        "score_change": r.score_change,
                        "description": r.description,
                        "operator": r.operator,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in pagination.items
                ],
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        )


@ns_records.route("/statistics")
class RecordStatistics(Resource):
    @ns_records.doc(
        "get_record_statistics",
        description="获取积分统计信息",
        params={
            "user_id": "学生ID筛选",
            "class_name": "班级名称筛选",
            "start_date": "开始日期（ISO格式）",
            "end_date": "结束日期（ISO格式）",
        },
    )
    @ns_records.response(200, "成功", record_statistics_response)
    @requires_permission("score.view")
    def get(self):
        """
        获取积分统计信息

        获取积分记录的统计数据，包括总记录数、累计加分、累计扣分等。
        非管理员用户只能查看关联班级的统计数据。
        """
        user_id = request.args.get("user_id", type=int)
        class_name = request.args.get("class_name")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        # 数据隔离：检查班级权限
        admin = get_current_admin()
        if admin:
            allowed_classes = get_allowed_classes(admin.id)
            if allowed_classes is not None:
                if class_name and class_name not in allowed_classes:
                    return APIResponse.error(message="无权查看该班级的统计", status_code=403)
                if not class_name and not user_id:
                    class_name = allowed_classes[0] if allowed_classes else None

        cache_key = f"score_statistics:{user_id}:{class_name}:{start_date}:{end_date}"
        cached_result = get_cache_service().get(cache_key)
        if cached_result:
            return APIResponse.success(data=cached_result)

        query = ScoreRecord.query
        if user_id:
            query = query.filter(ScoreRecord.student_id == user_id)
        elif class_name:
            query = query.join(User).filter(User.class_name == class_name)
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
            except ValueError:
                return APIResponse.bad_request(message="start_date 格式非法（应为 ISO 日期）")
            query = query.filter(ScoreRecord.created_at >= start_dt)
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
            except ValueError:
                return APIResponse.bad_request(message="end_date 格式非法（应为 ISO 日期）")
            query = query.filter(ScoreRecord.created_at <= end_dt)

        # 数据隔离
        query = _apply_score_data_isolation(query)

        total_records = query.count()

        # 性能优化：使用 SQL 聚合函数替代多次查询
        from sqlalchemy import func, case

        stats = (
            db.session.query(
                func.coalesce(
                    func.sum(
                        case((ScoreRecord.score_change > 0, ScoreRecord.score_change), else_=0)
                    ),
                    0,
                ).label("total_add"),
                func.coalesce(
                    func.abs(
                        func.sum(
                            case((ScoreRecord.score_change < 0, ScoreRecord.score_change), else_=0)
                        )
                    ),
                    0,
                ).label("total_subtract"),
            )
            .filter(ScoreRecord.id.in_(query.with_entities(ScoreRecord.id)))
            .first()
        )

        total_add = float(stats.total_add) if stats else 0
        total_subtract = float(stats.total_subtract) if stats else 0

        today = datetime.now().date()
        today_records = ScoreRecord.query.filter(
            ScoreRecord.created_at >= datetime.combine(today, datetime.min.time())
        )
        if user_id:
            today_records = today_records.filter(ScoreRecord.student_id == user_id)
        today_count = today_records.count()

        result = {  # noqa: F841
            "total_records": total_records,
            "total_add": total_add,
            "total_subtract": total_subtract,
            "net_change": total_add - total_subtract,
            "today_count": today_count,
        }

        # 使用标签缓存，便于积分变动时清除
        get_cache_service().set(cache_key, result, ttl=300, tags=["statistics"])

        return APIResponse.success(data=result)


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
        """
        # 尝试从缓存获取
        cache_key = "score_entry_data"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return APIResponse.success(data=cached_result)

        # 获取积分规则列表
        rules = ScoreRule.query.filter_by(is_active=True).all()
        rule_list = [
            {
                "id": r.id,
                "name": r.name,
                "score": r.score,
                "description": r.description,
                "category_id": r.category_id,
            }
            for r in rules
        ]

        # 获取活跃学生列表（性能优化：只获取活跃用户）
        users_query = User.query.filter_by(is_active=True)
        admin = get_current_admin()
        if admin:
            allowed_classes = get_allowed_classes(admin.id)
            if allowed_classes is not None and allowed_classes:
                users_query = users_query.filter(User.class_name.in_(allowed_classes))
        users = users_query.all()
        user_list = [
            {
                "id": u.id,
                "name": u.name,
                "card_id": u.card_id,
                "class_name": u.class_name,
                "current_score": u.current_score or 0,
            }
            for u in users
        ]

        result = {"rules": rule_list, "users": user_list}  # noqa: F841

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
        if not _can_access_student(user_id):
            return APIResponse.error(message="无权为该学生创建记录", status_code=403)

        # 如果提供了规则ID，获取规则对应的分数并检查限制
        if rule_id:
            rule = get_by_id(ScoreRule, rule_id)
            if not rule:
                return APIResponse.error(message="规则不存在", status_code=400)

            # 检查规则限制（每日上限、最小间隔）
            is_allowed, limit_message = check_rule_limits(user_id, rule_id)
            if not is_allowed:
                return APIResponse.error(message=limit_message, status_code=400)

            score_change = rule.score
            if not description:
                description = f"执行规则: {rule.name}"
        elif score_change is None:
            return APIResponse.error(message="必须提供规则ID或积分变化", status_code=400)

        # 学生存在性校验 + 排名对比用的 before/after 计算（只读；积分原子累加收口到 service，避免路由侧重复累加）
        user = get_by_id(User, user_id)
        if not user:
            return APIResponse.error(message="学生不存在", status_code=400)

        before_score = user.current_score or 0
        user_name = user.name

        # 使用缓存获取排名规则（仅用于排名变动通知的 before/after 对比，不改写积分）
        from api.scores.rank_routes import (
            _find_rank_by_score_binary_search,
            _get_active_rank_rules_cached,
        )

        before_rules = _get_active_rank_rules_cached()
        before_rank = _find_rank_by_score_binary_search(before_rules, before_score)
        before_rank_name = before_rank.get("name") if before_rank else "无等级"

        # 仅预测变动后排名（基于 before_score + score_change，不改积分）；积分原子累加由 service 完成
        after_rank = _find_rank_by_score_binary_search(before_rules, before_score + score_change)
        after_rank_name = after_rank.get("name") if after_rank else "无等级"

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

        # 检查排名是否发生变化，如果变化则发送通知
        if before_rank_name != after_rank_name:
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
                logger.warning(f"[Rank] 发送排名变动通知失败: {e}")

        # 发送积分变动通知到远程客户端（积分窗口显示）
        try:

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

            allowed, check_message, reason_code, rule_info = (
                ClassTimeChecker.is_notification_allowed(
                    target_class_info_id=getattr(user, "class_info_id", None), force_send=False
                )
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
                type="success" if score_change > 0 else "warning",
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
            logger.warning(f"[ScoreChange] 发送积分变动通知失败: {e}")

        # 清除统计缓存
        try:
            invalidated = get_cache_service().invalidate_by_tag("statistics")
            logger.info(f"[Cache] 积分录入后清除了 {invalidated} 个statistics相关缓存")
        except Exception as e:
            logger.warning(f"[Cache] 清除缓存失败: {e}")
        invalidate_cache("api:/api/records/*")

        # 触发综合评分增量更新
        composite_score_updated = False
        try:
            from services.composite_score_service import CompositeScoreService

            result = CompositeScoreService.recalculate_user_score(user_id)  # noqa: F841
            if result:
                composite_score_updated = True
                logger.info(
                    f"[CompositeScore] 用户{user_id}综合评分已更新: {result.get('composite_score')}"
                )
        except Exception as e:
            logger.warning(f"[CompositeScore] 综合评分更新失败: {e}")

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
                user_id = entry.get("user_id")
                rule_id = entry.get("rule_id")
                score_change = entry.get("score_change")
                description = entry.get("description")

                if not user_id:
                    errors.append({"index": i, "error": "user_id不能为空"})
                    continue

                if score_change is None:
                    errors.append({"index": i, "error": "score_change不能为空"})
                    continue

                # 处理规则
                rule = None
                if rule_id:
                    rule = get_by_id(ScoreRule, rule_id)
                    if not rule:
                        errors.append({"index": i, "error": f"规则{rule_id}不存在"})
                        continue
                    if description is None:
                        description = f"执行规则: {rule.name}"
                    score_change = rule.score

                # 验证学生存在
                user = get_by_id(User, user_id)
                if not user:
                    errors.append({"index": i, "error": f"学生{user_id}不存在"})
                    continue

                # 数据隔离检查（F12: 用预计算的 allowed_classes 集合，合并进学生查询避免重复查库）
                if _allowed_classes is not None and user.class_name not in _allowed_classes:
                    errors.append({"index": i, "error": "无权为该学生创建记录"})
                    continue

                # 验证规则限制
                if rule:
                    is_allowed, limit_message = check_rule_limits(user_id, rule.id)
                    if not is_allowed:
                        errors.append({"index": i, "error": limit_message})
                        continue

                # 仅构造记录与目标分值，暂不写 session
                record = ScoreRecord(
                    student_id=user_id,
                    rule_id=rule_id,
                    score_change=score_change,
                    description=description,
                    operator=operator,
                )
                before_score = user.current_score or 0
                created_records.append(
                    {
                        "index": i,
                        "record": record,
                        "user": user,
                        "score_change": score_change,
                        "new_score": before_score + score_change,
                    }
                )

            except Exception as e:
                errors.append({"index": i, "error": str(e)})

        # 批量提交（仅成功行）：事务收口到 service（add + 原子累加 + 单次 commit）
        results, commit_errors = commit_batch_score_entry(created_records)
        errors.extend(commit_errors)

        # 清除统计缓存
        try:
            get_cache_service().invalidate_by_tag("statistics")
        except Exception:
            pass
        invalidate_cache("api:/api/records/*")

        # R4: 批量录入后对涉及学生触发综合评分重算
        if results:
            try:
                from services.composite_score_service import CompositeScoreService

                for uid in {item["user"].id for item in created_records}:
                    CompositeScoreService.recalculate_user_score(uid)
            except Exception:
                pass

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
                data={"results": results, "errors": errors},
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
        if not _can_access_student(record.student_id):
            return APIResponse.error(message="无权查看该记录", status_code=403)
        return APIResponse.success(
            data={
                "id": record.id,
                "user_id": record.student_id,
                "user_name": record.user.name if record.user else None,
                "rule_id": record.rule_id,
                "rule_name": record.rule.name if record.rule else None,
                "score_change": record.score_change,
                "description": record.description,
                "operator": record.operator,
                "created_at": record.created_at.isoformat() if record.created_at else None,
            }
        )

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
        if not _can_access_student(record.student_id):
            return APIResponse.error(message="无权删除该记录", status_code=403)

        data = request.get_json() or {}
        if not data.get("confirm"):
            user_name = record.user.name if record.user else "未知用户"
            return APIResponse.error(
                message=f'请确认删除操作。即将删除记录：{user_name} {"+" if record.score_change > 0 else ""}{record.score_change}分',
                status_code=400,
                data={
                    "record_info": {
                        "id": record.id,
                        "user_id": record.student_id,
                        "user_name": user_name,
                        "score_change": record.score_change,
                        "description": record.description,
                        "created_at": record.created_at.isoformat() if record.created_at else None,
                    },
                    "requires_confirm": True,
                },
            )

        before_data = {
            "id": record.id,
            "user_id": record.student_id,
            "user_name": record.user.name if record.user else None,
            "score_change": record.score_change,
            "description": record.description,
            "operator": record.operator,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        }

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
            logger.warning(f"[Cache] 清除缓存失败: {e}")
        invalidate_cache("api:/api/records/*")

        # R4: 删除回滚后触发综合评分重算
        try:
            from services.composite_score_service import CompositeScoreService

            CompositeScoreService.recalculate_user_score(record.student_id)
        except Exception:
            pass

        logger.info(f"[Record] 删除记录: id={id}, user={user_name}, score_change={record.score_change}")

        return APIResponse.success(
            data={"rollback_score": -record.score_change}, message="记录删除成功"
        )
