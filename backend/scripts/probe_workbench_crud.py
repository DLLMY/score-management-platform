# -*- coding: utf-8 -*-
"""班主任工作台 12 模块「写操作」冒烟测试。

只验证创建接口能否走通（权限 + 必填字段 + service 层），
创建成功的记录随后尽量删除，避免污染数据。
"""

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:5000"
CLASS_ID = 1  # 一年级1班 = teacher 的 primary_class_id
STUDENT_ID = 1  # 1班学生
SUBJECT_ID = 5  # 化学


def call(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw or "{}")
        except Exception:
            return e.code, {"raw": raw[:200]}
    except Exception as e:
        return -1, {"error": str(e)}


def login(username, password):
    st, res = call("POST", "/api/auth/login", body={"username": username, "password": password})
    if st != 200:
        return None
    return res.get("access_token")


# (标签, method, path, body, 删除路径模板 or None)
CASES = [
    (
        "座次表-新建",
        "POST",
        "/api/seating/charts",
        {"class_id": CLASS_ID, "name": "冒烟_座次表", "rows": 6, "columns": 6},
        "/api/seating/charts/{id}",
    ),
    (
        "值日组-新建",
        "POST",
        "/api/duty/groups",
        {"class_id": CLASS_ID, "name": "冒烟_值日组", "day_of_week": "1", "area": "教室"},
        "/api/duty/groups/{id}",
    ),
    (
        "班委-新建",
        "POST",
        "/api/committee/members",
        {"class_id": CLASS_ID, "position": "冒烟_学习委员", "student_id": STUDENT_ID},
        "/api/committee/members/{id}",
    ),
    (
        "家长联系-新建",
        "POST",
        "/api/parent/contacts",
        {"student_id": STUDENT_ID, "father_name": "冒烟_父", "father_phone": "13800000000"},
        "/api/parent/contacts/{id}",
    ),
    (
        "作业-新建",
        "POST",
        "/api/homework/assignments",
        {
            "class_id": CLASS_ID,
            "title": "冒烟_作业",
            "due_date": "2026-12-31",
            "subject_id": SUBJECT_ID,
        },
        "/api/homework/assignments/{id}",
    ),
    (
        "考勤-新建",
        "POST",
        "/api/attendance/records",
        {"class_id": CLASS_ID, "student_id": STUDENT_ID, "date": "2026-08-05", "status": "present"},
        "/api/attendance/records/{id}",
    ),
    (
        "请假-新建",
        "POST",
        "/api/attendance/leaves",
        {
            "student_id": STUDENT_ID,
            "start_date": "2026-08-06",
            "end_date": "2026-08-07",
            "leave_type": "personal",
        },
        "/api/attendance/leaves/{id}",
    ),
    (
        "学习小组-新建",
        "POST",
        "/api/study-group/groups",
        {"class_id": CLASS_ID, "name": "冒烟_小组", "leader_id": STUDENT_ID},
        "/api/study-group/groups/{id}",
    ),
    (
        "心理记录-新建",
        "POST",
        "/api/mental-health/records",
        {"student_id": STUDENT_ID, "mood_level": 4, "stress_level": 2, "sleep_hours": 8},
        "/api/mental-health/records/{id}",
    ),
    (
        "文体活动-新建",
        "POST",
        "/api/activity",
        {"class_id": CLASS_ID, "title": "冒烟_活动", "activity_type": "sports"},
        "/api/activity/{id}",
    ),
    (
        "班级文化-新建",
        "POST",
        "/api/culture/records",
        {"class_id": CLASS_ID, "category": "班训", "title": "冒烟_文化", "content": "测试"},
        "/api/culture/records/{id}",
    ),
    (
        "学法指导-新建",
        "POST",
        "/api/study-guide/guides",
        {"class_id": CLASS_ID, "title": "冒烟_学法", "guide_type": "method"},
        "/api/study-guide/guides/{id}",
    ),
    (
        "手机箱-一键放行",
        "POST",
        "/api/phonebox-policy/override",
        {"minutes": 5, "class_info_id": CLASS_ID},
        None,
    ),
]


def run(account, password):
    token = login(account, password)
    print("\n########## %s ##########" % account)
    if not token:
        print("  登录失败")
        return 0, 0
    ok = fail = 0
    for label, method, path, body, del_tpl in CASES:
        st, res = call(method, path, token, body)
        created_id = None
        if isinstance(res, dict):
            d = res.get("data")
            if isinstance(d, dict):
                created_id = d.get("id")
        if st in (200, 201):
            ok += 1
            print("  OK   %-16s %s" % (label, st))
            if del_tpl and created_id:
                call("DELETE", del_tpl.format(id=created_id), token)
        else:
            fail += 1
            msg = res.get("message") or res.get("error") or res.get("raw") or ""
            print("  FAIL %-16s %s  %s" % (label, st, str(msg)[:90]))
    print("  --- 通过 %d / 失败 %d ---" % (ok, fail))
    return ok, fail


if __name__ == "__main__":
    accounts = [("teacher", "123456"), ("admin", "123456")]
    if len(sys.argv) > 1 and sys.argv[1] == "teacher":
        accounts = [("teacher", "123456")]
    for u, p in accounts:
        run(u, p)
