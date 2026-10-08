"""R10 索引完备性审计：隔离内存引擎 + EXPLAIN QUERY PLAN 实证。

对全仓 order_by 候选（模型 + 排序列）检查是否存在「首列匹配」索引；
无则跑 EXPLAIN QUERY PLAN，标记 TEMP B-TREE（排序溢出）/ SCAN（全表扫描）。
不触碰任何开发库。
"""
import os
import sys

BACKEND = r"C:\Users\53527\Desktop\自我管理提升\自我管理提升V2.0\平台开发\管理平台设计\apps\backend"
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from flask import Flask
from sqlalchemy import text
from models import db
import models as M

# 候选：(模型类, 排序列名列表, 是否为复合排序)
CANDIDATES = [
    (M.DeviceHeartbeat, ["received_at"], False),
    (M.DeviceHeartbeat, ["received_at", "id"], False),
    (M.DeviceFirmwareUpdate, ["started_at"], False),
    (M.DeviceFirmwareUpdate, ["created_at"], False),
    (M.FirmwareVersion, ["created_at"], False),
    (M.Approval, ["created_at", "id"], False),
    (M.Approval, ["end_time"], False),
    (M.Approval, ["start_date"], False),
    (M.MentalHealthRecord, ["created_at", "id"], False),
    (M.SeatingChart, ["created_at"], False),
    (M.SeatingSeat, ["row", "col"], True),
    (M.StudyGuide, ["created_at", "id"], False),
    (M.ImprovementPlan, ["start_date", "id"], False),
    (M.SecurityAudit, ["created_at", "id"], False),
    (M.RateLimitRecord, ["window_start", "id"], False),
    (M.NLPRuleUsage, ["created_at", "id"], False),
    (M.CommitteeTerm, ["start_date"], False),
    (M.ClassCommittee, ["position"], False),
    (M.StudyGroup, ["score"], False),
    (M.PermissionLog, ["created_at", "id"], False),
    (M.NotifyHistory, ["created_at", "id"], False),
    (M.ImportConfig, ["module_name", "config_name"], True),
    (M.DutyGroup, ["day_of_week", "name"], True),
    (M.Subject, ["sort_order", "name"], True),
    (M.Subject, ["name"], False),
    (M.ClassPeriod, ["sort_order", "period_number"], True),
    (M.DeviceGroup, ["sort_order", "name"], True),
    (M.ScoreRankRule, ["min_score"], False),
    (M.MQTTLog, ["timestamp"], False),
    (M.CourseSchedule, ["day_of_week", "period_number"], True),
    (M.Activity, ["start_date", "id"], False),
    (M.NLPScoringRule, ["priority"], False),
    (M.NLPScoringRule, ["usage_count"], False),
    (M.NLPCorrection, ["learn_count"], False),
    (M.HomeworkAssignment, ["due_date", "id"], False),
    (M.ContactLog, ["contact_time", "id"], False),
    (M.ClassInfo, ["name"], False),
    (M.User, ["created_at", "id"], False),
    (M.Alert, ["created_at", "id"], False),
    (M.Notification, ["created_at", "id"], False),
    (M.OperationLog, ["created_at", "id"], False),
    (M.Exam, ["start_time", "id"], False),
    (M.ScoreRecord, ["created_at", "id"], False),
    (M.CompositeScore, ["student_id", "composite_score"], False),
    (M.Score, ["student_id", "entered_at"], False),
    (M.Score, ["exam_id", "entered_at"], False),
]


def leading_index_cols(table):
    """返回该表所有索引的首列集合（单/复合均取第一列）。"""
    firsts = set()
    detail = []
    for idx in table.indexes:
        cols = list(idx.columns)
        if cols:
            firsts.add(cols[0].name)
            detail.append((idx.name, [c.name for c in cols]))
    # 主键首列
    pk = list(table.primary_key.columns)
    if pk:
        firsts.add(pk[0].name)
        detail.append(("(PK)", [c.name for c in pk]))
    return firsts, detail


def explain(sql, conn):
    rows = conn.execute(text("EXPLAIN QUERY PLAN " + sql)).fetchall()
    return [r[3] for r in rows]


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

with app.app_context():
    db.create_all()
    conn = db.engine.connect()
    out = []
    covered = 0
    temp_btree = 0
    scan = 0
    for model, cols, is_composite in CANDIDATES:
        table = model.__table__
        tname = table.name
        firsts, detail = leading_index_cols(table)
        lead = cols[0]
        has_lead = lead in firsts
        if has_lead:
            covered += 1
            status = "COVERED"
            plan = ""
        else:
            # 复合排序且首列无索引 -> 必 TEMP B-TREE（除非整体被索引覆盖，这里首列都无）
            colsql = ", ".join(c + " DESC" for c in cols)
            sql = "SELECT * FROM %s ORDER BY %s LIMIT 50" % (tname, colsql)
            plan = explain(sql, conn)
            joined = " | ".join(plan)
            if "TEMP B-TREE" in joined:
                temp_btree += 1
                status = "TEMP_BTREE"
            elif "SCAN" in joined and "USING INDEX" not in joined:
                scan += 1
                status = "SCAN"
            else:
                status = "OK_NO_INDEX_BUT_FAST"
            plan = joined
        out.append(
            "%-22s %-30s %-18s %s"
            % (tname, ",".join(cols), status, plan)
        )

print("=" * 110)
print("R10 INDEX COVERAGE AUDIT (EXPLAIN QUERY PLAN on in-memory engine)")
print("=" * 110)
print("%-22s %-30s %-18s %s" % ("TABLE", "ORDER_BY_COLS", "STATUS", "PLAN"))
print("-" * 110)
for line in out:
    print(line)
print("-" * 110)
print("SUMMARY: covered=%d temp_btree=%d scan=%d" % (covered, temp_btree, scan))
print("=" * 110)
