# -*- coding: utf-8 -*-
"""
安全响应头中间件（第十次评估 P2-1 加固）
----------------------------------------
统一为所有响应添加安全头，缓解 XSS / 点击劫持 / MIME 嗅探 / 信息泄漏：

- Content-Security-Policy：宽松策略（保留 'unsafe-inline' 供 antd cssinjs 样式与
  vite 产物；connect-src 放行 ws/wss 供 WebSocket / MQTT 前端通道）
- X-Content-Type-Options: nosniff（防 MIME 嗅探）
- X-Frame-Options: SAMEORIGIN（防点击劫持）
- Referrer-Policy: strict-origin-when-cross-origin（防跨站泄漏）

仅在 HTML/API 响应上附加；对已设置同头的响应不覆盖（幂等）。
"""
from flask import request

# 注意：script-src 不开放 'unsafe-eval'；dev 模式 vite HMR 需要 ws://127.0.0.1:3000，
# 生产部署由同源反向代理提供时 connect-src 'self' ws: wss: 足够。
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        "frame-ancestors 'self'; "
        "object-src 'none'; "
        "base-uri 'self'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


def register_security_headers(app):
    """注册安全响应头（after_request，幂等不覆盖已设置的头）。"""

    @app.after_request
    def _apply_security_headers(response):
        # 静态资源（/assets/*）也加头无害；对已显式设置的头不覆盖
        for name, value in SECURITY_HEADERS.items():
            if name not in response.headers:
                response.headers[name] = value
        return response

    return _apply_security_headers
