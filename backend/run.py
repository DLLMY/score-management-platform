"""
学生积分管理平台 - 统一启动脚本
\n支持开发环境和生产环境两种模式\n
"""

import os
import argparse
from dotenv import load_dotenv


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
    args = parser.parse_args()
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
