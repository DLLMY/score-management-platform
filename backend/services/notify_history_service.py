"""notify_history 域 service 承载（F17 路由服务化 · 防腐层）。

仅承载写入/事务路径，路由保留：
- get_or_404 / 请求级校验 / 聚合只读 query（暂缓不动）
- 响应构造
所有函数逐字节复刻原路由事务逻辑，行为完全等价。
"""
from datetime import datetime, timedelta
from models import db, NotifyHistory


def clean_notify_history(days: int = 30) -> int:
    """清理 days 天前的通知历史（DELETE /notify_history/clean 写入路径收口，F17 防腐层）。

    与原路由内 NotifyHistory.query.filter(...).delete() + db.session.commit() 行为完全等价；
    返回被删除的记录数。路由仅保留响应构造。
    """
    cutoff_time = datetime.now() - timedelta(days=days)
    deleted_count = NotifyHistory.query.filter(NotifyHistory.created_at < cutoff_time).delete()
    db.session.commit()
    return deleted_count
