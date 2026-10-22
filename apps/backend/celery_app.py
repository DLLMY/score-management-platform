import os

from celery import Celery, Task
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

# Flask 应用上下文任务基座（2026-10-22 深度修复）：
# celery worker 子进程默认无 Flask app_context，而本仓任务大量触碰
# db.session / Model.query / get_cache_service 等依赖上下文的组件。
# 2026-10-21 实证：scheduled_tasks 4 个 beat 任务在 worker 下恒崩/恒败，
# 根因即缺上下文（当时靠逐任务自包 app_context 兜底）。
# 设 ContextTask 基座后，所有经 .delay()/.apply_async() 派发的任务在 worker
# 侧自动获得 app_context，从协议层根治「新任务忘记自包」这一错误模式；
# 既有任务内层自包变为安全嵌套（Flask app_context 可嵌套，内层复用同一
# 实例），执行行为不变。
# 约束：必须在 autodiscover_tasks / include 注册任务前设置基座；app 单例在
# __call__ 内惰性导入（celery_app <- tasks 单向依赖，app 包不 import celery，
# 无循环）；导入失败时降级为无上下文执行，保证 worker 启动不因基座崩溃。
class ContextTask(Task):
    """Celery 任务基座：执行体自动获得 Flask app_context。

    语义与 tasks.scheduled_tasks._resolve_flask_app 一致：调用链已有环境
    上下文（请求线程 / 测试夹具 / 同步回退链）时直接沿用，绝不导入单例；
    仅 worker 子进程（无上下文）才惰性导入 app 单例并包裹。
    2026-10-22 实证：直调任务实例（@task 装饰后名字绑定 Task 实例，调用
    即 __call__）若一律取单例，会使「测试 app 上下文内直调任务」的既有
    用例误连真实库。
    """

    def __call__(self, *args, **kwargs):
        from flask import has_app_context

        if has_app_context():
            return self.run(*args, **kwargs)
        try:
            from app import app as flask_app
        except Exception:
            return self.run(*args, **kwargs)
        with flask_app.app_context():
            return self.run(*args, **kwargs)


celery_app.Task = ContextTask

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
