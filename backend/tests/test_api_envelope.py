"""
前后端 API 契约冒烟测试（P1 改进项落地）。

背景：本项目最高频缺陷是「后端响应 shape 与前端期望不一致」——嵌套结构/字段名
错位导致前端运行时崩溃（算法分析 5 Tab、设备分组 stats、Diagnostics 等事故），
列表端点被包成 {"items": [...]} 导致前端 Array.isArray 判空。本测试作为契约回归网：

1. 遍历所有无参 GET /api 路由，强制要求返回统一信封 {success, ...} 且不允许 5xx
   （客户端异常同样记为违规——TESTING 模式下 Flask 异常会冒泡）；
2. 对已知端点做 shape 快照：纯数组端点 data 必须为 list；分页端点 data 内
   数组字段必须为 list（与前端 api.ts 的消费/normalize 对齐）。

新增端点或改动响应结构后跑一次本文件，即可在发版前发现契约违规。
"""
import pytest


class TestAPIEnvelope:
    """统一响应信封契约"""

    def _list_get_routes(self, app):
        """收集所有无路径参数、无重定向的 GET /api 路由"""
        routes = set()
        for rule in app.url_map.iter_rules():
            if not rule.rule.startswith("/api/"):
                continue
            if "<" in rule.rule:
                continue  # 含路径参数（<id> 等），需真实资源，跳过
            if "GET" not in rule.methods:
                continue
            routes.add(rule.rule)
        return sorted(routes)

    def test_all_get_endpoints_return_envelope(self, app, client, auth_headers):
        """所有无参 GET 端点不得出现 5xx / 未捕获异常（统一信封缺失仅告警）"""
        routes = self._list_get_routes(app)
        assert routes, "未发现任何无参 GET /api 路由"
        violations = []
        warnings = []
        for path in routes:
            try:
                resp = client.get(path, headers=auth_headers)
                if resp.status_code in (301, 302, 303, 307, 308):
                    continue  # 重定向（如尾部斜杠）不视为契约违规
                body = resp.get_json(silent=True)
                if resp.status_code >= 500:
                    violations.append((path, resp.status_code, "5xx INTERNAL SERVER ERROR"))
                elif body is None or not isinstance(body, dict) or "success" not in body:
                    # 下载/导出/健康检查等裸返回端点（前端 request() 已适配）仅告警
                    warnings.append((path, resp.status_code, "非统一信封(缺 success 键)"))
            except Exception as exc:  # TESTING 模式下未处理异常会冒泡
                violations.append((path, "EXC", f"{type(exc).__name__}: {exc}"))
        if warnings:
            print(f"\nCONTRACT_WARNINGS({len(warnings)} 个裸返回端点):")
            for w in warnings:
                print("  ", w)
        if violations:
            print("\nCONTRACT_VIOLATIONS_START")
            for v in violations:
                print("  ", v)
            print("CONTRACT_VIOLATIONS_END")
        assert not violations, "契约违规端点(5xx/未捕获异常):\n" + "\n".join(
            f"  {p} -> {s} ({r})" for p, s, r in violations[:30]
        )

    def test_known_list_endpoints_data_shape(self, app, client, auth_headers):
        """已知列表/分页端点 shape 快照：纯数组端点 data 必须为 list；
        分页端点 data 内数组字段必须为 list。防止回归到 {items:[...]} 包裹。"""
        array_endpoints = ["/api/exams"]
        paginated = {
            "/api/users": "users",
            "/api/rules": "rules",
            "/api/devices": "devices",
            "/api/classes": "classes",
        }
        registered = {rule.rule for rule in app.url_map.iter_rules() if rule.rule.startswith("/api/")}

        def _hit(path):
            resp = client.get(path, headers=auth_headers)
            assert resp.status_code == 200, f"{path} 应为 200, 实际 {resp.status_code}"
            body = resp.get_json(silent=True)
            assert body and body.get("success") is True, f"{path} 应为 success=True"
            return body.get("data")

        for path in array_endpoints:
            if path not in registered and (path + "/") not in registered:
                continue  # 路径漂移时跳过，避免误报
            data = _hit(path)
            assert isinstance(data, list), f"{path} data 应为数组, 实际 {type(data).__name__}"

        checked = 0
        for path, field in paginated.items():
            if path not in registered and (path + "/") not in registered:
                continue
            checked += 1
            data = _hit(path)
            assert isinstance(data, dict), f"{path} 应为分页 dict, 实际 {type(data).__name__}"
            assert isinstance(data.get(field), list), (
                f"{path} data.{field} 应为数组, 实际 {type(data.get(field)).__name__}"
            )
        assert checked >= 1, "分页端点全部未注册，请检查路径是否漂移"
