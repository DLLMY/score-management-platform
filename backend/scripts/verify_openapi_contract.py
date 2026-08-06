#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenAPI 契约漂移校验脚本（P1 改进项：建立前后端 API 契约）。

背景：api-docs/openapi.json 是 2026-07-29 手工导出的 OpenAPI 快照；后端持续演进，
文档极易过期（新增/删除/改名端点后没人同步）。本脚本对比「实时 swagger.json」
与「快照」，报告契约漂移，使文档过期可被发现。

用法（cwd=backend，需后端 5000 已启动）：
    python scripts/verify_openapi_contract.py                 # 默认对比运行中后端
    python scripts/verify_openapi_contract.py --snapshot ../api-docs/openapi.json
    python scripts/verify_openapi_contract.py --live-url http://127.0.0.1:5000/api/swagger.json
    python scripts/verify_openapi_contract.py --strict        # 有漂移时 exit 1
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DEFAULT_SNAPSHOT = BASE_DIR.parent / "api-docs" / "openapi.json"
DEFAULT_LIVE_URL = "http://127.0.0.1:5000/api/swagger.json"


def _load_live(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _extract_paths(doc):
    """兼容两种 swagger 结构：标准 OpenAPI（paths 在顶层）与信封包裹
    （{success, code, data:{paths}}——flask-restx + APIResponse envelope）。"""
    paths = doc.get("paths")
    if paths is None and isinstance(doc.get("data"), dict):
        paths = doc["data"].get("paths")
    return paths or {}


def _norm(path):
    """归一化路径：去尾部斜杠，便于比较。"""
    p = path.rstrip("/")
    return p if p else "/"


def _method_set(path_item):
    """提取路径下的 HTTP 方法集合（去 head/options）。"""
    return {
        m.upper() for m in path_item.keys() if m.upper() in ("GET", "POST", "PUT", "DELETE", "PATCH")
    }


def main():
    ap = argparse.ArgumentParser(description="OpenAPI 契约漂移校验（实时 swagger vs 快照）")
    ap.add_argument("--snapshot", default=str(DEFAULT_SNAPSHOT), help="OpenAPI 快照文件路径")
    ap.add_argument("--live-url", default=DEFAULT_LIVE_URL, help="实时 swagger.json 地址")
    ap.add_argument("--strict", action="store_true", help="存在漂移时 exit 1（默认仅报告）")
    ap.add_argument("--update", action="store_true", help="用实时 swagger 覆盖快照（先备份 .bak_<ts>）")
    args = ap.parse_args()

    try:
        live = _load_live(args.live_url)
    except Exception as e:  # noqa: BLE001
        print(f"[错误] 无法拉取实时 swagger.json（{args.live_url}）: {e}\n"
              f"        请确认后端已启动（python run.py --env development --host 127.0.0.1 --port 5000）")
        sys.exit(2)

    snapshot_path = Path(args.snapshot)
    if not snapshot_path.exists():
        print(f"[错误] 快照文件不存在: {snapshot_path}")
        sys.exit(2)
    with open(snapshot_path, encoding="utf-8") as f:
        snapshot = json.load(f)

    live_paths = {_norm(p): item for p, item in _extract_paths(live).items()}
    snap_paths = {_norm(p): item for p, item in _extract_paths(snapshot).items()}

    # ---- --update：用实时文档覆盖快照（先备份，绝不静默覆盖） ----
    if args.update:
        import shutil
        import time

        live_doc = (
            live["data"]
            if live.get("paths") is None and isinstance(live.get("data"), dict) and "paths" in live.get("data")
            else live
        )
        bak = snapshot_path.with_suffix(
            snapshot_path.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}"
        )
        shutil.copy2(snapshot_path, bak)
        with open(snapshot_path, "w", encoding="utf-8") as f:
            json.dump(live_doc, f, ensure_ascii=False, indent=2)
        print(f"[更新] 快照已用实时文档覆盖: {snapshot_path}")
        print(f"       旧版已备份: {bak}")
        with open(snapshot_path, encoding="utf-8") as f:
            snapshot = json.load(f)
        snap_paths = {_norm(p): item for p, item in _extract_paths(snapshot).items()}

    only_live = sorted(set(live_paths) - set(snap_paths))          # 新增端点，文档未同步
    only_snap = sorted(set(snap_paths) - set(live_paths))          # 已删除/改名端点，文档残留
    method_diffs = sorted(
        p for p in (set(live_paths) & set(snap_paths))
        if _method_set(live_paths[p]) != _method_set(snap_paths[p])
    )

    print(f"快照路径数: {len(snap_paths)} | 实时路径数: {len(live_paths)}")
    print(f"新增端点（文档缺失）: {len(only_live)}")
    for p in only_live[:30]:
        print(f"  + {p} {sorted(_method_set(live_paths[p]))}")
    if len(only_live) > 30:
        print(f"  ... 等 {len(only_live)} 个")
    print(f"消失端点（文档残留）: {len(only_snap)}")
    for p in only_snap[:20]:
        print(f"  - {p}")
    print(f"方法不一致端点: {len(method_diffs)}")
    for p in method_diffs[:20]:
        print(f"  ~ {p}: 快照{ sorted(_method_set(snap_paths[p])) } vs 实时{ sorted(_method_set(live_paths[p])) }")

    drift = only_live or only_snap or method_diffs
    if not drift:
        print("[结果] OpenAPI 契约一致，无漂移")
    else:
        print(f"[结果] 发现 {len(only_live)} 新增 + {len(only_snap)} 消失 + {len(method_diffs)} 方法差异 处漂移"
              f"（提示：更新 api-docs/openapi.json 快照）")
    sys.exit(1 if (drift and args.strict) else 0)


if __name__ == "__main__":
    main()
