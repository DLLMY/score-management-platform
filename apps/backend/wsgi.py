import os
import sys
import logging

"""
WSGI Entry Point for Production Deployment ==========================================
==========================================
It uses Waitress (Windows-friendly) or can be used with Gunicorn (Linux/Docker).

Usage:
    # Development (still using Flask dev server)
    python app.py

    # Production with Waitress
    pip install waitress
    waitress-serve --host=0.0.0.0 --port=5000 wsgi:application

    # Production with Gunicorn (Linux/Docker)
    pip install gunicorn
    gunicorn --bind 0.0.0.0:5000 --workers=4 --threads=2 wsgi:application

Environment Variables:
    FLASK_ENV=production      # Set to production
    FLASK_DEBUG=false         # Disable debug mode
    PORT=5000                 # Port to listen on
"""

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging for production
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)

logger = logging.getLogger(__name__)

# Set production environment variables before importing the app
os.environ.setdefault("FLASK_ENV", "production")
os.environ.setdefault("FLASK_DEBUG", "false")

try:
    from app import create_app

    flask_app = create_app()

    # P0-b: 暴露 SocketIO WSGI 包装器作为 gunicorn 入口，使 WebSocket 在生产可用。
    # 生产镜像使用 flask_socketio.serving.SocketIOWorker（async_mode=threading，无 monkey-patch）。
    # 若 socketio 未初始化（极端异常），回退为纯 Flask 应用（HTTP 仍可用，仅 WS 不可用）。
    _socketio = getattr(flask_app, "socketio", None)
    application = _socketio if _socketio is not None else flask_app

    # P0-d：数据库模式对账 + 幂等种子已在 app/db_init.init_database 内随 create_app 自动执行
    # （ensure_database_ready：按模型 metadata 补全缺失表/列/索引 + 补齐 class_periods /
    # warning_configs 默认数据）。此处不再单独调用脆弱的手写迁移脚本编排器。
    # 历史手写脚本保留于 apps/backend/migrations/*.py 仅供运维参考，active 路径为 reconcile.py。

    logger.info("Flask application loaded successfully")
    logger.info(f"Environment: {flask_app.config.get('FLASK_ENV', 'unknown')}")
    logger.info(f"Debug mode: {flask_app.config.get('FLASK_DEBUG', 'false')}")
    logger.info(
        f"WebSocket entry: {'enabled (SocketIO WSGI)' if _socketio is not None else 'Flask-only (fallback, WS disabled)'}"
    )

except Exception as e:
    logger.error(f"Failed to load Flask application: {str(e)}", exc_info=True)
    raise

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    host = os.getenv("FLASK_HOST", "127.0.0.1")

    logger.info(f"Starting production server on {host}:{port}")

    try:
        from waitress import serve

        serve(application, host=host, port=port, threads=4)
    except ImportError:
        logger.warning("Waitress not installed, falling back to Flask dev server")
        application.run(host=host, port=port, debug=False)
