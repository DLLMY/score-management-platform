"""
学生积分管理平台 - 统一启动脚本
\n支持开发环境和生产环境两种模式\n
"""

import os
import argparse
import subprocess
import sys
import atexit
import socket
import re
from dotenv import load_dotenv


def _redis_reachable(host, port, timeout=2):
    """探测 Redis/Celery Broker 是否可达（不依赖 redis 客户端库）"""
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except OSError:
        return False


def maybe_start_celery(basedir, env):
    """可选启动 Celery worker + beat。

    此前 Celery 仅配置未实际运行 → 异步(通知/导出/MQTT)与定时任务(归档日志/清缓存/
    预热/日报/健康检查/设备状态)永不执行。
    行为：
    - 生产环境默认启动（START_CELERY=0 可关）；开发环境需 --with-celery 显式开启。
    - Broker(Redis) 不可达时安全跳过，不影响 Web 服务启动。
    """
    enabled = os.getenv("START_CELERY", "1" if env == "production" else "0") == "1"
    if not enabled:
        return []
    broker = os.getenv("CELERY_BROKER_URL", "")
    m = re.match(r"redis://([^:/]+):(\d+)", broker) if broker else None
    host = m.group(1) if m else os.getenv("REDIS_HOST", "localhost")
    port = m.group(2) if m else os.getenv("REDIS_PORT", "6379")
    if not _redis_reachable(host, port):
        print(f"[Celery] Broker({host}:{port}) 不可达，跳过 Celery 启动（不影响 Web 服务）")
        return []
    procs = []
    common = [sys.executable, "-m", "celery", "-A", "celery_app"]
    try:
        procs.append(
            subprocess.Popen(
                common
                + [
                    "worker",
                    "-Q",
                    "default,notification,mqtt,export",
                    "-c",
                    "4",
                    "--loglevel=info",
                ],
                cwd=basedir,
            )
        )
        procs.append(subprocess.Popen(common + ["beat", "--loglevel=info"], cwd=basedir))
        print(f"[Celery] 已启动 worker + beat（共 {len(procs)} 个进程）")
    except Exception as e:  # noqa: BLE001
        print(f"[Celery] 启动失败，跳过（不影响 Web 服务）: {e}")
        return []

    def _stop():
        for p in procs:
            try:
                p.terminate()
            except Exception:  # noqa: BLE001
                pass

    atexit.register(_stop)
    return procs


def main():
    parser = argparse.ArgumentParser(description="学生积分管理平台启动脚本")
    parser.add_argument(
        "--env",
        type=str,
        default="development",
        choices=["development", "production"],
        help="运行环境: development 或 production (默认: development)",
    )
    parser.add_argument("--host", type=str, default=None, help="监听地址 (默认: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=None, help="监听端口 (默认: 5000)")
    parser.add_argument("--debug", action="store_true", help="开启调试模式 (仅开发环境)")
    parser.add_argument(
        "--with-celery",
        action="store_true",
        help="开发环境下同时启动 Celery worker + beat（生产环境默认已启动）",
    )
    args = parser.parse_args()
    if args.with_celery:
        os.environ["START_CELERY"] = "1"
    basedir = os.path.abspath(os.path.dirname(__file__))
    env_file = os.path.join(basedir, ".env")
    if os.path.exists(env_file):
        load_dotenv(env_file)
    os.environ["FLASK_ENV"] = args.env
    host = args.host or os.getenv("FLASK_HOST", "127.0.0.1")
    port = args.port or int(os.getenv("FLASK_PORT", "5000"))
    debug = args.debug or args.env == "development"
    print("=" * 60)
    print("  学生积分管理平台 - 服务启动")
    print("=" * 60)
    print(f"  环境: {args.env}")
    print(f"  地址: http://{host}:{port}")
    print(f"  调试: {debug}")
    print("=" * 60)
    print()
    from app import app
    from flask_socketio import SocketIO

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
    from services.websocket_service import register_handlers

    register_handlers(socketio)
    maybe_start_celery(basedir, args.env)
    if args.env == "production":
        print("使用 Flask-SocketIO 服务器启动（支持WebSocket）...")
        print()
        socketio.run(app, host=host, port=port, debug=False, allow_unsafe_werkzeug=True)
    else:
        print("使用 Flask-SocketIO 开发服务器启动...")
        print()
        socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
