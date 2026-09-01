"""积分记录薄服务层（F17 防腐层迁移：把 records_routes 内的 db.session 写入/事务收口到 service）。

仅迁移写入/事务路径（create / score-entry / batch-entry / delete）。只读查询（GET 列表/详情/
按学生/统计/录入页）仍留在路由内，按评估排期"只读 db.session.query 可暂缓"。

事务边界统一在此收口；方法返回结构保持与原路由一致，便于路由原样映射为 APIResponse，
不改变对外契约。下列跨切面副作用（MQTT 排名/积分变动通知、管理员通知、统计缓存失效、
综合评分重算、操作日志 POST-COMMIT 部分）按其它子域一致做法保留在路由内：
- create_record：service 仅 add+原子累加+commit，返回 (record, user_name)；路由做综合评分重算 + log_operation。
- delete_record：service 仅原子回滚+delete+commit，返回 (before_score, after_score, user_name)；
  路由做 before/after_data 构造 + log_operation + 缓存失效 + 综合评分重算。
- batch-entry：校验收集（只读）留在路由；service 仅 add+原子累加+commit，返回 (results, errors)。
- score-entry：事务最复杂（排名计算 + log_operation 须在 commit 前设置 record.operation_log_id），
  整体收口进 service 并返回结构化结果 dict；路由做 MQTT/通知/缓存/综合评分等 POST-COMMIT 副作用。

注：log_operation 返回 bool（非 OperationLog 对象），原路由 `record.operation_log_id = log_entry.id`
在 score-entry 会 AttributeError 500。此处以 `hasattr(log_entry, "id")` 守卫（与迁移前修复一致），
避免崩溃；operation_log_id 在 log_operation 返回 bool 时保持 None（审计日志仍正常写入）。
"""

from datetime import datetime

from models import db, ScoreRecord, User, ScoreRule, get_by_id
from utils.score_utils import atomic_score_update
from utils.logger import log_operation
from utils.serialize import serialize_dt


def create_record(data):
    """创建积分记录并原子累加学生积分。data 已由路由完成请求级校验（user_id/score_change）。

    返回 (record 对象, user_name)。路由负责 commit 后的综合评分重算与操作日志。
    """
    user_id = data["user_id"]
    score_change = data["score_change"]
    rule_id = data.get("rule_id")
    record = ScoreRecord(
        student_id=user_id,
        rule_id=rule_id,
        score_change=score_change,
        description=data.get("description"),
        operator=data.get("operator", "system"),
    )
    user = get_by_id(User, user_id)
    user_name = user.name if user else "未知用户"
    try:
        db.session.add(record)
        if user:
            # R5: SQL 原子累加（消除读改写竞态）；R8: 与审批/MQTT 一致钳制 min/max
            from models import SystemConfig as _SysCfg

            _cfg = _SysCfg.query.first()
            _min_s = _cfg.min_score if _cfg else 0
            _max_s = _cfg.max_score if _cfg else 100
            ok, final_score = atomic_score_update(
                user_id, score_change, min_score=_min_s, max_score=_max_s
            )
            if ok:
                user.current_score = final_score
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return record, user_name


def delete_record(record):
    """删除积分记录并原子回滚学生积分（R5 读改写竞态防护）。

    返回 (before_score, after_score, user_name)；路由负责 before/after_data 构造、操作日志、
    统计缓存失效、综合评分重算。
    """
    user = get_by_id(User, record.student_id)
    before_score = user.current_score or 0 if user else 0
    if user:
        # F5: 删除回滚须与录入一致的 min/max 钳制（atomic_score_update 默认不钳），
        # 否则边界学生回滚越界（越 min / 超额），与录入端钳制不一致。
        from models import SystemConfig as _SysCfg

        _cfg = _SysCfg.query.first()
        _min_s = _cfg.min_score if _cfg else 0
        _max_s = _cfg.max_score if _cfg else 100
        ok, final_score = atomic_score_update(
            user.id, -record.score_change, min_score=_min_s, max_score=_max_s
        )
        if ok:
            user.current_score = final_score
        user_name = user.name
        after_score = user.current_score
    else:
        user_name = "未知用户"
        after_score = None
    db.session.delete(record)
    db.session.commit()
    return before_score, after_score, user_name


def commit_batch_score_entry(created_records):
    """批量录入提交：仅成功行 add + 原子累加 + 单次 commit（F3 修复：校验收集在路由侧完成）。

    返回 (results, errors)。results 每项 {index, success, record_id, user_name, score_change, new_score}。
    """
    results = []
    errors = []
    if created_records:
        try:
            for item in created_records:
                db.session.add(item["record"])
                # R5: 逐条 SQL 原子累加（flush 生成 record.id）
                ok, final_score = atomic_score_update(item["user"].id, item["score_change"])
                if ok:
                    item["user"].current_score = final_score
                    item["new_score"] = final_score
            db.session.commit()
            for item in created_records:
                results.append(
                    {
                        "index": item["index"],
                        "success": True,
                        "record_id": item["record"].id,
                        "user_name": item["user"].name,
                        "score_change": item["score_change"],
                        "new_score": item["new_score"],
                    }
                )
        except Exception:
            db.session.rollback()
            errors.extend(
                [{"index": item["index"], "error": "数据库提交失败"} for item in created_records]
            )
    return results, errors


def create_score_entry(data):
    """积分录入（最复杂写入路径）：排名计算 + 设置积分 + log_operation（commit 前设 operation_log_id）+ add + commit。

    data 已由路由完成请求级校验与 rule 解析（user_id / rule_id / score_change / description / operator 均就绪）。
    返回 (result_dict, None)；学生不存在返回 (None, "学生不存在")。result_dict 含路由 POST-COMMIT
    副作用所需的 user_name/new_score/before_rank_name/after_rank_name/user_id/score_change/rule_id/description/card_id。
    """
    user_id = data["user_id"]
    rule_id = data.get("rule_id")
    score_change = data["score_change"]
    description = data.get("description")
    operator = data.get("operator", "system")

    user = get_by_id(User, user_id)
    if not user:
        return None, "学生不存在"

    before_score = user.current_score or 0
    # 排名计算（与原路由一致，懒导入 rank_service 缓存/二分查找）
    from services.rank_service import (
        _find_rank_by_score_binary_search,
        _get_active_rank_rules_cached,
    )

    before_rules = _get_active_rank_rules_cached()
    before_rank = _find_rank_by_score_binary_search(before_rules, before_score)
    before_rank_name = before_rank.get("name") if before_rank else "无等级"

    # F4: R5 原子累加 + R8 钳制 min/max（消除读改写竞态，与 create_record 一致）。
    # 原 `user.current_score = before + change` 在并发/MQTT 下会丢更新且越界。
    from models import SystemConfig as _SysCfg

    _cfg = _SysCfg.query.first()
    _min_s = _cfg.min_score if _cfg else 0
    _max_s = _cfg.max_score if _cfg else 100
    ok, final_score = atomic_score_update(
        user_id, score_change, min_score=_min_s, max_score=_max_s
    )
    if ok:
        user.current_score = final_score
    user_name = user.name

    after_rank = _find_rank_by_score_binary_search(before_rules, user.current_score)
    after_rank_name = after_rank.get("name") if after_rank else "无等级"

    record = ScoreRecord(
        student_id=user_id,
        rule_id=rule_id,
        score_change=score_change,
        description=description,
        operator=operator,
    )
    db.session.add(record)
    log_entry = log_operation(
        operation_type="score_entry",
        target_type="record",
        target_id=record.id,
        description=f'积分录入: {user_name} {"+" if score_change > 0 else ""}{score_change}分',
        after_data={
            **data,
            "before_score": before_score,
            "after_score": user.current_score,
            "before_rank": before_rank_name,
            "after_rank": after_rank_name,
        },
    )
    # log_operation 返回 bool（非 OperationLog 对象）→ 守卫避免 AttributeError 500（迁移前缺陷修复）
    if log_entry and hasattr(log_entry, "id"):
        record.operation_log_id = log_entry.id
    db.session.commit()

    return {
        "record": record,
        "user_name": user_name,
        "new_score": user.current_score,
        "before_rank_name": before_rank_name,
        "after_rank_name": after_rank_name,
        "user_id": user_id,
        "score_change": score_change,
        "rule_id": rule_id,
        "description": description,
        "card_id": getattr(user, "card_id", None),
    }, None


# ==================== 读路径下沉（P3 大路由瘦身：records_routes GET 查询/聚合收口） ====================
# 设计约定：service 保持无请求上下文依赖；数据隔离白名单（allowed_classes）由路由解析后传入：
#   None = 全量不过滤（管理员）；[] = 无可见班级；[班级名...] = exists 白名单过滤。


def _apply_isolation_filter(query, allowed_classes):
    """对积分查询应用数据隔离（语义与原路由 _apply_score_data_isolation 一致）。"""
    if allowed_classes is None:
        return query
    if not allowed_classes:
        return query.filter(False)
    from sqlalchemy import exists

    return query.filter(
        exists().where((User.id == ScoreRecord.student_id) & (User.class_name.in_(allowed_classes)))
    )


def query_score_records(
    user_id=None,
    rule_id=None,
    start_dt=None,
    end_dt=None,
    allowed_classes=None,
    page=1,
    per_page=50,
):
    """积分记录分页查询（读路径下沉）。返回 SQLAlchemy Pagination 对象（items/total/pages）。

    路由保留：参数解析与 ISO 日期校验（bad_request）、隔离白名单解析、响应构造。
    """
    from sqlalchemy.orm import joinedload

    query = ScoreRecord.query.options(joinedload(ScoreRecord.user), joinedload(ScoreRecord.rule))
    if user_id:
        query = query.filter(ScoreRecord.student_id == user_id)
    if rule_id:
        query = query.filter(ScoreRecord.rule_id == rule_id)
    if start_dt:
        query = query.filter(ScoreRecord.created_at >= start_dt)
    if end_dt:
        query = query.filter(ScoreRecord.created_at <= end_dt)
    query = _apply_isolation_filter(query, allowed_classes)
    return query.order_by(ScoreRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )


def serialize_score_record(r):
    """积分记录行序列化（列表/按用户共用，形态与原路由逐字段一致）。
    统一收敛到 ScoreRecord.to_dict（B3 2026-08-23），输出零变化。"""
    return r.to_dict()


def get_score_statistics(
    user_id=None, class_name=None, start_dt=None, end_dt=None, allowed_classes=None
):
    """积分统计聚合（读路径下沉）。返回 {total_records, total_add, total_subtract, net_change, today_count}。

    语义与原路由 RecordStatistics.get 一致；today_count 与其余指标同样套用班级隔离过滤
    （user_id / class_name / allowed_classes），口径统一，不再泄露跨班数据量。
    """
    from sqlalchemy import func, case

    query = ScoreRecord.query
    if user_id:
        query = query.filter(ScoreRecord.student_id == user_id)
    elif class_name:
        query = query.join(User).filter(User.class_name == class_name)
    if start_dt:
        query = query.filter(ScoreRecord.created_at >= start_dt)
    if end_dt:
        query = query.filter(ScoreRecord.created_at <= end_dt)
    query = _apply_isolation_filter(query, allowed_classes)

    total_records = query.count()

    stats = (
        db.session.query(
            func.coalesce(
                func.sum(case((ScoreRecord.score_change > 0, ScoreRecord.score_change), else_=0)),
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
    today_records = ScoreRecord.query
    if user_id:
        today_records = today_records.filter(ScoreRecord.student_id == user_id)
    elif class_name:
        today_records = today_records.join(User).filter(User.class_name == class_name)
    today_records = today_records.filter(
        ScoreRecord.created_at >= datetime.combine(today, datetime.min.time())
    )
    today_records = _apply_isolation_filter(today_records, allowed_classes)
    today_count = today_records.count()

    return {
        "total_records": total_records,
        "total_add": total_add,
        "total_subtract": total_subtract,
        "net_change": total_add - total_subtract,
        "today_count": today_count,
    }


def get_score_entry_data(allowed_classes=None):
    """积分录入页表单数据（读路径下沉）：活跃规则 + 活跃学生。

    allowed_classes 语义与原路由一致：None 或空列表 = 不过滤；非空 = 班级白名单过滤。
    路由保留缓存读写（score_entry_data 5 分钟缓存）。
    """
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

    users_query = User.query.filter_by(is_active=True)
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

    return {"rules": rule_list, "users": user_list}
