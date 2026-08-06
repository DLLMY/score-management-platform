import urllib.request, json

BASE = "http://127.0.0.1:5003"

def login(u, p):
    d = json.dumps({"username": u, "password": p}).encode()
    r = urllib.request.urlopen(
        urllib.request.Request(BASE + "/api/auth/login", data=d,
            headers={"Content-Type": "application/json"}, method="POST"), timeout=15)
    return json.loads(r.read().decode())["access_token"]

admin_t = login("admin", "123456")
teacher_t = login("teacher", "123456")

# Test RBAC endpoints
h = {"Authorization": "Bearer " + admin_t}
for ep in ["/api/rbac/admin-roles/1", "/api/rbac/admin-roles/2"]:
    r = json.loads(urllib.request.urlopen(
        urllib.request.Request(BASE + ep, headers=h), timeout=10).read().decode())
    d = r.get("data", r)
    print("{}: roles={} perms={}".format(ep, d.get("roles", []), len(d.get("permissions", []))))

# Test teacher permissions with new has_permission
th = {"Authorization": "Bearer " + teacher_t}
for ep in ["/api/users", "/api/admins", "/api/dashboard/data"]:
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(BASE + ep, headers=th), timeout=10)
        print("teacher {}: {}".format(ep, r.status))
    except Exception as e:
        s = str(e)
        code = s.split("HTTP Error ")[1].split(":")[0] if "HTTP Error" in s else "ERR"
        print("teacher {}: {}".format(ep, code))

print("DONE")
