#!/usr/bin/env python
"""
索引部署闸门脚本（M11）
------------------------
校验数据库核心性能索引是否齐全（清单与 scripts/create_indexes.py 同源）。
缺失任一索引即退出码 1（回归闸门报警），防止新环境漏跑索引导致静默全表扫描。

用法（backend/ 目录）：
    python scripts/verify_indexes.py
    # 缺失时输出清单并 exit 1；全部存在输出 [OK] 并 exit 0

已纳入 scripts/run_regression.sh（回归闸门第 5 步）。
"""
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from create_indexes import verify_indexes as _verify


def main():
    missing = _verify()
    if missing:
        print(f"[失败] 缺失 {len(missing)} 个核心索引:")
        for m in missing:
            print(f"  - {m}")
        print("提示：运行 python scripts/create_indexes.py --create 补建")
        return 1
    print("[OK] 核心索引全部存在")
    return 0


if __name__ == "__main__":
    sys.exit(main())
