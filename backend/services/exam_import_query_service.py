"""成绩导入历史的只读查询视图（薄路由下沉）。

将 ImportHistory 端点的读路径（分页查询 + 序列化）下沉到此服务，
路由层仅负责解析请求参数与信封封装，保持契约不变。
"""

from models import Score, User, Exam, Admin, get_by_id


def get_import_history_view(exam_id=None, page=1, per_page=20):
    """返回成绩导入历史的分页视图，结构与原路由实现逐字一致。

    Returns:
        dict: {"data": [...], "total": int, "page": int, "per_page": int, "pages": int}
    """
    query = Score.query.filter(Score.entered_by.isnot(None))
    if exam_id:
        query = query.filter_by(exam_id=exam_id)

    pagination = query.order_by(Score.entered_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    results = []
    for score in pagination.items:
        student = get_by_id(User, score.student_id)
        exam = get_by_id(Exam, score.exam_id)
        entered_by_admin = get_by_id(Admin, score.entered_by) if score.entered_by else None

        results.append(
            {
                "id": score.id,
                "exam_name": exam.name if exam else None,
                "student_name": student.name if student else None,
                "student_card_id": student.card_id if student else None,
                "subject": score.subject_rel.name if score.subject_rel else "",
                "score": score.score,
                "full_score": score.full_score,
                "status": score.status,
                "rank": None,  # R7: Score.rank 列废弃，无排名上下文
                "entered_by": entered_by_admin.username if entered_by_admin else None,
                "entered_at": score.entered_at.isoformat() if score.entered_at else None,
            }
        )

    return {
        "data": results,
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }
