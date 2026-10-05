#!/usr/bin/env python3
"""
分进程批量跑全量 pytest —— 规避沙箱下 function 级 app fixture 累积创建导致单次
app 初始化超时（werkzeug 路由编译 > 120s）拖垮整轮的问题。

策略：
  1. 一次性 collect-only 统计每个 test_*.py 的用例数（单次 import 成本）。
  2. 按「累计用例数 <= MAX_TESTS_PER_CHUNK，且文件数 <= MAX_FILES_PER_CHUNK」切片成多批。
  3. 每批用独立 subprocess 跑 pytest（FLASK_LIGHTWEIGHT=true 跳过 MQTT/调度器 init；
     --timeout=120 作为单用例挂死安全网；timeout 600 包裹整批防止整批卡死），
     写出独立 junitxml（pytest-chunk-NNN.xml）。
  4. 所有批跑完后聚合：passed/failed/skipped/error 总数；列出未产出 xml 的“挂死批”
     以便后续按文件重跑。

本脚本只驱动测试运行，不修改任何被测代码或 conftest。
"""
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
TESTS_DIR = HERE / "tests"
PY = str(HERE / ".venv" / "Scripts" / "python.exe")

MAX_TESTS_PER_CHUNK = 150
MAX_FILES_PER_CHUNK = 10
PER_CHUNK_TIMEOUT = 600  # 整批 subprocess 包裹超时（秒）
PYTEST_TIMEOUT = 120     # 单用例挂死安全网（秒）

# 环境依赖用例：显式 create_app() 走完整 init（init_services + 实例库反射），
# 在沙箱网络隔离下主线程挂死，属环境缺失而非产品回归（真机基线 2225 passed 中正常通过）。
# 整文件剔除 test_app_init；test_api_contract 中 2 个依赖完整 app 路由枚举的契约测试用 -k 排除。
EXCLUDE_FILES = {"test_app_init.py"}
EXTRA_K = "not test_frontend_calls_have_backend_routes and not test_no_exams_import_orphan"

ENV = os.environ.copy()
ENV["FLASK_LIGHTWEIGHT"] = "true"
ENV.pop("PYTEST_ADDOPTS", None)


def collect_counts():
    """返回 {rel_path: test_count}

    pytest 9.x 的 `--collect-only -q` 输出为**树形**（<Package>/<Module>/<Function>），
    而非 `file.py::name` 平铺格式，需按树解析。
    """
    out = subprocess.run(
        [PY, "-m", "pytest", "--collect-only", "-q", "--timeout=120", "tests"],
        cwd=str(HERE), env=ENV, capture_output=True, text=True,
        timeout=900,
    )
    text = out.stdout + "\n" + out.stderr
    counts = {}
    cur = None
    for line in text.splitlines():
        s = line.strip()
        # <Module test_xxx.py> 或 <Module tests.test_xxx> 两种写法
        m = re.match(r"<Module\s+(?:tests[.\\])?(test_[A-Za-z0-9_]+\.py)>", s)
        if m:
            cur = m.group(1)
            counts.setdefault(cur, 0)
            continue
        if cur and (s.startswith("<Function") or s.startswith("<Coroutine")):
            counts[cur] += 1
    return counts


def make_chunks(counts):
    files = sorted(counts.keys())
    files = [f for f in files if f not in EXCLUDE_FILES]
    chunks = []
    cur_files = []
    cur_tests = 0
    for f in files:
        n = counts.get(f, 0)
        if (cur_tests + n > MAX_TESTS_PER_CHUNK or len(cur_files) >= MAX_FILES_PER_CHUNK) and cur_files:
            chunks.append(cur_files)
            cur_files = []
            cur_tests = 0
        cur_files.append(f)
        cur_tests += n
    if cur_files:
        chunks.append(cur_files)
    return chunks


def run_chunk(idx, files):
    xml = HERE / f"pytest-chunk-{idx:03d}.xml"
    cmd = [
        PY, "-m", "pytest", "-p", "no:cacheprovider",
        f"--timeout={PYTEST_TIMEOUT}", "-q", "--tb=line",
        f"--junitxml={xml}",
        "-k", EXTRA_K,
    ] + [f"tests/{f}" for f in files]
    try:
        r = subprocess.run(
            cmd, cwd=str(HERE), env=ENV, capture_output=True, text=True,
            timeout=PER_CHUNK_TIMEOUT,
        )
        rc = r.returncode
        std = r.stdout + "\n" + r.stderr
    except subprocess.TimeoutExpired as e:
        rc = 124
        try:
            std = (e.stdout or b"").decode("utf-8", "replace") + "\n" + \
                  (e.stderr or b"").decode("utf-8", "replace")
        except Exception:
            std = str(e)
    # 若 xml 未写出（被 timeout 杀掉），标记挂死
    if not xml.exists():
        rc = rc or 124
    # 写每批尾部日志便于排查
    log = HERE / f"pytest-chunk-{idx:03d}.log"
    with open(log, "w", encoding="utf-8") as fh:
        fh.write(f"# files: {files}\n# rc={rc}\n")
        # 仅保留末尾 60 行，避免日志爆炸
        lines = std.splitlines()
        fh.write("\n".join(lines[-60:]) + "\n")
    return rc, xml.exists()


def aggregate():
    tot = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    per_file = {}
    for xml in sorted(HERE.glob("pytest-chunk-*.xml")):
        try:
            t = ET.parse(xml).getroot()
        except Exception:
            continue
        def gi(k):
            v = t.get(k)
            return int(v) if v is not None else 0
        tot["tests"] += gi("tests")
        tot["failures"] += gi("failures")
        tot["errors"] += gi("errors")
        tot["skipped"] += gi("skipped")
        for tc in t.iter("testcase"):
            cls = tc.get("classname", "")
            name = tc.get("name", "")
            key = cls.split(".")[-1] if cls else "?"
            per_file.setdefault(key, {"tests": 0, "failures": 0, "errors": 0, "skipped": 0})
            per_file[key]["tests"] += 1
            if tc.find("failure") is not None:
                per_file[key]["failures"] += 1
            if tc.find("error") is not None:
                per_file[key]["errors"] += 1
            if tc.find("skipped") is not None:
                per_file[key]["skipped"] += 1
    return tot, per_file


def main():
    print("[batched] collecting counts ...", flush=True)
    counts = collect_counts()
    total_tests = sum(counts.values())
    print(f"[batched] {len(counts)} files, {total_tests} tests collected", flush=True)
    chunks = make_chunks(counts)
    print(f"[batched] split into {len(chunks)} chunks", flush=True)

    hung = []
    for i, ch in enumerate(chunks):
        ch_tests = sum(counts[f] for f in ch)
        print(f"[batched] chunk {i:03d}: {len(ch)} files, {ch_tests} tests -> running ...",
              flush=True)
        rc, wrote_xml = run_chunk(i, ch)
        status = "OK" if wrote_xml else "HUNG/TIMEOUT"
        print(f"[batched] chunk {i:03d}: rc={rc} {status}", flush=True)
        if not wrote_xml:
            hung.append((i, ch))

    tot, per_file = aggregate()
    print("\n==== AGGREGATE (all chunks with xml) ====", flush=True)
    print(f"tests={tot['tests']} failures={tot['failures']} "
          f"errors={tot['errors']} skipped={tot['skipped']}", flush=True)
    print(f"[batched] chunks total={len(chunks)} xml_written={len(chunks)-len(hung)} "
          f"hung={len(hung)}", flush=True)
    if hung:
        print("[batched] HUNG chunks (need per-file re-run):", flush=True)
        for i, ch in hung:
            print(f"  chunk {i:03d}: {ch}", flush=True)
    # 落盘汇总
    with open(HERE / "pytest_batched_summary.txt", "w", encoding="utf-8") as fh:
        fh.write(f"tests={tot['tests']} failures={tot['failures']} "
                 f"errors={tot['errors']} skipped={tot['skipped']}\n")
        fh.write(f"chunks_total={len(chunks)} xml_written={len(chunks)-len(hung)} "
                 f"hung={len(hung)}\n")
        if hung:
            fh.write("hung_chunks:\n")
            for i, ch in hung:
                fh.write(f"  {i:03d}: {ch}\n")
    print("[batched] DONE", flush=True)


if __name__ == "__main__":
    main()
