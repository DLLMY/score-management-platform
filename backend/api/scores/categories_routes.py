from flask_restx import Namespace, Resource, fields
from models import db, ScoreCategory, ScoreRule
from sqlalchemy import func
from utils.permission import requires_permission
from utils.response import APIResponse
from utils.api_cache_middleware import cached_api, invalidate_cache
from services.score_category_service import (
    create_category,
    update_category,
    delete_category,
)

try:
    from app import csrf_exempt
except ImportError:

    def csrf_exempt(f):
        return f


ns_score_categories = Namespace("score-categories", description="积分规则分类管理")

category_model = ns_score_categories.model(
    "Category",
    {
        "name": fields.String(required=True, description="分类名称"),
        "description": fields.String(description="分类描述"),
        "color": fields.String(description="分类颜色"),
        "is_active": fields.Boolean(description="是否启用"),
    },
)


@ns_score_categories.route("/")
class CategoryList(Resource):

    @ns_score_categories.doc("list_score_categories", security="Bearer")
    @requires_permission("rule.view")
    @cached_api(ttl=30)
    def get(self):
        categories = ScoreCategory.query.all()
        result = []
        # P3: in_ 聚合替代循环内 count（单查询 group by）
        category_ids = [c.id for c in categories]
        rule_counts = dict(
            db.session.query(ScoreRule.category_id, func.count(ScoreRule.id))
            .filter(ScoreRule.category_id.in_(category_ids), ScoreRule.is_active.is_(True))
            .group_by(ScoreRule.category_id)
            .all()
        )
        for cat in categories:
            rule_count = rule_counts.get(cat.id, 0)
            result.append(
                {
                    "id": cat.id,
                    "name": cat.name,
                    "description": cat.description,
                    "color": cat.color,
                    "is_active": cat.is_active,
                    "rule_count": rule_count,
                    "created_at": cat.created_at.isoformat() if cat.created_at else None,
                }
            )
        return APIResponse.success(data={"categories": result})

    @ns_score_categories.doc("create_score_category")
    @ns_score_categories.expect(category_model)
    @requires_permission("rule.manage")
    def post(self):
        data = ns_score_categories.payload

        category, err = create_category(data)
        if err:
            return APIResponse.error(message=err, status_code=400)
        invalidate_cache("api:/api/score-categories/*")

        return (
            APIResponse.success(
                data={
                    "category": {
                        "id": category.id,
                        "name": category.name,
                        "description": category.description,
                        "color": category.color,
                        "is_active": category.is_active,
                    }
                },
                message="分类创建成功",
            ),
            201,
        )


@ns_score_categories.route("/<int:id>")
class CategoryResource(Resource):

    @ns_score_categories.doc("get_score_category", security="Bearer")
    @requires_permission("rule.view")
    def get(self, id):
        category = ScoreCategory.query.get_or_404(id)
        rule_count = ScoreRule.query.filter_by(category_id=id, is_active=True).count()

        return {
            "success": True,
            "category": {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "color": category.color,
                "is_active": category.is_active,
                "rule_count": rule_count,
                "created_at": category.created_at.isoformat() if category.created_at else None,
            },
        }

    @ns_score_categories.doc("update_score_category")
    @ns_score_categories.expect(category_model)
    @requires_permission("rule.manage")
    def put(self, id):
        category = ScoreCategory.query.get_or_404(id)
        data = ns_score_categories.payload

        err = update_category(category, data)
        if err:
            return APIResponse.error(message=err, status_code=400)
        invalidate_cache("api:/api/score-categories/*")

        return APIResponse.success(message="分类更新成功")

    @ns_score_categories.doc("delete_score_category")
    @requires_permission("rule.manage")
    def delete(self, id):
        category = ScoreCategory.query.get_or_404(id)

        err = delete_category(category)
        if err:
            return APIResponse.error(message=err, status_code=400)
        invalidate_cache("api:/api/score-categories/*")

        return APIResponse.success(message="分类删除成功")


@ns_score_categories.route("/<int:id>/rules")
class CategoryRules(Resource):

    @ns_score_categories.doc("get_score_category_rules")
    @cached_api(ttl=30)
    def get(self, id):
        category = ScoreCategory.query.get_or_404(id)

        rules = ScoreRule.query.filter_by(category_id=id).all()

        return {
            "success": True,
            "category_name": category.name,
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "score": r.score,
                    "is_active": r.is_active,
                    "daily_limit": r.daily_limit,
                    "min_interval": r.min_interval,
                }
                for r in rules
            ],
        }
