#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""后端依赖安全审计脚本（可复用入口）。

封装 ``pip-audit``，规避在历史执行中踩到的坑：
- Windows 绝对路径 ``C:`` 会被 pip-audit 的 argparse 误判为 ``project_path``
  → 本脚本统一 ``cwd`` 到 backend 目录，再用**相对** ``-r requirements.lock.txt``。
- 沙箱/受限网络下 OSV 源易挂死 → 默认 ``--service pypi``，可用 ``--service osv`` 交叉。
- JSON 输出若给相对路径会被解析到 cwd 的上级（apps/.workbuddy），故 ``--json``
  必须传**绝对路径**，且默认不写盘（仅 stdout），避免污染仓库。

用法：
    python scripts/audit_deps.py                 # 默认 pypi 源，扫 requirements.lock.txt
    python scripts/audit_deps.py --service osv   # 交叉用 OSV 源
    python scripts/audit_deps.py --json D:/a.json  # 结果落盘（绝对路径）

退出码透传 pip-audit：发现已知漏洞时为非零（可作 CI 闸门）。
"""
import argparse
import os
import subprocess
import sys

DEFAULT_LOCK = "requirements.lock.txt"


def resolve_backend_dir(explicit):
    if explicit:
        return os.path.abspath(explicit)
    # 脚本位于 <root>/scripts，backend 在 <root>/apps/backend
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "apps", "backend"))


def main():
    ap = argparse.ArgumentParser(description="后端依赖安全审计（pip-audit 封装）")
    ap.add_argument(
        "--backend-dir",
        default=None,
        help="backend 目录（默认：脚本上级的 apps/backend）",
    )
    ap.add_argument(
        "--service",
        default="pypi",
        choices=["pypi", "osv", "pypi-json-api"],
        help="漏洞数据源（默认 pypi；osv 可作交叉校验）",
    )
    ap.add_argument("--lock", default=DEFAULT_LOCK, help="锁定文件名（默认 requirements.lock.txt）")
    ap.add_argument(
        "--json",
        default=None,
        help="可选：JSON 结果绝对输出路径（务必用绝对路径，避免被解析到上级目录）",
    )
    args = ap.parse_args()

    backend = resolve_backend_dir(args.backend_dir)
    lock_path = os.path.join(backend, args.lock)
    if not os.path.isfile(lock_path):
        print(f"[audit] ❌ 锁定文件不存在: {lock_path}", file=sys.stderr)
        sys.exit(2)

    # 关键：cwd 到 backend，用相对 -r，规避 Windows 盘符被误判为 project_path
    cmd = [
        sys.executable,
        "-m",
        "pip_audit",
        "-r",
        args.lock,  # 相对路径（相对 cwd=backend）
        "--service",
        args.service,
        "--desc",
        "on",
        "--progress-spinner",
        "off",
        "--timeout",
        "30",
    ]
    if args.json:
        cmd += ["-o", os.path.abspath(args.json)]

    print(
        f"[audit] cwd={backend}\n"
        f"[audit] service={args.service} lock={args.lock}\n"
        f"[audit] 命令: {' '.join(cmd)}",
        file=sys.stderr,
    )
    rc = subprocess.call(cmd, cwd=backend)
    sys.exit(rc)


if __name__ == "__main__":
    main()
