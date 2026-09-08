"""approvals 防腐层 service（F17 路由服务化）。

收口审批域的写入/事务路径 db.session 操作，路由仅保留：
- get_or_404（404 语义）
- 请求级校验与数据隔离（_can_access_approval_user）
- 缓存失效、跨切面副作用（综合评分重算 / 学生通知中心落库 / MQTT 下发 / 管理通知）
- 响应构造

所有写入遵循 F17 铁律：逐字节复刻响应体/状态码/错误信息，只读 query 暂缓不动。
本文件与原始 approvals_routes 内的事务逻辑一一对应，行为完全等价。
"""

from datetime import datetime

from models import db, Approval, User, ScoreRecord, SystemConfig, get_by_id
from utils.score_utils import atomic_score_update


def create_approval(data):
    """创建审批申请并落库。返回 (approval_id, error_message_or_None)。

    校验（user_id 非空 / 学生存在 / 数据隔离）由路由负责，service 只做写入。
    """
    approval = Approval(
        student_id=data.get("user_id"),
        type=data.get("type"),
        title=data.get("title"),
        description=data.get("description"),
        score_change=data.get("score_change"),
    )
    db.session.add(approval)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return approval.id, None


def update_approval(approval, data):
    """更新审批申请字段并提交。"""
    approval.title = data.get("title", approval.title)
    approval.description = data.get("description", approval.description)
    approval.score_change = data.get("score_change", approval.score_change)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return None


def delete_approval(approval):
    """删除审批记录并提交。"""
    db.session.delete(approval)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return None


def approve_approval(approval, data):
    """批准审批的核心事务：状态/审批人/意见/时间 + 原子积分累加 + 生成 ScoreRecord，统一提交。

    返回 result dict:
        {
            "approval_id": int,
            "user": User or None,
            "actual_change": float,   # 实际积分变动（钳制后）
            "score_change": float,    # 申请单上的原始加分值
            "new_points": float or None,
        }
    跨切面副作用（综合评分重算 / 通知落库 / MQTT / 管理通知）由路由负责，保持防腐层解耦。
    """
    approval.status = "approved"
    approval.approver_id = data.get("approver_id")
    approval.comment = data.get("comment", "审批通过")
    approval.approve_time = datetime.now()

    user = get_by_id(User, approval.student_id)
    actual_change = 0
    if user and approval.score_change:
        before_score = user.current_score or 0
        # R5: SQL 原子累加 + 钳制（min/max 来自 SystemConfig，与原始 apply_score_limit 一致但无读改写竞态）
        config = SystemConfig.query.first()
        min_score = config.min_score if config else 0
        max_score = config.max_score if config else 100
        ok, final_score = atomic_score_update(
            user.id, approval.score_change, min_score=min_score, max_score=max_score
        )
        if ok:
            user.current_score = final_score
        user.updated_at = datetime.now()

        actual_change = user.current_score - before_score

        record = ScoreRecord(
            student_id=approval.student_id,
            score_change=actual_change,
            description=f"审批通过: {approval.title}",
            operator=f"admin_{approval.approver_id}",
        )
        db.session.add(record)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return {
        "approval_id": approval.id,
        "user": user,
        "actual_change": actual_change,
        "score_change": approval.score_change,
        "new_points": user.current_score if user else None,
    }


def reject_approval(approval, data):
    """拒绝审批的核心事务：状态/审批人/意见/时间，统一提交。

    返回 result dict:
        {
            "approval_id": int,
            "user": User or None,
            "comment": str,
        }
    跨切面副作用（通知落库 / MQTT 下发）由路由负责。
    """
    approval.status = "rejected"
    approval.approver_id = data.get("approver_id")
    approval.comment = data.get("comment", "审批未通过")
    approval.approve_time = datetime.now()

    user = get_by_id(User, approval.student_id)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return {
        "approval_id": approval.id,
        "user": user,
        "comment": approval.comment,
    }
