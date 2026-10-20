"""监控配置校验门（ops/infra 一键监控栈 + grafana/dashboard.json）。

替代沙箱缺失的 promtool / docker compose config：
  1. 解析全部监控 YAML/JSON（prometheus / alerting_rules / alertmanager /
     docker-compose.monitoring / grafana provisioning / dashboard.json）。
  2. 结构化断言：告警规则必备字段、新业务告警在位、原 HTTP/进程告警保留、
     compose 三服务与挂载/端口、provisioning 数据源与看板路径、dashboard
     provisioning 就绪（id=null / uid / 18 面板 / DS_PROMETHEUS 变量）。
  3. PromQL 括号/花括号配平（轻量语法健全性检查）。

用法（仓根或任意 cwd）：
  python ops/infra/validate_monitoring.py
退出码：全部通过 0；任一失败 1。
"""
import json
import os
import sys

import yaml

# 仓根 = ops/infra/ 的上两级
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

errors = []
ok = []


def check(name, fn):
    try:
        fn()
        ok.append(name)
    except Exception as e:  # noqa: BLE001
        errors.append(f"{name}: {e}")


def load_yaml(rel):
    def _load():
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            yaml.safe_load(f)
    return _load


YAML_FILES = [
    "ops/infra/prometheus.yml",
    "ops/infra/alerting_rules.yml",
    "ops/infra/alertmanager.yml",
    "ops/infra/docker-compose.monitoring.yml",
    "ops/infra/grafana/provisioning/datasources/datasource.yml",
    "ops/infra/grafana/provisioning/dashboards/dashboards.yml",
]
for p in YAML_FILES:
    check(f"yaml:{p}", load_yaml(p))


def dash():
    with open(os.path.join(ROOT, "grafana/dashboard.json"), encoding="utf-8") as f:
        d = json.load(f)
    assert d.get("id") is None, "dashboard.id must be null for provisioning"
    assert d.get("uid") == "score-backend-monitor", "uid mismatch"
    assert len(d.get("panels", [])) == 18, f"expected 18 panels, got {len(d.get('panels', []))}"
    vars_ = [v.get("name") for v in d.get("templating", {}).get("list", [])]
    assert "DS_PROMETHEUS" in vars_, "DS_PROMETHEUS templating var missing"
    for pan in d.get("panels", []):
        for t in pan.get("targets", []):
            expr = t.get("expr", "")
            assert expr.count("{") == expr.count("}"), f"unbalanced braces in {expr!r}"
check("dashboard.json", dash)


def rules():
    with open(os.path.join(ROOT, "ops/infra/alerting_rules.yml"), encoding="utf-8") as f:
        d = yaml.safe_load(f)
    alerts = []
    for g in d["groups"]:
        for r in g["rules"]:
            assert "alert" in r and "expr" in r, f"rule missing alert/expr: {r}"
            assert "labels" in r and "severity" in r["labels"], f"rule missing severity: {r.get('alert')}"
            assert "annotations" in r, f"rule missing annotations: {r.get('alert')}"
            alerts.append(r["alert"])
            expr = r["expr"]
            assert expr.count("(") == expr.count(")"), f"unbalanced parens in {r['alert']}: {expr}"
            assert expr.count("[") == expr.count("]"), f"unbalanced brackets in {r['alert']}: {expr}"
    for a in ["MQTTLinkDown", "OTAFailureRateHigh", "DevicesMostlyOffline"]:
        assert a in alerts, f"missing business alert {a}"
    for a in ["BackendDown", "HighHTTPErrorRate", "HighUncaughtExceptions",
              "HighRequestLatencyP95", "ProcessMemoryHigh", "ProcessCPUHigh"]:
        assert a in alerts, f"missing original alert {a}"
check("alerting_rules.yml", rules)


def compose():
    with open(os.path.join(ROOT, "ops/infra/docker-compose.monitoring.yml"), encoding="utf-8") as f:
        d = yaml.safe_load(f)
    svcs = d["services"]
    for s in ["prometheus", "alertmanager", "grafana"]:
        assert s in svcs, f"missing service {s}"
    prom_vols = " ".join(svcs["prometheus"]["volumes"])
    assert "alerting_rules.yml" in prom_vols and "prometheus.yml" in prom_vols
    graf_vols = " ".join(svcs["grafana"]["volumes"])
    assert "/etc/grafana/provisioning" in graf_vols
    assert "grafana/dashboard.json" in graf_vols
    assert svcs["grafana"]["ports"] == ["3001:3000"], svcs["grafana"]["ports"]
check("docker-compose.monitoring.yml", compose)


def prov():
    with open(os.path.join(ROOT, "ops/infra/grafana/provisioning/datasources/datasource.yml"), encoding="utf-8") as f:
        ds = yaml.safe_load(f)
    assert ds["apiVersion"] == 1
    assert any(x["type"] == "prometheus" for x in ds["datasources"])
    assert ds["datasources"][0]["url"] == "http://prometheus:9090"
    with open(os.path.join(ROOT, "ops/infra/grafana/provisioning/dashboards/dashboards.yml"), encoding="utf-8") as f:
        db = yaml.safe_load(f)
    assert db["apiVersion"] == 1
    assert db["providers"][0]["options"]["path"] == "/var/lib/grafana/dashboards"
check("provisioning", prov)


def old_gone():
    assert not os.path.exists(os.path.join(ROOT, "prometheus")), "old prometheus/ still exists"
check("old-prometheus-removed", old_gone)


print("=== PASS ===")
for o in ok:
    print("  [ok]", o)
if errors:
    print("=== FAIL ===")
    for e in errors:
        print("  [FAIL]", e)
    sys.exit(1)
print(f"\nAll {len(ok)} config checks passed.")
