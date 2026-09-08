# -*- coding: utf-8 -*-
"""积分原子更新工具（R5 修复）。

原实现均为 Python 读-改-写（`user.current_score = user.current_score + Δ`），
多 worker / MQTT 并发时存在丢失更新竞态（两人同时读 50，各加 10 → 70 而非 80）。
统一改为 SQL 原子表达式 `UPDATE user SET current_score = <expr> WHERE id = ...`，
由数据库在单语句内完成读取与写入，天然串行化。
"""

from datetime import datetime

from sqlalchemy import func, update

from models import User, db


def atomic_score_update(user_id, delta, min_score=None, max_score=None):
    """SQL 原子更新 current_score。

    Args:
        user_id: 学生 ID
        delta: 积分变化量（可为负）
        min_score/max_score: 可选钳制上下限（None 表示不钳）

    Returns:
        (成功, 最终分数) 或 (False, None)（学生不存在）
    """
    expr = func.coalesce(User.current_score, 0) + delta
    if min_score is not None:
        expr = func.max(expr, min_score)
    if max_score is not None:
        expr = func.min(expr, max_score)
    db.session.execute(
        update(User).where(User.id == user_id).values(current_score=expr, updated_at=datetime.now())
    )
    db.session.flush()
    row = db.session.query(User.current_score).filter_by(id=user_id).first()
    if row is None:
        return False, None
    return True, row[0]
