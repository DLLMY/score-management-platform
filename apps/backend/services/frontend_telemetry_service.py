"""前端遥测（性能指标/错误上报）写入/事务路径薄封装（F17 防腐层：从 api/system/system_routes 收口）。

逐字节复刻原路由内联落库行为（含失败静默回滚，绝不阻塞上报接口）；路由保留
validate_performance_data 请求级校验、限流、响应构造。

迁移范围：
- _persist_perf_metric  → persist_perf_metric（add + 条件 commit + 失败 rollback）
- _persist_frontend_error → persist_frontend_error（add + commit + 失败 rollback）
- FrontendPerformanceBatch.post 末尾统一提交 → bulk_persist_perf_metrics（#629 全量收口，
  批量末尾统一 commit 事务由 service 自管，路由零 db.session 触达）。
"""

import logging

from models import db, FrontendPerfMetric, FrontendErrorLog

logger = logging.getLogger(__name__)


def persist_perf_metric(data, commit=True):
    """把单条前端性能指标落库（失败静默，绝不阻塞上报接口）。

    S10 修复: 批量路径 commit=False 延迟到末尾统一提交（原每条 commit，
    批量 100 条 = 100 次 SQLite 写提交 → 写放大）。
    """
    try:
        metric = FrontendPerfMetric(
            metric_type=str(data.get("type", "custom"))[:30],
            name=str(data.get("name", ""))[:200],
            value=float(data.get("value", 0)),
            unit=(str(data.get("unit"))[:20] if data.get("unit") is not None else None),
            page=(str(data.get("page"))[:200] if data.get("page") else None),
            user_agent=(str(data.get("user_agent"))[:500] if data.get("user_agent") else None),
            screen_width=data.get("screen_width"),
            screen_height=data.get("screen_height"),
            detail=data.get("data"),
        )
        db.session.add(metric)
        if commit:
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning(f"前端性能指标落库失败（已忽略）: {e}")


def persist_frontend_error(data):
    """把单条前端错误上报落库（失败静默，绝不阻塞上报接口）。"""
    try:
        err = FrontendErrorLog(
            error_type=str(data.get("type", "js_error"))[:30],
            message=str(data.get("message", ""))[:2000],
            stack=data.get("stack"),
            file=(str(data.get("file"))[:500] if data.get("file") else None),
            line=data.get("line"),
            column=data.get("column"),
            page=(str(data.get("page"))[:200] if data.get("page") else None),
            url=(str(data.get("url"))[:500] if data.get("url") else None),
            method=(str(data.get("method"))[:10] if data.get("method") else None),
            status=data.get("status"),
            user_agent=(str(data.get("user_agent"))[:500] if data.get("user_agent") else None),
            detail=data.get("data"),
        )
        db.session.add(err)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning(f"前端错误落库失败（已忽略）: {e}")


def bulk_persist_perf_metrics(metrics):
    """批量落库前端性能指标（事务由 service 自管，路由零 db.session 触达，#629 全量收口）。

    逐字节复刻原路由 FrontendPerformanceBatch.post 循环 + 末尾统一提交行为：
    循环内 persist_perf_metric(commit=False) 失败静默回滚（保留原 S10 写放大优化），
    全部 add 完成后统一 db.session.commit()。返回成功落库的条数（= 入参已校验指标数）。
    """
    persisted = 0
    for metric in metrics:
        persist_perf_metric(metric, commit=False)
        persisted += 1
    if persisted:
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("批量前端性能指标提交失败（已回滚）: %s", e)
            raise
    return persisted
