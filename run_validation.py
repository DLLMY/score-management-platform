#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提交前快速验证脚本（由 .git/hooks/pre-commit 调用）。

验证范围（保持轻量，<5 秒）：
- 本次提交涉及的 Python 文件语法编译检查（compile()，不执行）
- 前端变更仅提示（完整验证走 scripts/run_regression.sh）

说明：历史 hook 引用的 run_validation.py 缺失导致所有提交被拦截，
此文件补齐该入口。如需更严格的提交前检查（契约/RBAC/OpenAPI），
可在 CI 或 scripts/run_regression.sh 中执行。
"""
import subprocess
import sys


def main():
    try:
        staged = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            text=True,
        ).splitlines()
    except Exception as e:  # noqa: BLE001
        print(f"[验证] 无法读取暂存区: {e}，跳过")
        sys.exit(0)

    py_files = [f for f in staged if f.endswith(".py")]
    errors = []
    for f in py_files:
        try:
            with open(f, encoding="utf-8") as fh:
                compile(fh.read(), f, "exec")
        except SyntaxError as e:
            errors.append(f"{f}: {e.msg} (行 {e.lineno})")
        except Exception as e:  # noqa: BLE001
            errors.append(f"{f}: {e}")

    if errors:
        print("[验证] ❌ Python 语法检查失败:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    print(f"[验证] ✅ Python 语法检查通过（{len(py_files)} 个文件）")
    sys.exit(0)


if __name__ == "__main__":
    main()
