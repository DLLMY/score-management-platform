#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""分析 vitest v8 覆盖率 JSON（coverage-final.json），按「未覆盖语句数」降序列出补测候选。"""
import json
import os
import sys

COV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "coverage")
JSON_PATH = os.path.join(COV_DIR, "coverage-final.json")


def main():
    if not os.path.exists(JSON_PATH):
        print("ERROR: 未找到", JSON_PATH, file=sys.stderr)
        sys.exit(2)
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = []
    tot_s = tot_s_cov = tot_f = tot_f_cov = 0
    tot_branch = tot_branch_cov = 0
    for path, cov in data.items():
        s_map = cov.get("statementMap", {})
        s_hit = cov.get("s", {})
        f_map = cov.get("fnMap", {})
        f_hit = cov.get("f", {})
        b_map = cov.get("branchMap", {})
        b_hit = cov.get("b", {})

        n_s = len(s_map)
        cov_s = sum(1 for sid in s_map if (s_hit.get(sid, 0) or 0) > 0)
        unc_s = n_s - cov_s

        n_f = len(f_map)
        cov_f = sum(1 for fid in f_map if (f_hit.get(fid, 0) or 0) > 0)
        unc_f = n_f - cov_f

        # branches: each branch location has a list of 2+ hit counts
        n_b = 0
        cov_b = 0
        for bid, hitlist in b_hit.items():
            for h in hitlist:
                n_b += 1
                if (h or 0) > 0:
                    cov_b += 1
        unc_b = n_b - cov_b

        tot_s += n_s
        tot_s_cov += cov_s
        tot_f += n_f
        tot_f_cov += cov_f
        tot_branch += n_b
        tot_branch_cov += cov_b

        s_pct = (cov_s / n_s * 100) if n_s else 100.0
        rows.append(
            {
                "path": path,
                "s": n_s,
                "s_cov": cov_s,
                "s_unc": unc_s,
                "s_pct": s_pct,
                "f": n_f,
                "f_cov": cov_f,
                "f_unc": unc_f,
                "b": n_b,
                "b_cov": cov_b,
                "b_unc": unc_b,
            }
        )

    # 全局
    g_s = tot_s_cov / tot_s * 100 if tot_s else 100
    g_f = tot_f_cov / tot_f * 100 if tot_f else 100
    g_b = tot_branch_cov / tot_branch * 100 if tot_branch else 100
    print("=" * 100)
    print(
        "全局(全文件合计): Stmts %d/%d=%.2f%% | Funcs %d/%d=%.2f%% | Branch %d/%d=%.2f%%"
        % (tot_s_cov, tot_s, g_s, tot_f_cov, tot_f, g_f, tot_branch_cov, tot_branch, g_b)
    )
    print("=" * 100)

    # 按未覆盖语句数降序
    rows.sort(key=lambda r: r["s_unc"], reverse=True)
    print("\n── 未覆盖语句数 TOP 40（补测优先级）──")
    print("%-70s %6s %6s %6s %7s %6s %6s" % ("path", "stmts", "cov", "unc", "s%", "funcU", "brU"))
    for r in rows[:40]:
        short = r["path"]
        if len(short) > 70:
            short = "..." + short[-67:]
        print(
            "%-70s %6d %6d %6d %7.1f %6d %6d"
            % (short, r["s"], r["s_cov"], r["s_unc"], r["s_pct"], r["f_unc"], r["b_unc"])
        )

    # 低覆盖模块（<60% 且未覆盖语句>=20）
    print("\n── 低覆盖(<60%)且未覆盖>=20 语句的模块 ──")
    low = [r for r in rows if r["s_pct"] < 60 and r["s_unc"] >= 20]
    low.sort(key=lambda r: r["s_unc"], reverse=True)
    for r in low:
        print("  %-68s s%%=%.1f unc=%d fU=%d bU=%d" % (r["path"][-68:], r["s_pct"], r["s_unc"], r["f_unc"], r["b_unc"]))


if __name__ == "__main__":
    main()
