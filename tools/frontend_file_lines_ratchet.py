#!/usr/bin/env python3
"""前端单文件行数 ratchet（防腐化闸门）。

阈值：600 行。当前已超限的文件进入基线豁免清单（BASELINE_EXEMPT）——
  ① 既有豁免不失效；② 任何**新增**文件超 600 行 → 失败；
  ③ 豁免文件行数**继续增长** → 失败（只能减不能增，逼使逐步收敛）。
用法：
    python tools/frontend_file_lines_ratchet.py          # 核验，超限 exit 1
    python tools/frontend_file_lines_ratchet.py --list   # 仅列当前超限文件
退出码：0 = 通过；1 = 有非豁免/增长文件超限。
"""

import os
import sys

SRC = os.path.join("apps", "frontend", "src")
THRESHOLD = 600
EXTS = (".ts", ".tsx", ".js", ".jsx")

# 基线豁免（2026-10-16 实测）：已超 600 行的现存文件。行数只减不增。
BASELINE_EXEMPT = {
    "services/api.ts": 6486,
    "types/index.ts": 1614,
    "services/__tests__/api.endpoints.test.ts": 1329,
    "App.tsx": 862,
    "components/special/ImportExportPanel.tsx": 803,
    "components/layout/Header.tsx": 798,
    "pages/remote-notify/__tests__/useRemoteNotifyHandlers.test.tsx": 759,
    "components/layout/Sidebar.tsx": 651,
}


def count_lines(path):
    with open(path, "rb") as f:
        return sum(1 for _ in f)


def scan():
    hits = []
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        for f in files:
            if not f.endswith(EXTS):
                continue
            p = os.path.join(root, f)
            rel = os.path.relpath(p, SRC).replace(os.sep, "/")
            n = count_lines(p)
            if n > THRESHOLD:
                hits.append((rel, n))
    return sorted(hits, key=lambda x: -x[1])


def main():
    if "--list" in sys.argv:
        for rel, n in scan():
            mark = "BASELINE" if rel in BASELINE_EXEMPT else "VIOLATION"
            print(f"{n:>6}  {mark:9}  {rel}")
        return 0

    hits = scan()
    violations = []
    for rel, n in hits:
        if rel not in BASELINE_EXEMPT:
            violations.append((rel, n, "新增文件超阈值（不在基线豁免）"))
        elif n > BASELINE_EXEMPT[rel]:
            violations.append((rel, n, f"豁免文件增长（基线 {BASELINE_EXEMPT[rel]}）"))

    if violations:
        print(f"[lines-ratchet] FAIL: {len(violations)} 个文件超过 {THRESHOLD} 行且未合规")
        for rel, n, why in violations:
            print(f"  {n:>6}  {rel}  ({why})")
        print(f"[lines-ratchet] 阈值 {THRESHOLD}；豁免文件只减不增；大文件请拆分（react-page-split）")
        return 1

    n_exempt = sum(1 for rel, _ in hits if rel in BASELINE_EXEMPT)
    print(f"[lines-ratchet] OK: 无新增超限文件（{n_exempt} 个基线豁免未增长，阈值 {THRESHOLD}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
