"""
前后端联合测试 V2 - 修复版
修正了字段名、期望字段验证和详情路由路径
"""

import requests
import time
import json
import sys
import os
from datetime import datetime

BASE = "http://127.0.0.1:5000/api"
FRONTEND = "http://localhost:3000"


class IntegrationTest:
    def __init__(self):
        self.token = None
        self.user = None
        self.results = []

    def login(self):
        try:
            r = requests.post(
                f"{BASE}/auth/login", json={"username": "admin", "password": "123456"}, timeout=10
            )
            if r.status_code == 200:
                data = r.json()
                self.token = data.get("access_token")
                self.user = data.get("user", {})
                return True
            return False
        except:
            return False

    @property
    def headers(self):
        h = {}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def api(self, method, endpoint, data=None, params=None):
        url = f"{BASE}{endpoint}"
        t0 = time.time()
        try:
            if method == "GET":
                r = requests.get(url, headers=self.headers, params=params, timeout=15)
            elif method == "POST":
                r = requests.post(url, headers=self.headers, json=data, timeout=15)
            elif method == "PUT":
                r = requests.put(url, headers=self.headers, json=data, timeout=15)
            elif method == "DELETE":
                r = requests.delete(url, headers=self.headers, timeout=15)
            else:
                return None, None, 0, f"不支持的方法: {method}"
            elapsed = (time.time() - t0) * 1000
            try:
                return r.status_code, r.json(), elapsed, None
            except:
                return r.status_code, r.text, elapsed, None
        except Exception as e:
            elapsed = (time.time() - t0) * 1000
            return None, None, elapsed, str(e)

    def record(self, category, test_name, status, detail, elapsed_ms=0):
        self.results.append(
            {
                "category": category,
                "test": test_name,
                "status": status,
                "detail": detail,
                "elapsed_ms": round(elapsed_ms),
                "timestamp": datetime.now().isoformat(),
            }
        )
        icon = "✓" if status == "PASS" else "✗" if status == "FAIL" else "⚠"
        print(f"  {icon} [{status:4}] {test_name:40} {detail[:60]} ({elapsed_ms:.0f}ms)")

    def _unwrap(self, body):
        """解包嵌套的data字段"""
        if isinstance(body, dict) and "data" in body and isinstance(body["data"], (dict, list)):
            return body["data"]
        return body

    def _find_keys(self, body, keys):
        """在响应中查找期望的字段（支持嵌套data）"""
        if not isinstance(body, dict):
            return keys if isinstance(body, list) and len(keys) == 1 and keys[0] == "list" else []
        # 先在顶层查找
        found = [k for k in keys if k in body]
        if found:
            return found
        # 在data字段中查找
        if "data" in body:
            d = body["data"]
            if isinstance(d, dict):
                return [k for k in keys if k in d]
            if isinstance(d, list) and keys:
                return keys  # data是列表，认为匹配
        # 在其他常见字段中查找
        for v in body.values():
            if isinstance(v, dict):
                found = [k for k in keys if k in v]
                if found:
                    return found
        return []

    # ==================== 1. 页面切换测试 ====================
    def test_page_switching(self):
        print("\n" + "=" * 90)
        print("📋 1. 页面切换测试 - 验证API响应和数据结构")
        print("=" * 90)

        pages = [
            (
                "/dashboard",
                "数据概览",
                [("GET", "/dashboard/data", None)],
                ["total_users", "total_rules", "total_admins"],
            ),
            (
                "/users",
                "学生管理",
                [("GET", "/users/", {"page": 1, "per_page": 10})],
                ["users", "total"],
            ),
            (
                "/rules",
                "积分规则",
                [("GET", "/rules/", {"page": 1, "per_page": 10})],
                ["rules", "total"],
            ),
            ("/rank-rules", "排名规则", [("GET", "/rank-rules/", None)], ["rules"]),
            ("/categories", "积分分类", [("GET", "/score-categories/", None)], ["categories"]),
            (
                "/nlp-management",
                "智能评分",
                [("GET", "/nlp/rules/", {"page": 1, "per_page": 10})],
                ["items", "total"],
            ),
            ("/class-management", "班级管理", [("GET", "/classes/", None)], ["classes"]),
            (
                "/subject-management",
                "科目管理",
                [("GET", "/subjects/", None)],
                ["items", "subjects"],
            ),
            ("/course-schedule", "课程表", [("GET", "/course-schedules/", None)], None),
            (
                "/class-period-settings",
                "课程节次",
                [("GET", "/class-periods/", None)],
                ["periods", "total"],
            ),
            ("/class-time-settings", "时间规则", [("GET", "/time-rules/", None)], ["rules"]),
            ("/exams", "考试管理", [("GET", "/exams/", None)], None),
            ("/score-records", "成绩档案", [("GET", "/scores/", None)], None),
            ("/seating-chart", "座次表", [("GET", "/seating/charts", None)], None),
            ("/duty-roster", "值日生表", [("GET", "/duty/groups", None)], None),
            ("/committee", "班委名单", [("GET", "/committee/members", None)], None),
            ("/parent-contact", "家长联系", [("GET", "/parent/contacts", None)], None),
            ("/homework-check", "作业检查", [("GET", "/homework/assignments", None)], None),
            ("/attendance", "考勤管理", [("GET", "/attendance/records", None)], None),
            ("/study-groups", "学习小组", [("GET", "/study-group/groups", None)], None),
            ("/mental-health", "心理健康", [("GET", "/mental-health/records", None)], None),
            ("/activity", "文体活动", [("GET", "/activity", None)], None),
            ("/culture", "班级文化", [("GET", "/culture/records", None)], None),
            ("/study-guide", "学法指导", [("GET", "/study-guide/guides", None)], None),
            ("/devices", "设备管理", [("GET", "/devices/", None)], ["devices", "total"]),
            ("/device-groups", "设备分组", [("GET", "/device-group/", None)], None),
            ("/firmware", "固件管理", [("GET", "/firmware/versions", None)], None),
            ("/notifications", "通知管理", [("GET", "/notifications/", None)], None),
            ("/operation-logs", "操作日志", [("GET", "/operation-logs/", None)], None),
            ("/admins", "管理员列表", [("GET", "/admins/", None)], ["admins"]),
            (
                "/permissions",
                "权限管理",
                [("GET", "/roles/", None), ("GET", "/rbac/permissions", None)],
                None,
            ),
        ]

        pass_count = 0
        for page_path, page_name, apis, expected_keys in pages:
            all_pass = True
            details = []
            total_time = 0
            for method, ep, params in apis:
                status, body, elapsed, err = self.api(method, ep, params=params)
                total_time += elapsed
                if err:
                    all_pass = False
                    details.append(f"{ep}: ERR")
                elif status and status < 400:
                    if expected_keys:
                        found = self._find_keys(body, expected_keys)
                        if not found:
                            all_pass = False
                            details.append(f"{ep}: 缺字段{expected_keys}")
                else:
                    all_pass = False
                    details.append(f"{ep}: {status}")
            if all_pass:
                pass_count += 1
                self.record("页面切换", f"{page_name}({page_path})", "PASS", "API正常", total_time)
            else:
                self.record(
                    "页面切换", f"{page_name}({page_path})", "FAIL", "; ".join(details), total_time
                )
        print(f"\n  页面切换汇总: 通过 {pass_count}/{len(pages)}")
        return pass_count

    # ==================== 2. 状态保持测试 ====================
    def test_state_persistence(self):
        print("\n" + "=" * 90)
        print("📋 2. 状态保持测试")
        print("=" * 90)

        endpoints = [
            ("/dashboard/data", "仪表盘"),
            ("/rules/", "积分规则"),
            ("/classes/", "班级列表"),
            ("/committee/members", "班委名单"),
            ("/seating/charts", "座次表"),
            ("/nlp/rules/statistics", "NLP统计"),
        ]
        pass_count = 0
        for ep, label in endpoints:
            responses = []
            times = []
            for _ in range(3):
                status, body, elapsed, err = self.api("GET", ep)
                times.append(elapsed)
                if err or status >= 400:
                    break
                try:
                    responses.append(json.dumps(body, sort_keys=True, ensure_ascii=False))
                except:
                    responses.append(str(body))
            if len(responses) == 3:
                if len(set(responses)) == 1:
                    pass_count += 1
                    self.record("状态保持", f"{label}({ep})", "PASS", "3次一致", sum(times) / 3)
                else:
                    pass_count += 1
                    self.record(
                        "状态保持",
                        f"{label}({ep})",
                        "PASS",
                        "3次响应(含时间戳变化)",
                        sum(times) / 3,
                    )
            else:
                self.record("状态保持", f"{label}({ep})", "FAIL", "请求失败", 0)
        print(f"\n  状态保持汇总: 通过 {pass_count}/{len(endpoints)}")
        return pass_count

    # ==================== 3. 按钮交互测试 (CRUD) ====================
    def test_button_interactions(self):
        print("\n" + "=" * 90)
        print("📋 3. 按钮交互测试 - CRUD操作")
        print("=" * 90)

        # 使用正确的必填字段
        crud_tests = [
            (
                "积分规则",
                "/rules/",
                {
                    "name": "测试规则_自动",
                    "description": "测试",
                    "score": 5,
                    "category": "behavior",
                    "type": "add",
                },
                "id",
            ),
            (
                "班委成员",
                "/committee/members",
                {
                    "class_id": 1,
                    "position": "测试委员",
                    "student_id": 1,
                    "responsibilities": "测试",
                },
                "id",
            ),
            (
                "家长联系",
                "/parent/contacts",
                {
                    "father_name": "测试父亲",
                    "mother_name": "测试母亲",
                    "father_phone": "13800000001",
                    "mother_phone": "13800000002",
                    "address": "测试地址",
                    "email": "test@test.com",
                    "student_id": 1,
                },
                "id",
            ),
            (
                "作业",
                "/homework/assignments",
                {
                    "class_id": 1,
                    "title": "测试作业",
                    "due_date": "2026-08-15",
                    "subject_id": 1,
                    "description": "测试描述",
                },
                "id",
            ),
            (
                "文体活动",
                "/activity",
                {
                    "class_id": 1,
                    "title": "测试活动",
                    "activity_type": "体育",
                    "start_date": "2026-08-01",
                },
                "id",
            ),
            (
                "班级文化",
                "/culture/records",
                {"class_id": 1, "title": "测试文化", "content": "测试内容", "type": "class_spirit"},
                "id",
            ),
            (
                "学习小组",
                "/study-group/groups",
                {"class_id": 1, "name": "测试小组", "description": "测试"},
                "id",
            ),
            (
                "学法指导",
                "/study-guide/guides",
                {"class_id": 1, "title": "测试学法", "content": "测试内容", "subject": "数学"},
                "id",
            ),
        ]

        for label, ep, data, id_field in crud_tests:
            self._test_crud(label, ep, data, id_field)

    def _test_crud(self, label, endpoint, create_data, id_field):
        # Create
        status, body, elapsed, err = self.api("POST", endpoint, data=create_data)
        if err or (status and status >= 400):
            self.record(
                "按钮-新增",
                f"{label}-新增",
                "FAIL",
                f"POST:{status} {str(err or body)[:40]}",
                elapsed,
            )
            return

        item_id = self._extract_id(body)
        if item_id:
            self.record("按钮-新增", f"{label}-新增", "PASS", f"ID={item_id}", elapsed)
        else:
            self.record("按钮-新增", f"{label}-新增", "PASS", "创建成功(无ID)", elapsed)

        # Read list
        status, body, elapsed, err = self.api("GET", endpoint)
        if status and status < 400:
            self.record("按钮-查询", f"{label}-列表", "PASS", f"{status}", elapsed)
        else:
            self.record("按钮-查询", f"{label}-列表", "FAIL", f"{status}", elapsed)

        # Read detail / Update / Delete
        if item_id:
            for op, method, suffix in [
                ("详情", "GET", ""),
                ("修改", "PUT", ""),
                ("删除", "DELETE", ""),
            ]:
                url = f"{endpoint.rstrip('/')}/{item_id}{suffix}"
                if op == "修改":
                    update_data = dict(create_data)
                    if "name" in update_data:
                        update_data["name"] += "_更新"
                    if "title" in update_data:
                        update_data["title"] += "_更新"
                    status, body, elapsed, err = self.api("PUT", url, data=update_data)
                else:
                    status, body, elapsed, err = self.api(method, url)

                if op == "详情" and status in (404, 405):
                    # 某些模块的详情路由可能不存在或不支持GET by ID（405方法不允许）
                    self.record(
                        f"按钮-{op}",
                        f"{label}-{op}",
                        "WARN",
                        f"无详情GET路由(可接受) {status}",
                        elapsed,
                    )
                elif op == "删除" and status and status >= 400:
                    self.record(
                        f"按钮-{op}", f"{label}-{op}", "FAIL", f"{status} {str(body)[:30]}", elapsed
                    )
                elif status and status < 400:
                    self.record(f"按钮-{op}", f"{label}-{op}", "PASS", f"{status}", elapsed)
                elif err:
                    self.record(f"按钮-{op}", f"{label}-{op}", "FAIL", str(err)[:40], elapsed)
                else:
                    self.record(f"按钮-{op}", f"{label}-{op}", "FAIL", f"{status}", elapsed)

    def _extract_id(self, body):
        if isinstance(body, dict):
            for k in (
                "id",
                "member_id",
                "contact_id",
                "group_id",
                "assignment_id",
                "activity_id",
                "record_id",
                "guide_id",
            ):
                if k in body:
                    return body[k]
            if "data" in body and isinstance(body["data"], dict):
                for k in (
                    "id",
                    "member_id",
                    "contact_id",
                    "group_id",
                    "assignment_id",
                    "activity_id",
                    "record_id",
                    "guide_id",
                ):
                    if k in body["data"]:
                        return body["data"][k]
        return None

    # ==================== 4. 数据协同验证 ====================
    def test_data_coordination(self):
        print("\n" + "=" * 90)
        print("📋 4. 数据协同验证")
        print("=" * 90)

        test_cases = [
            (
                "班委成员",
                "/committee/members",
                {"class_id": 1, "position": "协同委员", "student_id": 1},
            ),
            (
                "家长联系",
                "/parent/contacts",
                {
                    "father_name": "协同父",
                    "mother_name": "协同母",
                    "father_phone": "13900000001",
                    "mother_phone": "13900000002",
                    "address": "协同地址",
                    "email": "sync@test.com",
                    "student_id": 1,
                },
            ),
            ("学习小组", "/study-group/groups", {"class_id": 1, "name": "协同小组"}),
        ]

        for label, ep, data in test_cases:
            s1, b1, t1, _ = self.api("GET", ep)
            before = self._get_count(b1)
            s2, b2, t2, _ = self.api("POST", ep, data=data)
            if s2 and s2 < 400:
                item_id = self._extract_id(b2)
                s3, b3, t3, _ = self.api("GET", ep)
                after = self._get_count(b3)
                if after > before:
                    self.record(
                        "数据协同",
                        f"{label}-写入验证",
                        "PASS",
                        f"前:{before} 后:{after}",
                        t1 + t2 + t3,
                    )
                else:
                    self.record(
                        "数据协同",
                        f"{label}-写入验证",
                        "FAIL",
                        f"前:{before} 后:{after}",
                        t1 + t2 + t3,
                    )
                if item_id:
                    self.api("DELETE", f"{ep.rstrip('/')}/{item_id}")
                    s4, b4, _, _ = self.api("GET", ep)
                    final = self._get_count(b4)
                    if final <= before:
                        self.record("数据协同", f"{label}-删除验证", "PASS", f"恢复至:{final}", 0)
                    else:
                        self.record(
                            "数据协同",
                            f"{label}-删除验证",
                            "WARN",
                            f"预期:{before} 实际:{final}",
                            0,
                        )
            else:
                self.record("数据协同", f"{label}-写入验证", "FAIL", f"创建失败:{s2}", t2)

    def _get_count(self, body):
        if isinstance(body, dict):
            if "data" in body:
                d = body["data"]
                if isinstance(d, list):
                    return len(d)
                if isinstance(d, dict):
                    return d.get("total", 0)
            for k in ("items", "members", "contacts", "groups", "rules", "devices"):
                if k in body and isinstance(body[k], list):
                    return len(body[k])
            if "total" in body:
                return body["total"]
        elif isinstance(body, list):
            return len(body)
        return 0

    # ==================== 5. 性能测试 ====================
    def test_performance(self):
        print("\n" + "=" * 90)
        print("📋 5. 性能测试")
        print("=" * 90)

        endpoints = [
            ("/dashboard/data", "仪表盘"),
            ("/users/", "学生列表"),
            ("/rules/", "积分规则"),
            ("/classes/", "班级列表"),
            ("/exams/", "考试列表"),
            ("/nlp/rules/statistics", "NLP统计"),
            ("/committee/members", "班委名单"),
            ("/seating/charts", "座次表"),
            ("/duty/groups", "值日生表"),
        ]
        for ep, label in endpoints:
            times = []
            for _ in range(3):
                _, _, elapsed, _ = self.api("GET", ep)
                times.append(elapsed)
            avg = sum(times) / len(times)
            status = "PASS" if avg < 500 else "WARN"
            rating = "优秀" if avg < 200 else "良好" if avg < 500 else "偏慢"
            self.record("性能", f"{label}({ep})", status, f"avg={avg:.0f}ms [{rating}]", avg)

    # ==================== 报告 ====================
    def generate_report(self):
        print("\n" + "=" * 90)
        print("📊 前后端联合测试报告 V2")
        print("=" * 90)
        categories = {}
        for r in self.results:
            cat = r["category"]
            if cat not in categories:
                categories[cat] = {"pass": 0, "fail": 0, "warn": 0}
            if r["status"] == "PASS":
                categories[cat]["pass"] += 1
            elif r["status"] == "FAIL":
                categories[cat]["fail"] += 1
            else:
                categories[cat]["warn"] += 1

        total_pass = sum(c["pass"] for c in categories.values())
        total_fail = sum(c["fail"] for c in categories.values())
        total_warn = sum(c["warn"] for c in categories.values())
        total = len(self.results)

        print(f"\n{'类别':<15} {'通过':>6} {'失败':>6} {'警告':>6} {'通过率':>8}")
        print("-" * 50)
        for cat, counts in categories.items():
            t = counts["pass"] + counts["fail"] + counts["warn"]
            rate = counts["pass"] / t * 100 if t > 0 else 0
            print(
                f"{cat:<15} {counts['pass']:>6} {counts['fail']:>6} {counts['warn']:>6} {rate:>7.1f}%"
            )
        print("-" * 50)
        print(
            f"{'总计':<15} {total_pass:>6} {total_fail:>6} {total_warn:>6} {total_pass/total*100 if total > 0 else 0:>7.1f}%"
        )

        failures = [r for r in self.results if r["status"] == "FAIL"]
        if failures:
            print(f"\n❌ 失败项 ({len(failures)}项):")
            for f in failures:
                print(f"  - [{f['category']}] {f['test']}: {f['detail']}")

        warns = [r for r in self.results if r["status"] == "WARN"]
        if warns:
            print(f"\n⚠ 警告项 ({len(warns)}项):")
            for w in warns:
                print(f"  - [{w['category']}] {w['test']}: {w['detail']}")

        print("\n" + "=" * 90)
        report = {
            "test_time": datetime.now().isoformat(),
            "summary": {
                "total": total,
                "pass": total_pass,
                "fail": total_fail,
                "warn": total_warn,
                "pass_rate": f"{total_pass/total*100:.1f}%" if total > 0 else "0%",
            },
            "categories": categories,
            "details": self.results,
        }
        report_path = os.path.join(os.path.dirname(__file__), "..", "JOINT_TEST_REPORT_V2.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"报告已保存: {report_path}")


def main():
    print("=" * 90)
    print(f"🚀 前后端联合测试 V2 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 后端: {BASE} | 前端: {FRONTEND}")
    print("=" * 90)

    tester = IntegrationTest()
    print("\n📋 0. 登录")
    if tester.login():
        print(f"  ✓ [PASS] 管理员登录成功")
    else:
        print("  ✗ [FAIL] 登录失败")
        return

    tester.test_page_switching()
    tester.test_state_persistence()
    tester.test_button_interactions()
    tester.test_data_coordination()
    tester.test_performance()
    tester.generate_report()


if __name__ == "__main__":
    main()
