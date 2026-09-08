"""考试 / 成绩只读查询服务层（薄路由下沉）。

仅承载路由层 GET 端点的只读编排（查询、聚合、分页、排名计算、导出数据准备），
不触碰 db.session 写操作、不构造 HTTP 信封（APIResponse.* 留在路由层），
不处理 send_file 等表现层细节（Excel 字节生成前的 rows/headers 在此准备）。
"""

from models import Exam, Score, User, Subject, get_by_id
from sqlalchemy.orm import joinedload
from utils.pagination import get_pagination
from utils.permission import get_current_admin, get_allowed_classes


def _resolve_subject_id(subject_name, subject_id):
    """将科目名称或科目ID解析为 subject.id；均缺失返回 None。"""
    if subject_id:
        return subject_id
    if subject_name:
        sub = Subject.query.filter_by(name=subject_name).first()
        if sub:
            return sub.id
        sub = Subject.query.filter_by(code=subject_name).first()
        if sub:
            return sub.id
    return None


def get_exam_list_view(class_id=None, status=None):
    """考试列表（分页）。返回 {items, pagination} 纯数据。"""
    query = Exam.query
    if class_id:
        query = query.filter_by(class_id=class_id)
    if status:
        query = query.filter_by(status=status)
    page, per_page = get_pagination(default=20)
    pagination = query.order_by(Exam.start_time.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return {
        "items": [e.to_dict() for e in pagination.items],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }


def get_exam_detail_view(exam_id):
    """考试详情。返回 Exam 实例或 None（None 由路由转 404）。"""
    return get_by_id(Exam, exam_id)


def get_score_list_view(exam_id=None, student_id=None, subject=None, subject_id=None):
    """成绩列表（分页 + 班级隔离 + 科目解析 + 预加载）。返回 {items, pagination}。"""
    query = Score.query
    if exam_id:
        query = query.filter_by(exam_id=exam_id)
    if student_id:
        query = query.filter_by(student_id=student_id)
    sid = _resolve_subject_id(subject, subject_id)
    if sid:
        query = query.filter_by(subject_id=sid)
    # R6 修复: 非超管按班级隔离（原无过滤 → 班主任可跨班读成绩）
    admin = get_current_admin()
    allowed = get_allowed_classes(admin.id) if admin else None
    if allowed is not None:
        query = query.join(User, Score.student_id == User.id).filter(User.class_name.in_(allowed))
    page, per_page = get_pagination(default=20)
    # N+1 修复：to_dict 访问 subject_rel.name，预加载避免逐行查询
    pagination = (
        query.options(joinedload(Score.subject_rel))
        .order_by(Score.score.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return {
        "items": [s.to_dict() for s in pagination.items],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }


def get_score_detail_view(score_id):
    """成绩详情。返回 Score 实例或 None。"""
    return get_by_id(Score, score_id)


def get_exam_score_analysis_view(exam_id):
    """考试成绩分析。返回 {exam, analysis} 或 None（exam 不存在）。"""
    exam = get_by_id(Exam, exam_id)
    if not exam:
        return None
    scores = Score.query.filter_by(exam_id=exam_id).all()
    if not scores:
        return {"exam": exam.to_dict(), "analysis": None}
    total = len(scores)
    scores_list = [s.score for s in scores if s.score is not None]
    analysis = {
        "total_students": total,
        "subjects": sorted({s.subject_rel.name for s in scores if s.subject_rel}),
        "avg_score": sum(scores_list) / len(scores_list) if scores_list else 0,
        "max_score": max(scores_list) if scores_list else 0,
        "min_score": min(scores_list) if scores_list else 0,
    }
    return {"exam": exam.to_dict(), "analysis": analysis}


def get_exam_rankings_view(exam_id, subject=None, subject_id=None, page=1, per_page=20):
    """考试排名（分页 + 科目筛选 + 动态排名 + 学生名）。返回 {exam, rankings, pagination} 或 None。"""
    exam = get_by_id(Exam, exam_id)
    if not exam:
        return None
    # R9 修复: 成绩状态为 confirmed（原筛 published 与实际状态不符 → 排名恒空）
    query = Score.query.filter_by(exam_id=exam_id, status="confirmed")
    sid = _resolve_subject_id(subject, subject_id)
    if sid:
        query = query.filter_by(subject_id=sid)
    pagination = query.order_by(Score.score.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    rankings = pagination.items
    result = []
    for idx, score in enumerate(rankings):
        rank = (page - 1) * per_page + idx + 1
        entry = score.to_dict()
        entry["rank"] = rank
        student = get_by_id(User, score.student_id)
        if student:
            entry["student_name"] = student.name
        result.append(entry)
    return {
        "exam": exam.to_dict(),
        "rankings": result,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }


def get_student_score_analysis_view(student_id):
    """学生成绩分析。返回 {student, scores, total, avg_score} 或 None（学生不存在）。"""
    student = get_by_id(User, student_id)
    if not student:
        return None
    scores = Score.query.filter_by(student_id=student_id).order_by(Score.entered_at.desc()).all()
    score_list = [s.to_dict() for s in scores]
    if score_list:
        raw_scores = [s.score for s in scores if s.score is not None]
        avg = sum(raw_scores) / len(raw_scores) if raw_scores else 0
    else:
        avg = 0
    return {
        "student": student.to_dict(["id", "name", "class_name"]),
        "scores": score_list,
        "total": len(score_list),
        "avg_score": round(avg, 2),
    }


def get_class_score_analysis_view(class_name):
    """班级成绩分析。返回 {class_name, student_count, ...} 或 None（班级不存在）。"""
    students = User.query.filter_by(class_name=class_name).all()
    if not students:
        return None
    student_ids = [s.id for s in students]
    scores = (
        Score.query.filter(Score.student_id.in_(student_ids))
        .order_by(Score.entered_at.desc())
        .all()
    )
    score_list = [s.to_dict() for s in scores]
    exam_ids = set(s.exam_id for s in scores)
    exams = (
        {e.id: e.to_dict() for e in Exam.query.filter(Exam.id.in_(exam_ids)).all()}
        if exam_ids
        else {}
    )
    subjects = {s.subject_rel.name for s in scores if s.subject_rel}
    raw_scores = [s.score for s in scores if s.score is not None]
    return {
        "class_name": class_name,
        "student_count": len(students),
        "scores": score_list,
        "total": len(score_list),
        "subjects": list(subjects),
        "exams": list(exams.values()),
        "avg_score": round(sum(raw_scores) / len(raw_scores), 2) if raw_scores else 0,
    }


def get_score_export_data_view(exam_id, student_id=None, subject_id=None):
    """成绩导出数据准备（不含 Excel 字节生成 / send_file）。返回 {rows, headers, filename}。

    exam_id 缺失校验由路由层负责（bad_request），此处假定 exam_id 已提供。
    """
    query = Score.query.filter_by(exam_id=exam_id)
    if student_id:
        query = query.filter_by(student_id=student_id)
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    scores = query.order_by(Score.subject_id, Score.score.desc()).all()
    exam = Exam.query.get(exam_id)
    headers = [
        "学生姓名",
        "学号",
        "班级",
        "科目",
        "分数",
        "满分",
        "排名",
        "状态",
        "录入时间",
        "备注",
    ]
    rows = []
    # R7: 排名列动态计算（Score.rank 列已废弃恒 None；按当前排序 1..N）
    for _idx, s in enumerate(scores, 1):
        u = s.student
        rows.append(
            {
                "学生姓名": u.name if u else "",
                "学号": u.card_id if u else "",
                "班级": (u.class_info.name if u and u.class_info else (u.class_name if u else "")),
                "科目": s.subject_rel.name if s.subject_rel else "",
                "分数": s.score,
                "满分": s.full_score,
                "排名": _idx,
                "状态": s.status or "",
                "录入时间": s.entered_at.strftime("%Y-%m-%d %H:%M") if s.entered_at else "",
                "备注": s.remark or "",
            }
        )
    filename = "成绩导出_%s" % (exam.name if exam else exam_id)
    return {"rows": rows, "headers": headers, "filename": filename}


def get_exam_export_data_view(class_id=None, status=None):
    """考试导出数据准备（不含 Excel 字节生成 / send_file）。返回 {rows, headers}。"""
    query = Exam.query
    if class_id:
        query = query.filter_by(class_id=class_id)
    if status:
        query = query.filter_by(status=status)
    exams = query.order_by(Exam.start_time.desc()).all()
    headers = ["考试名称", "类型", "科目", "开始时间", "结束时间", "重要性", "状态"]
    rows = []
    for e in exams:
        subjects = ",".join(e.subjects) if isinstance(e.subjects, list) else (e.subjects or "")
        rows.append(
            {
                "考试名称": e.name,
                "类型": e.exam_type or "",
                "科目": subjects,
                "开始时间": e.start_time.strftime("%Y-%m-%d %H:%M") if e.start_time else "",
                "结束时间": e.end_time.strftime("%Y-%m-%d %H:%M") if e.end_time else "",
                "重要性": e.importance or "",
                "状态": e.status or "",
            }
        )
    return {"rows": rows, "headers": headers}
