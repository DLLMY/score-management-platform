"""
P0-2 迁移：scores.subject 文本列 -> subject_id 外键（指向 subject.id）

策略：
  1. 备份数据库（wal_checkpoint 后物理拷贝）。
  2. 给 scores 增加 subject_id INTEGER 列（先可空）。
  3. 按 subject.name 回填 subject_id（语文->1/数学->2/英语->3）。
  4. 校验孤儿（subject_id 为空且 subject 非空）：存在则中止，绝不丢数据。
  5. 重建 scores 表：去掉 subject 文本列，subject_id NOT NULL + FK->subject(id)，
     保留 exam_id/student_id/entered_by 的 FK 与全部索引（含组合索引改用 subject_id）。
  6. 单事务提交，跑 integrity_check。

幂等：若 scores 已无 subject 列，则视为已完成，直接退出。
"""

import os
import sys
import shutil
import sqlite3
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate_score_subject_fk")

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(HERE)
sys.path.insert(0, BACKEND_ROOT)


def get_db_path():
    try:
        from app import app

        uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        if uri.startswith("sqlite:///"):
            return uri[len("sqlite:///") :]
    except Exception as e:  # pragma: no cover - fallback
        logger.warning("无法通过 app 配置获取 DB 路径: %s，回退到默认路径", e)
    return os.path.join(BACKEND_ROOT, "instance", "score_management.db")


def column_exists(conn, table, col):
    cur = conn.execute(f"PRAGMA table_info('{table}')")
    return any(row[1] == col for row in cur.fetchall())


def main():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        logger.error("数据库文件不存在: %s", db_path)
        sys.exit(1)
    logger.info("目标数据库: %s", db_path)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=OFF")
    try:
        # 幂等检查：subject 列已不存在 => 已完成
        if not column_exists(conn, "scores", "subject"):
            logger.info("scores 已无 subject 列，迁移已完成，直接退出。")
            conn.close()
            return 0

        # 1. 备份
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{db_path}.pre_P02_{ts}"
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.commit()
        shutil.copy2(db_path, backup_path)
        logger.info("已备份: %s", backup_path)

        # 2. 增加 subject_id 列（可空）
        if not column_exists(conn, "scores", "subject_id"):
            conn.execute("ALTER TABLE scores ADD COLUMN subject_id INTEGER")
            logger.info("已添加 scores.subject_id 列")
        else:
            logger.info("scores.subject_id 已存在，跳过 ADD COLUMN")

        # 3. 回填 subject_id
        conn.execute(
            "UPDATE scores SET subject_id = (SELECT id FROM subject WHERE subject.name = scores.subject) "
            "WHERE subject_id IS NULL"
        )
        conn.commit()

        # 4. 校验孤儿
        orphan_rows = conn.execute(
            "SELECT COUNT(*) FROM scores WHERE subject_id IS NULL AND subject IS NOT NULL AND subject != ''"
        ).fetchone()[0]
        if orphan_rows > 0:
            logger.error(
                "存在 %d 行 subject 文本无法映射到 subject 表，中止迁移以免丢数据！", orphan_rows
            )
            samples = conn.execute(
                "SELECT id, subject FROM scores WHERE subject_id IS NULL AND subject IS NOT NULL AND subject != '' LIMIT 10"
            ).fetchall()
            for r in samples:
                logger.error("  orphan id=%s subject=%r", r[0], r[1])
            conn.rollback()
            conn.close()
            sys.exit(2)

        total = conn.execute("SELECT COUNT(*) FROM scores").fetchone()[0]
        mapped = conn.execute(
            "SELECT COUNT(*) FROM scores WHERE subject_id IS NOT NULL"
        ).fetchone()[0]
        logger.info("subject_id 回填完成: %d/%d 行已映射", mapped, total)

        # 5. 重建 scores 表（去掉 subject，subject_id NOT NULL + FK）
        conn.execute("""
            CREATE TABLE scores_new (
                id INTEGER NOT NULL,
                exam_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                score FLOAT,
                full_score FLOAT,
                rank INTEGER,
                status VARCHAR(20),
                remark VARCHAR(200),
                entered_by INTEGER,
                entered_at DATETIME,
                updated_at DATETIME,
                PRIMARY KEY (id),
                FOREIGN KEY(exam_id) REFERENCES exams (id),
                FOREIGN KEY(student_id) REFERENCES user (id),
                FOREIGN KEY(entered_by) REFERENCES admin (id),
                FOREIGN KEY(subject_id) REFERENCES subject (id)
            )
            """)
        conn.execute("""
            INSERT INTO scores_new (
                id, exam_id, student_id, subject_id, score, full_score, rank,
                status, remark, entered_by, entered_at, updated_at
            )
            SELECT id, exam_id, student_id, subject_id, score, full_score, rank,
                   status, remark, entered_by, entered_at, updated_at
            FROM scores
            """)
        conn.execute("DROP TABLE scores")
        conn.execute("ALTER TABLE scores_new RENAME TO scores")

        # 重建索引（含组合索引改用 subject_id）
        indexes = [
            "CREATE INDEX ix_scores_exam_id ON scores (exam_id)",
            "CREATE INDEX ix_scores_student_id ON scores (student_id)",
            "CREATE INDEX ix_scores_status ON scores (status)",
            "CREATE INDEX ix_scores_entered_by ON scores (entered_by)",
            "CREATE INDEX ix_scores_subject_id ON scores (subject_id)",
            "CREATE INDEX ix_score_exam_student ON scores (exam_id, student_id)",
            "CREATE INDEX ix_score_exam_subject ON scores (exam_id, subject_id)",
            "CREATE INDEX ix_score_student_subject ON scores (student_id, subject_id)",
        ]
        for idx_sql in indexes:
            conn.execute(idx_sql)
        logger.info("scores 表已重建（subject_id 外键 + 索引）")

        conn.commit()

        # 6. 完整性校验
        conn.execute("PRAGMA integrity_check")
        ik = conn.execute("PRAGMA integrity_check").fetchone()[0]
        logger.info("integrity_check = %s", ik)
        if ik != "ok":
            logger.error("integrity_check 未通过: %s", ik)
            conn.rollback()
            conn.close()
            sys.exit(3)

        logger.info("P0-2 迁移成功完成 ✅")
        conn.close()
        return 0
    except Exception as e:  # pragma: no cover
        logger.exception("迁移失败: %s", e)
        try:
            conn.rollback()
        except Exception:
            pass
        conn.close()
        sys.exit(4)


if __name__ == "__main__":
    sys.exit(main())
