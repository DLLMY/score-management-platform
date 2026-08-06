"""Final verification after the missing GROUP BY fix:
- recalc composite-score
- confirm ~100/100 students get academic>0
- report distribution, top/bot, NaN
- probe prediction/risk endpoints
"""
import json, urllib.request, urllib.error, statistics

BASE = "http://127.0.0.1:5005"

def login():
    req = urllib.request.Request(BASE + "/api/auth/login",
        data=json.dumps({"username": "admin", "password": "123456"}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["access_token"]

TOKEN = login()
AUTH = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}

def call(method, url, body=None):
    req = urllib.request.Request(BASE + url, headers=AUTH, method=method)
    if body is not None:
        req.data = json.dumps(body).encode()
    try:
        r = urllib.request.urlopen(req, timeout=120)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def unwrap(d):
    if isinstance(d, dict) and "data" in d:
        return d["data"]
    return d

# 1) recalculate
s, b = call("POST", "/api/algorithm/composite-score/recalculate", {})
print("[recalculate] status", s, "| msg:", (b.get("data") or b).get("message") if isinstance(b, dict) else b)

# 2) fetch composite-score
s, d = call("GET", "/api/algorithm/composite-score")
data = unwrap(d)
rks = data.get("rankings") or []
print("[composite-score] status", s, "count", len(rks))
print("  weights:", data.get("weights"))

acad_pos = [r for r in rks if r.get("academic_score") not in (None, 0)]
print("  students with academic>0:", len(acad_pos), "/", len(rks))

cs = [r["composite_score"] for r in rks if isinstance(r.get("composite_score"), (int, float))]
nan = [r for r in rks if isinstance(r.get("composite_score"), float) and r["composite_score"] != r["composite_score"]]
print("  composite min=%.1f max=%.1f mean=%.1f stdev=%.1f" % (min(cs), max(cs), statistics.mean(cs), statistics.pstdev(cs)))
print("  NaN count:", len(nan))
print("  TOP5:", [(r.get("name"), r.get("composite_score"), r.get("academic_score")) for r in rks[:5]])
print("  BOT5:", [(r.get("name"), r.get("composite_score"), r.get("academic_score")) for r in rks[-5:]])

# 3) prediction / risk endpoints
for ep in ["/api/algorithm/prediction/risk", "/api/algorithm/risk-predict/high-risk"]:
    s2, d2 = call("GET", ep)
    payload = unwrap(d2)
    if isinstance(payload, dict):
        n = None
        for k in ("count", "rankings", "students", "data", "items", "list"):
            if isinstance(payload.get(k), list):
                n = len(payload[k])
        print(f"[{ep}] status {s2} keys={list(payload.keys())[:8]} list_len={n}")
    elif isinstance(payload, list):
        print(f"[{ep}] status {s2} list_len={len(payload)}")
    else:
        print(f"[{ep}] status {s2} type={type(payload)}")
