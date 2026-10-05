import os

from celery import Celery
from celery.signals import worker_process_init

# 设置Flask应用环境变量
# P2-d: 改用自管 APP_ENV（避免设置已弃用的 FLASK_ENV 触发警告）。
os.environ.setdefault("FLASK_APP", "app.py")
os.environ.setdefault("APP_ENV", "development")

# 创建Celery应用实例
celery_app = Celery(
    "score_management",
    include=[
        "tasks.mqtt_tasks",
        "tasks.export_tasks",
        "tasks.notification_tasks",
        "tasks.scheduled_tasks",
        "tasks.score_tasks",
    ],
)

# 加载配置
celery_app.config_from_object("celery_config")

# 自动发现任务
celery_app.autodiscover_tasks(
    [
        "tasks.mqtt_tasks",
        "tasks.export_tasks",
        "tasks.notification_tasks",
        "tasks.scheduled_tasks",
        "tasks.score_tasks",
    ]
)

if __name__ == "__main__":
    celery_app.start()


# 修复：Celery 5.6.x + billiard 4.2.x 在 Windows（spawn 而非 fork）下，
# 任务执行子进程的模块级 _localized 未被 setup_worker_optimizations 填充，
# 导致 fast_trace_task 在 `tasks, accept, hostname = _loc` 处抛
# 「ValueError: not enough values to unpack (expected 3, got 0)」，任务体永远无法执行。
# 在每个 worker 子进程初始化阶段（任务执行前）强制关闭快速追踪路径，
# 回退到不依赖 _localized 的 trace_task_ret，使异步任务（含 process_phonebox_telemetry
# 心跳落库）可正常执行。注意：必须改 celery.app.trace 的模块级全局 use_fast_trace_task，
# 仅设 celery_app.use_fast_trace_task 实例属性无效（strategy 在调用时读的是模块全局）。
@worker_process_init.connect
def _disable_fast_trace_task(sender=None, **kwargs):
    try:
        import celery.app.trace as _trace

        _trace.use_fast_trace_task = False
    except Exception:
        pass
    try:
        celery_app.use_fast_trace_task = False
    except Exception:
        pass
