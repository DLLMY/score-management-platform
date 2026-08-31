from celery import Celery
import os

# 设置Flask应用环境变量
os.environ.setdefault("FLASK_APP", "app.py")
os.environ.setdefault("FLASK_ENV", "development")

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
