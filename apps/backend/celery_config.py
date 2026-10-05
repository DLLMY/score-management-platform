"""
Celery配置文件
\n============= 使用统一的config模块，所有配置项从config.py读取。\n
"""

from config import (
    CELERY_ACCEPT_CONTENT,
    CELERY_BEAT_SCHEDULE,
    CELERY_BEAT_SCHEDULE_FILENAME,
    CELERY_BEAT_SCHEDULER,
    CELERY_BROKER_URL,
    CELERY_ENABLE_UTC,
    CELERY_RESULT_BACKEND,
    CELERY_RESULT_SERIALIZER,
    CELERY_TASK_ACKS_LATE,
    CELERY_TASK_DEFAULT_RETRY_DELAY,
    CELERY_TASK_MAX_RETRIES,
    CELERY_TASK_QUEUES,
    CELERY_TASK_REJECT_ON_WORKER_LOST,
    CELERY_TASK_ROUTES,
    CELERY_TASK_SERIALIZER,
    CELERY_TASK_SOFT_TIME_LIMIT,
    CELERY_TASK_TIME_LIMIT,
    CELERY_TIMEZONE,
    CELERY_WORKER_CONCURRENCY,
    CELERY_WORKER_PREFETCH_MULTIPLIER,
)

broker_url = CELERY_BROKER_URL
result_backend = CELERY_RESULT_BACKEND
task_serializer = CELERY_TASK_SERIALIZER
result_serializer = CELERY_RESULT_SERIALIZER
accept_content = CELERY_ACCEPT_CONTENT
timezone = CELERY_TIMEZONE
enable_utc = CELERY_ENABLE_UTC
task_queues = CELERY_TASK_QUEUES
task_routes = CELERY_TASK_ROUTES
worker_concurrency = CELERY_WORKER_CONCURRENCY
worker_prefetch_multiplier = CELERY_WORKER_PREFETCH_MULTIPLIER
task_acks_late = CELERY_TASK_ACKS_LATE
task_reject_on_worker_lost = CELERY_TASK_REJECT_ON_WORKER_LOST
task_track_started = True
task_default_retry_delay = CELERY_TASK_DEFAULT_RETRY_DELAY
task_max_retries = CELERY_TASK_MAX_RETRIES
beat_schedule = CELERY_BEAT_SCHEDULE
beat_scheduler = CELERY_BEAT_SCHEDULER
beat_schedule_filename = CELERY_BEAT_SCHEDULE_FILENAME
task_time_limit = CELERY_TASK_TIME_LIMIT
task_soft_time_limit = CELERY_TASK_SOFT_TIME_LIMIT
# 无 broker（如开发/沙箱未运行 Redis）时：让 .delay() 立即失败（不重试、短超时），
# 触发 mqtt_manager 的同步兜底路径处理遥测，避免阻塞 MQTT 回调线程；
# broker 可达时此配置无副作用。
broker_connection_max_retries = 0
broker_connection_timeout = 2
worker_log_format = "%(asctime)s - %(levelname)s - %(message)s"
worker_task_log_format = "%(asctime)s - %(levelname)s - %(task_name)s - %(task_id)s - %(message)s"
imports = ("tasks",)
result_expires = 86400
