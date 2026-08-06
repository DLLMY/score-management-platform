"""
幂等迁移：为 teacher（班主任）角色补充 culture.view / culture.edit 权限。

为什么：班主任工作台包含「班级文化」页，其后端接口要求 culture.view/edit，
但 teacher 角色原来只有 23 项权限、缺这两项，导致所有班主任访问 /api/culture/records 返回 403，
页面空白且报错。

落库姿势（遵循既有约定，禁止在有数据的库上跑 seed_rbac.py）：
- 仅改 role_permission_mappings（has_permission 实际查的表）+ role_permission.permissions CSV（一致性）。
- 运行前自动备份 db。可重复执行。
"""
import os
import shutil
import sqlite3
import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'score_management.db')
DB_PATH = os.path.abspath(DB_PATH)

ROLE = 'teacher'
NEW_PERMS = ['culture.view', 'culture.edit']


def backup():
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    dst = DB_PATH + f'.bak_culture_{ts}'
    shutil.copyfile(DB_PATH, dst)
    print(f'[backup] {dst}')


def main():
    backup()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1) role_permission.permissions CSV
    cur.execute("SELECT permissions FROM role_permission WHERE role_code=?", (ROLE,))
    row = cur.fetchone()
    if row:
        existing = set(p.strip() for p in (row[0] or '').split(',') if p.strip())
        added = [p for p in NEW_PERMS if p not in existing]
        if added:
            existing.update(added)
            new_csv = ','.join(sorted(existing))
            cur.execute("UPDATE role_permission SET permissions=? WHERE role_code=?", (new_csv, ROLE))
            print(f'[role_permission] +{added} -> teacher.permissions CSV 更新')
        else:
            print('[role_permission] teacher.permissions CSV 已含 culture.view/edit，跳过')
    else:
        print(f'[role_permission] 未找到角色 {ROLE}，跳过 CSV 更新')

    # 2) role_permission_mappings（has_permission 实际查的表）
    cur.execute("SELECT permission_code FROM role_permission_mappings WHERE role_code=?", (ROLE,))
    mapped = set(r[0] for r in cur.fetchall())
    inserted = []
    for perm in NEW_PERMS:
        if perm not in mapped:
            cur.execute(
                "INSERT INTO role_permission_mappings (role_code, permission_code, created_at) VALUES (?, ?, ?)",
                (ROLE, perm, datetime.datetime.now().isoformat()),
            )
            inserted.append(perm)
    if inserted:
        print(f'[mappings] 插入 {inserted}')
    else:
        print('[mappings] teacher 已含 culture.view/edit，跳过')

    # 3) 确保 culture.view/edit 存在于 permissions 目录表（权限管理 UI 完整性）
    try:
        cur.execute("SELECT code FROM permissions WHERE code IN (?, ?)", NEW_PERMS)
        have = set(r[0] for r in cur.fetchall())
        names = {'culture.view': '查看班级文化', 'culture.edit': '编辑班级文化'}
        for perm in NEW_PERMS:
            if perm not in have:
                cur.execute(
                    "INSERT INTO permissions (code, name, description, category, is_active) VALUES (?, ?, ?, '班主任工作台', 1)",
                    (perm, names[perm], names[perm]),
                )
                print(f'[catalog] 插入 permissions 目录 {perm}')
    except sqlite3.OperationalError:
        print('[catalog] permissions 表不存在，跳过（不影响鉴权）')

    conn.commit()

    # 校验
    cur.execute("SELECT permission_code FROM role_permission_mappings WHERE role_code=?", (ROLE,))
    final = sorted(set(r[0] for r in cur.fetchall()))
    print(f'[verify] teacher 映射权限总数={len(final)}')
    for p in NEW_PERMS:
        print(f'  {p}: {"OK" if p in final else "MISSING"}')
    conn.close()


if __name__ == '__main__':
    main()
