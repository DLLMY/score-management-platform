from flask_restx import Namespace, Resource, fields
from flask import request, g
from models import db, Exam, Score, User, get_by_id, cascade_delete_related_records
from utils.permission import requires_permission
from utils.response import APIResponse
from datetime import datetime
from utils.datetime_utils import parse_date, parse_datetime

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
        "subject": fields.String(required=True, description="科目"),
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
        data = request.get_json()
        exam = Exam(
            name=data.get("name"),
            description=data.get("description"),
            date=parse_date(data.get("date")),
            subjects=data.get("subjects", []),
            start_time=parse_datetime(data.get("start_time")),
            end_time=parse_datetime(data.get("end_time")),
            importance=data.get("importance", "medium"),
            class_id=data.get("class_id"),
            status=data.get("status", "draft"),
            created_by=data.get("created_by"),
        )
        db.session.add(exam)
        db.session.commit()
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
        for key in ["name", "description", "subjects", "start_time", "end_time", "importance", "class_id", "status"]:
            if key in data:
                if key in ("start_time", "end_time"):
                    setattr(exam, key, parse_datetime(data[key]))
                elif key == "date":
                    setattr(exam, key, parse_date(data[key]))
                else:
                    setattr(exam, key, data[key])
        exam.updated_at = datetime.now()
        db.session.commit()
        return APIResponse.success(data=exam.to_dict(), message="更新成功")

    @ns_exam.doc("delete_exam", description="删除考试")
    @requires_permission("score.manage")
    def delete(self, exam_id):
        exam = get_by_id(Exam, exam_id)
        if not exam:
            # 幂等删除：考试已不存在视为删除成功，避免前端因缓存残留旧数据而对已删考试误报 404
            return APIResponse.success(message="考试不存在或已删除")
        # scores.exam_id 为 NOT NULL 外键，必须先清理该考试下的成绩再删除考试
        cascade_delete_related_records(Exam, exam_id)
        db.session.delete(exam)
        db.session.commit()
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
        exam.status = "published"
        exam.updated_at = datetime.now()
        db.session.commit()
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
        exam.status = "closed"
        exam.updated_at = datetime.now()
        db.session.commit()
        return APIResponse.success(data=exam.to_dict(), message="关闭成功")


@ns_scores.route("/")
class ScoreList(Resource):
    @ns_scores.doc("list_scores", description="获取成绩列表")
    @requires_permission("score.view")
    def get(self):
        exam_id = request.args.get("exam_id", type=int)
        student_id = request.args.get("student_id", type=int)
        subject = request.args.get("subject")
        query = Score.query
        if exam_id:
            query = query.filter_by(exam_id=exam_id)
        if student_id:
            query = query.filter_by(student_id=student_id)
        if subject:
            query = query.filter_by(subject=subject)
        scores = query.order_by(Score.score.desc()).all()
        return APIResponse.success(data=[s.to_dict() for s in scores])

    @ns_scores.doc("create_score", description="创建成绩")
    @ns_scores.expect(score_model)
    @requires_permission("score.manage")
    def post(self):
        data = request.get_json()
        score = Score(
            exam_id=data.get("exam_id"),
            student_id=data.get("student_id"),
            subject=data.get("subject"),
            score=data.get("score"),
            full_score=data.get("full_score", 100),
            status=data.get("status", "pending"),
            remark=data.get("remark"),
            entered_by=data.get("entered_by"),
        )
        db.session.add(score)
        db.session.commit()
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
        operator_id = getattr(g.current_user, "id", None) if getattr(g, "current_user", None) else None
        created = 0
        errors = []
        for idx, item in enumerate(items):
            student_id = item.get("student_id")
            card_id = item.get("card_id")
            subject = item.get("subject")
            raw_score = item.get("score")
            if student_id is None and not card_id:
                errors.append({"index": idx, "message": "缺少 student_id 或 card_id"})
                continue
            if not subject:
                errors.append({"index": idx, "message": "缺少 subject"})
                continue
            try:
                score_val = float(raw_score) if raw_score is not None else None
            except (TypeError, ValueError):
                errors.append({"index": idx, "message": "分数格式非法"})
                continue
            student = (
                User.query.filter_by(id=student_id, is_active=True).first()
                if student_id is not None
                else User.query.filter_by(card_id=card_id, is_active=True).first()
            )
            if not student:
                errors.append({"index": idx, "message": "学生不存在"})
                continue
            score = Score(
                exam_id=exam_id,
                student_id=student.id,
                subject=subject,
                score=score_val,
                full_score=item.get("full_score", 100),
                status=item.get("status", "pending"),
                remark=item.get("remark"),
                entered_by=operator_id,
            )
            db.session.add(score)
            created += 1
        if created:
            db.session.commit()
        return APIResponse.success(
            data={"created": created, "errors": errors, "total": len(items)},
            message=f"成功录入 {created} 条，{len(errors)} 条失败",
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
        data = request.get_json()
        for key in ["score", "full_score", "rank", "status", "remark"]:
            if key in data:
                setattr(score, key, data[key])
        score.updated_at = datetime.now()
        db.session.commit()
        return APIResponse.success(data=score.to_dict(), message="更新成功")

    @ns_scores.doc("delete_score", description="删除成绩")
    @requires_permission("score.manage")
    def delete(self, score_id):
        score = get_by_id(Score, score_id)
        if not score:
            return APIResponse.not_found(message="成绩不存在")
        db.session.delete(score)
        db.session.commit()
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
            updated = Score.query.filter(
                Score.exam_id == exam_id,
                Score.status.in_(["pending", "normal"]),
            ).update(
                {"status": "confirmed", "updated_at": datetime.now()},
                synchronize_session=False,
            )
            db.session.commit()
            return APIResponse.success(
                data={"exam_id": exam_id, "updated": int(updated or 0)},
                message=f"已确认 {updated} 条成绩",
            )
        except Exception as e:  # noqa: BLE001
            db.session.rollback()
            return APIResponse.error(message=f"确认失败: {e}", code=500)


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
            "subjects": list(set(s.subject for s in scores)),
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
        query = Score.query.filter_by(exam_id=exam_id, status="published")
        if subject:
            query = query.filter_by(subject=subject)
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
        subjects = set(s.subject for s in scores)
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
