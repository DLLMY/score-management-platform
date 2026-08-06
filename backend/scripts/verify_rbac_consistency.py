#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RBAC 一致性校验 + 幂等补齐脚本（P1 改进项：RBAC 自动 seed / 校验脚本化）。

背景：正常启动不 seed RBAC；seed_rbac.py 是「清库重建」型脚本（DELETE 四表），
被项目铁律禁止在运行时执行。新增权限/角色只能靠幂等增量脚本，且四处易漂移
（rbac_routes / seed_rbac.py / utils/permission.py 静态 PERMISSIONS / 增量脚本）。
本脚本提供：

1. --check-only（默认）：只读校验，报告不一致项，有问题 exit 1（可接入 CI）：
   - seed_rbac.py 定义的权限是否全部落库（用 ast 解析字面量，不执行脚本）
   - role_permission 与 role_permission_mappings 的角色集合是否一致
   - mappings 引用的权限码是否都是孤儿（permissions 表不存在）
   - teacher 关键权限 smoke（class.edit / culture.view / culture.edit /
     phonebox.unlock.manage / notification.send）
   - 关键账号绑定（admin(1)->super_admin）
   - 静态 PERMISSIONS（utils/permission.py，旧命名体系）与 DB 角色的差异提示
2. --apply：幂等补齐缺失项（INSERT OR IGNORE），**绝不 DELETE**。

用法（cwd=backend）：
    python scripts/verify_rbac_consistency.py            # 只检查
    python scripts/verify_rbac_consistency.py --apply    # 检查 + 补齐
"""
import argparse
import ast
import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "instance", "score_management.db")
SEED_PATH = os.path.join(BASE_DIR, "seed_rbac.py")
PERMISSION_PATH = os.path.join(BASE_DIR, "utils", "permission.py")

# teacher 角色必须含的关键权限（班主任工作台写操作与手机箱策略依赖，历史多次漂移）
KEY_TEACHER_PERMS = [
    "class.edit",
    "culture.view",
    "culture.edit",
    "phonebox.unlock.manage",
    "notification.send",
]
# 关键账号绑定（admin_id -> role_code）
KEY_ADMIN_ROLES = [(1, "super_admin")]


def _load_literals(path, var_names):
    """用 ast 安全解析文件中的字面量变量（不执行文件），返回 {name: value}。"""
    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read())
    found = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in var_names:
                    try:
                        found[target.id] = ast.literal_eval(node.value)
                    except (ValueError, SyntaxError):
                        found[target.id] = None
    return found


def main():
    ap = argparse.ArgumentParser(description="RBAC 一致性校验与幂等补齐")
    ap.add_argument("--apply", action="store_true", help="幂等补齐缺失项（INSERT OR IGNORE，绝不删除）")
    ap.add_argument(
        "--check-only",
        action="store_true",
        help="仅检查不补齐（默认行为，CI 中使用以显式声明）",
    )
    args = ap.parse_args()

    issues = []
    infos = []

    # ---- 解析权威定义 ----
    seed = _load_literals(SEED_PATH, {"permissions", "roles"})
    seed_permissions = seed.get("permissions") or []
    seed_roles = seed.get("roles") or []
    if not seed_permissions or not seed_roles:
        print(f"[错误] 无法解析 {SEED_PATH} 的 permissions/roles 字面量")
        sys.exit(2)
    seed_perm_codes = {p[0] for p in seed_permissions}
    seed_role_map = {r[0]: r for r in seed_roles}  # role_code -> (code,name,desc,csv,active)

    # 静态 PERMISSIONS（旧命名体系，仅提示）
    static = _load_literals(PERMISSION_PATH, {"PERMISSIONS"})
    static_roles = list((static.get("PERMISSIONS") or {}).keys())
    static_missing_in_db = [r for r in static_roles if r not in seed_role_map]
    if static_missing_in_db:
        infos.append(
            f"静态 PERMISSIONS 角色 {static_missing_in_db} 在 seed_rbac/DB 无同名角色"
            f"（两套命名体系并存，属已知状态，仅提示）"
        )

    # ---- 连接 DB ----
    if not os.path.exists(DB_PATH):
        # CI / 全新检出场景没有本地数据库（instance/ 被 .gitignore 忽略）：
        # 无可校验，跳过而非失败。本地运行需先启动过服务生成 DB。
        print(f"[提示] 数据库不存在，跳过 RBAC 校验（本地运行需先初始化 DB）: {DB_PATH}")
        sys.exit(0)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    db_perms = {r[0] for r in cur.execute("SELECT code FROM permissions")}
    db_roles = {r[0] for r in cur.execute("SELECT role_code FROM role_permission")}
    db_map_roles = {r[0] for r in cur.execute("SELECT DISTINCT role_code FROM role_permission_mappings")}
    mapped_perm_codes = {r[0] for r in cur.execute("SELECT DISTINCT permission_code FROM role_permission_mappings")}
    teacher_perms = {
        r[0] for r in cur.execute(
            "SELECT permission_code FROM role_permission_mappings WHERE role_code='teacher'"
        )
    }
    admin_roles = {tuple(r) for r in cur.execute("SELECT admin_id, role_code FROM admin_roles")}

    # ---- 1. 权限目录漂移 ----
    missing_perms = seed_perm_codes - db_perms
    orphan_mapped = mapped_perm_codes - db_perms
    if missing_perms:
        issues.append(f"permissions 表缺 {len(missing_perms)} 条 seed 定义权限: {sorted(missing_perms)[:10]}")
    if orphan_mapped:
        issues.append(f"role_permission_mappings 引用 {len(orphan_mapped)} 个不存在的权限码(孤儿): {sorted(orphan_mapped)[:10]}")

    # ---- 2. 角色集合一致 ----
    role_diff = set(seed_role_map) - db_roles
    if role_diff:
        issues.append(f"role_permission 缺 seed 定义角色: {sorted(role_diff)}")
    if db_roles != db_map_roles:
        issues.append(f"role_permission 与 mappings 角色集合不一致: role_permission={sorted(db_roles)} mappings={sorted(db_map_roles)}")

    # ---- 3. teacher 关键权限 smoke ----
    missing_teacher = [p for p in KEY_TEACHER_PERMS if p not in teacher_perms]
    if missing_teacher:
        issues.append(f"teacher 角色缺关键权限: {missing_teacher}（班主任工作台写操作会 403）")

    # ---- 4. 关键账号绑定 ----
    missing_admin = [t for t in KEY_ADMIN_ROLES if t not in admin_roles]
    if missing_admin:
        issues.append(f"admin_roles 缺关键绑定: {missing_admin}")

    # ---- 输出 ----
    print(f"DB 权限目录: {len(db_perms)} 条, 角色: {sorted(db_roles)}")
    print(f"seed 权威权限: {len(seed_perm_codes)} 条, 角色: {sorted(seed_role_map)}")
    print(f"teacher 权限数: {len(teacher_perms)}, 关键权限: {'OK' if not missing_teacher else '缺 ' + str(missing_teacher)}")
    for info in infos:
        print(f"[提示] {info}")
    if not issues:
        print("[结果] 一致性 OK" + (", 无缺失需补齐" if not args.apply else ""))
    else:
        print(f"[结果] 发现 {len(issues)} 个不一致:")
        for i in issues:
            print(f"  - {i}")

    # ---- 5. --apply 幂等补齐 ----
    if args.apply:
        fixed = 0
        for code, name, category, desc in seed_permissions:
            if code not in db_perms:
                cur.execute(
                    'INSERT OR IGNORE INTO permissions (code, name, category, description, is_active, created_at, updated_at) '
                    'VALUES (?,?,?,?,1,datetime("now"),datetime("now"))',
                    (code, name, category, desc),
                )
                fixed += 1
        for role_code, role in seed_role_map.items():
            if role_code not in db_roles:
                _, role_name, desc, csv_perms, active = role
                cur.execute(
                    'INSERT OR IGNORE INTO role_permission (role_code, role_name, description, permissions, is_active, created_at, updated_at) '
                    'VALUES (?,?,?,?,?,datetime("now"),datetime("now"))',
                    (role_code, role_name, desc, csv_perms, active),
                )
                fixed += 1
            # 补齐该角色的映射（seed csv + 关键 teacher 权限）
            perms_to_add = set(seed_role_map[role_code][3].split(",")) | (set(KEY_TEACHER_PERMS) if role_code == "teacher" else set())
            for pc in perms_to_add:
                pc = pc.strip()
                if pc:
                    cur.execute(
                        'INSERT OR IGNORE INTO role_permission_mappings (role_code, permission_code, created_at) VALUES (?,?,datetime("now"))',
                        (role_code, pc),
                    )
                    fixed += 1
        for admin_id, role_code in KEY_ADMIN_ROLES:
            cur.execute(
                'INSERT OR IGNORE INTO admin_roles (admin_id, role_code, assigned_at) VALUES (?,?,datetime("now"))',
                (admin_id, role_code),
            )
            fixed += 1
        conn.commit()
        print(f"[补齐] 已幂等插入 {fixed} 处缺失项（INSERT OR IGNORE，未删除任何数据）")

    conn.close()
    # check-only 模式有 issue 时返回非 0（供 CI）
    sys.exit(1 if (issues and not args.apply) else 0)


if __name__ == "__main__":
    main()
