"""广度端点扫描：对大量 GET 端点发请求，报告非 200，用于功能评估抓隐藏 bug。"""

import urllib.request, json, os, sys

BASE = os.environ.get("TEST_BASE", "http://127.0.0.1:5002")
ENDPOINTS = [
    # dashboard
    "/api/dashboard/data",
    "/api/dashboard/stats",
    # system
    "/api/system/config",
    "/api/system/health",
    "/api/operation-logs/summary",
    "/api/operation-logs",
    "/api/security/rate-limit-status",
    # users / rbac
    "/api/users",
    "/api/admins",
    "/api/roles",
    "/api/rbac/permissions",
    "/api/rbac/roles",
    "/api/rbac/admin-roles/1",
    "/api/rbac/admin-roles/2",
    "/api/permission-logs",
    # scores
    "/api/rules",
    "/api/score-categories",
    "/api/records",
    "/api/scores",
    "/api/approvals",
    "/api/time-rules",
    "/api/class-periods",
    # devices
    "/api/devices",
    "/api/devices/stats",
    "/api/device-group/",
    "/api/firmware/versions",
    # monitoring
    "/api/notifications",
    "/api/alerts",
    "/api/mqtt/logs",
    "/api/mqtt/status",
    "/api/mqtt/recent",
    # academics
    "/api/exams",
    "/api/classes",
    "/api/admin-classes/1",
    "/api/subjects",
    "/api/course-schedules/",
    "/api/exam-import/template",
    # class_management
    "/api/seating/charts",
    "/api/duty/groups",
    "/api/committee/members",
    "/api/parent/contacts",
    "/api/homework/assignments",
    "/api/attendance/records",
    "/api/study-group/groups",
    "/api/mental-health/records",
    "/api/activity",
    "/api/culture/records",
    "/api/study-guide/guides",
    # analysis
    "/api/analysis/class-ranking",
    "/api/analysis/student-ranking",
    "/api/analysis/class-compare?class_names=" + urllib.request.quote("一年一班,一年二班"),
    "/api/analysis/dashboard-summary",
    # algorithm (broad)
    "/api/algorithm/all",
    "/api/algorithm/statistics",
    "/api/algorithm/cluster",
    "/api/algorithm/composite-score",
    "/api/algorithm/composite-score/progress",
    "/api/algorithm/warning",
    "/api/algorithm/warning/config",
    "/api/algorithm/prediction/batch?days=7",
    "/api/algorithm/prediction/risk?days=7",
    "/api/algorithm/anomaly/batch?days=30",
    "/api/algorithm/rule-recommend",
    "/api/algorithm/rule-recommend/statistics?days=30",
    "/api/algorithm/rule-recommend/new?days=30",
    "/api/algorithm/rule-recommend/optimization?days=30",
    "/api/algorithm/rule-recommend/combination?days=30",
    "/api/algorithm/score-predict/distribution?days=30",
    "/api/algorithm/score-distribution/statistics",
    "/api/algorithm/risk-predict/high-risk?days=30",
    "/api/algorithm/reward/types",
    "/api/algorithm/score-ecosystem/earning-rules",
    "/api/algorithm/score-ecosystem/spending-rules",
    # nlp
    "/api/nlp/rules",
    "/api/nlp/model/algorithms",
    "/api/nlp/performance/stats",
]


def login():
    r = urllib.request.urlopen(
        urllib.request.Request(
            BASE + "/api/auth/login",
            data=json.dumps({"username": "admin", "password": "123456"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        ),
        timeout=20,
    )
    return json.loads(r.read().decode())["access_token"]


TOKEN = login()
H = {"Authorization": "Bearer " + TOKEN}
results = {"pass": 0, "fail": 0}
print(f"扫描 {len(ENDPOINTS)} 个端点 @ {BASE}")
for ep in ENDPOINTS:
    url = BASE + ep
    try:
        req = urllib.request.Request(url, headers=H)
        r = urllib.request.urlopen(req, timeout=30)
        if r.status == 200:
            results["pass"] += 1
        else:
            results["fail"] += 1
            print(f"  WARN {r.status} {ep}")
    except urllib.error.HTTPError as e:
        body = e.read(400).decode(errors="replace").replace("\n", " ")
        results["fail"] += 1
        print(f"  FAIL {e.code} {ep} :: {body[:200]}")
    except Exception as e:
        results["fail"] += 1
        print(f"  ERR {ep} :: {str(e)[:80]}")
print(f"\n扫描结果: {results['pass']} pass, {results['fail']} fail (of {len(ENDPOINTS)})")
