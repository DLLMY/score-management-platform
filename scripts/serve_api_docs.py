#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地静态托管 docs/api 目录，便于离线查看 API 文档站。

启动后访问 http://127.0.0.1:8088/swagger-ui.html 即可查看 Swagger UI（加载同目录 openapi.json）。

用法：
    python scripts/serve_api_docs.py            # 默认 8088
    python scripts/serve_api_docs.py --port 9000
    python scripts/serve_api_docs.py --host 0.0.0.0 --port 8088

注意：swagger-ui.html 的 UI 资源来自 unpkg CDN，浏览器需联网才能渲染 UI；
openapi.json 为本地文件，不受网络影响。
"""
import argparse
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


def main():
    ap = argparse.ArgumentParser(description="本地静态托管 API 文档站（docs/api）")
    ap.add_argument("--host", default="127.0.0.1", help="监听地址（默认 127.0.0.1）")
    ap.add_argument("--port", type=int, default=8088, help="监听端口（默认 8088）")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    doc_dir = os.path.abspath(os.path.join(here, "..", "docs", "api"))
    if not os.path.isdir(doc_dir):
        print(f"[serve] ❌ 目录不存在: {doc_dir}", file=sys.stderr)
        sys.exit(1)

    os.chdir(doc_dir)

    # 让目录列表与默认文档更友好
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=doc_dir, **kw)

        def log_message(self, fmt, *a):  # 静默默认访问日志
            pass

    httpd = HTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}/swagger-ui.html"
    print(f"[serve] 📚 API 文档站已启动：{url}")
    print(f"[serve] 根目录: {doc_dir}")
    print(f"[serve] 按 Ctrl+C 停止")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[serve] 已停止")
        httpd.server_close()


if __name__ == "__main__":
    main()
