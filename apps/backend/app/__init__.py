import os
import sys

from flask import Flask, redirect, request

from app.api_versioning import api_version_manager

limiter = None

_app_instance = None


def create_app(lightweight=False):
    global limiter

    app = Flask(__name__)

    # 让迁移脚本 `from app import app` 在初始化阶段即可解析到"当前"实例。
    # 否则 wsgi/run.py 直接 create_app() 时，模块级 app 属性仍指向 get_app() 首次创建的实例，
    # 会导致迁移脚本在错误的应用上下文里执行（P0-d 编排器在启动时导入这些脚本）。
    sys.modules[__name__].app = app

    from app.config_init import init_config

    init_config(app, lightweight=lightweight)

    limiter = app.limiter

    if app.config.get("APP_ENV") == "production":

        @app.before_request
        def enforce_https():
            if not request.is_secure:
                url = request.url.replace("http://", "https://", 1)
                return redirect(url, code=301)
            return None

    from app.db_init import init_database

    init_database(app)

    # 初始化全文搜索引擎（需在应用上下文中执行）
    if not lightweight:
        try:
            from utils.fulltext_search import get_search_engine

            search_engine = get_search_engine(app)
            with app.app_context():
                search_engine.init_app(app)
            app.search_engine = search_engine
        except Exception as e:
            app.logger.warning(f"全文搜索引擎初始化失败: {e}", exc_info=True)

    from utils.error_handler import register_error_handlers

    register_error_handlers(app)

    from middleware.response_middleware import ResponseMiddleware

    ResponseMiddleware(app)

    # 全局写请求缓存自动失效（兜底所有漏手写 invalidate_cache 的写端点，根治幽灵数据）
    from middleware.cache_invalidation import register_cache_invalidation

    register_cache_invalidation(app)

    # P2-1: 安全响应头（CSP/nosniff/X-Frame/Referrer），缓解 XSS 与点击劫持面
    from middleware.security_headers import register_security_headers

    register_security_headers(app)

    if not lightweight:
        from app.api_versioning import api_version_manager

        api_version_manager.init_app(app)

        from app.service_init import init_services

        init_services(app, lightweight=lightweight)

        from utils.route_registry import check_route_duplicates

        check_route_duplicates(app)

        from middleware import configure_csrf_exemptions, configure_rate_limits

        csrf = app.config.get("csrf_instance")
        limiter = app.config.get("limiter_instance")
        if csrf:
            configure_csrf_exemptions(app, csrf, limiter)
        # F7 修复: 启用登录/密码/设备写/规则写限流（此前 configure_rate_limits 从未被调用）
        if limiter:
            configure_rate_limits(app, limiter)

        # P1-监控：暴露 Prometheus 原生 /metrics 端点（免鉴权 scrape）。
        # 测试 app（TESTING）不注册，避免污染测试并零回归。
        if not app.config.get("TESTING"):
            from app.metrics_exporter import init_metrics

            init_metrics(app)

        # G5: OTA 部署自检（生产环境未配置 OTA_FIRMWARE_BASE_URL 则高优告警）。
        # TESTING 环境跳过，避免测试噪声；生产判定由函数内部完成。
        # 自检失败绝不影响启动流程（仅告警）。
        _run_ota_deploy_self_check(app)

    # D-M1: 日志自动归档（压缩轮转 + 超期清理）启动钩子
    from utils.log_archiver import setup_log_archiving

    setup_log_archiving(app)

    return app


def _run_ota_deploy_self_check(app):
    """G5: 启动期 OTA 部署自检（失败安全）。仅非 TESTING 应用调用，异常绝不阻断启动。"""
    if app.config.get("TESTING"):
        return
    try:
        from services.ota_negotiation_service import check_ota_deploy_config

        check_ota_deploy_config()
    except Exception as e:  # 自检异常不阻断启动
        app.logger.warning(f"OTA 部署自检执行异常（已忽略）: {e}")


def get_app(lightweight=False):
    global _app_instance
    if _app_instance is None:
        _app_instance = create_app(lightweight=lightweight)
    return _app_instance


def reset_app():
    global _app_instance

    api_version_manager.reset()
    _app_instance = None


app = get_app(lightweight=os.getenv("FLASK_LIGHTWEIGHT", "false").lower() == "true")
