"""积分排行榜接口

班主任/老师视角（权限 score.view，teacher 已持有），复用 analysis_service 的排名方法。
与 Admin 体系内的 /api/analysis/* 端点（权限 algorithm.view）区分：本命名空间专门服务于
「积分排行榜」业务功能，避免为班主任开放算法分析权限。

⚠️ 与 `api/scores/rank_routes.py`（"排名规则" CRUD）**不是同一模块**，仅文件名同名：
  - 本文件  = 排行榜展示（学生/班级排名，权限 score.view，analysis_service 计算）
  - 那个文件 = 排名规则管理（段位阈值/颜色/图标 CRUD，权限 rule.view / undefined）
两者 Namespace 不同（`rank` vs `rank-rules`）、URL 前缀不同（`/api/rank/*` vs `/api/rank-rules/*`），不合并。
"""

from flask_restx import Namespace, Resource
from flask import request
from services.analysis_service import analysis_service
from utils.permission import requires_permission
from utils.response import APIResponse
from utils.params import get_int_arg
from utils.decorators import safe_handle
from utils.api_cache_middleware import cached_api

ns_rank = Namespace("rank", description="积分排行榜相关操作")


@ns_rank.route("/student")
class StudentRankBoard(Resource):
    @safe_handle()
    @ns_rank.doc("rank_student", description="学生积分排行榜（按班级或全校）")
    @ns_rank.param("class_name", "班级名称(可选，不填则全校)")
    @ns_rank.param("sort_by", "排序字段(score/unlock_count)")
    @ns_rank.param("order", "排序方向(desc/asc)")
    @ns_rank.param("limit", "返回数量限制")
    @requires_permission("score.view")
    @cached_api(ttl=60)  # F13: 班级排行高频读缓存
    def get(self):
        class_name = request.args.get("class_name")
        sort_by = request.args.get("sort_by", "score")
        order = request.args.get("order", "desc")
        limit = get_int_arg("limit", default=50)
        data = analysis_service.get_student_ranking(class_name, sort_by, order, limit)
        return APIResponse.success(data=data)


@ns_rank.route("/class")
class ClassRankBoard(Resource):
    @safe_handle()
    @ns_rank.doc("rank_class", description="班级积分排行榜")
    @ns_rank.param("sort_by", "排序字段(total_score/avg_score/unlock_count)")
    @ns_rank.param("order", "排序方向(desc/asc)")
    @ns_rank.param("limit", "返回数量限制")
    @requires_permission("score.view")
    def get(self):
        sort_by = request.args.get("sort_by", "total_score")
        order = request.args.get("order", "desc")
        limit = get_int_arg("limit", default=20)
        data = analysis_service.get_class_ranking(sort_by, order, limit)
        return APIResponse.success(data=data)
