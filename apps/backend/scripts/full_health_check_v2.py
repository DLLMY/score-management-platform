"""全面服务健康检查 V2 - 使用所有正确的API路径"""

import requests
import time

BASE = "http://127.0.0.1:5000/api"


def check():
    results = []
    # 1. 登录
    try:
        t0 = time.time()
        r = requests.post(
            f"{BASE}/auth/login", json={"username": "admin", "password": "123456"}, timeout=10
        )
        elapsed = (time.time() - t0) * 1000
        if r.status_code == 200:
            token = r.json().get("access_token")
            results.append(("登录", "PASS", f"{r.status_code} {elapsed:.0f}ms"))
        else:
            results.append(("登录", "FAIL", f"{r.status_code}"))
            token = None
    except Exception as e:
        results.append(("登录", "ERROR", str(e)))
        token = None

    # 2. 全部页面API端点（使用前端实际调用的正确路径）
    endpoints = [
        # 首页
        ("GET", "/dashboard/data", "数据概览"),
        ("GET", "/users/", "学生管理"),
        ("GET", "/classes/", "班级管理"),
        ("GET", "/operation-logs/", "操作日志"),
        # 积分管理
        ("GET", "/rules/", "积分规则"),
        ("GET", "/rank-rules/", "排名规则"),
        ("GET", "/score-categories/", "积分分类"),
        ("GET", "/nlp/rules/statistics", "NLP统计"),
        ("GET", "/nlp/rules/", "NLP规则"),
        # 教务管理
        ("GET", "/subjects/", "科目管理"),
        ("GET", "/course-schedules/", "课程表"),
        ("GET", "/class-periods/", "课程节次"),
        ("GET", "/time-rules/", "时间规则"),
        # 成绩管理
        ("GET", "/exams/", "考试管理"),
        ("GET", "/scores/", "成绩档案"),
        # 班主任工作台
        ("GET", "/seating/charts", "座次表"),
        ("GET", "/duty/groups", "值日生表"),
        ("GET", "/committee/members", "班委名单"),
        ("GET", "/parent/contacts", "家长联系"),
        ("GET", "/homework/assignments", "作业检查"),
        ("GET", "/attendance/records", "考勤管理"),
        ("GET", "/study-group/groups", "学习小组"),
        ("GET", "/mental-health/records", "心理健康"),
        ("GET", "/activity", "文体活动"),
        ("GET", "/culture/records", "班级文化"),
        ("GET", "/study-guide/guides", "学法指导"),
        # 设备管理
        ("GET", "/devices/", "设备管理"),
        ("GET", "/device-group/", "设备分组"),
        ("GET", "/firmware/versions", "固件管理"),
        # 通知中心
        ("GET", "/notifications/", "通知管理"),
        ("GET", "/admin_notifications/", "管理员通知"),
        # 系统管理
        ("GET", "/admins/", "管理员列表"),
        ("GET", "/roles/", "角色管理"),
        ("GET", "/rbac/roles", "RBAC角色"),
        ("GET", "/security/audit-logs", "安全审计"),
        # 通知模板
        ("GET", "/notify_templates/", "通知模板"),
    ]

    headers = {"Authorization": f"Bearer {token}"} if token else {}

    for method, ep, label in endpoints:
        try:
            t0 = time.time()
            r = requests.get(f"{BASE}{ep}", headers=headers, timeout=10)
            elapsed = (time.time() - t0) * 1000
            status = "PASS" if r.status_code < 400 else "FAIL"
            body = ""
            try:
                j = r.json()
                if isinstance(j, dict):
                    for k in (
                        "items",
                        "data",
                        "rules",
                        "users",
                        "classes",
                        "devices",
                        "notifications",
                        "admins",
                        "periods",
                        "versions",
                        "logs",
                    ):
                        if k in j:
                            v = j[k]
                            if isinstance(v, list):
                                body = f"{k}={len(v)}"
                            elif isinstance(v, dict):
                                body = f"{k}=dict"
                            else:
                                body = f"{k}={v}"
                            break
                    else:
                        if "total" in j:
                            body = f"total={j['total']}"
                        else:
                            body = f"keys={list(j.keys())[:4]}"
                elif isinstance(j, list):
                    body = f"list={len(j)}"
            except:
                body = r.text[:30] if r.text else "empty"
            results.append((f"{label}({ep})", status, f"{r.status_code} {elapsed:.0f}ms {body}"))
        except Exception as e:
            results.append((f"{label}({ep})", "ERROR", str(e)[:50]))

    # 输出
    print("\n" + "=" * 95)
    print("全面服务健康检查报告 V2")
    print("=" * 95)
    p = sum(1 for _, s, _ in results if s == "PASS")
    f = sum(1 for _, s, _ in results if s == "FAIL")
    e = sum(1 for _, s, _ in results if s == "ERROR")
    print(
        f"总计: {len(results)}  通过: {p}  失败: {f}  错误: {e}  通过率: {p/len(results)*100:.0f}%"
    )
    print("-" * 95)
    for name, status, detail in results:
        icon = "✓" if status == "PASS" else "✗" if status == "FAIL" else "!"
        print(f"{icon} [{status:4}] {name:45} {detail}")
    print("=" * 95)
    return p, f, e


if __name__ == "__main__":
    check()
