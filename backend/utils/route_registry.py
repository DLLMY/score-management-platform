from flask import Flask
from typing import Dict, List, Tuple

from utils.logger import log_error, log_info, log_warning


class RouteRegistry:

    def __init__(self):
        self.registered_endpoints: Dict[str, List[str]] = {}
        self.registered_rules: Dict[str, List[str]] = {}

    def register(self, endpoint: str, rule: str, view_func_name: str):
        if endpoint not in self.registered_endpoints:
            self.registered_endpoints[endpoint] = []
        self.registered_endpoints[endpoint].append((rule, view_func_name))

        if rule not in self.registered_rules:
            self.registered_rules[rule] = []
        self.registered_rules[rule].append((endpoint, view_func_name))

    def check_duplicates(self) -> Tuple[List[Dict], List[Dict]]:
        duplicate_endpoints = []
        duplicate_rules = []

        for endpoint, entries in self.registered_endpoints.items():
            if len(entries) > 1:
                duplicate_endpoints.append({"endpoint": endpoint, "entries": entries})

        for rule, entries in self.registered_rules.items():
            if len(entries) > 1:
                duplicate_rules.append({"rule": rule, "entries": entries})

        return duplicate_endpoints, duplicate_rules

    def print_report(self):
        """输出路由注册检查报告。

        经 logger 输出（原为 print 直出）：报告整体聚合成单条日志，
        发现重复路由→error，无重复→info。方法名与返回值保持不变以免破坏调用方。
        """
        duplicate_endpoints, duplicate_rules = self.check_duplicates()

        if duplicate_endpoints or duplicate_rules:
            lines = ["=" * 70, "路由注册检查报告 - 发现重复路由", "=" * 70]

            if duplicate_endpoints:
                lines.append("重复的Endpoint:")
                lines.append("-" * 50)
                for dup in duplicate_endpoints:
                    lines.append(f"  Endpoint: {dup['endpoint']}")
                    for i, (rule, view_func) in enumerate(dup["entries"], 1):
                        lines.append(f"    {i}. 规则: {rule} -> 视图函数: {view_func}")

            if duplicate_rules:
                lines.append("重复的路由规则:")
                lines.append("-" * 50)
                for dup in duplicate_rules:
                    lines.append(f"  规则: {dup['rule']}")
                    for i, (endpoint, view_func) in enumerate(dup["entries"], 1):
                        lines.append(f"    {i}. Endpoint: {endpoint} -> 视图函数: {view_func}")

            lines.append("=" * 70)
            log_error(f"路由注册存在重复:\n" + "\n".join(lines))
            return False

        log_info("路由注册检查报告 - 未发现重复路由")
        return True


route_registry = RouteRegistry()


def check_route_duplicates(app: Flask) -> bool:
    route_registry.registered_endpoints.clear()
    route_registry.registered_rules.clear()

    for rule in app.url_map.iter_rules():
        view_func = app.view_functions.get(rule.endpoint)
        view_func_name = view_func.__name__ if view_func else "unknown"

        route_registry.register(
            endpoint=rule.endpoint, rule=rule.rule, view_func_name=view_func_name
        )

    return route_registry.print_report()


def register_route_safe(app: Flask, rule: str, endpoint: str, view_func, **options):
    if endpoint in app.view_functions:
        existing_rule = None
        for r in app.url_map.iter_rules():
            if r.endpoint == endpoint:
                existing_rule = r.rule
                break

        log_warning(
            f"Endpoint '{endpoint}' 已存在，规则: {existing_rule}；"
            f"新规则: {rule} 将覆盖现有规则"
        )

    app.add_url_rule(rule, endpoint, view_func, **options)
