import os
import sys
from config import config

"""
Gunicorn配置文件
"""
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
GUNICORN_BIND = config.GUNICORN_BIND
GUNICORN_WORKERS = config.GUNICORN_WORKERS
GUNICORN_THREADS = config.GUNICORN_THREADS
GUNICORN_WORKER_CLASS = config.GUNICORN_WORKER_CLASS
GUNICORN_MAX_REQUESTS = config.GUNICORN_MAX_REQUESTS
GUNICORN_TIMEOUT = config.GUNICORN_TIMEOUT
GUNICORN_GRACEFUL_TIMEOUT = config.GUNICORN_GRACEFUL_TIMEOUT
GUNICORN_LOG_LEVEL = config.GUNICORN_LOG_LEVEL
GUNICORN_KEEPALIVE = config.GUNICORN_KEEPALIVE
GUNICORN_MAX_REQUESTS_JITTER = config.GUNICORN_MAX_REQUESTS_JITTER
LOG_DIR = config.LOG_DIR
os.makedirs(LOG_DIR, exist_ok=True)
bind = GUNICORN_BIND
workers = GUNICORN_WORKERS
threads = GUNICORN_THREADS
worker_class = GUNICORN_WORKER_CLASS
max_requests = GUNICORN_MAX_REQUESTS
timeout = GUNICORN_TIMEOUT
graceful_timeout = GUNICORN_GRACEFUL_TIMEOUT
pidfile = "gunicorn.pid"
accesslog = os.path.join(LOG_DIR, "gunicorn_access.log")
errorlog = os.path.join(LOG_DIR, "gunicorn_error.log")
loglevel = GUNICORN_LOG_LEVEL
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
raw_env = [
    "FLASK_APP=app",
    "FLASK_ENV=production",
]
preload_app = True
worker_connections = 1000
keepalive = GUNICORN_KEEPALIVE
max_requests_jitter = GUNICORN_MAX_REQUESTS_JITTER
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s'
if GUNICORN_WORKER_CLASS == "gevent":
    worker_connections = 1000
    preload_app = False
