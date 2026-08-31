from flask import Flask
from typing import Dict, List, Tuple


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
        duplicate_endpoints, duplicate_rules = self.check_duplicates()

        if duplicate_endpoints or duplicate_rules:
            print("\n" + "=" * 70)
            print("🚨 路由注册检查报告 - 发现重复路由")
            print("=" * 70)

            if duplicate_endpoints:
                print("\n重复的Endpoint:")
                print("-" * 50)
                for dup in duplicate_endpoints:
                    print(f"\n  Endpoint: {dup['endpoint']}")
                    for i, (rule, view_func) in enumerate(dup["entries"], 1):
                        print(f"    {i}. 规则: {rule} -> 视图函数: {view_func}")

            if duplicate_rules:
                print("\n重复的路由规则:")
                print("-" * 50)
                for dup in duplicate_rules:
                    print(f"\n  规则: {dup['rule']}")
                    for i, (endpoint, view_func) in enumerate(dup["entries"], 1):
                        print(f"    {i}. Endpoint: {endpoint} -> 视图函数: {view_func}")

            print("\n" + "=" * 70)
            return False
        else:
            print("\n" + "=" * 70)
            print("✅ 路由注册检查报告 - 未发现重复路由")
            print("=" * 70)
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

        print(f"⚠️  警告: Endpoint '{endpoint}' 已存在，规则: {existing_rule}")
        print(f"         新规则: {rule} 将覆盖现有规则")

    app.add_url_rule(rule, endpoint, view_func, **options)
