"""成绩 CRUD、批量录入与全部确认。"""

from datetime import datetime

from models import (
    Admin,
    AdminClass,
    ClassInfo,
    CourseSchedule,
    Exam,
    ImportConfig,
    Score,
    Subject,
    SubjectClass,
    User,
    cascade_delete_related_records,
    db,
    get_by_id,
)
from utils.db_session import db_session_scope


class _ScoreMixin:
    def create_score(
        self, exam_id, student_id, subject_id, score_val, full_score, status, remark, entered_by
    ):
        """创建单条成绩。科目解析/考试存在/已关闭禁录/分数范围/冲突检测（请求级）由路由层完成。

        返回新成绩 id；唯一约束冲突由 db_session_scope 回滚并上抛 IntegrityError，路由捕获后回 400。
        """
        score = Score(
            exam_id=exam_id,
            student_id=student_id,
            subject_id=subject_id,
            score=score_val,
            full_score=full_score,
            status=status,
            remark=remark,
            entered_by=entered_by,
        )
        with db_session_scope(detach=False):
            db.session.add(score)
            db.session.flush()
            return score.id

    def batch_create_scores(self, score_dicts):
        """批量写入成绩。逐条校验/解析/冲突检测由路由层完成；本方法仅整段提交已验证的 score_dicts。

        唯一约束冲突由 db_session_scope 回滚并上抛 IntegrityError，路由捕获后回 400（避免半提交）。
        """
        with db_session_scope(detach=False):
            for d in score_dicts:
                db.session.add(
                    Score(
                        exam_id=d["exam_id"],
                        student_id=d["student_id"],
                        subject_id=d["subject_id"],
                        score=d.get("score"),
                        full_score=d.get("full_score", 100),
                        status=d.get("status", "pending"),
                        remark=d.get("remark"),
                        entered_by=d.get("entered_by"),
                    )
                )

    def update_score(self, score_id, data):
        """更新成绩字段。考试关闭禁改校验由路由层完成；逐字节复刻 setattr 循环与范围校验。

        分数格式非法/越界抛 ValueError（路由捕获回 400）；唯一冲突由 scope 回滚抛 IntegrityError。
        """
        with db_session_scope(detach=False):
            score = get_by_id(Score, score_id)
            if score is None:
                return None
            for key in ["score", "full_score", "rank", "status", "remark"]:
                if key in data:
                    setattr(score, key, data[key])
            # E13 修复: 更新后范围校验
            if score.score is not None:
                full = score.full_score or 100
                try:
                    score.score = float(score.score)
                    full = float(full)
                except (TypeError, ValueError):
                    raise ValueError("分数格式非法") from None
                if score.score < 0 or (full > 0 and score.score > full):
                    raise ValueError(f"成绩需在 0 ~ {full} 之间")
            score.updated_at = datetime.now()
            return score.id

    def delete_score(self, score_id):
        """删除成绩。考试关闭禁删校验由路由层完成；404 语义由路由层 get_by_id 保证。"""
        with db_session_scope(detach=False):
            score = get_by_id(Score, score_id)
            if score:
                db.session.delete(score)

    def confirm_all_scores(self, exam_id):
        """批量确认某次考试的所有成绩（pending/normal → confirmed）。

        返回更新条数；异常由 db_session_scope 回滚并上抛，路由捕获后回 500。
        """
        with db_session_scope(detach=False):
            updated = Score.query.filter(
                Score.exam_id == exam_id,
                Score.status.in_(["pending", "normal"]),
            ).update(
                {"status": "confirmed", "updated_at": datetime.now()},
                synchronize_session=False,
            )
            return int(updated or 0)
