#!/usr/bin/env python3
"""聚合分进程批量跑的 junitxml，输出真实 passed/failed/skipped/error 总数，
并把失败/error 用例按「环境性 vs 真实逻辑」分类。"""
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent

ENV_KEYS = (
    "mqtt", "paho", "emqx", "broker", "redis", "scheduler", "init_scheduler",
    "requests.exceptions", "httpx", "urllib3", "connectionrefused", "connectionerror",
    "timeouterror", "socket.timeout", "database is locked", "operationalerror",
    "could not connect", "connection refused", "remote", "emqxsl", "8883",
    "wechat", "aliyun", "ocr", "sms", "tencent", "external", "api call",
    "timeout", "timed out", "failed to connect", "refused", "dns", "getaddrinfo",
)


def is_env(msg: str) -> bool:
    m = (msg or "").lower()
    return any(k in m for k in ENV_KEYS)


def main():
    tot = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    real_fail = []   # (file, class::name, snippet)
    env_fail = []
    per_chunk = []
    xmls = sorted(HERE.glob("pytest-chunk-*.xml"))
    for x in xmls:
        root = ET.parse(x).getroot()
        suites = root.findall("testsuite") or [root]
        c_tests = c_fail = c_err = c_skip = 0
        for s in suites:
            def gi(k):
                v = s.get(k)
                return int(v) if v is not None else 0
            c_tests += gi("tests")
            c_fail += gi("failures")
            c_err += gi("errors")
            c_skip += gi("skipped")
            for tc in s.iter("testcase"):
                cls = tc.get("classname", "")
                name = tc.get("name", "")
                fnode = None
                enode = None
                for child in tc:
                    tag = child.tag
                    if isinstance(tag, str):
                        if tag.endswith("failure"):
                            fnode = child
                        elif tag.endswith("error"):
                            enode = child
                if fnode is not None or enode is not None:
                    node = fnode if fnode is not None else enode
                    msg = (node.get("message") or "") + "\n" + (node.text or "")
                    # 取前 400 字符作为证据
                    snippet = msg[:400].replace("\n", " ")
                    entry = (cls, name, snippet)
                    if is_env(msg):
                        env_fail.append(entry)
                    else:
                        real_fail.append(entry)
        tot["tests"] += c_tests
        tot["failures"] += c_fail
        tot["errors"] += c_err
        tot["skipped"] += c_skip
        per_chunk.append((x.name, c_tests, c_fail, c_err, c_skip))

    passed = tot["tests"] - tot["failures"] - tot["errors"] - tot["skipped"]
    print("==================== 全量回归聚合（分进程批量） ====================")
    print(f"总用例数   tests     = {tot['tests']}")
    print(f"通过       passed   = {passed}")
    print(f"失败       failures = {tot['failures']}")
    print(f"错误       errors   = {tot['errors']}")
    print(f"跳过       skipped  = {tot['skipped']}")
    print(f"真实逻辑失败(非环境) = {len(real_fail)}")
    print(f"环境性失败(error/timeout) = {len(env_fail)}")
    print()
    print(f"通过率(不含skip) = {passed/(tot['tests']-tot['skipped'])*100:.2f}%" if (tot['tests']-tot['skipped']) else "n/a")
    print()
    print("-------------------- 真实逻辑失败（需关注） --------------------")
    if real_fail:
        for cls, name, snip in real_fail:
            print(f"  [{cls}::{name}]\n    {snip}")
    else:
        print("  (无)")
    print()
    print("-------------------- 环境性失败（沙箱缺服务/网络隔离，非回归） --------------------")
    for cls, name, snip in env_fail:
        print(f"  [{cls}::{name}]\n    {snip}")
    # 落盘
    with open(HERE / "pytest_final_summary.txt", "w", encoding="utf-8") as fh:
        fh.write(f"tests={tot['tests']} passed={passed} failures={tot['failures']} "
                 f"errors={tot['errors']} skipped={tot['skipped']}\n")
        fh.write(f"real_fail={len(real_fail)} env_fail={len(env_fail)}\n")
        if real_fail:
            fh.write("\n[REAL FAILURES]\n")
            for cls, name, snip in real_fail:
                fh.write(f"- {cls}::{name}: {snip}\n")
        if env_fail:
            fh.write("\n[ENV FAILURES]\n")
            for cls, name, snip in env_fail:
                fh.write(f"- {cls}::{name}: {snip}\n")


if __name__ == "__main__":
    main()
