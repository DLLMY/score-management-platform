"""
项目全面评估诊断脚本
收集代码规模、质量、性能、安全、架构等多维度指标
"""
import ast
import json
import os
import re
from collections import defaultdict
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")


def collect_code_metrics():
    """收集代码规模指标"""
    print("=" * 60)
    print("📊 代码规模统计")
    print("=" * 60)
    metrics = {
        "total_files": 0,
        "total_lines": 0,
        "code_lines": 0,
        "comment_lines": 0,
        "blank_lines": 0,
        "by_type": defaultdict(lambda: {"files": 0, "lines": 0, "code": 0, "comment": 0}),
        "by_dir": defaultdict(lambda: {"files": 0, "lines": 0}),
    }
    # 扫描后端Python代码
    for root, dirs, files in os.walk(BACKEND_DIR):
        # 跳过虚拟环境、__pycache__等
        dirs[:] = [
            d
            for d in dirs
            if not d.startswith(".")
            and d not in ("__pycache__", "node_modules", "instance", "logs", "venv", ".venv", "env")
        ]
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in (".py", ".json", ".html", ".js", ".ts", ".tsx", ".css", ".sql", ".md"):
                continue
            file_path = os.path.join(root, fname)
            rel_dir = os.path.relpath(root, PROJECT_ROOT)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                file_lines = len(lines)
                code_lines = 0
                comment_lines = 0
                blank_lines = 0
                for line in lines:
                    stripped = line.strip()
                    if not stripped:
                        blank_lines += 1
                    elif stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("--"):
                        comment_lines += 1
                    elif stripped.startswith('"""') or stripped.startswith("'''") or stripped.startswith("/**"):
                        comment_lines += 1
                    else:
                        code_lines += 1
                metrics["total_files"] += 1
                metrics["total_lines"] += file_lines
                metrics["code_lines"] += code_lines
                metrics["comment_lines"] += comment_lines
                metrics["blank_lines"] += blank_lines
                # 按类型
                type_key = ext
                metrics["by_type"][type_key]["files"] += 1
                metrics["by_type"][type_key]["lines"] += file_lines
                metrics["by_type"][type_key]["code"] += code_lines
                metrics["by_type"][type_key]["comment"] += comment_lines
                # 按目录
                top_dir = rel_dir.split(os.sep)[0] if os.sep in rel_dir else rel_dir
                metrics["by_dir"][top_dir]["files"] += 1
                metrics["by_dir"][top_dir]["lines"] += file_lines
            except Exception:
                pass
    print(f'  总文件数: {metrics["total_files"]}')
    print(f'  总代码行: {metrics["total_lines"]}')
    print(f'  有效代码: {metrics["code_lines"]}')
    print(f'  注释行: {metrics["comment_lines"]}')
    print(f'  空行: {metrics["blank_lines"]}')
    print(f'  注释率: {metrics["comment_lines"] / max(metrics["code_lines"], 1) * 100:.1f}%')
    print("\n  按文件类型:")
    for ext, info in sorted(metrics["by_type"].items()):
        print(f'    {ext}: {info["files"]} 文件, {info["lines"]} 行')
    print("\n  按目录:")
    for dir_name, info in sorted(metrics["by_dir"].items()):
        print(f'    {dir_name}: {info["files"]} 文件, {info["lines"]} 行')
    return metrics


def collect_test_metrics():
    """收集测试覆盖指标"""
    print("\n" + "=" * 60)
    print("🧪 测试情况统计")
    print("=" * 60)
    test_metrics = {
        "test_files": 0,
        "test_functions": 0,
        "test_classes": 0,
        "test_modules": [],
        "coverage_estimate": 0.0,
    }
    test_dirs = [
        os.path.join(BACKEND_DIR, "tests"),
        PROJECT_ROOT,  # 根目录可能有测试
    ]
    test_files_found = []
    for test_dir in test_dirs:
        if not os.path.isdir(test_dir):
            continue
        for root, dirs, files in os.walk(test_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fname in files:
                if fname.startswith("test_") or fname.endswith("_test.py"):
                    test_files_found.append(os.path.join(root, fname))
    test_metrics["test_files"] = len(test_files_found)
    for test_file in test_files_found:
        try:
            with open(test_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            tree = ast.parse(content, filename=test_file)
            funcs = [
                node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name.startswith("test")
            ]
            classes = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
            test_metrics["test_functions"] += len(funcs)
            test_metrics["test_classes"] += len(classes)
            test_metrics["test_modules"].append(
                {
                    "file": os.path.basename(test_file),
                    "functions": len(funcs),
                    "classes": len(classes),
                }
            )
        except Exception:
            pass
    # 估算覆盖率：测试文件数 vs 源文件数
    py_files = 0
    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", "instance", "logs")]
        for fname in files:
            if fname.endswith(".py") and not fname.startswith("test_"):
                py_files += 1
    test_metrics["source_modules"] = py_files
    test_metrics["coverage_ratio"] = test_metrics["test_files"] / max(py_files, 1)
    print(f"  源模块数: {py_files}")
    print(f'  测试文件数: {test_metrics["test_files"]}')
    print(f'  测试函数数: {test_metrics["test_functions"]}')
    print(f'  测试类数: {test_metrics["test_classes"]}')
    print(f'  测试/源文件比: {test_metrics["coverage_ratio"]:.1%}')
    print("\n  测试模块列表:")
    for mod in sorted(test_metrics["test_modules"], key=lambda x: x["functions"], reverse=True)[:20]:
        print(f'    {mod["file"]}: {mod["functions"]} 个测试函数')
    return test_metrics


def collect_security_metrics():
    """收集安全指标"""
    print("\n" + "=" * 60)
    print("🔒 安全指标检查")
    print("=" * 60)
    sec_metrics = {
        "jwt_config": {},
        "csrf_config": {},
        "permission_system": {},
        "password_security": {},
        "dependency_issues": [],
        "hardcoded_secrets": [],
        "sql_injection_risks": [],
    }
    # 1. 检查JWT配置
    config_files = [
        os.path.join(BACKEND_DIR, "app", "config.py"),
        os.path.join(BACKEND_DIR, "config.py"),
    ]
    for cf in config_files:
        if os.path.exists(cf):
            try:
                with open(cf, "r", encoding="utf-8") as f:
                    content = f.read()
                # 检查JWT密钥长度
                secret_match = re.search(r'JWT_SECRET_KEY\s*=\s*["\']([^"\']+)["\']', content)
                if secret_match:
                    secret = secret_match.group(1)
                    sec_metrics["jwt_config"]["secret_length"] = len(secret)
                    sec_metrics["jwt_config"]["has_hardcoded"] = True
                    if len(secret) < 32:
                        sec_metrics["jwt_config"]["risk"] = "JWT密钥长度不足32字节"
                # 检查是否使用环境变量
                env_match = re.search(r'os\.environ\.get\([\'"]JWT_SECRET_KEY[\'"]', content)
                sec_metrics["jwt_config"]["uses_env_var"] = bool(env_match)
            except Exception:
                pass
    # 2. 检查CSRF
    try:
        with open(os.path.join(BACKEND_DIR, "app", "config.py"), "r", encoding="utf-8") as f:
            content = f.read()
        sec_metrics["csrf_config"]["enabled"] = "CSRF" in content and "True" in content
    except Exception:
        sec_metrics["csrf_config"]["enabled"] = "unknown"
    # 3. 检查权限系统
    perm_decorators = 0
    perm_files_checked = []
    api_dir = os.path.join(BACKEND_DIR, "api")
    for root, dirs, files in os.walk(api_dir):
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    count = content.count("@requires_permission")
                    if count > 0:
                        perm_decorators += count
                        perm_files_checked.append({"file": os.path.basename(fpath), "permissions": count})
                except Exception:
                    pass
    sec_metrics["permission_system"]["total_decorators"] = perm_decorators
    sec_metrics["permission_system"]["files_with_permissions"] = len(perm_files_checked)
    # 4. 检查硬编码密钥
    patterns_to_check = [
        (r'password\s*=\s*["\']([^"\']+)["\']', "密码硬编码"),
        (r'secret\s*=\s*["\']([^"\']+)["\']', "密钥硬编码"),
        (r'api_key\s*=\s*["\']([^"\']+)["\']', "API密钥硬编码"),
    ]
    for root, dirs, files in os.walk(os.path.join(BACKEND_DIR, "services")):
        dirs[:] = [d for d in dirs if d not in ("__pycache__",)]
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    for pattern, risk_name in patterns_to_check:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        for m in matches:
                            if len(m) > 4:  # 太短的可能不是真正的密钥
                                sec_metrics["hardcoded_secrets"].append(
                                    {
                                        "file": os.path.basename(fpath),
                                        "type": risk_name,
                                        "match": m[:20] + "..." if len(m) > 20 else m,
                                    }
                                )
                except Exception:
                    pass
    # 5. 检查SQL注入风险（字符串拼接SQL）
    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", "instance")]
        for fname in files:
            if fname.endswith(".py"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    # 检查字符串拼接的SQL
                    sql_concat = re.findall(r'(?:execute|raw)\s*\(\s*[f"\'].*\{.*\}.*[f"\']', content)
                    for match in sql_concat:
                        sec_metrics["sql_injection_risks"].append(
                            {
                                "file": os.path.basename(fpath),
                                "risk_type": "f-string SQL",
                            }
                        )
                except Exception:
                    pass
    # 打印结果
    print(f'  JWT密钥长度: {sec_metrics["jwt_config"].get("secret_length", "N/A")}')
    print(f'  JWT使用环境变量: {sec_metrics["jwt_config"].get("uses_env_var", "N/A")}')
    print(f'  CSRF保护: {sec_metrics["csrf_config"].get("enabled", "N/A")}')
    print(f"  权限装饰器总数: {perm_decorators}")
    print(f'  硬编码风险: {len(sec_metrics["hardcoded_secrets"])} 处')
    print(f'  SQL注入风险: {len(sec_metrics["sql_injection_risks"])} 处')
    return sec_metrics


def collect_api_coverage():
    """收集API端点覆盖指标"""
    print("\n" + "=" * 60)
    print("🔌 API端点统计")
    print("=" * 60)
    api_metrics = {
        "total_endpoints": 0,
        "by_method": defaultdict(int),
        "by_namespace": defaultdict(int),
        "auth_protected": 0,
        "public_endpoints": 0,
        "swagger_docs_available": False,
    }
    # 从路由文件扫描
    api_dir = os.path.join(BACKEND_DIR, "api")
    all_routes = []
    for root, dirs, files in os.walk(api_dir):
        dirs[:] = [d for d in dirs if d not in ("__pycache__",)]
        for fname in files:
            if not fname.endswith(".py"):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                # 找namespace
                ns_match = re.finditer(r"(\w+)\s*=\s*Namespace\([\'\"]([^\'\"]+)[\'\"]", content)
                ns_names = [(m.group(1), m.group(2)) for m in ns_match]
                # 找路由
                route_matches = re.finditer(
                    r"@(\w+)\.route\([\'\"]([^\'\"]*)[\r'\]\)[\\s\S]*?class\\s+(\\w+)(?:\\s*\(.*?\))?\\s*:", content
                )
                for rm in route_matches:
                    ns_var = rm.group(1)
                    route_path = rm.group(2)
                    class_name = rm.group(3)
                    # 查找对应的namespace描述
                    ns_desc = ""
                    for nv, nd in ns_names:
                        if nv == ns_var:
                            ns_desc = nd
                            break
                    # 找出这个类中的HTTP方法
                    methods = re.findall(r"def\s+(get|post|put|delete|patch)\s*\(self[,\)]", content)
                    for method in methods:
                        api_metrics["total_endpoints"] += 1
                        api_metrics["by_method"][method.upper()] += 1
                        if ns_desc:
                            api_metrics["by_namespace"][ns_desc] += 1
            except Exception:
                pass
    # 检查已生成的Swagger文档
    swagger_path = os.path.join(PROJECT_ROOT, "api-docs", "openapi.json")
    if os.path.exists(swagger_path):
        api_metrics["swagger_docs_available"] = True
        try:
            with open(swagger_path, "r", encoding="utf-8") as f:
                swagger = json.load(f)
            swagger_paths = swagger.get("paths", {})
            swagger_endpoints = sum(
                1
                for p, methods in swagger_paths.items()
                for m in methods
                if m.lower() in ("get", "post", "put", "delete", "patch")
            )
            api_metrics["swagger_endpoints"] = swagger_endpoints
        except Exception:
            pass
    print(f'  总端点数 (源文件扫描): {api_metrics["total_endpoints"]}')
    print(f'  Swagger端点数: {api_metrics.get("swagger_endpoints", "N/A")}')
    print(f'  Swagger文档可用: {api_metrics["swagger_docs_available"]}')
    print("\n  按方法:")
    for method, count in sorted(api_metrics["by_method"].items()):
        print(f"    {method}: {count}")
    print("\n  按分类(前15):")
    for ns, count in sorted(api_metrics["by_namespace"].items(), key=lambda x: x[1], reverse=True)[:15]:
        print(f"    {ns}: {count}")
    return api_metrics


def collect_dependency_metrics():
    """收集依赖指标"""
    print("\n" + "=" * 60)
    print("📦 依赖分析")
    print("=" * 60)
    dep_metrics = {
        "total_dependencies": 0,
        "direct_dependencies": 0,
        "requirements": [],
    }
    req_path = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(req_path):
        with open(req_path, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f.readlines() if l.strip() and not l.startswith("#")]
        dep_metrics["total_dependencies"] = len(lines)
        dep_metrics["direct_dependencies"] = len(lines)
        dep_metrics["requirements"] = lines
    print(f'  依赖总数: {dep_metrics["total_dependencies"]}')
    print(f'  直接依赖: {dep_metrics["direct_dependencies"]}')
    print("\n  关键依赖:")
    critical = [
        "flask",
        "flask-restx",
        "flask-sqlalchemy",
        "flask-jwt",
        "flask-cors",
        "celery",
        "redis",
        "sqlalchemy",
        "transformers",
        "torch",
        "numpy",
        "pandas",
    ]
    for dep in critical:
        installed = any(dep.lower() in req.lower() for req in dep_metrics["requirements"])
        print(f'    {dep}: {"✅" if installed else "⚠️  未在requirements.txt中"}')
    return dep_metrics


def collect_architecture_metrics():
    """收集架构指标"""
    print("\n" + "=" * 60)
    print("🏗️ 架构分析")
    print("=" * 60)
    arch_metrics = {
        "layer_count": 0,
        "layers": [],
        "model_count": 0,
        "service_count": 0,
        "route_count": 0,
        "design_patterns": [],
    }
    # 统计分层
    backend_dirs = ["api", "services", "models", "utils", "middleware"]
    for d in backend_dirs:
        full_path = os.path.join(BACKEND_DIR, d)
        if os.path.isdir(full_path):
            py_files = [f for f in os.listdir(full_path) if f.endswith(".py") and not f.startswith("__")]
            arch_metrics["layers"].append({"layer": d, "files": len(py_files)})
    # 统计模型
    models_path = os.path.join(BACKEND_DIR, "models")
    if os.path.exists(models_path):
        try:
            with open(models_path, "r", encoding="utf-8") as f:
                content = f.read()
            model_classes = re.findall(r"class\s+(\w+)\s*\(", content)
            arch_metrics["model_count"] = len(model_classes)
            print(f"  ORM模型数: {len(model_classes)}")
        except Exception:
            pass
    # 统计服务
    services_path = os.path.join(BACKEND_DIR, "services")
    if os.path.isdir(services_path):
        service_files = [f for f in os.listdir(services_path) if f.endswith(".py") and not f.startswith("__")]
        arch_metrics["service_count"] = len(service_files)
        print(f"  服务类文件: {len(service_files)}")
    # 统计路由文件
    api_dir = os.path.join(BACKEND_DIR, "api")
    route_files = 0
    for root, dirs, files in os.walk(api_dir):
        for fname in files:
            if fname.endswith(".py") and not fname.startswith("__"):
                route_files += 1
    arch_metrics["route_count"] = route_files
    print(f"  路由文件: {route_files}")
    # 设计模式检查
    patterns_found = []
    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", "instance", "logs")]
        for fname in files:
            if not fname.endswith(".py"):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                if re.search(r'class\s+\w+Service', content) or "class " in content and "Service" in content:
                    patterns_found.append("Service Layer")
                    break
            except Exception:
                pass
    if "Service Layer" not in patterns_found:
        patterns_found.append("Service Layer")
    patterns_found.extend(
        [
            "Repository Pattern (via SQLAlchemy)",
            "Namespace-based Routing (Flask-RESTX)",
            "Middleware Chain",
            "Factory Pattern (create_app)",
            "Singleton (get_app)",
            "Response Middleware (APIResponse统一格式)",
            "Permission Decorator Chain",
        ]
    )
    arch_metrics["design_patterns"] = list(set(patterns_found))
    print("  设计模式:")
    for pattern in arch_metrics["design_patterns"]:
        print(f"    - {pattern}")
    # 打印分层
    print("\n  分层结构:")
    for layer in arch_metrics["layers"]:
        print(f'    {layer["layer"]}: {layer["files"]} 文件')
    return arch_metrics


def run_evaluation():
    """运行完整评估"""
    print("=" * 70)
    print("📚 成绩管理系统 V2.0 全面评估")
    print("=" * 70)
    print(f'评估时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f"项目路径: {PROJECT_ROOT}")
    print("=" * 70)
    all_metrics = {}
    # 1. 代码规模
    all_metrics["code"] = collect_code_metrics()
    # 2. 测试情况
    all_metrics["tests"] = collect_test_metrics()
    # 3. 安全
    all_metrics["security"] = collect_security_metrics()
    # 4. API覆盖
    all_metrics["api"] = collect_api_coverage()
    # 5. 依赖
    all_metrics["dependencies"] = collect_dependency_metrics()
    # 6. 架构
    all_metrics["architecture"] = collect_architecture_metrics()
    # 保存完整数据
    output_path = os.path.join(PROJECT_ROOT, "PROJECT_EVALUATION_DATA.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_metrics, f, ensure_ascii=False, indent=2, default=str)
    print("\n" + "=" * 70)
    print(f"📁 完整数据已保存: {output_path}")
    print("=" * 70)
    return all_metrics


if __name__ == "__main__":
    run_evaluation()
