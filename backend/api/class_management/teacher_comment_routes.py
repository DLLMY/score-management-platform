from flask_restx import Namespace, Resource, fields
from flask import request
from services.teacher_comment_service import teacher_comment_service
from utils.permission import requires_permission
from utils.api_cache_middleware import cached_api, invalidate_cache

ns_teacher_comment = Namespace("teacher_comment", description="班主任评语管理", path="/teacher-comments")

comment_model = ns_teacher_comment.model(
    "TeacherCommentInput",
    {
        "student_id": fields.Integer(required=True),
        "term": fields.String(),
        "comment_type": fields.String(default="term"),
        "rating": fields.Integer(min=1, max=5),
        "content": fields.String(required=True),
    },
)


@ns_teacher_comment.route("")
class TeacherCommentList(Resource):
    @ns_teacher_comment.doc(
        "list_comments",
        params={
            "class_id": {"description": "班级ID（班主任隔离自动叠加）", "type": int},
            "student_id": {"description": "学生ID", "type": int},
            "term": {"description": "学期/周期"},
        },
    )
    @requires_permission("comment.view")
    @cached_api(ttl=30)
    def get(self):
        class_id = request.args.get("class_id", type=int)
        student_id = request.args.get("student_id", type=int)
        term = request.args.get("term")
        return teacher_comment_service.list_comments(
            class_id=class_id, student_id=student_id, term=term
        )

    @ns_teacher_comment.expect(comment_model)
    @requires_permission("comment.edit")
    def post(self):
        data = request.get_json()
        result = teacher_comment_service.create_comment(data)
        invalidate_cache("api:/api/teacher-comments/*")
        return result


@ns_teacher_comment.route("/<int:comment_id>")
class TeacherCommentDetail(Resource):
    @requires_permission("comment.view")
    def get(self, comment_id):
        return teacher_comment_service.get_comment(comment_id)

    @ns_teacher_comment.expect(comment_model)
    @requires_permission("comment.edit")
    def put(self, comment_id):
        data = request.get_json()
        result = teacher_comment_service.update_comment(comment_id, data)
        invalidate_cache("api:/api/teacher-comments/*")
        return result

    @requires_permission("comment.edit")
    def delete(self, comment_id):
        result = teacher_comment_service.delete_comment(comment_id)
        invalidate_cache("api:/api/teacher-comments/*")
        return result
