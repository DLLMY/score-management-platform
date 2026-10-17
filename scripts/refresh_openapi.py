#!/usr/bin/env python3
"""刷新 docs/api/openapi.json 快照（从运行中的 Flask app 拉取最新 Swagger spec）。

用法（项目根目录）：
    apps/backend/.venv/Scripts/python.exe scripts/refresh_openapi.py

说明：
- 项目用 Flasgger（app/config_init.py::Swagger），spec 端点为 /api/spec
  （swagger_config.specs[0].route），UI 在 /swagger/；flask_restx 的 doc="/docs/"
  另提供 /api/v1/docs/ 交互界面；
- FLASK_LIGHTWEIGHT=true 时 Swagger 不初始化（回归测试口径），本脚本强制关闭；
- 通过 test_client 拉取，无需启动真实服务；写盘前做最小校验（swagger 2.0 +
  paths 非空），防止把错误页写进 spec；
- 旧文件自动备份为 openapi.json.bak_<时间戳>（与 docs/api 现有惯例一致）。
"""

import json
import os
import shutil
import sys
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BACKEND = os.path.join(ROOT, "apps", "backend")
OUT = os.path.join(ROOT, "docs", "api", "openapi.json")
# flask_restx 的 spec 端点（471 路径的真正来源）；flasgger 的 /api/spec 基于
# @swag_from 注解收集，与 restx 路由体系不同
SPEC_ROUTE = "/api/v1/swagger.json"


def main():
    # Flasgger 在 lightweight 模式下不初始化。import 时模块级 app 单例已按
    # FLASK_LIGHTWEIGHT=false 创建（含 Swagger/_swagger_initialized 守卫），
    # 必须复用 get_app() 单例；另建 create_app() 实例会被守卫跳过 Swagger 注册。
    os.environ["FLASK_LIGHTWEIGHT"] = "false"
    if BACKEND not in sys.path:
        sys.path.insert(0, BACKEND)
    os.chdir(BACKEND)

    from app import get_app

    app = get_app()
    client = app.test_client()
    resp = client.get(SPEC_ROUTE)
    if resp.status_code != 200:
        print(f"[refresh-openapi] FAIL: {SPEC_ROUTE} -> HTTP {resp.status_code}")
        print(resp.data[:300])
        return 1
    body = resp.get_json()
    # 项目信封中间件会把响应包成 {success, code, message, data}，spec 在 data 里
    spec = body.get("data") if isinstance(body, dict) and "data" in body else body
    if not spec or spec.get("swagger") != "2.0" or not spec.get("paths"):
        print("[refresh-openapi] FAIL: spec 校验不过（swagger!=2.0 或 paths 为空）")
        if isinstance(body, dict):
            print("  body keys:", list(body.keys())[:6])
        return 1

    if os.path.exists(OUT):
        bak = OUT + ".bak_" + datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(OUT, bak)
        print(f"[refresh-openapi] backup -> {os.path.relpath(bak, ROOT)}")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)
    print(
        f"[refresh-openapi] OK: {os.path.relpath(OUT, ROOT)}  "
        f"paths={len(spec['paths'])}  size={os.path.getsize(OUT)} bytes"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
