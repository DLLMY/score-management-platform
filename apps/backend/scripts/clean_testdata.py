"""清理历次调试探针遗留的测试数据（仅删测试残留，不动真实业务数据）。
顺序：备份 -> 关外键约束 -> 删子表关联 -> 删工作台测试父表(按测试标记) -> 删测试学生。
运行前自动备份 db。幂等可重跑。
"""

import sqlite3, os, shutil, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db = os.path.join(BASE, "instance", "score_management.db")
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
bak = db + f".bak_clean_testdata_{ts}"
shutil.copy(db, bak)
print("已备份 ->", bak)

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()
cur.execute("PRAGMA foreign_keys=OFF")


def q(sql, *a):
    cur.execute(sql, a)
    return cur.fetchall()


def ex(sql, *a):
    cur.execute(sql, a)


MARK = "%测试%", "%CrudTest%", "%E2E%", "%API测试%", "%全面测试%"

# 1) 测试学生 id
test_ids = [
    r["id"]
    for r in q(
        "SELECT id FROM user WHERE role='student' AND (name LIKE ? OR name LIKE ? OR name LIKE ? OR name LIKE ? OR name LIKE ?)",
        *MARK,
    )
]
ph = ",".join("?" * len(test_ids))
print(f"\n测试学生 id: {test_ids}")


# 2) 收集各工作台测试父表行 id（按文本标记，去重）
def collect_ids(table, cols):
    ids = set()
    for col in cols:
        for r in q(
            f"SELECT id FROM {table} WHERE {col} LIKE ? OR {col} LIKE ? OR {col} LIKE ? OR {col} LIKE ? OR {col} LIKE ?",
            *MARK,
        ):
            ids.add(r["id"])
    return sorted(ids)


residue = {
    "study_group": collect_ids("study_group", ["name"]),
    "activity": collect_ids("activity", ["title"]),
    "culture_record": collect_ids("culture_record", ["title", "content"]),
    "study_guide": collect_ids("study_guide", ["title", "content"]),
    "homework_assignment": collect_ids("homework_assignment", ["title"]),
}
for t, ids in residue.items():
    print(f"  待删 {t}: {len(ids)} 行 -> {ids}")


# 3) 删子表（关联上述父表）
def qm(n):
    return ",".join(["?"] * n)


if residue["study_group"]:
    ex(
        "DELETE FROM study_group_member WHERE group_id IN ("
        + qm(len(residue["study_group"]))
        + ")",
        *residue["study_group"],
    )
    ex(
        "DELETE FROM study_group_score WHERE group_id IN (" + qm(len(residue["study_group"])) + ")",
        *residue["study_group"],
    )
if residue["activity"]:
    ex(
        "DELETE FROM activity_registration WHERE activity_id IN ("
        + qm(len(residue["activity"]))
        + ")",
        *residue["activity"],
    )
if residue["culture_record"]:
    ex(
        "DELETE FROM culture_item WHERE record_id IN (" + qm(len(residue["culture_record"])) + ")",
        *residue["culture_record"],
    )
if residue["homework_assignment"]:
    ex(
        "DELETE FROM homework_submission WHERE assignment_id IN ("
        + qm(len(residue["homework_assignment"]))
        + ")",
        *residue["homework_assignment"],
    )
print("  已删父表关联子表行")

# 4) 删工作台测试父表
for t, ids in residue.items():
    if ids:
        ex("DELETE FROM " + t + " WHERE id IN (" + qm(len(ids)) + ")", *ids)

# 5) 删关联测试学生的行（class_committee / attendance 等）
ph = qm(len(test_ids))
ex("DELETE FROM class_committee WHERE student_id IN (" + ph + ")", *test_ids)
ex("DELETE FROM attendance WHERE student_id IN (" + ph + ")", *test_ids)
# 安全扫：任何含 student_id 的表，凡引用测试学生一律清
sweep_tables = [
    "seating_seat",
    "duty_assignment",
    "homework_submission",
    "study_group_member",
    "activity_registration",
    "mental_health_record",
    "parent_contact",
]
for t in sweep_tables:
    try:
        cols = [
            r["name"]
            for r in q("PRAGMA table_info(" + t + ")")
            if r["name"] in ("student_id", "leader_id")
        ]
        for c in cols:
            ex("DELETE FROM " + t + " WHERE " + c + " IN (" + ph + ")", *test_ids)
    except Exception as e:
        print("  sweep " + t + " 跳过: " + str(e))
# P0-6: 心理/风险预警已并入 alert(source IN ('mental','risk'))，按 student_id 清理测试学生残留
try:
    ex(
        "DELETE FROM alert WHERE student_id IN (" + ph + ") AND source IN ('mental','risk')",
        *test_ids,
    )
    print("  已删测试学生的 alert(source IN ('mental','risk')) 行")
except Exception as e:
    print("  sweep alert(mental/risk) 跳过: " + str(e))
print("  已删关联测试学生的行 + 安全扫")

# 6) 删测试学生
ex("DELETE FROM user WHERE id IN (" + ph + ")", *test_ids)
con.commit()
cur.execute("PRAGMA foreign_keys=ON")
con.close()
print(f"\n已删除测试学生 {len(test_ids)} 个 + 工作台测试行若干。备份: {bak}")
