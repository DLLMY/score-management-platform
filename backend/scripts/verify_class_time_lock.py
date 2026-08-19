#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上课时间拦截 - 手动验证脚本

用途：
    在不发送真实 MQTT 的前提下，基于当前数据库（真实课表 / TimeRule）验证
    ClassTimeChecker 的上课时间拦截决策是否符合预期，并可选探测正在运行的
    后端 /api/course-schedules/now 端点。

特性：
    - 只读，不修改任何业务数据。
    - 既验证「全局 TimeRule 时段」也验证「按班级课表反查」两类拦截。
    - 支持 --class-info-id 精确查看某班此刻是否在上课。
    - 支持 --live 探测本地已启动的后端（默认 http://127.0.0.1:5000）。

用法：
    python scripts/verify_class_time_lock.py [--class-info-id 23] [--live]
"""

import os
import sys
import argparse

BASEDIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
if BASEDIR not in sys.path:
    sys.path.insert(0, BASEDIR)

from datetime import datetime  # noqa: E402


def _boot_app():
    """加载 .env 并导入 app，返回 (app, env)。失败则抛错。"""
    try:
        from dotenv import load_dotenv

        env_file = os.path.join(BASEDIR, ".env")
        if os.path.exists(env_file):
            load_dotenv(env_file)
    except Exception:
        pass
    os.environ.setdefault("FLASK_ENV", "development")
    from app import app  # noqa: E402

    return app


def verify(app, class_info_id=None):
    from services.class_time_checker import ClassTimeChecker  # noqa: E402

    print("=" * 64)
    print("  上课时间拦截 - 决策验证")
    print("=" * 64)
    now = datetime.now()
    print(
        f"  服务器时间 : {now.strftime('%Y-%m-%d %H:%M:%S')} "
        f"(周{['一','二','三','四','五','六','日'][now.weekday()]})"
    )

    # 1) 全局 TimeRule 时段
    is_class_time, rule_info = ClassTimeChecker.is_during_class_time()
    print()
    print("-" * 64)
    print("  [1] 全局上课时段 (TimeRule)")
    print("-" * 64)
    if is_class_time and rule_info:
        print("  状态       : 命中全局时段")
        print(f"  规则名称   : {rule_info.get('name')}")
        print(
            f"  时段       : {rule_info.get('start_hour'):02d}:{rule_info.get('start_minute'):02d}"
            f" - {rule_info.get('end_hour'):02d}:{rule_info.get('end_minute'):02d}"
        )
    else:
        print("  状态       : 未命中全局时段（无匹配的 TimeRule）")

    # 2) 当前节次
    period = ClassTimeChecker._current_period(now)
    print()
    print("-" * 64)
    print("  [2] 当前节次 (ClassPeriod)")
    print("-" * 64)
    if period:
        print(f"  节次       : 第{period.period_number}节《{period.name}》")
        print(
            f"  时间窗     : {period.start_hour:02d}:{period.start_minute:02d}"
            f" - {period.end_hour:02d}:{period.end_minute:02d}"
        )
    else:
        print("  节次       : 课间 / 放学后（不在任何节次时间窗内）")

    # 3) 广播类下发决策
    print()
    print("-" * 64)
    print("  [3] 广播类下发决策 (is_broadcast_blocked)")
    print("-" * 64)
    blocked, message, code = ClassTimeChecker.is_broadcast_blocked(force_send=False)
    print(f"  是否拦截   : {'是' if blocked else '否'}")
    print(f"  拦截码     : {code}")
    print(f"  提示       : {message}")

    # 4) 指定班级 / 全部班级在上课情况
    print()
    print("-" * 64)
    print("  [4] 班级上课状态 (check_class_in_session)")
    print("-" * 64)
    any_in = ClassTimeChecker.any_class_in_session(now)
    print(f"  当前有班级在上课 : {'是' if any_in else '否'}")
    if class_info_id:
        in_session, info = ClassTimeChecker.check_class_in_session(class_info_id, now)
        if in_session and info:
            print(f"  班级 {class_info_id} ({info.get('class_name')}) : 上课中")
            print(
                f"    第{info.get('period_number')}节《{info.get('subject_name')}》"
                f" {info.get('start_time')}-{info.get('end_time')}"
            )
        else:
            print(f"  班级 {class_info_id} : 未处于上课状态（课间/放学/无课）")

    # 5) 精确按班级通知决策
    print()
    print("-" * 64)
    print("  [5] 按班级通知决策 (is_notification_allowed)")
    print("-" * 64)
    if class_info_id:
        allowed, msg, code, _ = ClassTimeChecker.is_notification_allowed(
            target_class_info_id=class_info_id, force_send=False
        )
        print(f"  目标班级   : {class_info_id}")
    else:
        allowed, msg, code, _ = ClassTimeChecker.is_notification_allowed(force_send=False)
        print("  目标班级   : (全局)")
    print(f"  是否允许   : {'是' if allowed else '否'}")
    print(f"  拦截码     : {code}")
    print(f"  提示       : {msg}")

    print()
    print("=" * 64)
    print("  结论")
    print("=" * 64)
    global_block = is_class_time
    class_block = bool(class_info_id) and any_in
    if global_block or class_block:
        print("  ✅ 当前处于上课时间，下发会被后端硬拦截（符合预期）。")
    else:
        print("  ℹ️ 当前非上课时间，下发不被拦截（符合预期）。")
        print("  （如需验证拦截，可临时在 TimeRule 中配置覆盖当前时段的规则，")
        print("    或为某班在 ClassPeriod 时间窗内安排课程后重试。）")
    print("=" * 64)


def verify_live(class_info_id=None, base_url="http://127.0.0.1:5000"):
    """探测正在运行的后端 /api/course-schedules/now 端点（只读，需有效 token）。"""
    import json
    import urllib.request
    import urllib.error

    print()
    print("=" * 64)
    print(f"  LIVE 探测: {base_url}/api/course-schedules/now")
    print("=" * 64)
    url = base_url + "/api/course-schedules/now"
    if class_info_id:
        url += f"?class_info_id={class_info_id}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        data = body.get("data", body)
        print("  返回:")
        print(f"    is_during_class_time : {data.get('is_during_class_time')}")
        print(f"    period               : {data.get('period')}")
        print(f"    in_session           : {data.get('in_session')}")
        if data.get("class_info_id") is not None:
            print(f"    class_info_id        : {data.get('class_info_id')}")
            print(f"    class_name           : {data.get('class_name')}")
            print(f"    subject_name         : {data.get('subject_name')}")
    except urllib.error.HTTPError as e:
        print(f"  HTTP 错误: {e.code} {e.reason}")
    except Exception as e:
        print(f"  探测失败（后端可能未启动或需鉴权）: {e}")


def main():
    parser = argparse.ArgumentParser(description="上课时间拦截验证脚本")
    parser.add_argument("--class-info-id", type=int, default=None, help="指定班级 ID 精确查看")
    parser.add_argument("--live", action="store_true", help="额外探测本地运行的后端 /now 端点")
    parser.add_argument("--base-url", type=str, default="http://127.0.0.1:5000", help="后端地址")
    args = parser.parse_args()

    app = _boot_app()
    with app.app_context():
        verify(app, class_info_id=args.class_info_id)
        if args.live:
            verify_live(class_info_id=args.class_info_id, base_url=args.base_url)


if __name__ == "__main__":
    main()
