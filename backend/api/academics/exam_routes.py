from flask_restx import Namespace, Resource, fields
from flask import request, g, send_file
from models import Exam, Score, User, Subject, get_by_id
from sqlalchemy.exc import IntegrityError
from utils.permission import requires_permission, get_current_admin, get_allowed_classes
from utils.response import APIResponse
from services.academics_service import academics_service
from services.export_service import export_service


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


ns_exam = Namespace("exams", description="考试管理相关操作")
ns_scores = Namespace("scores", description="成绩管理相关操作")
ns_score_analysis = Namespace("score-analysis", description="成绩分析相关操作")

exam_model = ns_exam.model(
    "Exam",
    {
        "id": fields.Integer(readOnly=True, description="考试ID"),
        "name": fields.String(required=True, description="考试名称"),
        "description": fields.String(description="考试描述"),
        "subjects": fields.List(fields.String, description="科目列表"),
        "start_time": fields.DateTime(required=True, description="开始时间"),
        "end_time": fields.DateTime(required=True, description="结束时间"),
        "importance": fields.String(description="重要性", default="medium"),
        "class_id": fields.Integer(description="班级ID"),
        "status": fields.String(description="状态", default="draft"),
        "created_by": fields.Integer(description="创建人ID"),
        "created_at": fields.DateTime(readOnly=True),
        "updated_at": fields.DateTime(readOnly=True),
    },
)

score_model = ns_scores.model(
    "Score",
    {
        "id": fields.Integer(readOnly=True, description="成绩ID"),
        "exam_id": fields.Integer(required=True, description="考试ID"),
        "student_id": fields.Integer(required=True, description="学生ID"),
        "subject": fields.String(description="科目（名称，可选；缺省时按 subject_id）"),
        "subject_id": fields.Integer(description="科目ID"),
        "score": fields.Float(description="分数"),
        "full_score": fields.Float(default=100, description="满分"),
        "rank": fields.Integer(description="排名"),
        "status": fields.String(description="状态", default="pending"),
        "remark": fields.String(description="备注"),
        "entered_by": fields.Integer(description="录入人ID"),
    },
)


@ns_exam.route("/")
class ExamList(Resource):
    @ns_exam.doc("list_exams", description="获取考试列表")
    @requires_permission("score.view")
    def get(self):
        class_id = request.args.get("class_id", type=int)
        status = request.args.get("status")
        query = Exam.query
        if class_id:
            query = query.filter_by(class_id=class_id)
        if status:
            query = query.filter_by(status=status)
        exams = query.order_by(Exam.start_time.desc()).all()
        return APIResponse.success(data=[e.to_dict() for e in exams])

    @ns_exam.doc("create_exam", description="创建考试")
    @ns_exam.expect(exam_model)
    @requires_permission("score.manage")
    def post(self):
        data = request.get_json(silent=True) or {}
        if not data.get("name"):
            return APIResponse.bad_request(message="考试名称 name 为必填项")
        if not data.get("date"):
            return APIResponse.bad_request(message="考试日期 date 为必填项")
        new_id = academics_service.create_exam(data)
        exam = get_by_id(Exam, new_id)
        return APIResponse.success(data=exam.to_dict(), message="创建成功")


@ns_exam.route("/<int:exam_id>")
@ns_exam.param("exam_id", "考试ID")
class ExamResource(Resource):
    @ns_exam.doc("get_exam", description="获取考试详情")
    @requires_permission("score.view")
    def get(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        return APIResponse.success(data=exam.to_dict())

    @ns_exam.doc("update_exam", description="更新考试")
    @ns_exam.expect(exam_model)
    @requires_permission("score.manage")
    def put(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        data = request.get_json()
        # R9 修复: date 分支此前不可达（key 列表未含 date）——补回使 Exam.date 可更新
        academics_service.update_exam(exam_id, data)
        exam = get_by_id(Exam, exam_id)
        return APIResponse.success(data=exam.to_dict(), message="更新成功")

    @ns_exam.doc("delete_exam", description="删除考试")
    @requires_permission("score.manage")
    def delete(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            # 幂等删除：考试已不存在视为删除成功，避免前端因缓存残留旧数据而对已删考试误报 404
            return APIResponse.success(message="考试不存在或已删除")
        # scores.exam_id 为 NOT NULL 外键，必须先清理该考试下的成绩再删除考试
        academics_service.delete_exam(exam_id)
        return APIResponse.success(message="删除成功")


@ns_exam.route("/<int:exam_id>/publish")
@ns_exam.param("exam_id", "考试ID")
class ExamPublish(Resource):
    @ns_exam.doc("publish_exam", description="发布考试（草稿→已发布）")
    @requires_permission("score.manage")
    def post(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        if exam.status == "published":
            # 已发布：幂等成功，避免前端因缓存或重复点击误报 404
            return APIResponse.success(data=exam.to_dict(), message="考试已发布")
        if exam.status != "draft":
            return APIResponse.error(message="只能发布草稿状态的考试")
        academics_service.publish_exam(exam_id)
        exam = get_by_id(Exam, exam_id)
        return APIResponse.success(data=exam.to_dict(), message="发布成功")


@ns_exam.route("/<int:exam_id>/close")
@ns_exam.param("exam_id", "考试ID")
class ExamClose(Resource):
    @ns_exam.doc("close_exam", description="结束考试（已发布→已关闭）")
    @requires_permission("score.manage")
    def post(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        if exam.status == "closed":
            # 已关闭：幂等成功
            return APIResponse.success(data=exam.to_dict(), message="考试已结束")
        if exam.status != "published":
            return APIResponse.error(message="只能关闭已发布的考试")
        academics_service.close_exam(exam_id)
        exam = get_by_id(Exam, exam_id)
        return APIResponse.success(data=exam.to_dict(), message="关闭成功")


@ns_scores.route("/")
class ScoreList(Resource):
    @ns_scores.doc("list_scores", description="获取成绩列表")
    @requires_permission("score.view")
    def get(self):
        exam_id = request.args.get("exam_id", type=int)
        student_id = request.args.get("student_id", type=int)
        subject = request.args.get("subject")
        subject_id = request.args.get("subject_id", type=int)
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
        scores = query.order_by(Score.score.desc()).all()
        return APIResponse.success(data=[s.to_dict() for s in scores])

    @ns_scores.doc("create_score", description="创建成绩")
    @ns_scores.expect(score_model)
    @requires_permission("score.manage")
    def post(self):
        data = request.get_json()
        subject_id = _resolve_subject_id(data.get("subject"), data.get("subject_id"))
        if not subject_id:
            return APIResponse.bad_request(message="缺少有效的科目（subject 或 subject_id）")
        exam = get_by_id(Exam, data.get("exam_id")) if data.get("exam_id") else None
        if not exam:
            return APIResponse.bad_request(message="考试不存在")
        # R9 修复: 已关闭考试禁止录入成绩
        if exam.status == "closed":
            return APIResponse.bad_request(message="考试已关闭，禁止录入成绩")
        score_val = data.get("score")
        full_val = data.get("full_score", 100)
        # E13 修复: 成绩范围校验（0 ~ full_score）
        if score_val is not None:
            try:
                score_val = float(score_val)
                full_val = float(full_val) if full_val else 100.0
            except (TypeError, ValueError):
                return APIResponse.bad_request(message="分数格式非法")
            if score_val < 0 or (full_val > 0 and score_val > full_val):
                return APIResponse.bad_request(message="成绩需在 0 ~ %s 之间" % full_val)
        # F4 修复: 单条创建也做 (exam_id, student_id, subject_id) 冲突检测
        existing = Score.query.filter_by(
            exam_id=exam.id, student_id=data.get("student_id"), subject_id=subject_id
        ).first()
        if existing:
            return APIResponse.bad_request(message="该学生此科目成绩已存在，请直接编辑原记录")
        try:
            new_id = academics_service.create_score(
                exam.id,
                data.get("student_id"),
                subject_id,
                score_val,
                data.get("full_score", 100),
                data.get("status", "pending"),
                data.get("remark"),
                data.get("entered_by"),
            )
        except IntegrityError:
            # R3 修复: DB 唯一约束兜底（并发窗口期重复提交）
            return APIResponse.bad_request(message="该学生此科目成绩已存在（并发重复提交），请刷新后编辑原记录")
        score = get_by_id(Score, new_id)
        return APIResponse.success(data=score.to_dict(), message="创建成功")


@ns_scores.route("/batch")
class ScoreBatch(Resource):
    @ns_scores.doc("batch_create_scores", description="批量录入成绩（支持 student_id 或 card_id 识别学生）")
    @requires_permission("score.entry")
    def post(self):
        data = request.get_json() or {}
        exam_id = data.get("exam_id")
        items = data.get("scores")
        if not exam_id:
            return APIResponse.bad_request(message="请指定 exam_id")
        if not isinstance(items, list) or not items:
            return APIResponse.bad_request(message="scores 必须为非空数组")
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        # R9 修复: 已关闭考试禁止录入成绩
        if exam.status == "closed":
            return APIResponse.bad_request(message="考试已关闭，禁止录入成绩")
        operator_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        created = 0
        errors = []
        valid = []
        for idx, item in enumerate(items):
            student_id = item.get("student_id")
            card_id = item.get("card_id")
            subject = item.get("subject")
            subject_id = _resolve_subject_id(subject, item.get("subject_id"))
            raw_score = item.get("score")
            if student_id is None and not card_id:
                errors.append({"index": idx, "message": "缺少 student_id 或 card_id"})
                continue
            if not subject_id:
                errors.append({"index": idx, "message": "缺少有效的科目（subject 或 subject_id）"})
                continue
            try:
                score_val = float(raw_score) if raw_score is not None else None
            except (TypeError, ValueError):
                errors.append({"index": idx, "message": "分数格式非法"})
                continue
            # E13 修复: 成绩范围校验（0 ~ full_score）
            full_val = item.get("full_score", 100)
            try:
                full_val = float(full_val) if full_val else 100.0
            except (TypeError, ValueError):
                errors.append({"index": idx, "message": "满分格式非法"})
                continue
            if score_val is not None and (score_val < 0 or (full_val > 0 and score_val > full_val)):
                errors.append({"index": idx, "message": "成绩需在 0 ~ %s 之间" % full_val})
                continue
            student = (
                User.query.filter_by(id=student_id, is_active=True).first()
                if student_id is not None
                else User.query.filter_by(card_id=card_id, is_active=True).first()
            )
            if not student:
                errors.append({"index": idx, "message": "学生不存在"})
                continue
            # F4 修复: 冲突检测——(exam_id, student_id, subject_id) 已存在则跳过，防重复成绩导致统计/排名失真
            existing = Score.query.filter_by(
                exam_id=exam_id, student_id=student.id, subject_id=subject_id
            ).first()
            if existing:
                errors.append({"index": idx, "message": f"学生{student.name}该科目成绩已存在，跳过（可编辑原记录）"})
                continue
            valid.append({
                "exam_id": exam_id,
                "student_id": student.id,
                "subject_id": subject_id,
                "score": score_val,
                "full_score": item.get("full_score", 100),
                "status": item.get("status", "pending"),
                "remark": item.get("remark"),
                "entered_by": operator_id,
            })
            created += 1
        if created:
            try:
                academics_service.batch_create_scores(valid)
            except IntegrityError:
                # R3 修复: 唯一约束兜底（并发窗口重复提交整批失败 → 回滚避免半提交）
                return APIResponse.error(message="批量录入失败：存在重复成绩（同学生同科目），请刷新后重试", status_code=400)
        return APIResponse.success(
            data={"created": created, "errors": errors, "total": len(items)},
            message="成功录入 %s 条，%s 条失败" % (created, len(errors)),
        )


@ns_scores.route("/<int:score_id>")
@ns_scores.param("score_id", "成绩ID")
class ScoreResource(Resource):
    @ns_scores.doc("get_score", description="获取成绩详情")
    @requires_permission("score.view")
    def get(self, score_id):
        score = get_by_id(Score, score_id)
        if not score:
            return APIResponse.not_found(message="成绩不存在")
        return APIResponse.success(data=score.to_dict())

    @ns_scores.doc("update_score", description="更新成绩")
    @ns_scores.expect(score_model)
    @requires_permission("score.manage")
    def put(self, score_id):
        score = get_by_id(Score, score_id)
        if not score:
            return APIResponse.not_found(message="成绩不存在")
        exam = get_by_id(Exam, score.exam_id)
        # R9 修复: 已关闭考试禁止修改成绩
        if exam and exam.status == "closed":
            return APIResponse.bad_request(message="考试已关闭，禁止修改成绩")
        data = request.get_json()
        try:
            academics_service.update_score(score_id, data)
        except ValueError as e:
            # E13 修复: 更新后分数格式非法 / 越界（消息逐字节保留）
            return APIResponse.bad_request(message=str(e))
        except IntegrityError:
            return APIResponse.error(message="更新失败：该学生此科目成绩已存在（唯一冲突）", status_code=400)
        score = get_by_id(Score, score_id)
        return APIResponse.success(data=score.to_dict(), message="更新成功")

    @ns_scores.doc("delete_score", description="删除成绩")
    @requires_permission("score.manage")
    def delete(self, score_id):
        score = get_by_id(Score, score_id)
        if not score:
            return APIResponse.not_found(message="成绩不存在")
        exam = get_by_id(Exam, score.exam_id)
        # R9 修复: 已关闭考试禁止删除成绩
        if exam and exam.status == "closed":
            return APIResponse.bad_request(message="考试已关闭，禁止删除成绩")
        academics_service.delete_score(score_id)
        return APIResponse.success(message="删除成功")


@ns_scores.route("/confirm-all")
class ScoreConfirmAll(Resource):
    """批量确认某次考试的所有成绩。

    前端调用路径：POST /api/scores/confirm-all，body = {exam_id: int}。
    历史脏数据兼容：status='normal'（早期前端误用字段名）一并改为 'confirmed'。
    """

    @ns_scores.doc("confirm_all_scores", description="确认某次考试的所有成绩")
    @requires_permission("score.manage")
    def post(self):
        data = request.get_json() or {}
        try:
            exam_id = int(data.get("exam_id")) if data.get("exam_id") is not None else None
        except (TypeError, ValueError):
            return APIResponse.error(message="exam_id 必须是整数")
        if not exam_id:
            return APIResponse.error(message="缺少 exam_id")
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        try:
            updated = academics_service.confirm_all_scores(exam_id)
        except Exception as e:  # noqa: BLE001
            return APIResponse.error(message=f"确认失败: {e}", code=500)
        return APIResponse.success(
            data={"exam_id": exam_id, "updated": int(updated or 0)},
            message=f"已确认 {updated} 条成绩",
        )


@ns_score_analysis.route("/exam/<int:exam_id>")
@ns_score_analysis.param("exam_id", "考试ID")
class ExamScoreAnalysis(Resource):
    @ns_score_analysis.doc("analyze_exam_scores", description="分析考试成绩")
    @requires_permission("score.view")
    def get(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        scores = Score.query.filter_by(exam_id=exam_id).all()
        if not scores:
            return APIResponse.success(data={"exam": exam.to_dict(), "analysis": None})
        total = len(scores)
        scores_list = [s.score for s in scores if s.score is not None]
        analysis = {
            "total_students": total,
            "subjects": sorted({s.subject_rel.name for s in scores if s.subject_rel}),
            "avg_score": sum(scores_list) / len(scores_list) if scores_list else 0,
            "max_score": max(scores_list) if scores_list else 0,
            "min_score": min(scores_list) if scores_list else 0,
        }
        return APIResponse.success(data={"exam": exam.to_dict(), "analysis": analysis})


@ns_score_analysis.route("/rankings/<int:exam_id>")
@ns_score_analysis.param("exam_id", "考试ID")
class ExamRankings(Resource):
    @ns_score_analysis.doc("get_rankings", description="获取考试排名")
    @requires_permission("score.view")
    def get(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            return APIResponse.not_found(message="考试不存在")
        subject = request.args.get("subject")
        subject_id = request.args.get("subject_id", type=int)
        # R9 修复: 成绩状态为 confirmed（原筛 published 与实际状态不符 → 排名恒空）
        query = Score.query.filter_by(exam_id=exam_id, status="confirmed")
        sid = _resolve_subject_id(subject, subject_id)
        if sid:
            query = query.filter_by(subject_id=sid)
        rankings = query.order_by(Score.score.desc()).all()
        result = []
        for rank, score in enumerate(rankings, 1):
            entry = score.to_dict()
            entry["rank"] = rank
            student = get_by_id(User, score.student_id)
            if student:
                entry["student_name"] = student.name
            result.append(entry)
        return APIResponse.success(data={"exam": exam.to_dict(), "rankings": result})


@ns_score_analysis.route("/student/<int:student_id>")
@ns_score_analysis.param("student_id", "学生ID")
class StudentScoreAnalysis(Resource):
    @ns_score_analysis.doc("analyze_student_scores", description="分析学生成绩")
    @requires_permission("score.view")
    def get(self, student_id):
        student = get_by_id(User, student_id)
        if not student:
            return APIResponse.not_found(message="学生不存在")
        scores = Score.query.filter_by(student_id=student_id).order_by(Score.entered_at.desc()).all()
        score_list = [s.to_dict() for s in scores]
        if score_list:
            raw_scores = [s.score for s in scores if s.score is not None]
            avg = sum(raw_scores) / len(raw_scores) if raw_scores else 0
        else:
            avg = 0
        return APIResponse.success(data={
            "student": {"id": student.id, "name": student.name, "class_name": student.class_name},
            "scores": score_list,
            "total": len(score_list),
            "avg_score": round(avg, 2),
        })


@ns_score_analysis.route("/class/<string:class_name>")
@ns_score_analysis.param("class_name", "班级名称")
class ClassScoreAnalysis(Resource):
    @ns_score_analysis.doc("analyze_class_scores", description="分析班级成绩")
    @requires_permission("score.view")
    def get(self, class_name):
        students = User.query.filter_by(class_name=class_name).all()
        if not students:
            return APIResponse.not_found(message="班级不存在")
        student_ids = [s.id for s in students]
        scores = Score.query.filter(Score.student_id.in_(student_ids)).order_by(Score.entered_at.desc()).all()
        score_list = [s.to_dict() for s in scores]
        exam_ids = set(s.exam_id for s in scores)
        exams = {e.id: e.to_dict() for e in Exam.query.filter(Exam.id.in_(exam_ids)).all()} if exam_ids else {}
        subjects = {s.subject_rel.name for s in scores if s.subject_rel}
        raw_scores = [s.score for s in scores if s.score is not None]
        return APIResponse.success(data={
            "class_name": class_name,
            "student_count": len(students),
            "scores": score_list,
            "total": len(score_list),
            "subjects": list(subjects),
            "exams": list(exams.values()),
            "avg_score": round(sum(raw_scores) / len(raw_scores), 2) if raw_scores else 0,
        })


@ns_scores.route("/export")
class ScoreExport(Resource):
    """P0-1 修复：成绩导出（原前端 /api/scores/export 后端无此端点，必 404）"""

    @ns_scores.doc("export_scores", description="导出成绩 Excel（按考试/学生/科目筛选）")
    @requires_permission("score.view")
    def get(self):
        exam_id = request.args.get("exam_id", type=int)
        if not exam_id:
            return APIResponse.bad_request(message="请指定 exam_id")
        query = Score.query.filter_by(exam_id=exam_id)
        student_id = request.args.get("student_id", type=int)
        subject_id = request.args.get("subject_id", type=int)
        if student_id:
            query = query.filter_by(student_id=student_id)
        if subject_id:
            query = query.filter_by(subject_id=subject_id)
        scores = query.order_by(Score.subject_id, Score.score.desc()).all()
        exam = Exam.query.get(exam_id)
        headers = ["学生姓名", "学号", "班级", "科目", "分数", "满分", "排名", "状态", "录入时间", "备注"]
        rows = []
        # R7: 排名列动态计算（Score.rank 列已废弃恒 None；按当前排序 1..N）
        for _idx, s in enumerate(scores, 1):
            u = s.student
            rows.append({
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
            })
        filename = "成绩导出_%s" % (exam.name if exam else exam_id)
        output = export_service.export_to_excel(rows, headers, filename)
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="scores_%s.xlsx" % exam_id,
        )


@ns_exam.route("/export")
class ExamExport(Resource):
    """P0-2 修复：考试导出（原前端 /api/exams/export 后端无此端点，必 404）"""

    @ns_exam.doc("export_exams", description="导出考试列表 Excel")
    @requires_permission("score.view")
    def get(self):
        query = Exam.query
        class_id = request.args.get("class_id", type=int)
        status = request.args.get("status")
        if class_id:
            query = query.filter_by(class_id=class_id)
        if status:
            query = query.filter_by(status=status)
        exams = query.order_by(Exam.start_time.desc()).all()
        headers = ["考试名称", "类型", "科目", "开始时间", "结束时间", "重要性", "状态"]
        rows = []
        for e in exams:
            subjects = ",".join(e.subjects) if isinstance(e.subjects, list) else (e.subjects or "")
            rows.append({
                "考试名称": e.name,
                "类型": e.exam_type or "",
                "科目": subjects,
                "开始时间": e.start_time.strftime("%Y-%m-%d %H:%M") if e.start_time else "",
                "结束时间": e.end_time.strftime("%Y-%m-%d %H:%M") if e.end_time else "",
                "重要性": e.importance or "",
                "状态": e.status or "",
            })
        output = export_service.export_to_excel(rows, headers, "考试列表导出")
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="exams.xlsx",
        )
