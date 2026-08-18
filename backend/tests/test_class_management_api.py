#!/usr/bin/env python3
"""
班主任工作台 API 集成测试脚本
测试 11 个班级管理模块的 API 端点
- 验证所有 GET 端点正确响应
- 验证返回正确的 JSON 格式
- 捕获所有错误并报告
"""

import sys
import os
import json
import traceback
from datetime import datetime
from unittest.mock import patch, MagicMock

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, basedir)

from flask import Flask
from flask_restx import Api
from models import db

try:
    from api.class_management.seating_routes import ns_seating
except ImportError:
    pass

try:
    from api.class_management.duty_routes import ns_duty
except ImportError:
    pass

try:
    from api.class_management.committee_routes import ns_committee
except ImportError:
    pass

try:
    from api.class_management.parent_routes import ns_parent
except ImportError:
    pass

try:
    from api.class_management.homework_routes import ns_homework
except ImportError:
    pass

try:
    from api.class_management.attendance_routes import ns_attendance
except ImportError:
    pass

try:
    from api.class_management.study_group_routes import ns_study_group
except ImportError:
    pass

try:
    from api.class_management.mental_health_routes import ns_mental_health
except ImportError:
    pass

try:
    from api.class_management.activity_routes import ns_activity
except ImportError:
    pass

try:
    from api.class_management.culture_routes import ns_culture
except ImportError:
    pass

try:
    from api.class_management.study_guide_routes import ns_study_guide
except ImportError:
    pass


def create_test_app():
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = "test_secret_key"
    app.config["WTF_CSRF_ENABLED"] = False
    app.url_map.strict_slashes = False

    db.init_app(app)

    with app.app_context():
        db.create_all()

    return app


def register_test_routes(app):
    """注册班级管理相关路由"""
    api = Api(app, version="1.0", title="测试API", prefix="/api")

    from api.class_management.seating_routes import ns_seating
    from api.class_management.duty_routes import ns_duty
    from api.class_management.committee_routes import ns_committee
    from api.class_management.parent_routes import ns_parent
    from api.class_management.homework_routes import ns_homework
    from api.class_management.attendance_routes import ns_attendance
    from api.class_management.study_group_routes import ns_study_group
    from api.class_management.mental_health_routes import ns_mental_health
    from api.class_management.activity_routes import ns_activity
    from api.class_management.culture_routes import ns_culture
    from api.class_management.study_guide_routes import ns_study_guide

    api.add_namespace(ns_seating, path="/seating")
    api.add_namespace(ns_duty, path="/duty")
    api.add_namespace(ns_committee, path="/committee")
    api.add_namespace(ns_parent, path="/parent")
    api.add_namespace(ns_homework, path="/homework")
    api.add_namespace(ns_attendance, path="/attendance")
    api.add_namespace(ns_study_group, path="/study-group")
    api.add_namespace(ns_mental_health, path="/mental-health")
    api.add_namespace(ns_activity, path="/activity")
    api.add_namespace(ns_culture, path="/culture")
    api.add_namespace(ns_study_guide, path="/study-guide")

    return api


def mock_permission_decorator():
    """Mock requires_permission 装饰器，跳过权限检查"""

    def mock_decorator(permission):
        def wrapper(f):
            return f

        return wrapper

    return mock_decorator


def validate_response(data, endpoint):
    """验证 API 响应格式"""
    errors = []

    if not isinstance(data, dict):
        errors.append("响应不是 JSON 对象")
        return errors

    if "success" not in data:
        errors.append("响应缺少 'success' 字段")

    if "data" not in data and "message" not in data:
        errors.append("响应缺少 'data' 或 'message' 字段")

    return errors


def run_tests():
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "warnings": 0,
        "errors": [],
        "details": [],
    }

    print("=" * 80)
    print("班主任工作台 API 集成测试")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    try:
        print("\n[1/4] 创建测试应用...")
        app = create_test_app()
        print("  ✓ 测试应用创建成功")

        print("\n[2/4] Mock 权限装饰器...")
        with patch("utils.permission.requires_permission", mock_permission_decorator()):
            print("  ✓ 权限装饰器 Mock 成功")

            print("\n[3/4] 注册测试路由...")
            try:
                api_instance = register_test_routes(app)
                print("  ✓ 路由注册成功")

                registered_routes = []
                for rule in app.url_map.iter_rules():
                    if "/api/" in rule.rule and rule.methods:
                        methods = ",".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
                        registered_routes.append(f"    {methods:8s} {rule.rule}")
                print(f"  已注册 {len(registered_routes)} 个 API 路由")
            except Exception as e:
                print(f"  ✗ 路由注册失败: {e}")
                traceback.print_exc()
                return results

        client = app.test_client()

        print("\n[4/4] 执行 API 端点测试...")
        print()

        test_cases = [
            {
                "module": "座次表管理",
                "code_endpoint": "GET /api/seating/charts",
                "user_endpoint": "GET /api/seating/charts",
                "url": "/api/seating/charts",
                "expected_status": 200,
                "description": "座次表列表",
            },
            {
                "module": "值日生组管理",
                "code_endpoint": "GET /api/duty/groups",
                "user_endpoint": "GET /api/duty/groups",
                "url": "/api/duty/groups",
                "expected_status": 200,
                "description": "值日生组列表",
            },
            {
                "module": "班委名单管理",
                "code_endpoint": "GET /api/committee/members",
                "user_endpoint": "GET /api/committee/list",
                "url": "/api/committee/members",
                "expected_status": 200,
                "alt_url": "/api/committee/list",
                "description": "班委列表 (代码: /members, 用户指定: /list)",
            },
            {
                "module": "家长联系管理",
                "code_endpoint": "GET /api/parent/contacts",
                "user_endpoint": "GET /api/parent/contacts",
                "url": "/api/parent/contacts",
                "expected_status": 200,
                "description": "家长联系人列表",
            },
            {
                "module": "作业检查管理",
                "code_endpoint": "GET /api/homework/assignments",
                "user_endpoint": "GET /api/homework/assignments",
                "url": "/api/homework/assignments",
                "expected_status": 200,
                "description": "作业列表",
            },
            {
                "module": "考勤管理",
                "code_endpoint": "GET /api/attendance/records",
                "user_endpoint": "GET /api/attendance/records",
                "url": "/api/attendance/records",
                "expected_status": 200,
                "description": "考勤记录",
            },
            {
                "module": "学习小组管理",
                "code_endpoint": "GET /api/study-group/groups",
                "user_endpoint": "GET /api/study-group/list",
                "url": "/api/study-group/groups",
                "expected_status": 200,
                "alt_url": "/api/study-group/list",
                "description": "学习小组列表 (代码: /groups, 用户指定: /list)",
            },
            {
                "module": "心理健康管理",
                "code_endpoint": "GET /api/mental-health/records",
                "user_endpoint": "GET /api/mental-health/records",
                "url": "/api/mental-health/records",
                "expected_status": 200,
                "description": "心理健康记录",
            },
            {
                "module": "文体活动管理",
                "code_endpoint": "GET /api/activity",
                "user_endpoint": "GET /api/activity/list",
                "url": "/api/activity",
                "expected_status": 200,
                "alt_url": "/api/activity/list",
                "description": "文体活动列表 (代码: /, 用户指定: /list)",
            },
            {
                "module": "班级文化管理",
                "code_endpoint": "GET /api/culture/records",
                "user_endpoint": "GET /api/culture/list",
                "url": "/api/culture/records",
                "expected_status": 200,
                "alt_url": "/api/culture/list",
                "description": "班级文化列表 (代码: /records, 用户指定: /list)",
            },
            {
                "module": "学法指导管理",
                "code_endpoint": "GET /api/study-guide/guides",
                "user_endpoint": "GET /api/study-guide/guides",
                "url": "/api/study-guide/guides",
                "expected_status": 200,
                "description": "学法指导列表",
            },
        ]

        for case in test_cases:
            results["total"] += 1
            test_result = {
                "module": case["module"],
                "code_endpoint": case["code_endpoint"],
                "user_endpoint": case["user_endpoint"],
                "status": "failed",
                "status_code": None,
                "response_time": None,
                "response_valid": False,
                "response_format_valid": False,
                "warnings": [],
                "error": None,
            }

            print(f"\n[{results['total']}/11] 测试: {case['module']}")
            print(f"  描述: {case['description']}")

            if case["code_endpoint"] != case["user_endpoint"]:
                print(f"  代码路径: {case['code_endpoint']}")
                print(f"  用户指定路径: {case['user_endpoint']}")

            try:
                start_time = datetime.now()
                response = client.get(case["url"])
                elapsed = (datetime.now() - start_time).total_seconds()
                test_result["response_time"] = f"{elapsed:.3f}s"
                test_result["status_code"] = response.status_code

                if response.status_code == case["expected_status"]:
                    try:
                        data = json.loads(response.data)
                        test_result["response_valid"] = True

                        format_errors = validate_response(data, case["url"])
                        if format_errors:
                            test_result["response_format_valid"] = False
                            test_result["warnings"].extend(format_errors)
                            results["warnings"] += 1
                            print(
                                f"  ⚠ 状态码: {response.status_code} | 响应时间: {elapsed:.3f}s | JSON格式: 有警告"
                            )
                            for err in format_errors:
                                print(f"    警告: {err}")
                        else:
                            test_result["response_format_valid"] = True
                            print(
                                f"  ✓ 状态码: {response.status_code} | 响应时间: {elapsed:.3f}s | JSON格式: 有效"
                            )

                        if "success" in data:
                            data_info = f"success={data['success']}"
                            if isinstance(data.get("data"), list):
                                data_info += f", 记录数={len(data['data'])}"
                            elif isinstance(data.get("data"), dict):
                                data_info += f", 字段={list(data['data'].keys())}"
                            print(f"    响应: {data_info}")
                        else:
                            print(f"    响应字段: {list(data.keys())}")

                        test_result["status"] = "passed"
                        results["passed"] += 1

                    except json.JSONDecodeError as e:
                        test_result["error"] = f"JSON解析失败: {e}"
                        results["failed"] += 1
                        print(f"  ✗ JSON解析失败: {e}")
                else:
                    test_result["error"] = (
                        f"期望状态码 {case['expected_status']}, 实际 {response.status_code}"
                    )
                    results["failed"] += 1
                    print(
                        f"  ✗ 状态码不匹配: 期望 {case['expected_status']}, 实际 {response.status_code}"
                    )

                    if case.get("alt_url"):
                        print(f"  尝试用户指定路径: {case['alt_url']}")
                        alt_response = client.get(case["alt_url"])
                        print(f"    用户指定路径状态码: {alt_response.status_code}")
                        if alt_response.status_code == case["expected_status"]:
                            test_result["status"] = "passed (用户指定路径)"
                            test_result["alt_url_used"] = True
                            results["passed"] += 1
                            test_result["error"] = None
                            print(f"    ✓ 用户指定路径成功!")
                        else:
                            print(f"    ✗ 用户指定路径也返回 {alt_response.status_code}")
                            test_result["warnings"].append(
                                f"代码路径({case['url']})和用户指定路径({case['alt_url']})均不可用"
                            )
                            results["warnings"] += 1

            except Exception as e:
                test_result["error"] = str(e)
                results["failed"] += 1
                results["errors"].append(
                    {
                        "module": case["module"],
                        "endpoint": case["url"],
                        "error": str(e),
                        "traceback": traceback.format_exc(),
                    }
                )
                print(f"  ✗ 异常: {e}")
                traceback.print_exc()

            results["details"].append(test_result)

        print("\n" + "=" * 80)
        print("测试结果汇总")
        print("=" * 80)
        print(f"总测试数: {results['total']}")
        print(f"通过: {results['passed']}")
        print(f"失败: {results['failed']}")
        print(f"警告: {results['warnings']}")
        pass_rate = results["passed"] / results["total"] * 100 if results["total"] > 0 else 0
        print(f"通过率: {pass_rate:.1f}%")

        if results["warnings"] > 0:
            print("\n" + "-" * 80)
            print("⚠ 警告信息")
            print("-" * 80)
            for detail in results["details"]:
                for warning in detail.get("warnings", []):
                    print(f"  [{detail['module']}] {warning}")

        if results["errors"]:
            print("\n" + "=" * 80)
            print("✗ 错误详情")
            print("=" * 80)
            for err in results["errors"]:
                print(f"\n模块: {err['module']}")
                print(f"端点: {err['endpoint']}")
                print(f"错误: {err['error']}")
                print(f"堆栈:\n{err['traceback']}")

        print("\n" + "=" * 80)
        print("详细测试结果")
        print("=" * 80)
        for detail in results["details"]:
            if "passed" in detail["status"]:
                icon = "✓"
            else:
                icon = "✗"
            print(f"\n{icon} [{detail['status'].upper()}] {detail['module']}")
            print(f"   代码路径: {detail['code_endpoint']}")
            print(f"   用户指定路径: {detail['user_endpoint']}")
            print(f"   状态码: {detail['status_code']}")
            print(f"   响应时间: {detail['response_time']}")
            print(f"   JSON有效: {detail['response_valid']}")
            print(f"   格式合规: {detail['response_format_valid']}")
            if detail.get("alt_url_used"):
                print(f"   注: 使用了备用路径")
            for warning in detail.get("warnings", []):
                print(f"   ⚠ {warning}")
            if detail.get("error"):
                print(f"   错误: {detail['error']}")

        print("\n" + "=" * 80)
        print("测试完成!")
        print("=" * 80)

        return results

    except Exception as e:
        print(f"\n严重错误: {e}")
        traceback.print_exc()
        results["errors"].append(
            {
                "module": "全局",
                "endpoint": "N/A",
                "error": str(e),
                "traceback": traceback.format_exc(),
            }
        )
        return results


if __name__ == "__main__":
    results = run_tests()
    sys.exit(0 if results["failed"] == 0 else 1)
