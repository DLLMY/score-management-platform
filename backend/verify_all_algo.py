"""
算法端点综合抽样核对
====================
覆盖：综合分（重算+读取）、风险预测批量/高危、趋势预测风险名单。
用法： python verify_all_algo.py
"""

import json
import statistics
import urllib.error
import urllib.request
from collections import Counter

BASE = "http://127.0.0.1:5005"


def login():
    req = urllib.request.Request(
        BASE + "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "123456"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["access_token"]


AUTH = {"Authorization": "Bearer " + login(), "Content-Type": "application/json"}


def call(method, url, body=None):
    req = urllib.request.Request(BASE + url, headers=AUTH, method=method)
    if body is not None:
        req.data = json.dumps(body).encode()
    try:
        r = urllib.request.urlopen(req, timeout=180)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def unwrap(d):
    return d.get("data", d) if isinstance(d, dict) else d


# ---------------------------------------------------------------- 综合分
print("=" * 62)
print("[1] 综合分 composite-score")
s, _ = call("POST", "/api/algorithm/composite-score/recalculate", {})
print(f"  recalculate -> {s}")

s, d = call("GET", "/api/algorithm/composite-score?page=1&per_page=200")
data = unwrap(d)
items = data.get("rankings") or data.get("items") or data.get("results") or []
if isinstance(data, dict) and "weights" in data:
    print("  熵权:", {k: round(v, 4) for k, v in data["weights"].items()})
print(f"  GET -> {s}  返回 {len(items)} 条")

comps = [i.get("composite_score") for i in items if i.get("composite_score") is not None]
acads = [i.get("academic_score") for i in items if i.get("academic_score")]
nan_cnt = sum(1 for c in comps if c != c)
if comps:
    print(f"  综合分: min={min(comps):.1f} max={max(comps):.1f} "
          f"avg={statistics.mean(comps):.1f} std={statistics.pstdev(comps):.1f} NaN={nan_cnt}")
print(f"  有学术分的学生: {len(acads)}/{len(items)}")
for i in items[:3]:
    print(f"    #{i.get('ranking')} {i.get('name')} 综合={i.get('composite_score')} "
          f"学术={i.get('academic_score')} 行为={i.get('behavior_score')}")
for i in items[-2:]:
    print(f"    #{i.get('ranking')} {i.get('name')} 综合={i.get('composite_score')} "
          f"学术={i.get('academic_score')} 行为={i.get('behavior_score')}")

# ---------------------------------------------------------------- 风险批量
print("=" * 62)
print("[2] 风险预测 risk-predict/batch")
s, d = call("GET", "/api/algorithm/risk-predict/batch?days=30")
data = unwrap(d)
results = data.get("results") if isinstance(data, dict) else data
results = results or []
print(f"  status={s}  返回 {len(results)} 条")
print("  层级分布:", dict(Counter(r.get("overall_risk_level") for r in results)))
for r in sorted(results, key=lambda x: x.get("overall_risk_score", 0), reverse=True)[:5]:
    rd = r.get("risk_details", {})
    print(f"    {r.get('name')} [{r.get('overall_risk_level')}] "
          f"overall={r.get('overall_risk_score')} | "
          f"学业={rd.get('academic', {}).get('risk_score')} "
          f"行为={rd.get('behavior', {}).get('risk_score')} "
          f"出勤={rd.get('attendance', {}).get('risk_score')}")

# ---------------------------------------------------------------- 高危名单
print("=" * 62)
print("[3] 高危名单 risk-predict/high-risk")
s, d = call("GET", "/api/algorithm/risk-predict/high-risk?days=30")
data = unwrap(d)
hr = data.get("students") or data.get("results") if isinstance(data, dict) else data
hr = hr or []
print(f"  status={s}  高危学生 {len(hr)} 名")
for r in hr[:5]:
    print(f"    {r.get('name')} overall={r.get('overall_risk_score')} "
          f"建议={(r.get('intervention_suggestions') or [''])[0]}")

# ---------------------------------------------------------------- 趋势预测
print("=" * 62)
print("[4] 趋势预测 prediction/risk")
s, d = call("GET", "/api/algorithm/prediction/risk?days=30")
data = unwrap(d)
pr = data.get("students") or data.get("results") if isinstance(data, dict) else data
pr = pr or []
print(f"  status={s}  下降风险学生 {len(pr)} 名")
print("  层级分布:", dict(Counter(r.get("risk_level") for r in pr)))
missing = [k for k in ("risk_level", "risk_score", "warning_count") if pr and k not in pr[0]]
print(f"  契约字段缺失: {missing or '无'}")
for r in pr[:5]:
    print(f"    {r.get('name')} [{r.get('risk_level')}] 风险分={r.get('risk_score')} "
          f"预测变化={r.get('predicted_change')} 预警天数={r.get('warning_count')}")
print("=" * 62)
