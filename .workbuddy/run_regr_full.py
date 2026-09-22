import os
import sys
import subprocess
import glob
import xml.etree.ElementTree as ET

# 跨平台兼容：基于脚本位置推断仓库结构，自动探测 venv，
# 不再硬编码 Windows 绝对路径（G5 CI 真实生效所需）。
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # 仓库根（.workbuddy 的父目录）
BE = os.environ.get("BE_PATH") or os.path.join(ROOT, "apps", "backend")
TESTS = os.path.join(BE, "tests")
OUT = os.environ.get("OUT_PATH") or os.path.join(HERE, "regr_xml")
os.makedirs(OUT, exist_ok=True)


def detect_venv():
    """优先使用环境变量 VENV_PYTHON，否则自动探测 .venv（Win/Linux 通用）。"""
    if os.environ.get("VENV_PYTHON"):
        return os.environ["VENV_PYTHON"]
    for cand in (
        os.path.join(BE, ".venv", "Scripts", "python.exe"),
        os.path.join(BE, ".venv", "bin", "python"),
    ):
        if os.path.isfile(cand):
            return cand
    return sys.executable


VENV = detect_venv()

# P2-e: 覆盖率采集准备——12 批独立进程用 --cov-append 累加写入同一 .coverage，
# 批末 coverage report --fail-under=70 形成闸门（仅统计 services + models）。
# 先清理历史覆盖率数据，避免跨次运行污染。
for _cf in [os.path.join(BE, ".coverage")] + glob.glob(os.path.join(BE, ".coverage.*")):
    try:
        os.remove(_cf)
    except OSError:
        pass

files = sorted(
    f for f in os.listdir(TESTS)
    if f.startswith("test_") and f.endswith(".py")
)
N = 12
batches = [files[i::N] for i in range(N)]
print(f"BE={BE}")
print(f"VENV={VENV}")
print(f"total test files: {len(files)}, batches={N}")

agg = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
any_fail = False
for idx, batch in enumerate(batches):
    if not batch:
        continue
    rel = [os.path.join("tests", f) for f in batch]
    xml = os.path.join(OUT, f"batch_{idx}.xml")
    args = [VENV, "-m", "pytest", "-q", "-p", "no:cacheprovider",
            "--timeout=0", f"--junitxml={xml}",
            # P2-e: 覆盖率采集（仅 services + models，append 到共享 .coverage）
            "--cov=services", "--cov=models", "--cov-append", "--cov-report="] + rel
    try:
        rc = subprocess.run(args, cwd=BE, timeout=900).returncode
    except subprocess.TimeoutExpired:
        print(f"batch {idx} TIMEOUT")
        any_fail = True
        continue
    if rc != 0:
        any_fail = True
        print(f"batch {idx} rc={rc} (non-zero)")
    try:
        tree = ET.parse(xml)
        for ts in tree.iter("testsuite"):
            agg["tests"] += int(ts.get("tests") or 0)
            agg["failures"] += int(ts.get("failures") or 0)
            agg["errors"] += int(ts.get("errors") or 0)
            agg["skipped"] += int(ts.get("skipped") or 0)
    except Exception as e:
        print(f"batch {idx} xml parse fail: {e}")

# P2-e: 汇总覆盖率并施加 --fail-under=70 闸门（services + models）。
# 仅当测试全绿时才评估覆盖率，避免“测试失败 + 覆盖率不足”双重信号噪声。
if not any_fail:
    cov_rc = subprocess.run(
        [VENV, "-m", "coverage", "report", "--fail-under=70", "--skip-covered"],
        cwd=BE,
    ).returncode
    if cov_rc != 0:
        print("COVERAGE GATE FAILED: services+models line coverage below 70%")
        any_fail = True
else:
    print("SKIP coverage gate (test failures present)")

print("AGG", agg)
sys.exit(1 if any_fail or agg["failures"] or agg["errors"] else 0)
