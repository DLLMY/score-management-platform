import urllib.request, json, sys

BASE = "http://127.0.0.1:5000"

def login():
    req = urllib.request.Request(BASE + "/api/auth/login", method="POST",
        headers={"Content-Type": "application/json"},
        data=json.dumps({"username": "admin", "password": "123456"}).encode())
    res = json.loads(urllib.request.urlopen(req).read().decode())
    return res.get("access_token") or res.get("data", {}).get("access_token")

def get(path, tok):
    req = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {tok}"})
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def check_no_orm(obj, path=""):
    """递归检查 JSON 里是否混入了 ORM 对象（无法序列化 / __tablename__ 特征）"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("__tablename__",) and isinstance(v, str):
                return f"ORM对象混入于 {path}.{k}"
            r = check_no_orm(v, f"{path}.{k}")
            if r: return r
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            r = check_no_orm(v, f"{path}[{i}]")
            if r: return r
    return None

tok = login()
print("token:", (tok or "")[:20], "...")

print("\n=== 1) GET /api/algorithm/rule-recommend?days=30 ===")
status, data = get("/api/algorithm/rule-recommend?days=30", tok)
print("HTTP", status, "| success:", data.get("success"))
# request() 剥 envelope，所以真正数据在 data.data 下（或整段若是裸 list/dict）
payload = data.get("data", data)
print("payload type:", type(payload).__name__)
print("new_rules:", len(payload.get("new_rules", [])) if isinstance(payload, dict) else "N/A")
print("optimizations:", len(payload.get("optimizations", [])) if isinstance(payload, dict) else "N/A")
print("combinations:", len(payload.get("combinations", [])) if isinstance(payload, dict) else "N/A")
bad = check_no_orm(payload, "payload")
print("ORM混入检查:", "PASS (无)" if not bad else "FAIL -> " + bad)
assert status == 200, f"rule-recommend 期望 200，实际 {status}"

print("\n=== 2) GET /api/algorithm/prediction/risk?days=7 ===")
status, data = get("/api/algorithm/prediction/risk?days=7", tok)
print("HTTP", status, "| success:", data.get("success"))
payload = data.get("data", data)
print("payload type:", type(payload).__name__, "| len:", len(payload) if isinstance(payload, list) else "N/A")
assert status == 200, f"prediction/risk 期望 200，实际 {status}"
assert isinstance(payload, list), "prediction/risk 应返回数组（前端不再 .data.slice）"

print("\n=== 3) GET /api/algorithm/prediction/batch?days=7 ===")
status, data = get("/api/algorithm/prediction/batch?days=7", tok)
print("HTTP", status, "| success:", data.get("success"))
payload = data.get("data", data)
print("payload type:", type(payload).__name__)
assert status == 200

print("\nALL_CHECKS_PASSED")
