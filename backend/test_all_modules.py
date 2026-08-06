"""全模块API测试脚本"""
import urllib.request, json, sys, time

import os
BASE = os.environ.get("TEST_BASE", "http://127.0.0.1:5003")
TOTAL = {"pass": 0, "fail": 0, "skip": 0}

def login(u, p):
    d = json.dumps({"username": u, "password": p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        BASE + "/api/auth/login", data=d,
        headers={"Content-Type": "application/json"}, method="POST"), timeout=20)
    return json.loads(r.read().decode())

def test(method, path, name, expected_status=200, body=None, headers=None):
    global TOTAL
    try:
        h = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
        if headers: h.update(headers)
        if body:
            req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=h, method=method)
        else:
            req = urllib.request.Request(BASE + path, headers=h)
        r = urllib.request.urlopen(req, timeout=15)
        status = r.status
        if status == expected_status:
            print(f"  PASS {name}: {status}")
            TOTAL["pass"] += 1
        else:
            print(f"  WARN {name}: {status} (expected {expected_status})")
            TOTAL["fail"] += 1
        return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        code = e.code
        if code == expected_status:
            print(f"  PASS {name}: {code} (expected)")
            TOTAL["pass"] += 1
        else:
            print(f"  FAIL {name}: {code} (expected {expected_status})")
            TOTAL["fail"] += 1
        return None
    except Exception as e:
        print(f"  FAIL {name}: {str(e)[:80]}")
        TOTAL["fail"] += 1
        return None

# ===== Login =====
print("Logging in...")
try:
    result = login("admin", "123456")
    TOKEN = result["access_token"]
    print(f"  Login OK (admin, role={result['data']['admin']['role']})")
except Exception as e:
    print(f"  Login FAIL: {e}")
    sys.exit(1)

# ===== 1. Auth 认证模块 =====
print("\n=== 1. Auth 认证模块 ===")
test("POST", "/api/auth/login", "admin登录", body={"username":"admin","password":"123456"})
test("POST", "/api/auth/login", "错误密码", 401, body={"username":"admin","password":"wrong"})
test("POST", "/api/auth/login", "teacher登录", body={"username":"teacher","password":"123456"})

# ===== 2. 管理员/权限 RBAC =====
print("\n=== 2. RBAC 权限模块 ===")
test("GET", "/api/admins", "管理员列表")
test("GET", "/api/roles", "角色列表")
test("GET", "/api/rbac/permissions", "RBAC权限列表")
test("GET", "/api/rbac/roles", "RBAC角色列表")
test("GET", "/api/rbac/admin-roles/1", "admin角色权限")
test("GET", "/api/rbac/admin-roles/2", "teacher角色权限")

# ===== 3. 用户管理 =====
print("\n=== 3. 用户管理 ===")
test("GET", "/api/users", "用户列表")
test("GET", "/api/users?page=1&per_page=3", "用户分页")

# ===== 4. 班级管理 =====
print("\n=== 4. 班级管理 ===")
test("GET", "/api/classes", "班级列表")

# ===== 5. 积分规则 =====
print("\n=== 5. 积分规则 ===")
test("GET", "/api/rules", "规则列表")
test("GET", "/api/score-categories", "积分分类")

# ===== 6. 积分记录 =====
print("\n=== 6. 积分记录 ===")
test("GET", "/api/records", "积分记录列表")
test("GET", "/api/scores", "成绩列表")

# ===== 7. 设备管理 =====
print("\n=== 7. 设备管理 ===")
test("GET", "/api/devices", "设备列表")
test("GET", "/api/devices/stats", "设备统计")

# ===== 8. 仪表盘 =====
print("\n=== 8. 仪表盘 ===")
test("GET", "/api/dashboard/data", "仪表盘数据")
test("GET", "/api/dashboard/stats", "仪表盘统计")

# ===== 9. 系统管理 =====
print("\n=== 9. 系统管理 ===")
test("GET", "/api/system/config", "系统配置")
test("GET", "/api/operation-logs/summary", "操作日志")

# ===== 10. 数据分析 =====
print("\n=== 10. 数据分析 ===")
test("GET", "/api/analysis/class-ranking", "班级排名")
test("GET", "/api/analysis/student-ranking", "学生排名")
test("GET", "/api/analysis/class-compare?class_names=" + urllib.parse.quote("一年一班,一年二班"), "班级对比")
test("GET", "/api/analysis/dashboard-summary", "分析汇总")

# ===== 11. 算法模块 =====
print("\n=== 11. 算法模块 ===")
test("GET", "/api/algorithm/all", "全部算法数据")
test("GET", "/api/algorithm/cluster", "学生分群")

# ===== 12. NLP 模块 =====
print("\n=== 12. NLP 模块 ===")
test("POST", "/api/nlp/parse", "NLP解析", body={"text":"张三上课发言积极加3分"})
test("GET", "/api/nlp/rules", "NLP规则")
test("GET", "/api/nlp/model/algorithms", "NLP算法列表")
test("POST", "/api/nlp/sentiment", "情感分析", body={"text":"今天表现很好"})

# ===== 13. 考试管理 =====
print("\n=== 13. 考试管理 ===")
test("GET", "/api/exams", "考试列表")

# ===== 14. 班主任工作台 =====
print("\n=== 14. 班主任工作台 ===")
test("GET", "/api/seating/charts", "座次表")
test("GET", "/api/duty/groups", "值日组")
test("GET", "/api/committee/members", "班委名单")
test("GET", "/api/parent/contacts", "家长联系")
test("GET", "/api/homework/assignments", "作业检查")
test("GET", "/api/attendance/records", "考勤记录")
test("GET", "/api/study-group/groups", "学习小组")
test("GET", "/api/mental-health/records", "心理健康")
test("GET", "/api/activity", "文体活动")
test("GET", "/api/culture/records", "班级文化")
test("GET", "/api/study-guide/guides", "学法指导")

# ===== 15. 通知 =====
print("\n=== 15. 通知中心 ===")
test("GET", "/api/notifications", "通知列表")

# ===== Summary =====
print(f"\n{'='*50}")
print(f"Total: {TOTAL['pass']} pass, {TOTAL['fail']} fail, {TOTAL['skip']} skip")
print(f"{'='*50}")
