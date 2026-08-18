"""系统指标后台采样服务（运维中心趋势数据来源）。

启动一个守护线程，按固定间隔采样 CPU/内存/磁盘/网络指标并写入 system_metrics 表，
同时清理超过保留期的旧数据，避免表无限增长。

由 app/service_init.py::init_system_metric_sampler 在应用启动时拉起（仅生产/非 lightweight 模式）。
"""

import time
import threading
import logging
from datetime import datetime, timedelta

import psutil

logger = logging.getLogger(__name__)

RETENTION_DAYS = 30
SAMPLING_INTERVAL = 60  # 秒

_started = False


def sample_once(app):
    """执行一次采样并落库（失败静默）。"""
    try:
        with app.app_context():
            from models import db, SystemMetric

            cpu = psutil.cpu_percent(interval=0.1)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            net = psutil.net_io_counters()

            rows = [
                SystemMetric(metric_name="cpu_percent", metric_value=cpu, unit="%", category="system"),
                SystemMetric(metric_name="memory_percent", metric_value=mem.percent, unit="%", category="system"),
                SystemMetric(metric_name="disk_percent", metric_value=disk.percent, unit="%", category="system"),
                SystemMetric(metric_name="net_sent", metric_value=net.bytes_sent, unit="bytes", category="network"),
                SystemMetric(metric_name="net_recv", metric_value=net.bytes_recv, unit="bytes", category="network"),
            ]
            db.session.add_all(rows)

            # 清理过期（保留最近 RETENTION_DAYS 天）
            cutoff = datetime.now() - timedelta(days=RETENTION_DAYS)
            deleted = db.session.query(SystemMetric).filter(SystemMetric.created_at < cutoff).delete()
            # S7 修复: 前端性能/错误上报表一并清理（原只清 system_metrics → 两表无限膨胀）
            try:
                from models import FrontendPerfMetric, FrontendErrorLog

                deleted += (
                    db.session.query(FrontendPerfMetric).filter(FrontendPerfMetric.created_at < cutoff).delete()
                )
                deleted += (
                    db.session.query(FrontendErrorLog).filter(FrontendErrorLog.created_at < cutoff).delete()
                )
            except Exception:
                pass
            db.session.commit()
            logger.debug(f"系统指标采样完成（写入 {len(rows)} 条，清理过期 {deleted} 条）")
    except Exception as e:
        logger.warning(f"系统指标采样失败: {e}")
        try:
            from models import db

            db.session.rollback()
        except Exception:
            pass


def start_sampler(app, interval=SAMPLING_INTERVAL):
    """启动采样守护线程（幂等：重复调用不会起多个线程）。"""
    global _started
    if _started:
        return
    _started = True

    def loop():
        while True:
            try:
                sample_once(app)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"系统指标采样线程异常: {e}")
            time.sleep(interval)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
    logger.info(f"系统指标采样线程已启动，间隔 {interval}s，保留 {RETENTION_DAYS} 天")
    return t
