"""R10：向模型与 create_indexes.py 清单落地缺失排序索引（EOL 守恒，幂等）。

- 模型层：在每个目标类 `def to_dict` 前插入 `__table_args__ = (db.Index(...),)`，
  使 create_all（新建/测试库）+ reconcile（现有库）一致覆盖。
- 清单层：向 scripts/create_indexes.py 的 get_all_indexes() 追加同样命名的索引，
  使启动自举与 verify 闸门覆盖。
不触碰任何运行中的数据；仅改模型定义与管理脚本。
"""
import io
import os

BACKEND = r"C:\Users\53527\Desktop\自我管理提升\自我管理提升V2.0\平台开发\管理平台设计\apps\backend"
os.chdir(BACKEND)


def detect_eol(data: bytes):
    crlf = data.count(b"\r\n")
    lf = data.count(b"\n") - crlf
    return b"\r\n" if crlf >= lf else b"\n"


# (相对路径, 类名, [(索引名, [列...]), ...])
MODEL_EDITS = [
    ("models/device_models.py", "DeviceHeartbeat", [("ix_heartbeat_received_at", ["received_at"])]),
    ("models/device_models.py", "FirmwareVersion", [("ix_firmware_version_created_at", ["created_at"])]),
    ("models/device_models.py", "DeviceFirmwareUpdate", [
        ("ix_device_firmware_update_started_at", ["started_at"]),
        ("ix_device_firmware_update_created_at", ["created_at"]),
    ]),
    ("models/notify_models.py", "Approval", [
        ("ix_approval_end_time", ["end_time"]),
        ("ix_approval_start_date", ["start_date"]),
    ]),
    ("models/system_models.py", "RateLimitRecord", [("ix_rate_limit_record_window_start", ["window_start"])]),
    ("models/nlp_models.py", "NLPCorrection", [("ix_nlp_correction_learn_count", ["learn_count"])]),
    ("models/seating.py", "SeatingChart", [("ix_seating_chart_created_at", ["created_at"])]),
    ("models/seating.py", "SeatingSeat", [("ix_seating_seat_row_col", ["row", "col"])]),
    ("models/mental_health.py", "MentalHealthRecord", [("ix_mental_health_record_created_at", ["created_at"])]),
    ("models/homework.py", "HomeworkAssignment", [("ix_homework_assignment_due_date", ["due_date"])]),
    ("models/parent.py", "ContactLog", [("ix_contact_log_contact_time", ["contact_time"])]),
    ("models/study_guide.py", "StudyGuide", [("ix_study_guide_created_at", ["created_at"])]),
    ("models/study_guide.py", "ImprovementPlan", [("ix_improvement_plan_start_date", ["start_date"])]),
    ("models/committee.py", "ClassCommittee", [("ix_class_committee_position", ["position"])]),
    ("models/committee.py", "CommitteeTerm", [("ix_committee_term_start_date", ["start_date"])]),
    ("models/study_group.py", "StudyGroup", [("ix_study_group_score", ["score"])]),
    ("models/activity.py", "Activity", [("ix_activity_start_date", ["start_date"])]),
]

# 仅追加「清单中尚不存在」的新索引（ix_heartbeat_received_at 已在清单中，不重复）
MANIFEST_NEW = [
    ("firmware_versions", [("ix_firmware_version_created_at", ["created_at"])]),
    ("device_firmware_updates", [
        ("ix_device_firmware_update_started_at", ["started_at"]),
        ("ix_device_firmware_update_created_at", ["created_at"]),
    ]),
    ("approval", [("ix_approval_end_time", ["end_time"]), ("ix_approval_start_date", ["start_date"])]),
    ("rate_limit_records", [("ix_rate_limit_record_window_start", ["window_start"])]),
    ("nlp_corrections", [("ix_nlp_correction_learn_count", ["learn_count"])]),
    ("mental_health_record", [("ix_mental_health_record_created_at", ["created_at"])]),
    ("homework_assignment", [("ix_homework_assignment_due_date", ["due_date"])]),
    ("contact_log", [("ix_contact_log_contact_time", ["contact_time"])]),
    ("seating_chart", [("ix_seating_chart_created_at", ["created_at"])]),
    ("seating_seat", [("ix_seating_seat_row_col", ["row", "col"])]),
    ("study_guide", [("ix_study_guide_created_at", ["created_at"])]),
    ("improvement_plan", [("ix_improvement_plan_start_date", ["start_date"])]),
    ("class_committee", [("ix_class_committee_position", ["position"])]),
    ("committee_term", [("ix_committee_term_start_date", ["start_date"])]),
    ("study_group", [("ix_study_group_score", ["score"])]),
    ("activity", [("ix_activity_start_date", ["start_date"])]),
]


def patch_model(path, class_name, indexes):
    data = open(path, "rb").read()
    eol = detect_eol(data)
    text = data.decode("utf-8")
    if class_name not in text:
        print("SKIP (class missing):", path, class_name)
        return False
    # 幂等：若索引名已存在则跳过
    existing = {idx[0] for idx in indexes if idx[0] in text}
    if existing == {idx[0] for idx in indexes}:
        print("SKIP (already present):", path, class_name)
        return False
    lines = text.split("\n")  # 逻辑行；写回时统一用 eol
    # 定位 class 声明行
    ci = None
    for i, ln in enumerate(lines):
        if ln.strip().startswith("class %s(" % class_name) or ln.strip().startswith("class %s:" % class_name):
            ci = i
            break
    if ci is None:
        print("SKIP (no class def):", path, class_name)
        return False
    # 从 ci 之后找第一个 4 空格缩进的 "def to_dict"
    ti = None
    for j in range(ci + 1, len(lines)):
        if lines[j] == "    def to_dict" or lines[j].startswith("    def to_dict("):
            ti = j
            break
    if ti is None:
        print("SKIP (no to_dict):", path, class_name)
        return False
    idx_lines = []
    for name, cols in indexes:
        col_str = ", ".join('"%s"' % c for c in cols)
        idx_lines.append('        db.Index("%s", %s),' % (name, col_str))
    block = (
        ["", "    __table_args__ = ("]
        + idx_lines
        + ["    )", ""]
    )
    # 在 ti 之前插入；ti 之前的空行保留
    new_lines = lines[:ti] + block + lines[ti:]
    new_text = eol.decode("utf-8").join(new_lines)
    # 末尾确保单行换行
    open(path, "wb").write(new_text.encode("utf-8"))
    print("PATCHED:", path, class_name, "->", [i[0] for i in indexes])
    return True


def patch_manifest(path, new_entries):
    data = open(path, "rb").read()
    eol = detect_eol(data)
    text = data.decode("utf-8")
    # 幂等：若首个新索引名已存在则跳过
    if new_entries[0][1][0][0] in text:
        print("SKIP (manifest already has):", path)
        return False
    lines = text.split("\n")
    # 定位 def create_indexes 之前的最后一个 "    ]"（列表闭合）
    end_i = None
    cz_i = None
    for i, ln in enumerate(lines):
        if ln.strip().startswith("def create_indexes"):
            cz_i = i
            break
    if cz_i is None:
        print("SKIP (no create_indexes):", path)
        return False
    for i in range(cz_i - 1, -1, -1):
        if lines[i].rstrip("\r") == "    ]":
            end_i = i
            break
    if end_i is None:
        print("SKIP (no list close):", path)
        return False
    block = ["", "        # R10: 补全排序字段索引（消除 order_by TEMP B-TREE 排序溢出）"]
    for tbl, indexes in new_entries:
        block.append("        (")
        block.append('            "%s",' % tbl)
        block.append("            [")
        for name, cols in indexes:
            col_str = ", ".join('"%s"' % c for c in cols)
            block.append('                ("%s", [%s]),' % (name, col_str))
        block.append("            ],")
        block.append("        ),")
    # 在 end_i（"    ]"）之前插入；并把 end_i 行的 "    ]" 前加逗号
    # 原 end_i 是列表最后一个元素的闭合后的 ]，需要在其前加逗号
    prev = lines[end_i - 1].rstrip("\r")
    if not prev.endswith(","):
        lines[end_i - 1] = prev + ","
    new_lines = lines[:end_i] + block + lines[end_i:]
    new_text = eol.decode("utf-8").join(new_lines)
    open(path, "wb").write(new_text.encode("utf-8"))
    print("PATCHED manifest:", path, "entries=%d" % len(new_entries))
    return True


if __name__ == "__main__":
    for f, cls, idxs in MODEL_EDITS:
        patch_model(f, cls, idxs)
    patch_manifest("scripts/create_indexes.py", MANIFEST_NEW)
    print("DONE")
