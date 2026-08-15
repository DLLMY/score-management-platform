from flask import request, send_file
from flask_restx import Namespace, Resource, fields
from models import db, ScoreRule, ScoreCategory, get_by_id
from utils.permission import requires_permission
from utils.logger import log_operation
from utils.response import APIResponse
from utils.validation import (
    ValidationRules,
    validate_score,
    validate_id,
    validate_positive_int,
    validation_error_response,
)
from services.redis_cache_service import get_cache_service
from datetime import datetime
import io
import csv

ns_rules = Namespace("rules", description="积分规则相关操作")
rule_model = ns_rules.model(
    "ScoreRule",
    {
        "id": fields.Integer(readOnly=True, description="规则ID"),
        "name": fields.String(required=True, description="规则名称"),
        "description": fields.String(description="规则描述"),
        "category_id": fields.Integer(description="分类ID"),
        "score": fields.Float(required=True, description="分数（正数加分，负数扣分）"),
        "is_active": fields.Boolean(description="是否启用"),
        "daily_limit": fields.Integer(description="每日上限（0表示无限制）"),
        "min_interval": fields.Integer(description="最小间隔（秒，0表示无限制）"),
    },
)
rule_list_response = ns_rules.model(
    "RuleListResponse",
    {
        "rules": fields.List(fields.Nested(rule_model), description="规则列表"),
        "total": fields.Integer(description="总记录数"),
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "pages": fields.Integer(description="总页数"),
    },
)


@ns_rules.route("/")
class RuleList(Resource):
    @ns_rules.doc(
        "list_rules",
        description="获取积分规则列表",
        params={
            "page": "页码（默认1）",
            "per_page": "每页数量（默认100）",
            "category_id": "分类ID筛选",
            "is_active": "是否启用筛选（true/false）",
        },
    )
    @ns_rules.response(200, "成功", rule_list_response)
    @requires_permission("rule.view")
    def get(self):
        """
        获取积分规则列表
        支持分页、分类筛选和状态筛选。需要规则查看权限。
        """
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 100, type=int)
        category_id = request.args.get("category_id", type=int)
        is_active = request.args.get("is_active")
        cache_key = f"rules_list:{page}:{per_page}:{category_id}:{is_active}"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return APIResponse.success(data=cached_result)
        query = ScoreRule.query
        if category_id:
            query = query.filter(ScoreRule.category_id == category_id)
        if is_active is not None:
            query = query.filter(ScoreRule.is_active == (is_active.lower() == "true"))
        pagination = query.order_by(ScoreRule.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        result = {  # noqa: F841
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "category_id": r.category_id,
                    "category_name": r.category.name if r.category else None,
                    "score": r.score,
                    "is_active": r.is_active,
                    "daily_limit": r.daily_limit,
                    "min_interval": r.min_interval,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }
        get_cache_service().set(cache_key, result, ttl=300, tags=["rules"])
        return APIResponse.success(data=result)

    @ns_rules.doc("create_rule", description="创建积分规则", security="Bearer")
    @ns_rules.expect(rule_model)
    @ns_rules.response(201, "创建成功")
    @ns_rules.response(400, "请求参数错误")
    @requires_permission("rule.manage")
    def post(self):
        """
        创建积分规则
        创建新的积分规则，需要规则管理权限。
        请求体：
        - name: 规则名称（必填）
        - description: 规则描述
        - category_id: 分类ID
        - score: 分数（正数加分，负数扣分，必填，范围-1000到1000）
        - is_active: 是否启用（默认true）
        - daily_limit: 每日上限（0表示无限制）
        - min_interval: 最小间隔（秒，0表示无限制）
        """
        data = ns_rules.payload
        # 参数校验
        errors = []
        # 规则名称必填校验
        if not data.get("name") or not data.get("name").strip():
            errors.append("规则名称不能为空")
        # 规则名称长度校验
        if data.get("name") and len(data.get("name")) > ValidationRules.NAME_MAX_LEN:
            errors.append(f"规则名称长度不能超过{ValidationRules.NAME_MAX_LEN}个字符")
        # 描述长度校验
        description = data.get("description")
        if description and len(description) > ValidationRules.DESCRIPTION_MAX_LEN:
            errors.append(f"规则描述长度不能超过{ValidationRules.DESCRIPTION_MAX_LEN}个字符")
        # 分数校验
        score = data.get("score")
        if score is None:
            errors.append("分数不能为空")
        else:
            is_valid, error_msg = validate_score(score)
            if not is_valid:
                errors.append(f"分数: {error_msg}")
        # 分类ID校验
        category_id = data.get("category_id")
        if category_id is not None:
            is_valid, error_msg = validate_id(category_id)
            if not is_valid:
                errors.append(f"分类ID: {error_msg}")
            else:
                # 检查分类是否存在
                category = get_by_id(ScoreCategory, category_id)
                if not category:
                    errors.append(f"分类ID {category_id} 不存在")
        # 每日上限校验（兼容旧字段 max_per_day）
        daily_limit = data.get("daily_limit", data.get("max_per_day", 0))
        if daily_limit is not None:
            is_valid, error_msg = validate_positive_int(daily_limit)
            if not is_valid and daily_limit != 0:
                errors.append("每日上限必须为正整数或0")
        # 最小间隔校验
        min_interval = data.get("min_interval", 0)
        if min_interval is not None:
            is_valid, error_msg = validate_positive_int(min_interval)
            if not is_valid and min_interval != 0:
                errors.append("最小间隔必须为正整数或0")
        if errors:
            return validation_error_response(errors)
        rule = ScoreRule(
            name=data.get("name").strip(),
            description=data.get("description"),
            category_id=data.get("category_id"),
            score=float(data.get("score")),
            is_active=data.get("is_active", True),
            daily_limit=int(data.get("daily_limit", data.get("max_per_day", 0))),
            min_interval=int(data.get("min_interval", 0)),
        )
        db.session.add(rule)
        db.session.commit()
        log_operation(
            "rule.create",
            "rule",
            rule.id,
            f"创建积分规则: {rule.name}",
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("rules")
        return APIResponse.success(
            data={
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "category_id": rule.category_id,
                "score": rule.score,
                "is_active": rule.is_active,
                "daily_limit": rule.daily_limit,
                "min_interval": rule.min_interval,
            },
            message="规则创建成功",
            status_code=201,
        )


@ns_rules.route("/<int:id>")
@ns_rules.param("id", "规则ID")
class RuleResource(Resource):
    @ns_rules.doc("get_rule", description="获取单个规则详情")
    @ns_rules.response(200, "成功", rule_model)
    @ns_rules.response(404, "规则不存在")
    @requires_permission("rule.view")
    def get(self, id):
        """
        获取单个规则详情
        根据规则ID获取规则的详细信息。需要规则查看权限。
        """
        cache_key = f"rule:{id}"
        cached_result = get_cache_service().get(cache_key)
        if cached_result is not None:
            return APIResponse.success(data=cached_result)
        rule = ScoreRule.query.get_or_404(id)
        result = {  # noqa: F841
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "category_id": rule.category_id,
            "category_name": rule.category.name if rule.category else None,
            "score": rule.score,
            "is_active": rule.is_active,
            "daily_limit": rule.daily_limit,
            "min_interval": rule.min_interval,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
            "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
        }
        get_cache_service().set(cache_key, result, ttl=300, tags=["rules"])
        return APIResponse.success(data=result)

    @ns_rules.doc("update_rule", description="更新规则", security="Bearer")
    @ns_rules.expect(rule_model)
    @ns_rules.response(200, "更新成功")
    @ns_rules.response(404, "规则不存在")
    @requires_permission("rule.manage")
    def put(self, id):
        """
        更新规则
        更新指定规则的信息，需要规则管理权限。
        """
        rule = ScoreRule.query.get_or_404(id)
        data = ns_rules.payload
        rule.name = data.get("name", rule.name)
        rule.description = data.get("description", rule.description)
        rule.category_id = data.get("category_id", rule.category_id)
        rule.score = data.get("score", rule.score)
        rule.is_active = data.get("is_active", rule.is_active)
        rule.daily_limit = data.get("daily_limit", data.get("max_per_day", rule.daily_limit))
        rule.min_interval = data.get("min_interval", rule.min_interval)
        rule.updated_at = datetime.now()
        db.session.commit()
        log_operation(
            "rule.update",
            "rule",
            rule.id,
            f"更新积分规则: {rule.name}",
            before_data={
                "name": data.get("name", rule.name),
                "score": data.get("score", rule.score),
                "is_active": data.get("is_active", rule.is_active),
            },
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("rules")
        return APIResponse.success(message="规则更新成功")

    @ns_rules.doc("delete_rule", description="删除规则", security="Bearer")
    @ns_rules.response(200, "删除成功")
    @ns_rules.response(404, "规则不存在")
    @requires_permission("rule.manage")
    def delete(self, id):
        """
        删除规则
        删除指定的规则，需要规则管理权限。
        """
        rule = ScoreRule.query.get_or_404(id)
        _deleted_name = rule.name
        db.session.delete(rule)
        db.session.commit()
        log_operation("rule.delete", "rule", id, f"删除积分规则: {_deleted_name}")
        get_cache_service().invalidate_by_tag("rules")
        return APIResponse.success(message="规则删除成功")


@ns_rules.route("/export")
class RuleExport(Resource):
    @ns_rules.doc("export_rules", description="导出规则列表", security="Bearer")
    @requires_permission("report.export")
    def get(self):
        """
        导出规则列表
        将所有规则导出为CSV文件，需要报表导出权限。
        """
        rules = ScoreRule.query.all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["规则名称", "描述", "分类", "分数", "是否启用", "每日上限", "最小间隔"])
        for rule in rules:
            writer.writerow(
                [
                    rule.name,
                    rule.description,
                    rule.category.name if rule.category else "",
                    rule.score,
                    "是" if rule.is_active else "否",
                    rule.daily_limit,
                    rule.min_interval,
                ]
            )
        output.seek(0)
        from flask import send_file

        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name=f'rules_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv',
        )


@ns_rules.route("/import")
class RuleImport(Resource):
    @ns_rules.doc("import_rules", description="批量导入规则", security="Bearer")
    @requires_permission("rule.manage")
    def post(self):
        """
        批量导入规则
        批量导入规则数据，需要管理员权限。
        请求体：
        - rules: 规则数据列表
        """
        data = request.get_json()
        rules_data = data.get("rules", [])
        if not rules_data:
            return APIResponse.error(message="没有导入数据", status_code=400)
        imported_count = 0
        error_count = 0
        errors = []
        messages = []
        existing_names = set(r.name for r in ScoreRule.query.all())
        for idx, rule_data in enumerate(rules_data):
            try:
                row_errors = []
                row_data = rule_data.copy()
                name = rule_data.get("name")
                if not name:
                    row_errors.append({"field": "name", "message": "规则名称不能为空"})
                elif not isinstance(name, str) or len(str(name).strip()) == 0:
                    row_errors.append({"field": "name", "message": "规则名称格式无效，必须为非空字符串"})
                elif len(str(name).strip()) > 100:
                    row_errors.append({"field": "name", "message": "规则名称长度超过限制（最大100字符）"})
                if name:
                    name_str = str(name).strip()
                    if name_str in existing_names:
                        row_errors.append({"field": "name", "message": f'规则名称"{name_str}"已存在'})
                score = rule_data.get("score")
                if score is None:
                    row_errors.append({"field": "score", "message": "分数不能为空"})
                else:
                    try:
                        score_float = float(score)
                    except (ValueError, TypeError):
                        row_errors.append({"field": "score", "message": f'分数"{score}"不是有效的数值'})
                category_id = rule_data.get("category_id")
                if category_id is not None:
                    try:
                        category_id_int = int(category_id)
                        if category_id_int > 0:
                            category = get_by_id(ScoreCategory, category_id_int)
                            if not category:
                                row_errors.append(
                                    {"field": "category_id", "message": f'分类ID"{category_id_int}"不存在'}
                                )
                    except (ValueError, TypeError):
                        row_errors.append({"field": "category_id", "message": f'分类ID"{category_id}"不是有效的整数'})
                daily_limit = rule_data.get("daily_limit", 0)
                try:
                    daily_limit_int = int(daily_limit)
                    if daily_limit_int < 0:
                        row_errors.append({"field": "daily_limit", "message": "每日上限不能为负数"})
                except (ValueError, TypeError):
                    row_errors.append({"field": "daily_limit", "message": f'每日上限"{daily_limit}"不是有效的整数'})
                min_interval = rule_data.get("min_interval", 0)
                try:
                    min_interval_int = int(min_interval)
                    if min_interval_int < 0:
                        row_errors.append({"field": "min_interval", "message": "最小间隔不能为负数"})
                except (ValueError, TypeError):
                    row_errors.append({"field": "min_interval", "message": f'最小间隔"{min_interval}"不是有效的整数'})
                if row_errors:
                    error_count += 1
                    error_msg = "; ".join([f'{err["field"]}: {err["message"]}' for err in row_errors])
                    errors.append(
                        {
                            "row": idx + 1,
                            "message": error_msg,
                            "row_data": row_data,
                            "error_fields": [err["field"] for err in row_errors],
                        }
                    )
                    messages.append(
                        {
                            "name": str(name) if name else "未知",
                            "action": "failed",
                            "message": error_msg,
                            "row_data": row_data,
                            "error_fields": [err["field"] for err in row_errors],
                        }
                    )
                    continue
                name_str = str(name).strip()
                score_float = float(score)
                category_id_int = int(category_id) if category_id is not None else None
                daily_limit_int = int(daily_limit)
                min_interval_int = int(min_interval)
                rule = ScoreRule(
                    name=name_str,
                    description=str(rule_data.get("description", "")).strip(),
                    category_id=category_id_int,
                    score=score_float,
                    is_active=bool(rule_data.get("is_active", True)),
                    daily_limit=daily_limit_int,
                    min_interval=min_interval_int,
                )
                db.session.add(rule)
                imported_count += 1
                existing_names.add(name_str)
                messages.append({"name": name_str, "action": "created", "message": f'规则"{name_str}"导入成功'})
            except Exception as e:
                error_count += 1
                error_msg = str(e)
                errors.append({"row": idx + 1, "message": error_msg, "row_data": rule_data, "error_fields": ["system"]})
                messages.append(
                    {
                        "name": rule_data.get("name", "未知"),
                        "action": "failed",
                        "message": error_msg,
                        "row_data": rule_data,
                        "error_fields": ["system"],
                    }
                )
        db.session.commit()
        return APIResponse.success(
            data={
                "total": len(rules_data),
                "success_count": imported_count,
                "failed_count": error_count,
                "errors": errors,
                "messages": messages,
            },
            message=f"导入完成: 成功{imported_count}条, 失败{error_count}条",
        )


@ns_rules.route("/template/download")
class RuleTemplate(Resource):
    @ns_rules.doc("download_rule_template", security="Bearer")
    @requires_permission("rule.view")
    def get(self):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["规则名称", "描述", "分类ID", "分数", "是否启用", "每日上限", "最小间隔"])
        writer.writerow(["作业完成", "完成家庭作业", "1", "5", "是", "3", "60"])
        writer.writerow(["迟到", "上学迟到", "2", "-2", "是", "0", "0"])
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name="rule_import_template.csv",
        )


RULE_TEMPLATES = [
    {
        "id": "classroom_positive",
        "name": "课堂表现（加分）",
        "description": "课堂上表现优秀的加分规则",
        "rules": [
            {
                "name": "积极回答问题",
                "description": "课堂上主动举手并正确回答问题",
                "score": 2,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "课堂纪律好",
                "description": "整节课保持良好纪律，无违纪行为",
                "score": 3,
                "daily_limit": 3,
                "min_interval": 0,
            },
            {
                "name": "认真听讲",
                "description": "上课专注听讲，不做小动作",
                "score": 1,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "帮助同学",
                "description": "主动帮助同学解答学习问题",
                "score": 3,
                "daily_limit": 3,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "homework",
        "name": "作业管理",
        "description": "与家庭作业相关的积分规则",
        "rules": [
            {
                "name": "按时完成作业",
                "description": "在规定时间前完成并提交作业",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "作业优秀",
                "description": "作业完成质量高，获得优秀评价",
                "score": 3,
                "daily_limit": 3,
                "min_interval": 0,
            },
            {
                "name": "未完成作业",
                "description": "未在规定时间内完成作业",
                "score": -5,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {
                "name": "作业抄袭",
                "description": "抄袭他人作业或答案",
                "score": -10,
                "daily_limit": 0,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "discipline",
        "name": "纪律管理",
        "description": "日常纪律和行为规范相关规则",
        "rules": [
            {"name": "迟到", "description": "上课或集会迟到", "score": -2, "daily_limit": 0, "min_interval": 0},
            {"name": "早退", "description": "未经允许提前离开", "score": -3, "daily_limit": 0, "min_interval": 0},
            {"name": "旷课", "description": "无故缺课或逃课", "score": -10, "daily_limit": 0, "min_interval": 0},
            {
                "name": "打架斗殴",
                "description": "与同学发生肢体冲突",
                "score": -20,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {"name": "说脏话", "description": "使用不文明语言", "score": -3, "daily_limit": 0, "min_interval": 0},
        ],
    },
    {
        "id": "hygiene",
        "name": "卫生管理",
        "description": "班级和个人卫生相关规则",
        "rules": [
            {
                "name": "值日认真",
                "description": "认真完成值日工作，保持教室整洁",
                "score": 2,
                "daily_limit": 1,
                "min_interval": 0,
            },
            {
                "name": "乱扔垃圾",
                "description": "在教室或校园内乱扔垃圾",
                "score": -3,
                "daily_limit": 0,
                "min_interval": 0,
            },
            {"name": "个人卫生差", "description": "个人卫生不达标", "score": -2, "daily_limit": 0, "min_interval": 0},
        ],
    },
    {
        "id": "activity",
        "name": "活动参与",
        "description": "课外活动和比赛相关规则",
        "rules": [
            {
                "name": "参加活动",
                "description": "积极参加学校组织的各类活动",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {
                "name": "比赛获奖",
                "description": "在各类比赛中获得奖项",
                "score": 10,
                "daily_limit": 10,
                "min_interval": 0,
            },
            {
                "name": "好人好事",
                "description": "主动做好事，帮助他人",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
        ],
    },
    {
        "id": "exam",
        "name": "考试评价",
        "description": "考试成绩和进步相关规则",
        "rules": [
            {
                "name": "考试进步",
                "description": "考试成绩比上次有明显进步",
                "score": 5,
                "daily_limit": 5,
                "min_interval": 0,
            },
            {"name": "考试满分", "description": "考试获得满分", "score": 10, "daily_limit": 10, "min_interval": 0},
            {"name": "考试作弊", "description": "在考试中作弊", "score": -20, "daily_limit": 0, "min_interval": 0},
        ],
    },
]


@ns_rules.route("/templates")
class RuleTemplates(Resource):
    @ns_rules.doc("list_rule_templates", description="获取预设规则模板列表", security="Bearer")
    @ns_rules.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        """
        获取预设规则模板列表
        返回系统预设的积分规则模板，包含课堂表现、作业管理、纪律管理等多个类别。
        """
        return APIResponse.success(data={"templates": RULE_TEMPLATES})


apply_template_model = ns_rules.model(
    "ApplyTemplate",
    {
        "template_id": fields.String(required=True, description="模板ID"),
        "category_id": fields.Integer(description="分类ID（可选，默认创建新分类）"),
    },
)


@ns_rules.route("/templates/apply")
class ApplyRuleTemplate(Resource):
    @ns_rules.doc("apply_rule_template", description="应用预设规则模板")
    @ns_rules.expect(apply_template_model)
    @ns_rules.response(200, "成功")
    @requires_permission("rule.manage")
    def post(self):
        """
        应用预设规则模板
        根据模板ID批量创建积分规则。如果指定了分类ID，则将所有规则归入该分类；
        否则会自动创建一个与模板同名的新分类。
        """
        data = request.get_json()
        template_id = data.get("template_id")
        category_id = data.get("category_id")
        if not template_id:
            return APIResponse.error(message="模板ID不能为空", status_code=400)
        template = next((t for t in RULE_TEMPLATES if t["id"] == template_id), None)
        if not template:
            return APIResponse.error(message="模板不存在", status_code=404)
        try:
            # 如果没有指定分类ID，创建新分类
            if not category_id:
                category = ScoreCategory.query.filter_by(name=template["name"]).first()
                if not category:
                    category = ScoreCategory(
                        name=template["name"], description=template["description"], color="#4A90D9"
                    )
                    db.session.add(category)
                    db.session.flush()
                category_id = category.id
            else:
                category = get_by_id(ScoreCategory, data.get("category_id"))
                if not category:
                    return APIResponse.error(message="指定的分类不存在", status_code=400)
                category_id = category.id
            created_rules = []
            for rule_data in template["rules"]:
                # 检查规则是否已存在（同名同分类）
                existing = ScoreRule.query.filter_by(name=rule_data["name"], category_id=category_id).first()
                if not existing:
                    rule = ScoreRule(
                        name=rule_data["name"],
                        description=rule_data["description"],
                        category_id=category_id,
                        score=rule_data["score"],
                        is_active=True,
                        daily_limit=rule_data.get("daily_limit", 0),
                        min_interval=rule_data.get("min_interval", 0),
                    )
                    db.session.add(rule)
                    created_rules.append(rule_data["name"])
            db.session.commit()
            # 清除所有rules相关缓存
            invalidated_count = get_cache_service().invalidate_by_tag("rules")
            print(f"[Cache] 模板应用后失效了 {invalidated_count} 个rules标签缓存")
            return APIResponse.success(
                data={"created_count": len(created_rules), "created_rules": created_rules, "category_id": category_id},
                message=f"成功应用模板，创建了 {len(created_rules)} 条规则",
            )
        except Exception as e:
            db.session.rollback()
            return APIResponse.error(message=f"应用模板失败: {str(e)}", status_code=500)


@ns_rules.route("/statistics")
class RuleStatistics(Resource):
    @ns_rules.doc("rule_statistics", description="获取规则使用统计", security="Bearer")
    @ns_rules.response(200, "成功")
    @requires_permission("rule.view")
    def get(self):
        """
        获取规则使用统计
        返回各规则的被使用次数、最近使用时间等信息，帮助了解规则的使用情况。
        """
        from models import ScoreRecord
        from sqlalchemy import func

        # 按规则分组统计使用次数
        stats = (
            db.session.query(
                ScoreRecord.rule_id,
                func.count(ScoreRecord.id).label("usage_count"),
                func.max(ScoreRecord.created_at).label("last_used_at"),
                func.sum(ScoreRecord.score_change).label("total_score_change"),
            )
            .filter(ScoreRecord.rule_id.isnot(None))
            .group_by(ScoreRecord.rule_id)
            .all()
        )
        # 构建规则ID到统计信息的映射
        rule_stats = {}
        for stat in stats:
            rule_stats[stat.rule_id] = {
                "usage_count": stat.usage_count,
                "last_used_at": stat.last_used_at.isoformat() if stat.last_used_at else None,
                "total_score_change": float(stat.total_score_change) if stat.total_score_change else 0,
            }
        # 获取规则详情并关联统计
        rules = ScoreRule.query.all()
        result = []  # noqa: F841
        for rule in rules:
            stat = rule_stats.get(rule.id, {"usage_count": 0, "last_used_at": None, "total_score_change": 0})
            result.append(
                {
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "score": rule.score,
                    "is_active": rule.is_active,
                    "category_id": rule.category_id,
                    "category_name": rule.category.name if rule.category else None,
                    "usage_count": stat["usage_count"],
                    "last_used_at": stat["last_used_at"],
                    "total_score_change": stat["total_score_change"],
                }
            )
        # 按使用次数排序
        result.sort(key=lambda x: x["usage_count"], reverse=True)
        # 计算总计
        total_usage = sum(r["usage_count"] for r in result)
        total_score = sum(r["total_score_change"] for r in result)
        return APIResponse.success(
            data={
                "statistics": result,
                "summary": {
                    "total_rules": len(result),
                    "active_rules": sum(1 for r in result if r["is_active"]),
                    "total_usage_count": total_usage,
                    "total_score_change": total_score,
                    "most_used_rule": result[0]["name"] if result and result[0]["usage_count"] > 0 else None,
                },
            }
        )
