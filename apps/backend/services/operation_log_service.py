"""操作日志只读查询下沉（薄路由收尾，F17 防腐层延伸）。

承载 routes 中内联的 db.session 只读聚合逻辑，逐字节复刻原响应体；
路由层退化为仅解析参数 + 调用本服务的薄壳。
"""

from datetime import datetime

from models import db, OperationLog
from sqlalchemy import case, func


def get_stats(start_time, end_time):
    """统计操作日志：总量/成功失败/开关箱数/按类型/按天。

    原 OperationLogStats.get 内联聚合已整体下沉，响应结构逐字节不变。
    """
    query = OperationLog.query
    if start_time:
        query = query.filter(OperationLog.created_at >= datetime.fromisoformat(start_time))
    if end_time:
        query = query.filter(OperationLog.created_at <= datetime.fromisoformat(end_time))

    total_count = query.count()

    success_count = query.filter(OperationLog.description.ilike("%成功%")).count()

    failure_count = query.filter(OperationLog.description.ilike("%失败%")).count()

    unlock_a_count = query.filter(OperationLog.description.ilike("%开A箱%")).count()

    unlock_b_count = query.filter(OperationLog.description.ilike("%开B箱%")).count()

    by_type = (
        db.session.query(
            OperationLog.operation_type, func.count(OperationLog.id).label("count")
        )
        .filter(
            OperationLog.created_at <= datetime.fromisoformat(end_time) if end_time else True,
        )
        .group_by(OperationLog.operation_type)
        .all()
    )

    by_day = (
        db.session.query(
            func.date(OperationLog.created_at).label("date"),
            func.count(OperationLog.id).label("count"),
            func.sum(case((OperationLog.description.ilike("%成功%"), 1), else_=0)).label(
                "success"
            ),
            func.sum(case((OperationLog.description.ilike("%失败%"), 1), else_=0)).label(
                "failure"
            ),
        )
        .filter(
            (
                OperationLog.created_at >= datetime.fromisoformat(start_time)
                if start_time
                else True
            ),
            OperationLog.created_at <= datetime.fromisoformat(end_time) if end_time else True,
        )
        .group_by(func.date(OperationLog.created_at))
        .order_by(func.date(OperationLog.created_at).desc())
        .limit(30)
        .all()
    )

    return {
        "total_count": total_count,
        "success_count": success_count,
        "failure_count": failure_count,
        "unlock_a_count": unlock_a_count,
        "unlock_b_count": unlock_b_count,
        "success_rate": round(success_count / total_count * 100, 1) if total_count > 0 else 0,
        "by_type": [{"type": t[0], "count": t[1]} for t in by_type],
        "by_day": [
            {
                "date": str(t[0]),
                "total": t[1],
                "success": int(t[2]) if t[2] else 0,
                "failure": int(t[3]) if t[3] else 0,
            }
            for t in by_day
        ],
    }
