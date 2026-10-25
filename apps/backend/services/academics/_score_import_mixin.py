"""成绩导入：execute_score_import + 列定位/字段解析/行落库三助手。"""

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


def _locate_score_columns(headers):
    from services.score_import_helper import ScoreImportHelper

    return {
        "card_id": ScoreImportHelper.find_column_index(headers, "card_id"),
        "subject": ScoreImportHelper.find_column_index(headers, "subject"),
        "score": ScoreImportHelper.find_column_index(headers, "score"),
        "full_score": ScoreImportHelper.find_column_index(headers, "full_score"),
        "remark": ScoreImportHelper.find_column_index(headers, "remark"),
    }

def _parse_score_fields(row_data, headers, indices):
    from services.score_import_helper import ScoreImportHelper, _resolve_subject_id

    card_id_idx = indices["card_id"]
    subject_idx = indices["subject"]
    score_idx = indices["score"]
    full_score_idx = indices["full_score"]
    remark_idx = indices["remark"]
    card_id = (
        str(row_data.get(headers[card_id_idx], "")).strip()
        if card_id_idx >= 0 and row_data.get(headers[card_id_idx])
        else None
    )
    subject = row_data.get(headers[subject_idx]) if subject_idx >= 0 else None
    subject_id = _resolve_subject_id(subject, None)
    score_val = (
        ScoreImportHelper.parse_score_value(row_data.get(headers[score_idx]))
        if score_idx >= 0
        else None
    )
    full_score = (
        ScoreImportHelper.parse_score_value(row_data.get(headers[full_score_idx]))
        if full_score_idx >= 0
        else 100
    )
    remark = (
        str(row_data.get(headers[remark_idx], "")).strip()
        if remark_idx >= 0 and row_data.get(headers[remark_idx])
        else None
    )
    return {
        "card_id": card_id,
        "subject": subject,
        "subject_id": subject_id,
        "score_val": score_val,
        "full_score": full_score,
        "remark": remark,
    }

def _apply_score_row(parsed, row_num, validate_score, entered_by, exam_id, update_existing):
    from services.score_import_helper import ScoreImportHelper

    card_id = parsed["card_id"]
    subject = parsed["subject"]
    subject_id = parsed["subject_id"]
    score_val = parsed["score_val"]
    full_score = parsed["full_score"]
    remark = parsed["remark"]

    if not card_id or not subject:
        return {"status": "failed", "message": f"行{row_num}: 必需字段为空"}
    if subject_id is None:
        return {"status": "failed", "message": f"行{row_num}: 科目「{subject}」未配置"}
    student = User.query.filter_by(card_id=card_id).first()
    if not student:
        return {"status": "failed", "message": f"行{row_num}: 学号{card_id}不存在"}
    if validate_score:
        is_valid, msg = ScoreImportHelper.validate_score_range(score_val, full_score)
        if not is_valid:
            return {"status": "failed", "message": f"行{row_num}: {student.name}-{subject} - {msg}"}
    existing_score = Score.query.filter_by(
        exam_id=exam_id, student_id=student.id, subject_id=subject_id
    ).first()
    result = {"status": "ok", "insert": 0, "update": 0}
    if existing_score:
        if update_existing:
            existing_score.score = score_val
            existing_score.full_score = full_score
            existing_score.remark = remark
            existing_score.status = "pending"
            existing_score.entered_by = entered_by
            result["update"] = 1
        else:
            return {"status": "failed", "message": f"行{row_num}: {student.name}-{subject}已存在"}
    else:
        score = Score(
            exam_id=exam_id,
            student_id=student.id,
            subject_id=subject_id,
            score=score_val,
            full_score=full_score,
            remark=remark,
            status="pending",
            entered_by=entered_by,
        )
        db.session.add(score)
        result["insert"] = 1
    return result


class _ScoreImportMixin:
    def execute_score_import(
        self, exam_id, entered_by, update_existing, validate_score, parsed_rows, headers
    ):
        """执行成绩导入写入，返回统计 dict。调用方（路由）负责 exam 存在/已发布校验与文件解析。

        行为与原 ExecuteImport.post 内联逻辑逐字节一致：逐行解析、按 (exam_id, student_id,
        subject_id) 去重 upsert；整段 commit，异常由路由外层捕获后 rollback 回 500。
        """
        indices = _locate_score_columns(headers)
        success_count = 0
        update_count = 0
        insert_count = 0
        failed_count = 0
        errors = []

        for i, row_data in enumerate(parsed_rows):
            try:
                parsed = _parse_score_fields(row_data, headers, indices)
                res = _apply_score_row(
                    parsed, i + 2, validate_score, entered_by, exam_id, update_existing
                )
                if res["status"] == "failed":
                    failed_count += 1
                    errors.append(res["message"])
                    continue
                update_count += res["update"]
                insert_count += res["insert"]
                success_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"行{i+2}: {e!s}")

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        return {
            "imported_count": success_count,
            "insert_count": insert_count,
            "update_count": update_count,
            "failed_count": failed_count,
            "errors": errors[:50],
        }
