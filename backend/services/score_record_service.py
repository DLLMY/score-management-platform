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

from models import db, ScoreRecord, User, get_by_id
from utils.score_utils import atomic_score_update
from utils.logger import log_operation


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
    db.session.add(record)
    if user:
        # R5: SQL 原子累加（消除读改写竞态）；R8: 与审批/MQTT 一致钳制 min/max
        from models import SystemConfig as _SysCfg

        _cfg = _SysCfg.query.first()
        _min_s = _cfg.min_score if _cfg else 0
        _max_s = _cfg.max_score if _cfg else 100
        ok, final_score = atomic_score_update(user_id, score_change, min_score=_min_s, max_score=_max_s)
        if ok:
            user.current_score = final_score
    db.session.commit()
    return record, user_name


def delete_record(record):
    """删除积分记录并原子回滚学生积分（R5 读改写竞态防护）。

    返回 (before_score, after_score, user_name)；路由负责 before/after_data 构造、操作日志、
    统计缓存失效、综合评分重算。
    """
    user = get_by_id(User, record.student_id)
    before_score = user.current_score or 0 if user else 0
    if user:
        ok, final_score = atomic_score_update(user.id, -record.score_change)
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
            errors.extend([{"index": item["index"], "error": "数据库提交失败"} for item in created_records])
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
    # 排名计算（与原路由一致，懒导入 rank_routes 缓存/二分查找）
    from api.scores.rank_routes import _find_rank_by_score_binary_search, _get_active_rank_rules_cached

    before_rules = _get_active_rank_rules_cached()
    before_rank = _find_rank_by_score_binary_search(before_rules, before_score)
    before_rank_name = before_rank.get("name") if before_rank else "无等级"

    user.current_score = before_score + score_change
    user_name = user.name

    after_rank = _find_rank_by_score_binary_search(before_rules, user.current_score)
    after_rank_name = after_rank.get("name") if after_rank else "无等级"

    record = ScoreRecord(
        student_id=user_id, rule_id=rule_id, score_change=score_change, description=description, operator=operator
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
