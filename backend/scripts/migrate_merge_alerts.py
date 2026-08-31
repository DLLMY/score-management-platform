#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
P0-6 预警合并迁移脚本（幂等 / 单事务 / 可逆）

将两类预警并入统一的 `alert` 表：
  - mental_health_alert  -> alert(source='mental')
      mental_health_alert.student_id -> alert.student_id
      mental_health_alert.alert_type -> alert.alert_type
      mental_health_alert.severity (INT) -> alert.severity (存为字符串化整数，保留前端整数契约)
      mental_health_alert.message    -> alert.message
      mental_health_alert.is_resolved/resolved_at/created_at -> alert 对应列
  - risk_warnings         -> alert(source='risk')
      risk_warnings.student_id        -> alert.student_id
      risk_warnings.risk_type         -> alert.alert_type
      risk_warnings.risk_level        -> alert.risk_level
      risk_warnings.risk_score        -> alert.risk_score
      risk_warnings.description       -> alert.message
      risk_warnings.recommended_action-> alert.recommended_action
      risk_warnings.status            -> alert.status
      risk_warnings.acknowledged_at   -> alert.acknowledged_at
      risk_warnings.is_resolved/resolved_at/created_at -> alert 对应列

合并后 alert 新增列（均为 nullable，不影响既有 device/system 告警）：
  student_id / risk_level / risk_score / recommended_action / status / acknowledged_at

备份策略（受 C 盘空间约束，勿整库 .backup）：
  - 执行前在库内建 `mental_health_alert_bak` / `risk_warnings_bak`（AS SELECT *，可逆，占用极小）。
  - 单事务：备份 + 加列 + 拷贝 + DROP 旧表。

幂等：
  - 旧表已不存在 -> 视为已完成，跳过。
  - 备份已存在但拷贝未完成 -> 用 source 计数确认后补拷。
  - 加列前用 PRAGMA 检查，避免重复加列报错。

用法：
  python scripts/migrate_merge_alerts.py            # 执行
  python scripts/migrate_merge_alerts.py --check-only  # 仅报告状态不修改
"""

import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "instance", "score_management.db")

CHECK_ONLY = "--check-only" in sys.argv


def table_exists(conn, name):
    cur = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


def column_exists(conn, table, col):
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == col for row in cur.fetchall())


def count_source(conn, source):
    cur = conn.execute("SELECT COUNT(*) FROM alert WHERE source=?", (source,))
    return cur.fetchone()[0]


def main():
    if not os.path.exists(DB_PATH):
        print(f"[error] 找不到数据库: {DB_PATH}")
        sys.exit(2)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=OFF")
    try:
        has_mha = table_exists(conn, "mental_health_alert")
        has_rw = table_exists(conn, "risk_warnings")
        has_alert = table_exists(conn, "alert")
        has_mha_bak = table_exists(conn, "mental_health_alert_bak")
        has_rw_bak = table_exists(conn, "risk_warnings_bak")

        print(f"[info] mental_health_alert 表存在: {has_mha}")
        print(f"[info] risk_warnings 表存在: {has_rw}")
        print(f"[info] alert 表存在: {has_alert}")
        print(f"[info] mental_health_alert_bak 存在: {has_mha_bak}")
        print(f"[info] risk_warnings_bak 存在: {has_rw_bak}")

        if not has_alert:
            print("[error] alert 表不存在，无法合并")
            sys.exit(2)

        if not has_mha and not has_rw:
            print("[skip] 两类预警旧表均已不存在，视为已完成合并，直接退出")
            return

        if CHECK_ONLY:
            pending = []
            if has_mha:
                pending.append("mental_health_alert")
            if has_rw:
                pending.append("risk_warnings")
            print(f"[check-only] 检测到待合并表: {pending}，未做任何修改")
            return

        # 1) 给 alert 加列（若不存在）
        for col, ctype in (
            ("student_id", "INTEGER"),
            ("risk_level", "VARCHAR(20)"),
            ("risk_score", "FLOAT"),
            ("recommended_action", "TEXT"),
            ("status", "VARCHAR(20)"),
            ("acknowledged_at", "DATETIME"),
        ):
            if not column_exists(conn, "alert", col):
                conn.execute(f"ALTER TABLE alert ADD COLUMN {col} {ctype}")
                print(f"[ok] alert 新增列 {col}")
            else:
                print(f"[info] alert 列 {col} 已存在，跳过")

        # 2) 合并 mental_health_alert -> alert(source='mental')
        if has_mha:
            if not has_mha_bak:
                conn.execute(
                    "CREATE TABLE mental_health_alert_bak AS SELECT * FROM mental_health_alert"
                )
                print("[ok] 已建库内备份 mental_health_alert_bak")
            else:
                print("[info] mental_health_alert_bak 已存在，跳过备份")
            if count_source(conn, "mental") == 0:
                conn.execute("""
                    INSERT INTO alert (
                        student_id, alert_type, severity, message,
                        is_resolved, resolved_at, created_at, source
                    )
                    SELECT
                        student_id, alert_type, CAST(severity AS TEXT), message,
                        is_resolved, resolved_at, created_at, 'mental'
                    FROM mental_health_alert
                    """)
                copied = conn.execute("SELECT changes()").fetchone()[0]
                print(f"[ok] 已拷贝 {copied} 条心理预警到 alert(source='mental')")
            else:
                print("[info] alert(source='mental') 已有数据，跳过拷贝")
            conn.execute("DROP TABLE mental_health_alert")
            conn.commit()
            print("[ok] 已删除旧表 mental_health_alert")

        # 3) 合并 risk_warnings -> alert(source='risk')
        if has_rw:
            if not has_rw_bak:
                conn.execute("CREATE TABLE risk_warnings_bak AS SELECT * FROM risk_warnings")
                print("[ok] 已建库内备份 risk_warnings_bak")
            else:
                print("[info] risk_warnings_bak 已存在，跳过备份")
            if count_source(conn, "risk") == 0:
                conn.execute("""
                    INSERT INTO alert (
                        student_id, alert_type, severity, message, is_read,
                        source, is_resolved, resolved_at, created_at,
                        risk_level, risk_score, recommended_action, status, acknowledged_at
                    )
                    SELECT
                        student_id, risk_type, NULL, COALESCE(description, '(风险预警)'), 0,
                        'risk', is_resolved, resolved_at, created_at,
                        risk_level, risk_score, recommended_action, status, acknowledged_at
                    FROM risk_warnings
                    """)
                copied = conn.execute("SELECT changes()").fetchone()[0]
                print(f"[ok] 已拷贝 {copied} 条风险预警到 alert(source='risk')")
            else:
                print("[info] alert(source='risk') 已有数据，跳过拷贝")
            conn.execute("DROP TABLE risk_warnings")
            conn.commit()
            print("[ok] 已删除旧表 risk_warnings")

        remain_mental = count_source(conn, "mental")
        remain_risk = count_source(conn, "risk")
        print(
            f"[done] 合并完成：alert(source='mental')={remain_mental}, alert(source='risk')={remain_risk}"
        )
    except Exception as e:
        conn.rollback()
        print(f"[error] 迁移失败已回滚: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
