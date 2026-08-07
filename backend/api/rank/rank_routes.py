"""积分排行榜接口

班主任/老师视角（权限 score.view，teacher 已持有），复用 analysis_service 的排名方法。
与 Admin 体系内的 /api/analysis/* 端点（权限 algorithm.view）区分：本命名空间专门服务于
「积分排行榜」业务功能，避免为班主任开放算法分析权限。
"""
from flask_restx import Namespace, Resource
from flask import request
from services.analysis_service import analysis_service
from utils.permission import requires_permission
from utils.response import APIResponse

ns_rank = Namespace("rank", description="积分排行榜相关操作")


@ns_rank.route("/student")
class StudentRankBoard(Resource):
    @ns_rank.doc("rank_student", description="学生积分排行榜（按班级或全校）")
    @ns_rank.param("class_name", "班级名称(可选，不填则全校)")
    @ns_rank.param("sort_by", "排序字段(score/unlock_count)")
    @ns_rank.param("order", "排序方向(desc/asc)")
    @ns_rank.param("limit", "返回数量限制")
    @requires_permission("score.view")
    def get(self):
        class_name = request.args.get("class_name")
        sort_by = request.args.get("sort_by", "score")
        order = request.args.get("order", "desc")
        try:
            limit = int(request.args.get("limit", 50))
        except (ValueError, TypeError):
            limit = 50
        data = analysis_service.get_student_ranking(class_name, sort_by, order, limit)
        return APIResponse.success(data=data)


@ns_rank.route("/class")
class ClassRankBoard(Resource):
    @ns_rank.doc("rank_class", description="班级积分排行榜")
    @ns_rank.param("sort_by", "排序字段(total_score/avg_score/unlock_count)")
    @ns_rank.param("order", "排序方向(desc/asc)")
    @ns_rank.param("limit", "返回数量限制")
    @requires_permission("score.view")
    def get(self):
        sort_by = request.args.get("sort_by", "total_score")
        order = request.args.get("order", "desc")
        try:
            limit = int(request.args.get("limit", 20))
        except (ValueError, TypeError):
            limit = 20
        data = analysis_service.get_class_ranking(sort_by, order, limit)
        return APIResponse.success(data=data)
