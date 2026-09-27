#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
前端补测候选分析器（coverage ROI）

用法（cwd = apps/frontend）：
    python cov_analyze.py [top_n]

数据源说明（重要，勿踩坑）：
  本项目 vitest.config.ts 的 coverage.reporter = ['text', 'json-summary']，
  **不生成 coverage-final.json**。仓库里若残留 coverage-final.json，那是**历史旧快照**，
  直接读它会得到过时候选（B20 曾因此把 6 个已补到 ~100% 的文件重新列进候选榜）。
  因此本脚本统一以 **coverage/coverage-summary.json** 为准（每次 coverage 跑自动刷新）。

输出：
  1) 全局合计（Stmts / Funcs / Branch / Lines）
  2) 未覆盖语句 TOP N（补 Stmts/Lines 的 ROI）
  3) 未覆盖分支 TOP N（Branch 短板专用）
  4) 未覆盖函数 TOP N（Funcs 短板专用）
  5) 低覆盖(<60%)且未覆盖>=15 语句清单
"""
import json
import os
import sys

COV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "coverage")
SUMMARY_PATH = os.path.join(COV_DIR, "coverage-summary.json")

SRC_MARKER = os.path.join("src", "")


def rel_path(key):
    """把绝对路径裁剪成 src/... 相对路径，便于阅读。"""
    idx = key.find(SRC_MARKER)
    return key[idx:] if idx >= 0 else key


def ratio(m):
    return "%d/%d=%.2f%%" % (m.get("covered", 0), m.get("total", 0), m.get("pct", 0))


def main():
    top_n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    if not os.path.exists(SUMMARY_PATH):
        print("ERROR: 未找到", SUMMARY_PATH, "（请先在 apps/frontend 跑 vitest run --coverage）")
        sys.exit(2)

    with open(SUMMARY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    total = data.pop("total", None)
    if total:
        print("=" * 104)
        print(
            "全局: Stmts %s | Funcs %s | Branch %s | Lines %s"
            % (
                ratio(total["statements"]),
                ratio(total["functions"]),
                ratio(total["branches"]),
                ratio(total["lines"]),
            )
        )
        print("=" * 104)

    rows = []
    for key, m in data.items():
        if "src" not in key:
            continue
        st = m.get("statements", {})
        fn = m.get("functions", {})
        br = m.get("branches", {})
        ln = m.get("lines", {})
        rows.append(
            {
                "path": rel_path(key),
                "s": st.get("total", 0),
                "s_pct": st.get("pct", 0.0),
                "s_unc": st.get("total", 0) - st.get("covered", 0),
                "f_unc": fn.get("total", 0) - fn.get("covered", 0),
                "f_pct": fn.get("pct", 0.0),
                "b_unc": br.get("total", 0) - br.get("covered", 0),
                "b_pct": br.get("pct", 0.0),
                "l_pct": ln.get("pct", 0.0),
            }
        )

    def dump(title, key, hdr):
        sub = sorted(rows, key=lambda r: r[key], reverse=True)[:top_n]
        print("\n── %s ──" % title)
        print("%-72s %8s %7s %6s %6s %7s %7s" % ("path", hdr, "s%", "fU", "bU", "f%", "b%"))
        for r in sub:
            short = r["path"]
            if len(short) > 72:
                short = "..." + short[-69:]
            print(
                "%-72s %8d %7.1f %6d %6d %7.1f %7.1f"
                % (short, r[key], r["s_pct"], r["f_unc"], r["b_unc"], r["f_pct"], r["b_pct"])
            )

    dump("未覆盖语句 TOP（补 Stmts/Lines ROI）", "s_unc", "stmtUnc")
    dump("未覆盖分支 TOP（Branch 短板专用）", "b_unc", "brUnc")
    dump("未覆盖函数 TOP（Funcs 短板专用）", "f_unc", "fnUnc")

    low = [r for r in rows if r["s_pct"] < 60 and r["s_unc"] >= 15]
    low.sort(key=lambda r: r["s_unc"], reverse=True)
    print("\n── 低覆盖(<60%)且未覆盖>=15 语句 ──")
    print("%-72s %8s %7s %6s %6s" % ("path", "stmtUnc", "s%", "fU", "bU"))
    for r in low:
        short = r["path"]
        if len(short) > 72:
            short = "..." + short[-69:]
        print(
            "%-72s %8d %7.1f %6d %6d" % (short, r["s_unc"], r["s_pct"], r["f_unc"], r["b_unc"])
        )


if __name__ == "__main__":
    main()
