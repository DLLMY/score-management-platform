import os
import sys
import threading
import argparse
from dotenv import load_dotenv

"\n"
"学生积分管理平台 - 统一启动脚本"
"\n支持开发环境和生产环境两种模式\n"
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    os.environ["PYTHONUTF8"] = "1"
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass


def main():
    basedir = os.path.abspath(os.path.dirname(__file__))
    backend_dir = os.path.dirname(basedir)
    sys.path.insert(0, backend_dir)
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
    print("[Startup] 初始化NLP服务...")
    try:
        from services.nlp_service import get_nlp_service

        nlp_service = get_nlp_service()
        nlp_service.initialize(flask_app=app)
        nlp_service.warmup()
        print("[Startup] NLP服务初始化完成")
    except Exception as e:
        print(f"[Startup] NLP服务初始化失败: {e}")
    print("[Startup] 触发缓存预热...")
    try:
        from services.redis_cache_service import warmup_cache

        warmup_cache(app)
        print("[Startup] 缓存预热完成")
    except Exception as e:
        print(f"[Startup] 缓存预热失败: {e}")

    def bert_warmup():
        try:
            print("[Startup] 后台线程：启动BERT模型预热...")
            from services.bert_service import initialize_bert_service

            success = initialize_bert_service(warmup=True)
            if success:
                print("[Startup] BERT模型预热完成")
            else:
                print("[Startup] BERT模型预热失败，将使用TextCNN作为降级方案")
        except Exception as e:
            print(f"[Startup] BERT预热异常: {e}")

    bert_thread = threading.Thread(target=bert_warmup, daemon=True)
    bert_thread.start()
    if args.env == "production":
        print("使用 Flask-SocketIO 服务器启动（支持WebSocket）...")
        print()
        socketio.run(app, host=host, port=port, debug=False, allow_unsafe_werkzeug=True)
    else:
        use_reloader = False
        print("使用 Flask-SocketIO 开发服务器启动...")
        print()
        socketio.run(
            app,
            host=host,
            port=port,
            debug=debug,
            use_reloader=use_reloader,
            allow_unsafe_werkzeug=True,
        )


if __name__ == "__main__":
    main()
