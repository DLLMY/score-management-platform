#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从运行中后端导出 OpenAPI 规范快照到 docs/api/openapi.json。

解决静态文档漂移问题：flask-restx 在线 /swagger/ 始终与代码一致，
但 docs/api/openapi.json 是快照，需在接口变更后刷新。

用法：
    # 后端已在 http://127.0.0.1:5000 运行（默认）
    python scripts/export_openapi.py
    # 指定后端地址
    API_BASE_URL=http://192.168.1.10:5000 python scripts/export_openapi.py

候选 spec 端点（flask-restx 默认）：
    - {base}/swagger.json     （specs_route="/swagger/" 对应）
    - {base}/apidocs/swagger.json
导出成功后写入 <root>/docs/api/openapi.json（覆盖旧快照）。
"""
import os
import sys
import urllib.request
import json

DEFAULT_BASE = "http://127.0.0.1:5000"
CANDIDATE_PATHS = ["/swagger.json", "/apidocs/swagger.json"]
TIMEOUT = 10


def main():
    base = os.getenv("API_BASE_URL", DEFAULT_BASE).rstrip("/")
    here = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.abspath(os.path.join(here, "..", "docs", "api", "openapi.json"))

    spec = None
    used_url = None
    last_err = None
    for path in CANDIDATE_PATHS:
        url = base + path
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                if resp.status == 200:
                    raw = resp.read().decode("utf-8")
                    spec = json.loads(raw)
                    used_url = url
                    break
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue

    if spec is None:
        print(
            f"[export] ❌ 无法从后端获取 OpenAPI 规范。\n"
            f"  请确认后端已启动且可访问（默认 {DEFAULT_BASE}，可用 API_BASE_URL 覆盖）。\n"
            f"  最后错误: {last_err}",
            file=sys.stderr,
        )
        sys.exit(1)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(spec, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    title = spec.get("info", {}).get("title", "API")
    ver = spec.get("info", {}).get("version", "?")
    print(
        f"[export] ✅ 已导出 {title} v{ver}\n"
        f"  源: {used_url}\n"
        f"  目标: {out_path}"
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
