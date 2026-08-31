import os
import json
import subprocess


def run_bandit():
    print("=" * 60)
    print("运行 Bandit 安全扫描")
    print("=" * 60)

    cmd = ["bandit", "-c", "bandit.cfg", "-r", ".", "-", "json", "-o", "bandit-report.json"]

    result = subprocess.run(
        cmd, capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__))
    )  # noqa: F841

    print("\n扫描结果摘要:")
    print("-" * 60)

    if result.returncode == 0:
        print("✅ 安全扫描通过 - 未发现高危漏洞")
    elif result.returncode == 1:
        print("⚠️ 安全扫描发现问题，请查看报告")
    else:
        print("❌ 扫描执行失败")
        print(f"错误信息: {result.stderr}")
        return

    if os.path.exists("bandit-report.json"):
        with open("bandit-report.json", "r") as f:
            report = json.load(f)

        issues = report.get("results", [])
        if issues:
            print(f"\n发现 {len(issues)} 个安全问题:")
            print("-" * 60)

            for issue in sorted(issues, key=lambda x: x.get("issue_severity", ""), reverse=True):
                severity = issue.get("issue_severity", "UNKNOWN")
                confidence = issue.get("issue_confidence", "UNKNOWN")
                issue_text = issue.get("issue_text", "")
                filename = issue.get("filename", "")
                line_number = issue.get("line_number", 0)

                print(f"[{severity}] {issue_text}")
                print(f"  文件: {filename}:{line_number}")
                print(f"  置信度: {confidence}")
                print()

        print("\n报告已保存到: bandit-report.json")

    print("=" * 60)


if __name__ == "__main__":
    run_bandit()
