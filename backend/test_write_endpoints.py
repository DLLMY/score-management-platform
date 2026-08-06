"""
写入端点(POST/PUT/DELETE/PATCH)全面冒烟测试 v2 —— 不导入 app(避免加载 ML 模型)。
对每条写端点发送较真实 payload(路径参数用占位 id=999999 避免误删真实数据)，
捕捉 500(真实服务端崩溃)而非 400/404(校验/预期)。逐条 flush 输出便于监控。

用法：
  TEST_BASE="http://127.0.0.1:5005" PYTHONPATH=. ../.venv/Scripts/python.exe test_write_endpoints.py
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error

BASE = os.environ.get("TEST_BASE", "http://127.0.0.1:5005")
TOKEN = None
AUTH = {}

def log(*a):
    print(*a, flush=True)

def login(username="admin", password="123456"):
    global TOKEN, AUTH
    req = urllib.request.Request(
        BASE + "/api/auth/login",
        data=json.dumps({"username": username, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    TOKEN = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())["access_token"]
    AUTH = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
    log("login OK, token len=", len(TOKEN))

def call(method, url, body=None, timeout=40):
    try:
        if body is None:
            data = b"{}"
        else:
            data = json.dumps(body).encode()
        req = urllib.request.Request(BASE + url, data=data, headers=AUTH, method=method)
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read(500).decode(errors="replace")
    except Exception as e:
        return "ERR", str(e)[:120]

# (name, method, url, payload_or_None)
CASES = [
    # auth
    ("注销", "POST", "/api/auth/logout", {}),
    # users / admins / roles
    ("创建管理员", "POST", "/api/admins", {"username": "smoke_a2", "password": "smoke123", "role": "teacher", "real_name": "冒烟"}),
    ("更新管理员(占位)", "PUT", "/api/admins/999999", {"real_name": "x"}),
    ("删除管理员(占位)", "DELETE", "/api/admins/999999", None),
    ("创建用户", "POST", "/api/users", {"username": "smoke_u", "password": "smoke123", "role": "student", "real_name": "冒烟生", "class_name": "一年一班"}),
    ("创建角色", "POST", "/api/roles", {"name": "smoke_role_e2e", "description": "冒烟", "permissions": "score:view,user:view"}),
    ("更新角色(占位)", "PUT", "/api/roles/999999", {"description": "x"}),
    ("删除角色(占位)", "DELETE", "/api/roles/999999", None),
    # rbac
    ("RBAC分配角色", "POST", "/api/rbac/admin-roles", {"admin_id": 1, "role_id": 1}),
    ("RBAC创建权限", "POST", "/api/rbac/permissions", {"code": "smoke:perm", "name": "冒烟权限", "category": "score"}),
    ("RBAC更新权限(占位)", "PUT", "/api/rbac/permissions/999999", {"name": "x"}),
    ("RBAC角色权限映射", "POST", "/api/rbac/role-permissions", {"role_id": 1, "permission_ids": [1]}),
    # scores
    ("创建积分规则", "POST", "/api/rules", {"name": "smoke_rule", "description": "auto", "score": 5, "category": "behavior", "daily_limit": 3, "is_active": True}),
    ("更新规则(占位)", "PUT", "/api/rules/999999", {"score": 2}),
    ("删除规则(占位)", "DELETE", "/api/rules/999999", None),
    ("创建积分分类", "POST", "/api/score-categories", {"name": "smoke_cat", "description": "auto", "weight": 1.0}),
    ("更新积分分类(占位)", "PUT", "/api/score-categories/999999", {"weight": 1.0}),
    ("删除积分分类(占位)", "DELETE", "/api/score-categories/999999", None),
    ("创建积分记录", "POST", "/api/records", {"student_id": 1, "rule_id": 1, "score": 5, "reason": "auto smoke"}),
    ("创建审批", "POST", "/api/approvals", {"record_id": 1, "action": "approve", "comment": "auto"}),
    ("更新审批(占位)", "PUT", "/api/approvals/999999", {"action": "approve"}),
    ("创建时间段规则", "POST", "/api/time-rules", {"name": "smoke_tr", "day_of_week": 1, "start_hour": 8, "start_minute": 0, "end_hour": 9, "end_minute": 0}),
    ("创建课时", "POST", "/api/class-periods", {"name": "smoke_cp", "period_number": 99, "start_hour": 8, "start_minute": 0, "end_hour": 8, "end_minute": 45}),
    # devices
    ("创建设备", "POST", "/api/devices", {"device_id": "SMOKE_E2E_001", "name": "冒烟设备", "location": "测试", "status": "online"}),
    ("更新设备(占位)", "PUT", "/api/devices/999999", {"name": "x"}),
    ("设备指令(占位)", "POST", "/api/devices/999999/command", {"command": "unlock"}),
    ("创建设备组", "POST", "/api/device-groups", {"name": "smoke_dg", "description": "auto"}),
    ("创建固件版本", "POST", "/api/firmware/versions", {"version": "1.0.0-smoke", "description": "auto", "url": "http://x/fw.bin"}),
    # notifications / alerts
    ("发送通知", "POST", "/api/notifications", {"title": "冒烟通知", "content": "auto", "user_ids": [1]}),
    ("标记通知已读(占位)", "PUT", "/api/notifications/999999/read", {}),
    ("告警确认(占位)", "POST", "/api/alerts/999999/ack", {}),
    # academics
    ("创建考试", "POST", "/api/exams", {"name": "冒烟考试", "exam_type": "midterm", "date": "2026-08-10", "start_time": "09:00", "end_time": "10:30", "class_id": 1, "subjects": ["数学"], "importance": "normal"}),
    ("更新考试(占位)", "PUT", "/api/exams/999999", {"name": "x"}),
    ("删除考试(占位)", "DELETE", "/api/exams/999999", None),
    ("创建班级", "POST", "/api/classes", {"name": "冒烟班", "grade": "一年级"}),
    ("创建科目", "POST", "/api/subjects", {"name": "冒烟科目"}),
    ("创建课程表", "POST", "/api/course-schedules", {"class_info_id": 1, "subject_id": 1, "day_of_week": 1, "period_number": 1}),
    ("创建行政班", "POST", "/api/admin-classes", {"name": "冒烟行政班", "grade": "一年级"}),
    # algorithm (heavy logic)
    ("重算聚类", "POST", "/api/algorithm/cluster/recalculate", {"n_clusters": 4}),
    ("综合评分重算", "POST", "/api/algorithm/composite-score/recalculate", {}),
    ("批量预测", "POST", "/api/algorithm/prediction/batch", {"days": 7}),
    ("批量异常检测", "POST", "/api/algorithm/anomaly/batch", {"days": 30}),
    ("规则推荐", "POST", "/api/algorithm/rule-recommend", {"student_id": 1}),
    ("规则推荐优化", "POST", "/api/algorithm/rule-recommend/optimization", {"days": 30}),
    ("分数预测分布", "POST", "/api/algorithm/score-predict/distribution", {"days": 30}),
    ("更新预警配置", "PUT", "/api/algorithm/warning/config", {"threshold": 0.8}),
    ("创建奖励类型", "POST", "/api/algorithm/reward/types", {"name": "smoke_reward", "score": 10}),
    ("创建积分获取规则", "POST", "/api/algorithm/score-ecosystem/earning-rules", {"name": "smoke_er", "score": 5}),
    # nlp
    ("创建NLP规则", "POST", "/api/nlp/rules", {"name": "smoke_nlp", "pattern": "测试", "category": "behavior", "score": 3}),
    ("NLP训练", "POST", "/api/nlp/train", {"rule_id": 1}),
    ("NLP评估", "POST", "/api/nlp/evaluate", {"rule_id": 1}),
    # class_management
    ("创建座位表", "POST", "/api/seating/charts", {"name": "smoke_seat", "class_id": 1, "rows": 5, "cols": 6}),
    ("创建值日组", "POST", "/api/duty/groups", {"name": "smoke_duty", "class_id": 1, "members": [1, 2]}),
    ("创建家委会成员", "POST", "/api/committee/members", {"name": "冒烟委员", "class_id": 1, "position": "会长", "student_id": 61}),
    ("创建家长联系", "POST", "/api/parent/contacts", {"student_id": 1, "phone": "13800000000", "relation": "父"}),
    ("创建作业", "POST", "/api/homework/assignments", {"title": "冒烟作业", "class_id": 1, "due_date": "2026-08-10"}),
    ("创建考勤记录", "POST", "/api/attendance/records", {"student_id": 1, "class_id": 1, "status": "present", "date": "2026-08-02"}),
    ("创建学习小组", "POST", "/api/study-group/groups", {"name": "冒烟小组", "class_id": 1, "members": [1, 2]}),
    ("创建心理健康记录", "POST", "/api/mental-health/records", {"student_id": 1, "score": 80, "note": "auto"}),
    ("创建活动", "POST", "/api/activity", {"title": "冒烟活动", "class_id": 1, "date": "2026-08-10"}),
    ("创建文化记录", "POST", "/api/culture/records", {"title": "冒烟文化", "class_id": 1, "content": "auto"}),
    ("创建学习指南", "POST", "/api/study-guide/guides", {"title": "冒烟指南", "class_id": 1, "content": "auto"}),
    # system / monitoring
    ("更新系统配置", "POST", "/api/system/config", {"key": "smoke_key", "value": "1"}),
    ("MQTT发布", "POST", "/api/mqtt/publish", {"topic": "test/topic", "message": "hello"}),
    ("写入错误日志", "POST", "/api/logs/error", {"message": "smoke error"}),
    ("WS广播", "POST", "/api/ws/broadcast", {"room": "test", "message": "hi"}),
]

def main():
    login()
    fails = []
    oks = 0
    n = len(CASES)
    log(f"=== 写入端点测试: {n} 条 ===")
    for i, (name, method, url, body) in enumerate(CASES, 1):
        t0 = time.time()
        status, resp = call(method, url, body)
        dt = time.time() - t0
        if status == 500 or status == "ERR":
            log(f"  [{i}/{n}][FAIL {status}] {name}: {method} {url}  ({dt:.1f}s)")
            log(f"       resp: {resp[:300]}")
            fails.append((name, method, url, status, resp[:300]))
        else:
            oks += 1
            tag = "OK" if (isinstance(status, int) and 200 <= status <= 299) else "accept"
            log(f"  [{i}/{n}][{tag} {status}] {name}: {method} {url}  ({dt:.1f}s)")
    log("\n=== 汇总 ===")
    log(f"总用例: {n}, 通过/可接受: {oks}, 失败(500/ERR): {len(fails)}")
    for name, method, url, status, resp in fails:
        log(f"  FAIL {status} | {name} | {method} {url} | {resp[:200]}")
    log("DONE")
    if fails:
        sys.exit(2)

if __name__ == "__main__":
    main()
