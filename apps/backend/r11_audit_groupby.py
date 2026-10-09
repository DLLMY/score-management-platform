"""R11 索引审计（GROUP BY / 聚合族）：隔离内存引擎 + EXPLAIN QUERY PLAN 实证。

延续 R7/R8/R10 方法论：完全不碰开发库。
对 PART B 扫描出的 GROUP BY 聚合候选，检查现有索引首列覆盖；
无覆盖则 EXPLAIN，标记 `USE TEMP B-TREE FOR GROUP BY`（排序溢出）/ `SCAN`（全表扫描）。
"""
import os
import sys

BACKEND = r"C:\Users\53527\Desktop\自我管理提升\自我管理提升V2.0\平台开发\管理平台设计\apps\backend"
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
os.environ["FLASK_LIGHTWEIGHT"] = "true"

from flask import Flask
from sqlalchemy import text
from models import db
import models as M

# (模型类, 聚合列, 是否 date() 包裹, 备注)
CANDIDATES = [
    (M.ScoreRecord, "rule_id", False, "dashboard/score_rule_query 按规则聚合"),
    (M.Alert, "severity", False, "alert_service 按严重度聚合"),
    (M.OperationLog, "operation_type", False, "operation_log_service 按操作类型聚合"),
    (M.SecurityAudit, "severity", False, "security_service 按严重度聚合"),
    (M.SecurityAudit, "event_type", False, "security_service 按事件类型聚合"),
    (M.SecurityAudit, "ip_address", False, "security_service 按 IP 聚合(having)"),
    (M.SystemMetric, "metric_name", False, "_system_part2 按指标名聚合"),
    (M.DeviceGroupMapping, "group_id", False, "device_group_routes 按组聚合"),
    (M.AdminClass, "admin_id", False, "data_consistency 按班主任聚合"),
    (M.AdminClass, "class_info_id", False, "data_consistency 按班级聚合"),
    (M.User, "class_info_id", False, "data_consistency 按班级聚合"),
    (M.ScoreRecord, "created_at", True, "operation_log/query_optimizer 按日期聚合(date())"),
    (M.OperationLog, "created_at", True, "operation_log_service 按日期聚合(date())"),
]

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
app.config["TESTING"] = True
db.init_app(app)

with app.app_context():
    db.create_all()
    eng = db.engine

    def leftmost_covered(table_name, col):
        """返回 (是否有首列==col 的索引, 匹配索引名列表)"""
        tbl = db.metadata.tables.get(table_name)
        if tbl is None:
            return None, []
        matched = []
        for idx in tbl.indexes:
            cols = list(idx.columns)
            if cols and cols[0].name == col:
                matched.append(idx.name)
        return (len(matched) > 0), matched

    def explain(table_name, col, is_date):
        if is_date:
            q = f'EXPLAIN QUERY PLAN SELECT date("{col}"), COUNT(*) FROM "{table_name}" GROUP BY date("{col}")'
        else:
            q = f'EXPLAIN QUERY PLAN SELECT "{col}", COUNT(*) FROM "{table_name}" GROUP BY "{col}"'
        plan = []
        with eng.connect() as conn:
            for r in conn.execute(text(q)):
                plan.append(" ".join(str(x) for x in r))
        return plan

    print("=" * 70)
    print("R11 GROUP BY / 聚合 索引审计")
    print("=" * 70)
    needs_fix = []
    for model, col, is_date, note in CANDIDATES:
        table_name = model.__tablename__
        covered, matched = leftmost_covered(table_name, col)
        if covered is None:
            print(f"[SKIP] {table_name}.{col}: 表不存在")
            continue
        plan = explain(table_name, col, is_date)
        plan_str = " | ".join(plan)
        has_temp = "USE TEMP B-TREE" in plan_str
        has_scan = "SCAN" in plan_str
        if covered:
            status = "COVERED(首列索引)"
            flag = "OK"
        else:
            if has_temp or has_scan:
                status = "TEMP_BTREE/SCAN -> 需补索引"
                flag = "FIX"
                needs_fix.append((table_name, col, is_date, note))
            else:
                status = "无TEMP_BTREE(可能小表/巧合)"
                flag = "OK?"
        print(f"[{flag:4}] {table_name}.{col}{'(date)' if is_date else ''}: {status}")
        print(f"       现有首列索引: {matched or '无'}  备注: {note}")
        print(f"       PLAN: {plan_str}")

    print("=" * 70)
    print("需补索引候选:")
    for t, c, d, n in needs_fix:
        print(f"  {t}.{c}{'(date)' if d else ''}  # {n}")
    print(f"合计: {len(needs_fix)}")
