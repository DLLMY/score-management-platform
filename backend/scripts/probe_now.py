import urllib.request, json
BASE = "http://127.0.0.1:5000"

def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=10)
        return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

for uname in ["admin", "teacher", "paikao"]:
    st, raw = req("POST", "/api/auth/login", body={"username": uname, "password": "123456"})
    print(f"\n=== login {uname}: {st} ===")
    if st != 200:
        print("  login failed")
        continue
    j = json.loads(raw)
    tok = j.get("access_token")
    admin = j.get("admin", {})
    aid = admin.get("id")
    st2, raw2 = req("GET", f"/api/rbac/admin-roles/{aid}", token=tok)
    perms = []
    roles = []
    if st2 == 200:
        d = json.loads(raw2)
        data = d.get("data", d)
        perms = data.get("permissions", [])
        roles = data.get("roles", [])
    print(f"  id={aid} real_name={admin.get('real_name')} roles={roles}")
    print(f"  permissions({len(perms)}): {perms}")
    paths = [
        "/api/seating/charts", "/api/duty/groups", "/api/committee/members",
        "/api/parent/contacts", "/api/homework/assignments", "/api/attendance/records",
        "/api/study-group/groups", "/api/mental-health/records", "/api/activity",
        "/api/culture/records", "/api/study-guide/guides", "/api/phonebox-policy",
    ]
    codes = []
    for p in paths:
        s, _ = req("GET", p, token=tok)
        label = p.split("/")[2] if p.count("/") >= 2 else p
        codes.append(f"{label}:{s}")
    print("  endpoints:", " | ".join(codes))
