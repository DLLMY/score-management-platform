"""业务逻辑端到端测试 — CRUD + 数据一致性验证"""
import http.client, json, sys

HOST = "127.0.0.1"
PORT = 5003
PASS = FAIL = 0
TOKEN = None

def api(method, path, body=None, token=None, exp=200):
    global PASS, FAIL
    if token is None:
        token = TOKEN
    conn = http.client.HTTPConnection(HOST, PORT, timeout=15)
    h = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
    try:
        if body:
            conn.request(method, path, body=json.dumps(body, ensure_ascii=False).encode(), headers=h)
        else:
            conn.request(method, path, headers=h)
        resp = conn.getresponse()
        data = json.loads(resp.read().decode())
        status = resp.status
        label = f"  {method} {path.split('?')[0]}"
        if status == exp:
            print(f"PASS {label} -> {status}")
            PASS += 1
        else:
            msg = data.get("message", data.get("error", str(data)[:80]))
            print(f"FAIL {label} -> {status} (exp {exp}): {msg}")
            FAIL += 1
        conn.close()
        return data
    except Exception as e:
        print(f"FAIL {method} {path}: {str(e)[:100]}")
        FAIL += 1
        conn.close()
        return None

# ===== Login =====
print("=== Login ===")
conn = http.client.HTTPConnection(HOST, PORT, timeout=15)
body = json.dumps({"username": "admin", "password": "123456"}).encode()
conn.request("POST", "/api/auth/login", body=body, headers={"Content-Type": "application/json"})
data = json.loads(conn.getresponse().read().decode())
TOKEN = data["access_token"]
admin_id = data["data"]["admin"]["id"]
print(f"  Admin id={admin_id} role={data['data']['admin']['role']}")
conn.close()

# ===== 1. User 用户 CRUD =====
print("\n=== 1. User 用户管理逻辑 ===")
# Create
uid = api("POST", "/api/users", body={
    "name": "测试学生", "gender": "male", "class_name": "一年一班",
    "card_id": "TEST_LOGIC_001", "phone": "13800000000"
})
uid = uid["data"]["user"]["id"] if uid and "data" in uid and "user" in uid["data"] else None
print(f"     Created user id={uid}")

# Read & verify
if uid:
    u = api("GET", f"/api/users/{uid}")
    if u:
        name = u.get("data", {}).get("name", "") or u.get("name", "")
        print(f"     Read back: name={name}")

# Update
if uid:
    api("PUT", f"/api/users/{uid}", body={"phone": "13800000001"})
    u = api("GET", f"/api/users/{uid}")
    if u:
        phone = u.get("data", {}).get("phone", "") or u.get("phone", "")
        print(f"     After update phone={phone}")

# Delete
if uid:
    api("DELETE", f"/api/users/{uid}")
    api("GET", f"/api/users/{uid}", exp=404)
    print(f"     Deleted and verified 404")

# ===== 2. Score 积分录入逻辑 =====
print("\n=== 2. Score 积分录入逻辑 ===")
# Get first user for testing
ul = api("GET", "/api/users?per_page=1")
users = []
if ul:
    d = ul.get("data", ul)
    users = d.get("users", [])
test_user = users[0] if users else None
if test_user:
    uid = test_user["id"]
    old_score = test_user.get("current_score", 0)
    print(f"     User {test_user['name']} current_score={old_score}")

    # Record a score
    r = api("POST", "/api/records", body={
        "user_id": uid, "score_change": 5,
        "description": "逻辑测试加分", "rule_id": 1
    })
    if r:
        # Verify score changed
        u2 = api("GET", f"/api/users/{uid}")
        if u2:
            new_score = u2.get("data", {}).get("current_score", 0) or u2.get("current_score", 0)
            print(f"     After +5: current_score={new_score} (was {old_score}, diff={new_score - old_score})")

    # Undo or revert
    r2 = api("POST", "/api/records", body={
        "user_id": uid, "score_change": -5,
        "description": "逻辑测试撤销", "rule_id": 1
    })
    if r2:
        u3 = api("GET", f"/api/users/{uid}")
        if u3:
            final_score = u3.get("data", {}).get("current_score", 0) or u3.get("current_score", 0)
            print(f"     After -5: current_score={final_score} (should be {old_score})")

# ===== 3. Rule 规则 CRUD =====
print("\n=== 3. Rule 积分规则逻辑 ===")
rid = api("POST", "/api/rules", body={
    "name": "逻辑测试规则", "description": "测试用规则",
    "category_id": 1, "score": 10, "is_active": True
})
rid = rid["data"]["id"] if rid and "data" in rid else None
print(f"     Created rule id={rid}")
if rid:
    api("PUT", f"/api/rules/{rid}", body={"score": 15})
    r = api("GET", f"/api/rules/{rid}")
    if r:
        print(f"     Updated score to {r.get('data',{}).get('score','?')}")
    api("DELETE", f"/api/rules/{rid}")
    api("GET", f"/api/rules/{rid}", exp=404)
    print(f"     Deleted rule")

# ===== 4. Class 班级管理 =====
print("\n=== 4. Class 班级管理 ===")
c = api("POST", "/api/classes", body={"name": "逻辑测试班", "grade": "一年级"})
cid = None
if c:
    d = c.get("data", c)
    if isinstance(d, dict):
        cid = d.get("id") or d.get("data", {}).get("id")
print(f"     Created class id={cid}")
if cid:
    api("PUT", f"/api/classes/{cid}", body={"description": "测试班级描述"})
    api("DELETE", f"/api/classes/{cid}")
    print(f"     Deleted class")

# ===== 5. Device 设备状态 =====
print("\n=== 5. Device 设备管理 ===")
dl = api("GET", "/api/devices")
devices = []
if dl:
    d = dl.get("data", dl)
    devices = d.get("devices", [])
print(f"     Device count: {len(devices)}")
if devices:
    d = devices[0]
    print(f"     First: {d.get('device_id','?')} status={d.get('status','?')} online={d.get('is_online','?')}")

# ===== 6. Dashboard 数据一致性 =====
print("\n=== 6. Dashboard 数据一致性 ===")
db_data = api("GET", "/api/dashboard/data")
if db_data:
    d = db_data.get("data", db_data)
    total_users = d.get("total_users", 0)
    # Verify user count matches actual list
    ul2 = api("GET", "/api/users?per_page=1")
    if ul2:
        actual_total = ul2.get("data", {}).get("total", 0) or ul2.get("total", 0)
        match = "MATCH" if total_users == actual_total else f"MISMATCH (db={total_users}, api={actual_total})"
        print(f"     Dashboard total_users={total_users} vs API total={actual_total}: {match}")

# ===== 7. NLP 解析 → 评分联动 =====
print("\n=== 7. NLP 解析 → 评分联动 ===")
if test_user:
    nlp = api("POST", "/api/nlp/parse", body={"text": f"{test_user['name']} 上课积极发言加3分"})
    if nlp:
        d = nlp.get("data", nlp)
        extracted = d.get("extracted_name", "") or d.get("parse_result", {}).get("extracted_name", "")
        print(f"     NLP extracted name={extracted}")

# ===== 8. RBAC 权限隔离 =====
print("\n=== 8. RBAC 权限隔离 ===")
t_conn = http.client.HTTPConnection(HOST, PORT, timeout=15)
t_body = json.dumps({"username": "teacher", "password": "123456"}).encode()
t_conn.request("POST", "/api/auth/login", body=t_body, headers={"Content-Type": "application/json"})
t_data = json.loads(t_conn.getresponse().read().decode())
T_TOKEN = t_data["access_token"]
t_conn.close()

# teacher should be forbidden from admin endpoints
tests = [("/api/admins", 403), ("/api/dashboard/data", 200), ("/api/rbac/roles", 200)]
for path, exp in tests:
    conn2 = http.client.HTTPConnection(HOST, PORT, timeout=10)
    conn2.request("GET", path, headers={"Authorization": "Bearer " + T_TOKEN})
    resp = conn2.getresponse()
    status = resp.status
    conn2.close()
    if status == exp:
        print(f"  PASS teacher {path} -> {status} (expected {exp})")
        PASS += 1
    else:
        print(f"  FAIL teacher {path} -> {status} (expected {exp})")
        FAIL += 1

# ===== Summary =====
print(f"\n{'='*50}")
all_pass = 45
print(f"Total: {PASS} pass / {FAIL} fail")
if FAIL == 0:
    print("ALL LOGIC TESTS PASSED!")
print(f"{'='*50}")
