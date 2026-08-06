"""Characterize RiskPredictService batch output (levels + top samples)."""
import json, urllib.request, urllib.error
from collections import Counter

BASE = "http://127.0.0.1:5005"
def login():
    req = urllib.request.Request(BASE + "/api/auth/login",
        data=json.dumps({"username":"admin","password":"123456"}).encode(),
        headers={"Content-Type":"application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["access_token"]
TOKEN = login(); AUTH = {"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"}
def call(method, url, body=None):
    req = urllib.request.Request(BASE+url, headers=AUTH, method=method)
    if body is not None: req.data = json.dumps(body).encode()
    try:
        r = urllib.request.urlopen(req, timeout=120); return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

s, d = call("GET", "/api/algorithm/risk-predict/batch?days=30")
data = d.get("data", d)
if isinstance(data, dict):
    results = data.get("results") or []
else:
    results = data if isinstance(data, list) else []
print("[risk-predict/batch] status", s, "count", len(results))
levels = Counter(r.get("overall_risk_level") for r in results)
print("  level distribution:", dict(levels))
# top 5 by overall_risk_score
ranked = sorted(results, key=lambda r: r.get("overall_risk_score", 0), reverse=True)[:5]
for r in ranked:
    rd = r.get("risk_details", {})
    print("   %s level=%s score=%.2f behavior=%.2f academic=%.2f attendance=%.2f" % (
        r.get("name"), r.get("overall_risk_level"), r.get("overall_risk_score",0),
        rd.get("behavior",{}).get("risk_score",0), rd.get("academic",{}).get("risk_score",0),
        rd.get("attendance",{}).get("risk_score",0)))
