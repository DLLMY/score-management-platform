#!/usr/bin/env python3
"""代码质量检查脚本 - CI/CD集成

用法:
    python backend/tools/check_code_quality.py [--fail-on-error]

功能:
    1. 运行 flake8 代码规范检查
    2. 运行 pylint 代码质量评分
    3. 检查 E999 语法错误（致命）
    4. 运行 bandit 安全扫描
    5. 生成检查报告
    6. 可选：检查失败时返回非零退出码（用于CI/CD）

退出码:
    0 - 检查通过
    1 - 检查失败
    2 - 部分通过（仅警告）
"""

import subprocess
import sys
import os
import json
from datetime import datetime

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
PROJECT_DIR = os.path.join(BACKEND_DIR, "..")
REPORT_DIR = os.path.join(PROJECT_DIR, "reports")

THRESHOLDS = {
    "max_flake8_errors": 50,
    "max_syntax_errors": 0,
}


def run_flake8():
    """运行 flake8 检查"""
    print("=" * 60)
    print("🔍 运行 Flake8 代码规范检查...")
    print("=" * 60)

    cmd = [
        sys.executable,
        "-m",
        "flake8",
        BACKEND_DIR,
        "--config",
        os.path.join(PROJECT_DIR, ".flake8"),
        "--statistics",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)

    error_count = 0
    if result.stdout:
        lines = result.stdout.strip().split("\n")
        for line in lines:
            if line and not line.startswith(" ") and ":" in line:
                error_count += 1

    print(f"  错误总数: {error_count}")

    if result.stdout:
        # Show only first 20 lines of errors
        error_lines = result.stdout.strip().split("\n")
        for line in error_lines[:20]:
            print(f"  {line}")
        if len(error_lines) > 20:
            print(f"  ... 还有 {len(error_lines) - 20} 条错误")

    return {
        "total_errors": error_count,
        "passed": error_count <= THRESHOLDS["max_flake8_errors"],
        "output": result.stdout,
    }


def check_syntax():
    """检查语法错误 (E999)"""
    print("\n" + "=" * 60)
    print("🔍 检查 Python 语法错误...")
    print("=" * 60)

    cmd = [
        sys.executable,
        "-m",
        "flake8",
        BACKEND_DIR,
        "--config",
        os.path.join(PROJECT_DIR, ".flake8"),
        "--select=E999",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)

    syntax_errors = 0
    if result.stdout:
        syntax_errors = len(result.stdout.strip().split("\n"))

    print(f"  语法错误数: {syntax_errors}")

    if result.stdout:
        for line in result.stdout.strip().split("\n")[:10]:
            print(f"  ❌ {line}")

    return {
        "syntax_errors": syntax_errors,
        "passed": syntax_errors == 0,
        "output": result.stdout,
    }


def check_python_compile():
    """检查所有Python文件能否通过编译"""
    print("\n" + "=" * 60)
    print("🔍 检查 Python 编译...")
    print("=" * 60)

    compile_errors = []
    exclude_dirs = {"archive", "tools", "tests", "__pycache__", "scripts"}

    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        source = f.read()
                    compile(source, filepath, "exec")
                except SyntaxError as e:
                    compile_errors.append(
                        {
                            "file": filepath,
                            "error": str(e),
                        }
                    )

    print(f"  编译错误数: {len(compile_errors)}")

    if compile_errors:
        for err in compile_errors[:5]:
            rel_path = os.path.relpath(err["file"], PROJECT_DIR)
            print(f"  ❌ {rel_path}: {err['error'][:80]}")

    return {
        "compile_errors": len(compile_errors),
        "passed": len(compile_errors) == 0,
        "errors": compile_errors,
    }


def check_bandit():
    """运行 bandit 安全扫描"""
    print("\n" + "=" * 60)
    print("🔍 运行 Bandit 安全扫描...")
    print("=" * 60)

    cmd = [
        sys.executable,
        "-m",
        "bandit",
        "-r",
        BACKEND_DIR,
        "-x",
        "archive,migrations",
        "--severity-level",
        "high",
        "medium",
        "-f",
        "json",
        "-o",
        os.path.join(REPORT_DIR, "bandit_report.json"),
    ]

    _ = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)

    # 读取生成的报告
    high_count = 0
    medium_count = 0
    try:
        report_path = os.path.join(REPORT_DIR, "bandit_report.json")
        if os.path.exists(report_path):
            with open(report_path, "r", encoding="utf-8") as f:
                import json as j

                data = j.load(f)
                results = data.get("results", [])
                high_count = len([r for r in results if r.get("issue_severity") == "HIGH"])
                medium_count = len([r for r in results if r.get("issue_severity") == "MEDIUM"])
    except Exception:
        pass

    print(f"  HIGH: {high_count}")
    print(f"  MEDIUM: {medium_count}")

    return {
        "high": high_count,
        "medium": medium_count,
        "passed": high_count == 0,
    }


def generate_report(flake8_result, syntax_result, compile_result, bandit_result=None):
    """生成检查报告"""
    os.makedirs(REPORT_DIR, exist_ok=True)

    report = {
        "timestamp": datetime.now().isoformat(),
        "flake8": flake8_result,
        "syntax": syntax_result,
        "compile": compile_result,
        "bandit": bandit_result,
        "summary": {
            "flake8_passed": flake8_result["passed"],
            "syntax_passed": syntax_result["passed"],
            "compile_passed": compile_result["passed"],
            "bandit_passed": bandit_result["passed"] if bandit_result else True,
            "overall_passed": (
                flake8_result["passed"]
                and syntax_result["passed"]
                and compile_result["passed"]
                and (bandit_result["passed"] if bandit_result else True)
            ),
        },
    }

    report_path = os.path.join(REPORT_DIR, "code_quality_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print("\n" + "=" * 60)
    print("📊 检查汇总")
    print("=" * 60)
    print(
        f"  Flake8: {'✅ 通过' if flake8_result['passed'] else '❌ 失败'} ({flake8_result['total_errors']} 错误)"
    )
    print(
        f"  语法检查: {'✅ 通过' if syntax_result['passed'] else '❌ 失败'} ({syntax_result['syntax_errors']} 错误)"
    )
    print(
        f"  编译检查: {'✅ 通过' if compile_result['passed'] else '❌ 失败'} ({compile_result['compile_errors']} 错误)"
    )
    if bandit_result:
        print(
            f"  安全扫描: {'✅ 通过' if bandit_result['passed'] else '❌ 失败'} (HIGH:{bandit_result['high']}, MEDIUM:{bandit_result['medium']})"
        )
    print(f"\n  报告已保存: {report_path}")

    return report["summary"]["overall_passed"]


def main():
    fail_on_error = "--fail-on-error" in sys.argv

    print("\n🚀 开始代码质量检查...\n")

    flake8_result = run_flake8()
    syntax_result = check_syntax()
    compile_result = check_python_compile()
    bandit_result = check_bandit()

    overall_passed = generate_report(flake8_result, syntax_result, compile_result, bandit_result)

    if fail_on_error and not overall_passed:
        sys.exit(1)
    elif not syntax_result["passed"] or not compile_result["passed"] or not bandit_result["passed"]:
        sys.exit(1)
    elif not flake8_result["passed"]:
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
