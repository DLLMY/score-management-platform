"""P1 成绩 / 考勤历史冷归档：建表 + 可归档行数统计（dry-run）+ 真正归档（--execute）。

背景：
  单库 score_management.db 已达 ~2.3G，scores / attendance 为高频写入热表，历史学年
  数据长期驻留会拖慢查询并放大备份体积。本脚本提供「归档表 + 定时迁移」能力，将早于
  RETENTION 窗口的历史冷数据移入 *_archive 冷表，缓解主表膨胀。

新增表（db.create_all 幂等建表，可重复执行）：
  - scores_archive      : 与 scores 结构一致 + archived_at
  - attendance_archive  : 与 attendance 结构一致 + archived_at

用法（cwd=backend）：
  python scripts/migrate_archive_tables.py            # 仅幂等建表（默认，安全）
  python scripts/migrate_archive_tables.py --dry-run # 报告可归档行数（不移动任何数据）
  python scripts/migrate_archive_tables.py --execute # 真正归档早于 RETENTION 的历史数据

安全说明：
  --execute 会修改热表（DELETE 冷数据），必须在维护窗口、且已完整备份后执行。
  脚本按 id 分批（BATCH）提交，单批失败可定位断点；归档前请确认已执行本仓库备份策略。
"""
import argparse
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import db, ScoreArchive, AttendanceArchive

RETENTION_DAYS = int(os.getenv("ARCHIVE_RETENTION_DAYS", "365"))
BATCH = 2000

# 归档列（与模型一致，含 archived_at 由脚本写入）
_SCORE_COLS = ["id", "exam_id", "student_id", "subject_id", "score",
               "full_score", "status", "remark", "entered_by", "entered_at", "updated_at"]
_ATT_COLS = ["id", "class_id", "student_id", "date", "period", "status",
             "arrive_time", "leave_time", "recorded_by", "notes", "created_at"]


def ensure_tables():
    """幂等创建归档表（已存在则跳过）。"""
    with app.app_context():
        db.create_all()
        inspector = db.inspect(db.engine)
        for model in (ScoreArchive, AttendanceArchive):
            exists = model.__tablename__ in inspector.get_table_names()
            print(f"[{'OK' if exists else 'MISSING'}] table {model.__tablename__}")
            if not exists:
                sys.exit(1)
    print("[migrate] 归档表就绪 (scores_archive / attendance_archive)")


def _in_clause(ids):
    """将整数 id 列表拼为 SQL IN 子句（id 来自本库自增主键，非外部输入，安全）。"""
    return ",".join(str(int(i)) for i in ids)


def dry_run(cutoff):
    with app.app_context():
        n_scores = db.session.execute(
            db.text("SELECT COUNT(*) FROM scores WHERE entered_at IS NOT NULL AND entered_at < :cutoff"),
            {"cutoff": cutoff},
        ).scalar()
        n_att = db.session.execute(
            db.text("SELECT COUNT(*) FROM attendance WHERE created_at IS NOT NULL AND created_at < :cutoff"),
            {"cutoff": cutoff},
        ).scalar()
        print(f"[dry-run] 归档窗口截止: {cutoff.date()} (RETENTION_DAYS={RETENTION_DAYS})")
        print(f"[dry-run] 可归档 scores 行数    : {n_scores}")
        print(f"[dry-run] 可归档 attendance 行数: {n_att}")
        print("[dry-run] 未移动任何数据。如需执行请加 --execute（需维护窗口 + 已备份）")


def execute(cutoff):
    """将早于 cutoff 的冷数据分批移入归档表，并从热表删除（每批独立事务）。"""
    score_cols_sql = ", ".join(_SCORE_COLS)
    att_cols_sql = ", ".join(_ATT_COLS)
    now = datetime.now()
    total_scores = 0
    total_att = 0

    with app.app_context():
        # ---- scores 归档 ----
        while True:
            ids = [r[0] for r in db.session.execute(
                db.text(
                    "SELECT id FROM scores "
                    "WHERE entered_at IS NOT NULL AND entered_at < :cutoff "
                    "ORDER BY id LIMIT :lim"
                ),
                {"cutoff": cutoff, "lim": BATCH},
            ).fetchall()]
            if not ids:
                break
            in_clause = _in_clause(ids)
            db.session.execute(db.text(
                f"INSERT INTO scores_archive ({score_cols_sql}, archived_at) "
                f"SELECT {score_cols_sql}, :now FROM scores WHERE id IN ({in_clause})"
            ), {"now": now})
            db.session.execute(db.text(f"DELETE FROM scores WHERE id IN ({in_clause})"))
            db.session.commit()
            total_scores += len(ids)
            print(f"[execute] 已归档 scores {total_scores} 行")

        # ---- attendance 归档 ----
        while True:
            ids = [r[0] for r in db.session.execute(
                db.text(
                    "SELECT id FROM attendance "
                    "WHERE created_at IS NOT NULL AND created_at < :cutoff "
                    "ORDER BY id LIMIT :lim"
                ),
                {"cutoff": cutoff, "lim": BATCH},
            ).fetchall()]
            if not ids:
                break
            in_clause = _in_clause(ids)
            db.session.execute(db.text(
                f"INSERT INTO attendance_archive ({att_cols_sql}, archived_at) "
                f"SELECT {att_cols_sql}, :now FROM attendance WHERE id IN ({in_clause})"
            ), {"now": now})
            db.session.execute(db.text(f"DELETE FROM attendance WHERE id IN ({in_clause})"))
            db.session.commit()
            total_att += len(ids)
            print(f"[execute] 已归档 attendance {total_att} 行")

    print(f"[execute] 完成：scores +{total_scores} 行，attendance +{total_att} 行已移入归档表")


def main():
    ap = argparse.ArgumentParser(description="成绩/考勤历史冷归档（建表 + dry-run + execute）")
    ap.add_argument("--dry-run", action="store_true", help="报告可归档行数，不移动数据")
    ap.add_argument("--execute", action="store_true", help="真正归档早于 RETENTION 的历史数据（需维护窗口）")
    args = ap.parse_args()

    cutoff = datetime.now() - timedelta(days=RETENTION_DAYS)
    ensure_tables()
    if args.execute:
        execute(cutoff)
    else:
        dry_run(cutoff)


if __name__ == "__main__":
    main()
