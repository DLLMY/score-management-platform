"""
API文档生成工具
自动扫描API路由并生成完整的Markdown文档
"""
import os
import re
from datetime import datetime

API_MODULES = {
    "academics": {
        "path": "api/academics",
        "description": "学术管理模块",
        "files": [
            "subject_routes.py",
            "exam_routes.py",
            "exam_import_routes.py",
            "import_routes.py",
            "classes_routes.py",
            "admin_classes_routes.py",
        ],
    },
    "scores": {
        "path": "api/scores",
        "description": "成绩管理模块",
        "files": [
            "rules_routes.py",
            "records_routes.py",
            "categories_routes.py",
            "rank_routes.py",
            "approvals_routes.py",
            "time_rules_routes.py",
            "notify_history_routes.py",
        ],
    },
    "users": {
        "path": "api/users",
        "description": "用户管理模块",
        "files": [
            "users_routes.py",
            "rbac_routes.py",
            "sub_accounts_routes.py",
            "user_management_routes.py",
            "permission_logs_routes.py",
        ],
    },
    "system": {
        "path": "api/system",
        "description": "系统管理模块",
        "files": [
            "admins_routes.py",
            "admin_notifications_routes.py",
            "system_routes.py",
            "notification_config_routes.py",
            "security_routes.py",
        ],
    },
    "data": {
        "path": "api/data",
        "description": "数据管理模块",
        "files": [
            "export_routes.py",
            "import_export_routes.py",
            "download_routes.py",
        ],
    },
    "devices": {
        "path": "api/devices",
        "description": "设备管理模块",
        "files": [
            "devices_routes.py",
            "box_routes.py",
            "firmware_routes.py",
        ],
    },
    "monitoring": {
        "path": "api/monitoring",
        "description": "监控告警模块",
        "files": [
            "mqtt_routes.py",
            "notifications_routes.py",
            "alerts_routes.py",
            "operation_logs_routes.py",
        ],
    },
}


def extract_api_info(file_path):
    """从路由文件提取API信息"""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    endpoints = []
    # 提取namespace定义
    ns_match = re.findall(r"(\w+)\s*=\s*Namespace\([\'\"]([^\'\"]+)[\'\"]", content)
    # 提取路由装饰器和资源类，匹配 @ns_xxx.route('/path') 后的 class 定义
    class_pattern = r'@(\w+)\.route\([\'"]([^\'"]*)[\'"]\)[\s\S]*?class\s+(\w+)(?:\s*\(.*?\))?\s*:'
    class_matches = re.findall(class_pattern, content)
    # 提取doc注解
    doc_pattern = r"""@(\w+)\.doc\(['"]([^'"]*)['"]\)(?:,\s*description=["']([^'"]*)["'])?"""
    doc_matches = re.findall(doc_pattern, content)
    # 提取权限注解
    permission_pattern = r"""@requires_permission\(['"]([^'"]*)['"]\)"""
    permissions = re.findall(permission_pattern, content)
    # 提取HTTP方法
    method_pattern = r"def\s+(get|post|put|delete|patch)\s*\(self[,\)]"
    methods = re.findall(method_pattern, content)
    return {
        "file": os.path.basename(file_path),
        "namespaces": ns_match,
        "classes": class_matches,
        "docs": doc_matches,
        "permissions": permissions,
        "methods": methods,
    }


def generate_module_docs(module_name, module_info, base_path):
    """生成单个模块的文档"""
    docs = []
    module_path = module_info["path"]
    docs.append(f'## {module_info["description"]} (`{module_name}`)\n')
    docs.append(f"**模块路径**: `{module_path}`\n")
    docs.append(f'**包含文件**: {len(module_info["files"])} 个\n')
    docs.append("---\n")
    endpoint_count = 0
    for file_name in module_info["files"]:
        file_path = os.path.join(base_path, module_path, file_name)
        if not os.path.exists(file_path):
            continue
        api_info = extract_api_info(file_path)
        if api_info["classes"]:
            docs.append(f"### {file_name}\n")
            for ns_name, route_path, class_name in api_info["classes"]:
                docs.append(f"#### `{class_name}`\n")
                docs.append(f"- **命名空间**: `{ns_name}`")
                docs.append(f"- **路由**: `{route_path}`\n")
                # 列出HTTP方法
                docs.append("**支持的方法**:")
                for method in api_info["methods"]:
                    docs.append(f"- `{method.upper()}`")
                docs.append("")
                endpoint_count += 1
            docs.append("")
    docs.append(f"> 共 {endpoint_count} 个API端点\n")
    return "\n".join(docs), endpoint_count


def generate_full_docs(base_path, output_path):
    """生成完整的API文档"""
    print("[INFO] 开始生成API文档...")
    print(f"[INFO] 扫描路径: {base_path}")
    print(f"[INFO] 输出路径: {output_path}")
    # 文档头部
    docs = []
    docs.append("# 成绩管理系统 API 文档")
    docs.append("")
    docs.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    docs.append("")
    docs.append("**框架**: Flask-RESTX")
    docs.append("")
    docs.append("**基础路径**: `/api`")
    docs.append("")
    docs.append("**认证方式**: Bearer Token (JWT)")
    docs.append("")
    docs.append("---")
    docs.append("")
    docs.append("## 目录")
    docs.append("")
    total_endpoints = 0
    module_summaries = []
    # 生成各模块文档
    for module_name, module_info in API_MODULES.items():
        print(f'[INFO] 处理模块: {module_info["description"]}')
        module_docs, endpoint_count = generate_module_docs(module_name, module_info, base_path)
        total_endpoints += endpoint_count
        module_summaries.append(
            {
                "name": module_name,
                "description": module_info["description"],
                "endpoints": endpoint_count,
            }
        )
        docs.append(module_docs)
    # 添加统计信息
    stats = []
    stats.append("---")
    stats.append("")
    stats.append("## 统计信息")
    stats.append("")
    stats.append("| 模块 | 描述 | 端点数 |")
    stats.append("|------|------|--------|")
    for summary in module_summaries:
        stats.append(f'| {summary["name"]} | {summary["description"]} | {summary["endpoints"]} |')
    stats.append(f"| **总计** | | **{total_endpoints}** |")
    stats.append("")
    # 添加通用说明
    common_docs = []
    common_docs.append("---")
    common_docs.append("")
    common_docs.append("## 通用说明")
    common_docs.append("")
    common_docs.append("### 响应格式")
    common_docs.append("")
    common_docs.append("所有API响应统一使用以下格式:")
    common_docs.append("")
    common_docs.append("```json")
    common_docs.append("{")
    common_docs.append('  "success": true/false,')
    common_docs.append('  "data": {...},')
    common_docs.append('  "message": "操作成功"')
    common_docs.append("}")
    common_docs.append("```")
    common_docs.append("")
    common_docs.append("### 错误码")
    common_docs.append("")
    common_docs.append("| 状态码 | 说明 |")
    common_docs.append("|--------|------|")
    common_docs.append("| 200 | 成功 |")
    common_docs.append("| 201 | 创建成功 |")
    common_docs.append("| 400 | 请求参数错误 |")
    common_docs.append("| 401 | 未认证 |")
    common_docs.append("| 403 | 无权限 |")
    common_docs.append("| 404 | 资源不存在 |")
    common_docs.append("| 500 | 服务器内部错误 |")
    common_docs.append("")
    common_docs.append("### 认证方式")
    common_docs.append("")
    common_docs.append("```")
    common_docs.append("Authorization: Bearer <JWT_TOKEN>")
    common_docs.append("```")
    common_docs.append("")
    # 组合所有文档
    full_docs = "\n".join(docs + stats + common_docs)
    # 写入文件
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(full_docs)
    print("[SUCCESS] API文档生成完成!")
    print(f"[SUCCESS] 输出文件: {output_path}")
    print(f"[SUCCESS] API端点总数: {total_endpoints}")
    return total_endpoints


def print_summary(total_endpoints):
    """打印生成摘要"""
    print("\n" + "=" * 60)
    print("API文档生成摘要")
    print("=" * 60)
    print(f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f"API端点总数: {total_endpoints}")
    print(f"模块数量: {len(API_MODULES)}")
    print("\n模块详情:")
    for name, info in API_MODULES.items():
        print(f'  - {info["description"]} ({name}): {len(info["files"])} 个文件')
    print("\n" + "=" * 60)


if __name__ == "__main__":
    # 获取后端目录
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # 输出文件路径
    output_file = os.path.join(os.path.dirname(backend_dir), "API_DOCUMENTATION.md")
    # 生成文档
    total_endpoints = generate_full_docs(backend_dir, output_file)
    # 打印摘要
    print_summary(total_endpoints)
