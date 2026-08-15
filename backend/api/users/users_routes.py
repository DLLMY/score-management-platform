from flask import request, send_file
from utils.response import APIResponse
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from models import db, User, ClassInfo, get_by_id, cascade_delete_user_related_records
from utils.permission import requires_permission, get_current_admin, get_admin_class_ids, get_allowed_classes
from utils.logger import log_operation
from utils.validation import (
    ValidationRules,
    validate_card_id,
    validate_phone,
    validate_score,
    validate_student_id,
    validate_name,
    validation_error_response,
)
from services.redis_cache_service import get_cache_service
from services.class_time_checker import ClassTimeChecker
from datetime import datetime
import io
import csv
import logging
from pypinyin import lazy_pinyin
import io
from flask_restx import Namespace, Resource, fields

logger = logging.getLogger(__name__)

limiter = Limiter(get_remote_address)
ns_users = Namespace("users", description="学生管理相关操作")
login_model = ns_users.model(
    "StudentLogin",
    {
        "username": fields.String(required=True, description="用户名"),
        "password": fields.String(required=True, description="密码"),
    },
)
user_model = ns_users.model(
    "User",
    {
        "id": fields.Integer(readOnly=True, description="学生ID"),
        "name": fields.String(required=True, description="学生姓名"),
        "gender": fields.String(description="性别"),
        "class_name": fields.String(description="班级"),
        "phone": fields.String(description="联系电话"),
        "father_name": fields.String(description="父亲姓名"),
        "father_phone": fields.String(description="父亲电话"),
        "mother_name": fields.String(description="母亲姓名"),
        "mother_phone": fields.String(description="母亲电话"),
        "guardian_name": fields.String(description="监护人姓名"),
        "guardian_phone": fields.String(description="监护人电话"),
        "guardian_relation": fields.String(description="监护关系"),
        "card_id": fields.String(description="卡片ID"),
        "current_score": fields.Float(description="当前积分"),
    },
)
user_list_response = ns_users.model(
    "UserListResponse",
    {
        "users": fields.List(fields.Nested(user_model), description="用户列表"),
        "total": fields.Integer(description="总记录数"),
        "page": fields.Integer(description="当前页码"),
        "per_page": fields.Integer(description="每页数量"),
        "pages": fields.Integer(description="总页数"),
    },
)
batch_score_model = ns_users.model(
    "BatchScoreRequest",
    {
        "ids": fields.List(fields.Integer, required=True, description="用户ID列表"),
        "score_change": fields.Integer(required=True, description="积分变化量"),
        "description": fields.String(description="操作描述"),
    },
)


def get_classes_for_admin(admin):
    """获取管理员可以访问的班级名称列表。返回None表示可以访问所有班级。"""
    if not admin or admin.role in ("admin", "super_admin"):
        return None
    class_ids = get_admin_class_ids(admin.id)
    if class_ids:
        classes = ClassInfo.query.filter(ClassInfo.id.in_(class_ids)).all()
        return [c.name for c in classes]
    return []


def _can_access_user(user_id):
    """检查当前管理员是否有权限操作指定学生"""
    admin = get_current_admin()
    if not admin:
        return False
    allowed_classes = get_allowed_classes(admin.id)
    if allowed_classes is None:
        return True
    user = get_by_id(User, user_id)
    if not user:
        return False
    return user.class_name in allowed_classes


@ns_users.route("/")
class UserList(Resource):
    @ns_users.doc(
        "list_users",
        description="获取学生列表",
        security="Bearer",
        params={
            "page": "页码，默认1",
            "per_page": "每页数量，默认100",
            "search": "搜索关键词（姓名、学号、电话）",
            "class_name": "班级名称筛选",
        },
    )
    @ns_users.response(200, "成功", user_list_response)
    @requires_permission("student.view")
    def get(self):
        """
        获取学生列表
        根据权限返回学生列表。超级管理员可以查看所有学生，教师只能查看所属班级的学生。
        查询参数：
        - page: 页码（默认1）
        - per_page: 每页数量（默认100）
        - search: 搜索关键词，匹配姓名、卡号、电话
        - class_name: 班级名称筛选
        返回分页结果，包含用户列表和分页信息。
        """
        admin = get_current_admin()
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 100, type=int)
        search = request.args.get("search", "")
        class_name = request.args.get("class_name", "")
        class_id = request.args.get("class_id", type=int)
        skip_cache = request.args.get("skip_cache", "false").lower() == "true"
        # 高级筛选参数
        keyword = request.args.get("keyword", "")
        min_score = request.args.get("min_score", type=int)
        max_score = request.args.get("max_score", type=int)
        sort_by = request.args.get("sort_by", "name")
        sort_order = request.args.get("sort_order", "asc")
        # 缓存键包含所有筛选参数，处理admin为None和admin.role为None的情况
        admin_role = admin.role if admin and admin.role else "anonymous"
        cache_key = (
            f"users_list:{admin_role}:{page}:{per_page}:{search}:"
            f"{class_name}:{class_id}:{keyword}:{min_score}:{max_score}:"
            f"{sort_by}:{sort_order}"
        )
        # 如果不跳过缓存，尝试从缓存获取
        if not skip_cache:
            cached_result = get_cache_service().get(cache_key)
            if cached_result is not None:
                return APIResponse.success(data=cached_result)
        query = User.query
        # 根据管理员权限过滤班级
        allowed_classes = get_classes_for_admin(admin)
        # 如果不是超级管理员且没有分配班级，返回空结果
        if allowed_classes == []:
            return APIResponse.success(data={"users": [], "total": 0, "page": page, "per_page": per_page, "pages": 0})
        # 如果不是超级管理员，只显示允许的班级
        if allowed_classes is not None:
            if class_id:
                class_info = ClassInfo.query.get(class_id)
                if not class_info or class_info.name not in allowed_classes:
                    return APIResponse.success(
                        data={"users": [], "total": 0, "page": page, "per_page": per_page, "pages": 0}
                    )
                query = query.filter(User.class_info_id == class_id)
            elif class_name:
                if class_name not in allowed_classes:
                    return APIResponse.success(
                        data={"users": [], "total": 0, "page": page, "per_page": per_page, "pages": 0}
                    )
            else:
                query = query.filter(User.class_name.in_(allowed_classes))
        elif class_id:
            # 超级管理员按 class_id 过滤
            query = query.filter(User.class_info_id == class_id)
        if search:
            search_lower = search.lower()
            # 检查是否为纯字母（可能是拼音）
            is_pinyin = search_lower.isascii() and search_lower.isalpha()
            if is_pinyin:
                # 拼音搜索优化：先通过数据库索引字段缩小范围，再进行拼音匹配
                # 优先使用card_id精确匹配或phone匹配来快速筛选
                filtered_query = query
                # 如果搜索词看起来像卡号（纯数字或字母数字组合），先尝试精确匹配
                if search_lower.isalnum() and len(search_lower) >= 3:
                    filtered_query = filtered_query.filter(
                        (User.card_id.like(f"%{search_lower}%")) | (User.phone.like(f"%{search_lower}%"))
                    )
                # 限制单次加载数量，避免全表扫描内存溢出
                max_preload = min(1000, per_page * 10)
                users_for_pinyin = filtered_query.limit(max_preload).all()
                matched_users = []
                for user in users_for_pinyin:
                    # 将姓名转换为拼音
                    pinyin = "".join(lazy_pinyin(user.name)).lower()
                    # 匹配拼音或姓名
                    if any(
                        [
                            search_lower in pinyin,
                            search_lower in user.name.lower(),
                            search_lower in user.card_id.lower(),
                        ]
                    ):
                        matched_users.append(user)
                # 根据分页参数筛选结果
                start_idx = (page - 1) * per_page
                end_idx = start_idx + per_page
                paginated_users = matched_users[start_idx:end_idx]
                result = {  # noqa: F841
                    "users": [
                        {
                            "id": u.id,
                            "name": u.name,
                            "gender": u.gender,
                            "class_name": u.class_name,
                            "phone": u.phone,
                            "father_name": u.father_name,
                            "father_phone": u.father_phone,
                            "mother_name": u.mother_name,
                            "mother_phone": u.mother_phone,
                            "guardian_name": u.guardian_name,
                            "guardian_phone": u.guardian_phone,
                            "guardian_relation": u.guardian_relation,
                            "card_id": u.card_id,
                            "current_score": u.current_score,
                            "score": u.current_score,
                            "role": "student",
                            "created_at": u.created_at.isoformat() if u.created_at else None,
                        }
                        for u in paginated_users
                    ],
                    "total": len(matched_users),
                    "page": page,
                    "per_page": per_page,
                    "pages": max(1, (len(matched_users) + per_page - 1) // per_page),
                }
                get_cache_service().set(cache_key, result, ttl=300, tags=["users"])
                return APIResponse.success(data=result)
            else:
                # 常规搜索：匹配姓名、卡号、电话
                query = query.filter(
                    (User.name.like(f"%{search}%"))
                    | (User.card_id.like(f"%{search}%"))
                    | (User.phone.like(f"%{search}%"))
                )
        if class_name:
            query = query.filter(User.class_name == class_name)
        # 高级筛选：关键词搜索（如果不是拼音搜索）
        if keyword and not (search and search.lower().isascii() and search.lower().isalpha()):
            keyword_filter = (
                (User.name.like(f"%{keyword}%"))
                | (User.card_id.like(f"%{keyword}%"))
                | (User.card_id.like(f"%{keyword}%"))
            )
            query = query.filter(keyword_filter)
        # 高级筛选：积分范围
        if min_score is not None:
            query = query.filter(User.current_score >= min_score)
        if max_score is not None:
            query = query.filter(User.current_score <= max_score)
        # 高级筛选：排序
        if sort_by == "score":
            order_col = User.current_score
        elif sort_by == "created_at":
            order_col = User.created_at
        else:
            order_col = User.name
        if sort_order == "desc":
            query = query.order_by(order_col.desc())
        else:
            query = query.order_by(order_col.asc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        result = {  # noqa: F841
            "users": [
                {
                    "id": u.id,
                    "name": u.name,
                    "gender": u.gender,
                    "class_name": u.class_name,
                    "phone": u.phone,
                    "father_name": u.father_name,
                    "father_phone": u.father_phone,
                    "mother_name": u.mother_name,
                    "mother_phone": u.mother_phone,
                    "guardian_name": u.guardian_name,
                    "guardian_phone": u.guardian_phone,
                    "guardian_relation": u.guardian_relation,
                    "card_id": u.card_id,
                    "current_score": u.current_score,
                    "score": u.current_score,
                    "role": "student",
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in pagination.items
            ],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
        }
        get_cache_service().set(cache_key, result, ttl=300, tags=["users"])
        return APIResponse.success(data=result)

    @ns_users.doc("create_user", description="创建学生", security="Bearer")
    @ns_users.expect(user_model)
    @ns_users.response(201, "创建成功")
    @ns_users.response(400, "参数错误")
    @requires_permission("student.create")
    def post(self):
        """
        创建新学生
        创建一个新的学生账户。
        非管理员用户只能为关联班级创建学生。
        请求体：
        - name: 学生姓名（必填）
        - gender: 性别（可选）
        - class_name: 班级（可选）
        - phone: 联系电话（可选）
        - father_name: 父亲姓名（可选）
        - father_phone: 父亲电话（可选）
        - mother_name: 母亲姓名（可选）
        - mother_phone: 母亲电话（可选）
        - guardian_name: 监护人姓名（可选）
        - guardian_phone: 监护人电话（可选）
        - guardian_relation: 监护关系（可选）
        - card_id: 学号（必填，8-16位数字）
        - current_score: 当前积分（可选，默认0，范围-1000到1000）
        """
        data = ns_users.payload
        # 数据隔离检查：只能为关联班级创建学生
        class_name = data.get("class_name")
        if class_name:
            admin = get_current_admin()
            if admin:
                allowed_classes = get_allowed_classes(admin.id)
                if allowed_classes is not None and class_name not in allowed_classes:
                    return APIResponse.error(message="无权为该班级创建学生", status_code=403)
        # 参数校验
        errors = []
        # 姓名必填校验
        if not data.get("name") or not data.get("name").strip():
            errors.append("学生姓名不能为空")
        # 姓名长度校验
        if data.get("name") and len(data.get("name")) > ValidationRules.NAME_MAX_LEN:
            errors.append(f"学生姓名长度不能超过{ValidationRules.NAME_MAX_LEN}个字符")
        # 卡号必填校验（数据库NOT NULL约束）
        card_id = data.get("card_id")
        if not card_id or not str(card_id).strip():
            errors.append("卡号不能为空")
        elif card_id:
            is_valid, error_msg = validate_card_id(card_id)
            if not is_valid:
                errors.append(f"卡号: {error_msg}")
        # 联系电话校验
        phone = data.get("phone")
        if phone:
            is_valid, error_msg = validate_phone(phone)
            if not is_valid:
                errors.append(f"联系电话: {error_msg}")
        # 父亲电话校验
        father_phone = data.get("father_phone")
        if father_phone:
            is_valid, error_msg = validate_phone(father_phone)
            if not is_valid:
                errors.append(f"父亲电话: {error_msg}")
        # 母亲电话校验
        mother_phone = data.get("mother_phone")
        if mother_phone:
            is_valid, error_msg = validate_phone(mother_phone)
            if not is_valid:
                errors.append(f"母亲电话: {error_msg}")
        # 积分校验
        score = data.get("current_score", 0)
        is_valid, error_msg = validate_score(score)
        if not is_valid:
            errors.append(f"积分: {error_msg}")
        # 检查卡号唯一性
        if card_id:
            existing_user = User.query.filter_by(card_id=card_id).first()
            if existing_user:
                errors.append(f"卡号 {card_id} 已被用户 {existing_user.name} 使用")
        if errors:
            return validation_error_response(errors)
        user = User(
            name=data.get("name").strip(),
            gender=data.get("gender"),
            class_name=data.get("class_name"),
            phone=data.get("phone"),
            father_name=data.get("father_name"),
            father_phone=data.get("father_phone"),
            mother_name=data.get("mother_name"),
            mother_phone=data.get("mother_phone"),
            guardian_name=data.get("guardian_name"),
            guardian_phone=data.get("guardian_phone"),
            guardian_relation=data.get("guardian_relation"),
            card_id=data.get("card_id"),
            current_score=int(data.get("current_score", 0)),
        )
        db.session.add(user)
        db.session.commit()
        # 更新FTS搜索索引
        try:
            from utils.fulltext_search import get_search_engine

            search_engine = get_search_engine()
            search_engine.add_to_index(user.id, user.name, user.card_id, user.phone, user.class_name)
        except Exception as e:
            # 索引更新失败：新数据搜不到（索引与 DB 不一致），须留痕
            logger.warning(f"FTS索引更新失败(user_id={user.id}): {e}")
        log_operation(
            operation_type="create",
            target_type="user",
            target_id=user.id,
            description=f"创建学生: {user.name}",
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("users")
        return APIResponse.success(
            data={
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "gender": user.gender,
                    "class_name": user.class_name,
                    "phone": user.phone,
                    "father_name": user.father_name,
                    "father_phone": user.father_phone,
                    "mother_name": user.mother_name,
                    "mother_phone": user.mother_phone,
                    "guardian_name": user.guardian_name,
                    "guardian_phone": user.guardian_phone,
                    "guardian_relation": user.guardian_relation,
                    "card_id": user.card_id,
                    "current_score": user.current_score,
                    "role": "student",
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            },
            message="用户创建成功",
            status_code=201,
        )


@ns_users.route("/<int:id>")
@ns_users.param("id", "用户ID")
class UserResource(Resource):
    @ns_users.doc("get_user", description="获取单个学生信息")
    @ns_users.response(200, "成功", user_model)
    @ns_users.response(404, "学生不存在")
    @requires_permission("student.view")
    def get(self, id):
        """
        获取单个学生详细信息
        根据学生ID获取详细信息。
        非管理员用户只能查看关联班级的学生。
        """
        user = User.query.get_or_404(id)
        if not _can_access_user(id):
            return APIResponse.error(message="无权查看该学生", status_code=403)
        return APIResponse.success(
            data={
                "id": user.id,
                "name": user.name,
                "gender": user.gender,
                "class_name": user.class_name,
                "phone": user.phone,
                "father_name": user.father_name,
                "father_phone": user.father_phone,
                "mother_name": user.mother_name,
                "mother_phone": user.mother_phone,
                "guardian_name": user.guardian_name,
                "guardian_phone": user.guardian_phone,
                "guardian_relation": user.guardian_relation,
                "card_id": user.card_id,
                "current_score": user.current_score,
                "score": user.current_score,
                "role": "student",
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            }
        )

    @ns_users.doc("update_user", description="更新学生信息", security="Bearer")
    @ns_users.expect(user_model)
    @ns_users.response(200, "更新成功")
    @ns_users.response(404, "学生不存在")
    @requires_permission("student.edit")
    def put(self, id):
        """
        更新学生信息
        更新指定学生的信息。
        非管理员用户只能更新关联班级的学生。
        请求体参数均为可选，只更新提供的字段。
        """
        user = User.query.get_or_404(id)
        if not _can_access_user(id):
            return APIResponse.error(message="无权更新该学生", status_code=403)
        before_data = {
            "name": user.name,
            "gender": user.gender,
            "class_name": user.class_name,
            "phone": user.phone,
            "card_id": user.card_id,
            "current_score": user.current_score,
        }
        data = ns_users.payload
        user.name = data.get("name", user.name)
        user.gender = data.get("gender", user.gender)
        user.class_name = data.get("class_name", user.class_name)
        user.phone = data.get("phone", user.phone)
        user.father_name = data.get("father_name", user.father_name)
        user.father_phone = data.get("father_phone", user.father_phone)
        user.mother_name = data.get("mother_name", user.mother_name)
        user.mother_phone = data.get("mother_phone", user.mother_phone)
        user.guardian_name = data.get("guardian_name", user.guardian_name)
        user.guardian_phone = data.get("guardian_phone", user.guardian_phone)
        user.guardian_relation = data.get("guardian_relation", user.guardian_relation)
        user.card_id = data.get("card_id", user.card_id)
        user.current_score = data.get("current_score", user.current_score)
        user.updated_at = datetime.now()
        db.session.commit()
        # 更新FTS搜索索引
        try:
            from utils.fulltext_search import get_search_engine  # 函数内 import（与 create 分支一致，缺失会 NameError）

            search_engine = get_search_engine()
            search_engine.add_to_index(user.id, user.name, user.card_id, user.phone, user.class_name)
        except Exception as e:
            # 索引更新失败：改动后搜不到（索引与 DB 不一致），须留痕
            logger.warning(f"FTS索引更新失败(user_id={user.id}): {e}")
        log_operation(
            operation_type="update",
            target_type="user",
            target_id=user.id,
            description=f"更新学生信息: {user.name}",
            before_data=before_data,
            after_data=data,
        )
        get_cache_service().invalidate_by_tag("users")
        return APIResponse.success(
            data={
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "gender": user.gender,
                    "class_name": user.class_name,
                    "phone": user.phone,
                    "father_name": user.father_name,
                    "father_phone": user.father_phone,
                    "mother_name": user.mother_name,
                    "mother_phone": user.mother_phone,
                    "guardian_name": user.guardian_name,
                    "guardian_phone": user.guardian_phone,
                    "guardian_relation": user.guardian_relation,
                    "card_id": user.card_id,
                    "current_score": user.current_score,
                    "role": "student",
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            },
            message="用户更新成功",
        )

    @ns_users.doc("delete_user", description="删除学生", security="Bearer")
    @ns_users.response(200, "删除成功")
    @ns_users.response(404, "学生不存在")
    @requires_permission("student.delete")
    def delete(self, id):
        """
        删除学生
        删除指定的学生账户。
        非管理员用户只能删除关联班级的学生。
        """
        user = User.query.get_or_404(id)
        if not _can_access_user(id):
            return APIResponse.error(message="无权删除该学生", status_code=403)
        before_data = {
            "name": user.name,
            "class_name": user.class_name,
            "card_id": user.card_id,
            "current_score": user.current_score,
        }
        # 先清理所有关联子表，避免 SQLite 外键 NOT NULL 约束导致删除失败
        cascade_delete_user_related_records(id)

        db.session.delete(user)
        db.session.commit()
        # 从FTS搜索索引移除
        try:
            from utils.fulltext_search import get_search_engine  # 函数内 import（缺失会 NameError）

            search_engine = get_search_engine()
            search_engine.remove_from_index(id)
        except Exception as e:
            # 索引移除失败：已删除用户仍可被搜到（索引残留），须留痕
            logger.warning(f"FTS索引移除失败(user_id={id}): {e}")
        log_operation(
            operation_type="delete",
            target_type="user",
            target_id=id,
            description=f'删除学生: {before_data["name"]}',
            before_data=before_data,
        )
        get_cache_service().invalidate_by_tag("users")
        return APIResponse.success(message="用户删除成功")


@ns_users.route("/by-card/<string:cardId>")
@ns_users.param("cardId", "卡片ID")
class UserByCard(Resource):
    @ns_users.doc("get_user_by_card", description="通过卡片ID获取学生信息")
    @ns_users.response(200, "成功")
    @ns_users.response(404, "未找到用户")
    @requires_permission("student.view")
    def get(self, cardId):
        """
        通过卡片ID获取学生信息
        根据学生的卡片ID查询学生信息。
        非管理员用户只能查看关联班级的学生。
        """
        user = User.query.filter_by(card_id=cardId).first()
        if not user:
            return APIResponse.error(message="未找到用户", status_code=404)
        if not _can_access_user(user.id):
            return APIResponse.error(message="无权查看该学生", status_code=403)
        return APIResponse.success(
            data={
                "id": user.id,
                "name": user.name,
                "gender": user.gender,
                "class_name": user.class_name,
                "phone": user.phone,
                "card_id": user.card_id,
                "current_score": user.current_score,
            }
        )


@ns_users.route("/import")
class UserImport(Resource):
    @ns_users.doc("import_users", description="批量导入学生（JSON格式）", security="Bearer")
    @ns_users.expect(
        ns_users.model(
            "UserImportRequest",
            {"users": fields.List(fields.Nested(user_model), required=True, description="学生列表")},
        )
    )
    @ns_users.response(200, "导入完成")
    @ns_users.response(400, "没有导入数据")
    @requires_permission("student.create")
    def post(self):
        """
        批量导入学生（JSON格式）
        通过JSON格式批量导入学生数据。
        非管理员用户只能为关联班级导入学生。
        请求体：
        - users: 学生列表数组
        返回导入结果，包含成功和失败数量。
        """
        data = request.get_json()
        users_data = data.get("users", [])
        if not users_data:
            return APIResponse.error(message="没有导入数据", status_code=400)
        imported_count = 0
        error_count = 0
        errors = []
        for idx, user_data in enumerate(users_data):
            try:
                row_errors = []
                row_data = user_data.copy()
                card_id = user_data.get("card_id")
                if not card_id:
                    row_errors.append({"field": "card_id", "message": "学号不能为空"})
                elif not isinstance(card_id, (int, str)) or len(str(card_id).strip()) == 0:
                    row_errors.append({"field": "card_id", "message": "学号格式无效"})
                elif len(str(card_id).strip()) > 50:
                    row_errors.append({"field": "card_id", "message": "学号长度超过限制（最大50字符）"})
                else:
                    card_id_str = str(card_id).strip()
                    is_valid, msg = validate_student_id(card_id_str)
                    if not is_valid:
                        row_errors.append({"field": "card_id", "message": msg})
                name = user_data.get("name")
                if not name:
                    row_errors.append({"field": "name", "message": "姓名不能为空"})
                elif not isinstance(name, str) or len(name.strip()) == 0:
                    row_errors.append({"field": "name", "message": "姓名格式无效，必须为非空字符串"})
                elif len(name.strip()) > 50:
                    row_errors.append({"field": "name", "message": "姓名长度超过限制（最大50字符）"})
                else:
                    is_valid, msg = validate_name(name.strip())
                    if not is_valid:
                        row_errors.append({"field": "name", "message": msg})
                class_name = user_data.get("class_name")
                if class_name:
                    if not isinstance(class_name, str) or len(class_name.strip()) == 0:
                        row_errors.append({"field": "class_name", "message": "班级名称格式无效，必须为非空字符串"})
                    elif len(class_name.strip()) > 100:
                        row_errors.append({"field": "class_name", "message": "班级名称长度超过限制（最大100字符）"})
                    else:
                        class_info = ClassInfo.query.filter_by(name=class_name.strip()).first()
                        if not class_info:
                            row_errors.append({"field": "class_name", "message": f'班级 "{class_name}" 在系统中不存在'})
                gender = user_data.get("gender")
                if gender and gender not in ["男", "女", "male", "female", "m", "f"]:
                    row_errors.append({"field": "gender", "message": '性别值无效，只能是"男"或"女"'})
                phone = user_data.get("phone")
                if phone:
                    is_valid, msg = validate_phone(str(phone))
                    if not is_valid:
                        row_errors.append({"field": "phone", "message": msg})
                    else:
                        if not re.match(r"^1[3-9]\d{9}$", str(phone).strip()):
                            row_errors.append({"field": "phone", "message": "联系电话格式无效，请输入11位手机号"})
                if card_id:
                    existing = User.query.filter_by(card_id=str(card_id)).first()
                    if existing:
                        row_errors.append({"field": "card_id", "message": f'学号 "{str(card_id)}" 已存在'})
                if row_errors:
                    error_count += 1
                    errors.append(
                        {
                            "row": idx + 1,
                            "message": "; ".join([f'{err["field"]}: {err["message"]}' for err in row_errors]),
                            "row_data": row_data,
                            "error_fields": [err["field"] for err in row_errors],
                        }
                    )
                    continue
                user = User(
                    name=name,
                    gender=gender or "",
                    class_name=class_name or "",
                    phone=phone or "",
                    father_name=user_data.get("father_name", ""),
                    father_phone=user_data.get("father_phone", ""),
                    mother_name=user_data.get("mother_name", ""),
                    mother_phone=user_data.get("mother_phone", ""),
                    guardian_name=user_data.get("guardian_name", ""),
                    guardian_phone=user_data.get("guardian_phone", ""),
                    guardian_relation=user_data.get("guardian_relation", ""),
                    card_id=str(card_id),
                    current_score=user_data.get("current_score", 0),
                )
                db.session.add(user)
                imported_count += 1
            except Exception as e:
                error_count += 1
                errors.append({"row": idx + 1, "message": str(e), "row_data": user_data, "error_fields": ["system"]})
        db.session.commit()
        return APIResponse.success(
            data={"imported": imported_count, "errors": errors},
            message=f"导入完成: 成功{imported_count}条, 失败{error_count}条",
        )


@ns_users.route("/batch-delete")
class UserBatchDelete(Resource):
    @ns_users.doc("batch_delete_users", description="批量删除学生", security="Bearer")
    @ns_users.expect(
        ns_users.model(
            "BatchDeleteRequest", {"ids": fields.List(fields.Integer, required=True, description="用户ID列表")}
        )
    )
    @ns_users.response(200, "删除完成")
    @ns_users.response(400, "没有提供删除ID")
    @requires_permission("student.delete")
    def post(self):
        """
        批量删除学生
        批量删除指定的学生。
        非管理员用户只能删除关联班级的学生。
        请求体：
        - ids: 用户ID列表
        返回删除结果。
        """
        data = request.get_json()
        ids = data.get("ids", [])
        if not ids:
            return APIResponse.error(message="没有提供删除ID", status_code=400)
        deleted_count = 0
        for user_id in ids:
            if not _can_access_user(user_id):
                continue
            user = get_by_id(User, user_id)
            if user:
                db.session.delete(user)
                deleted_count += 1
        db.session.commit()
        return APIResponse.success(message=f"批量删除完成: 成功{deleted_count}条")


@ns_users.route("/batch-score")
class UserBatchScore(Resource):
    @ns_users.doc("batch_update_user_score", description="批量调整学生积分", security="Bearer")
    @ns_users.expect(batch_score_model)
    @ns_users.response(200, "调整完成")
    @ns_users.response(400, "没有提供用户ID")
    @requires_permission("score.entry")
    def post(self):
        """
        批量调整学生积分
        为多个学生同时调整积分。
        非管理员用户只能为关联班级的学生调整积分。
        请求体：
        - ids: 用户ID列表（必填）
        - score_change: 积分变化量（必填，正数加分，负数扣分）
        - description: 操作描述（可选）
        返回调整结果。
        """
        from sqlalchemy import update
        from models import ScoreRecord

        data = request.get_json()
        ids = data.get("ids", [])
        score_change = data.get("score_change", 0)
        description = data.get("description", "批量积分调整")
        if not ids:
            return APIResponse.error(message="没有提供用户ID", status_code=400)
        # 数据隔离：过滤掉无权操作的学生
        allowed_ids = [uid for uid in ids if _can_access_user(uid)]
        if not allowed_ids:
            return APIResponse.error(message="无权为这些学生调整积分", status_code=403)
        # 性能优化：使用批量更新
        update_stmt = (
            update(User)
            .where(User.id.in_(allowed_ids))
            .values(current_score=User.current_score + score_change, updated_at=datetime.now())
        )
        result = db.session.execute(update_stmt)  # noqa: F841
        updated_count = result.rowcount
        # 批量插入积分记录
        records = [
            ScoreRecord(user_id=user_id, score_change=score_change, description=description, operator="batch_operation")
            for user_id in allowed_ids
        ]
        if records:
            db.session.add_all(records)
        db.session.commit()
        # 发送积分变动通知到远程客户端（积分窗口显示）
        try:
            from api.monitoring.mqtt_routes import publish_mqtt

            blocked, check_message, reason_code = ClassTimeChecker.is_broadcast_blocked(force_send=False)
            if not blocked:
                users = User.query.filter(User.id.in_(ids)).all()
                score_change_str = f"{score_change:+d}" if score_change > 0 else str(score_change)
                for user in users:
                    score_change_text = f"学生:{user.name}, {score_change_str}分, 原因:{description}"
                    score_notification = {
                        "type": "score_change",
                        "text": score_change_text,
                        "popup": True,
                        "timestamp": datetime.now().isoformat(),
                    }
                    publish_mqtt("phonebox/remote/notify", score_notification)
                print(f"[ScoreChange] 批量积分变动通知已发送: {updated_count}个用户, {score_change_str}分")
            else:
                ClassTimeChecker.log_notify_audit(
                    "score_change", None, None,
                    {"users": ids}, reason_code or "GLOBAL_TIME_RULE", check_message, force_send=False,
                )
                print(f"[ScoreChange] 批量积分变动通知被拦截（上课时间）: {updated_count}个用户, {score_change_str}分")
        except Exception as e:
            print(f"[ScoreChange] 批量发送积分变动通知失败: {e}")
        return APIResponse.success(message=f"批量积分调整完成: 成功{updated_count}条")


@ns_users.route("/template/download")
class UserTemplate(Resource):
    @ns_users.doc("download_user_template", description="下载导入模板", security="Bearer")
    @requires_permission("student.view")
    def get(self):
        """
        下载CSV导入模板
        下载学生批量导入的CSV模板文件。
        """
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "姓名",
                "性别",
                "班级",
                "联系电话",
                "卡片ID",
                "父亲姓名",
                "父亲电话",
                "母亲姓名",
                "母亲电话",
                "监护人姓名",
                "监护人电话",
                "监护关系",
                "初始积分",
            ]
        )
        writer.writerow(
            [
                "张三",
                "男",
                "一年一班",
                "13800138000",
                "CARD001",
                "张父",
                "13900139000",
                "张母",
                "13700137000",
                "",
                "",
                "",
                "60",
            ]
        )
        output.seek(0)
        from flask import send_file

        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            mimetype="text/csv",
            as_attachment=True,
            download_name="user_import_template.csv",
        )


def detect_encoding(content_bytes):
    encodings = ["utf-8-sig", "utf-8", "gbk", "gb2312", "gb18030"]
    for encoding in encodings:
        try:
            content = content_bytes.decode(encoding)
            return content, encoding
        except UnicodeDecodeError:
            continue
    return None, None


@ns_users.route("/import-file", methods=["POST"])
class UserImportFile(Resource):
    @ns_users.doc("import_users_file", description="通过CSV文件批量导入学生", security="Bearer")
    @ns_users.response(200, "导入完成")
    @ns_users.response(400, "文件错误")
    @requires_permission("student.create")
    def post(self):
        """
        通过CSV文件批量导入学生
        上传CSV文件批量导入学生数据。支持UTF-8和GBK编码。
        非管理员用户只能为关联班级导入学生。
        请求：multipart/form-data
        - file: CSV文件
        CSV文件格式：
        姓名,性别,班级,联系电话,卡片ID,父亲姓名,父亲电话,母亲姓名,母亲电话,监护人姓名,监护人电话,监护关系,初始积分
        返回导入结果，包含新增、更新数量和错误信息。
        """
        admin = get_current_admin()
        allowed_classes = get_allowed_classes(admin.id) if admin else None
        if "file" not in request.files:
            return APIResponse.error(message="请选择文件", status_code=400)
        file = request.files["file"]
        if file.filename == "":
            return APIResponse.error(message="请选择文件", status_code=400)
        if not file.filename.lower().endswith(".csv"):
            return APIResponse.error(message="请选择CSV格式的文件", status_code=400)
        imported = 0
        updated = 0
        errors = []
        messages = []
        try:
            content_bytes = file.read()
            content, encoding = detect_encoding(content_bytes)
            if content is None:
                return APIResponse.error(message="无法识别文件编码，请使用UTF-8或GBK编码保存文件", status_code=400)
            lines = content.split("\n")
            if len(lines) == 0:
                return APIResponse.error(message="文件为空", status_code=400)
            reader = csv.reader(lines)
            rows = list(reader)
            if len(rows) < 2:
                return APIResponse.error(message="文件没有数据", status_code=400)
            headers = [h.strip() for h in rows[0]]
            mapping = {
                "姓名": "name",
                "性别": "gender",
                "班级": "class_name",
                "电话": "phone",
                "联系电话": "phone",
                "家长信息": "parent_info",
                "父亲姓名": "father_name",
                "父亲电话": "father_phone",
                "母亲姓名": "mother_name",
                "母亲电话": "mother_phone",
                "监护人姓名": "guardian_name",
                "监护人电话": "guardian_phone",
                "监护关系": "guardian_relation",
                "卡片ID": "card_id",
                "饭卡号": "card_id",
                "学号": "card_id",
                "初始积分": "current_score",
                "积分": "current_score",
            }
            for idx, row in enumerate(rows[1:]):
                try:
                    row_dict = {}
                    row_data = {}
                    for i, header in enumerate(headers):
                        if header in mapping and i < len(row):
                            value = row[i].strip() if row[i] else ""
                            row_dict[mapping[header]] = value
                            row_data[header] = value
                    row_errors = []
                    row_number = idx + 2
                    card_id = row_dict.get("card_id", "").strip()
                    if not card_id:
                        row_errors.append({"field": "card_id", "message": "学号不能为空"})
                    elif not isinstance(card_id, (int, str)) or len(str(card_id).strip()) == 0:
                        row_errors.append({"field": "card_id", "message": "学号格式无效"})
                    elif len(str(card_id).strip()) > 50:
                        row_errors.append({"field": "card_id", "message": "学号长度超过限制（最大50字符）"})
                    name = row_dict.get("name", "").strip()
                    if not name:
                        row_errors.append({"field": "name", "message": "姓名不能为空"})
                    elif not isinstance(name, str) or len(name.strip()) == 0:
                        row_errors.append({"field": "name", "message": "姓名格式无效，必须为非空字符串"})
                    elif len(name.strip()) > 50:
                        row_errors.append({"field": "name", "message": "姓名长度超过限制（最大50字符）"})
                    class_name = row_dict.get("class_name", "").strip()
                    if class_name:
                        if not isinstance(class_name, str) or len(class_name.strip()) == 0:
                            row_errors.append({"field": "class_name", "message": "班级名称格式无效"})
                        elif len(class_name.strip()) > 100:
                            row_errors.append({"field": "class_name", "message": "班级名称长度超过限制（最大100字符）"})
                        else:
                            class_info = ClassInfo.query.filter_by(name=class_name.strip()).first()
                            if not class_info:
                                row_errors.append(
                                    {"field": "class_name", "message": f'班级 "{class_name}" 在系统中不存在'}
                                )
                        if allowed_classes is not None and class_name not in allowed_classes:
                            row_errors.append({"field": "class_name", "message": f'无权为班级 "{class_name}" 导入学生'})
                    gender = row_dict.get("gender", "").strip()
                    if gender and gender not in ["男", "女", "male", "female", "m", "f"]:
                        row_errors.append({"field": "gender", "message": '性别格式无效，只能是"男"或"女"'})
                    phone = row_dict.get("phone", "").strip()
                    if phone:
                        if not re.match(r"^1[3-9]\d{9}$", phone):
                            row_errors.append({"field": "phone", "message": "联系电话格式无效，请输入11位手机号"})
                    father_phone = row_dict.get("father_phone", "").strip()
                    if father_phone and not re.match(r"^1[3-9]\d{9}$", father_phone):
                        row_errors.append({"field": "father_phone", "message": "父亲电话格式无效，请输入11位手机号"})
                    mother_phone = row_dict.get("mother_phone", "").strip()
                    if mother_phone and not re.match(r"^1[3-9]\d{9}$", mother_phone):
                        row_errors.append({"field": "mother_phone", "message": "母亲电话格式无效，请输入11位手机号"})
                    guardian_phone = row_dict.get("guardian_phone", "").strip()
                    if guardian_phone and not re.match(r"^1[3-9]\d{9}$", guardian_phone):
                        row_errors.append(
                            {"field": "guardian_phone", "message": "监护人电话格式无效，请输入11位手机号"}
                        )
                    current_score = row_dict.get("current_score", "0").strip()
                    if current_score:
                        try:
                            current_score_int = int(current_score)
                            if current_score_int < 0:
                                row_errors.append({"field": "current_score", "message": "初始积分不能为负数"})
                        except ValueError:
                            row_errors.append({"field": "current_score", "message": "初始积分格式无效，必须为整数"})
                    if row_errors:
                        error_count = len(errors)
                        error_msg = "; ".join([f'{err["field"]}: {err["message"]}' for err in row_errors])
                        errors.append(
                            {
                                "row": row_number,
                                "message": error_msg,
                                "row_data": row_data,
                                "error_fields": [err["field"] for err in row_errors],
                            }
                        )
                        messages.append(
                            {
                                "name": name or card_id or "未知",
                                "action": "failed",
                                "message": error_msg,
                                "row_data": row_data,
                                "error_fields": [err["field"] for err in row_errors],
                            }
                        )
                        continue
                    current_score_int = int(current_score) if current_score else 0
                    existing = User.query.filter_by(card_id=card_id).first()
                    if existing:
                        existing.name = name if name else existing.name
                        existing.gender = gender if gender else existing.gender
                        existing.class_name = class_name if class_name else existing.class_name
                        existing.phone = phone if phone else existing.phone
                        existing.parent_info = (
                            row_dict.get("parent_info", "") if row_dict.get("parent_info", "") else existing.parent_info
                        )
                        existing.father_name = (
                            row_dict.get("father_name", "") if row_dict.get("father_name", "") else existing.father_name
                        )
                        existing.father_phone = (
                            row_dict.get("father_phone", "")
                            if row_dict.get("father_phone", "")
                            else existing.father_phone
                        )
                        existing.mother_name = (
                            row_dict.get("mother_name", "") if row_dict.get("mother_name", "") else existing.mother_name
                        )
                        existing.mother_phone = (
                            row_dict.get("mother_phone", "")
                            if row_dict.get("mother_phone", "")
                            else existing.mother_phone
                        )
                        existing.guardian_name = (
                            row_dict.get("guardian_name", "")
                            if row_dict.get("guardian_name", "")
                            else existing.guardian_name
                        )
                        existing.guardian_phone = (
                            row_dict.get("guardian_phone", "")
                            if row_dict.get("guardian_phone", "")
                            else existing.guardian_phone
                        )
                        existing.guardian_relation = (
                            row_dict.get("guardian_relation", "")
                            if row_dict.get("guardian_relation", "")
                            else existing.guardian_relation
                        )
                        existing.current_score = current_score_int
                        existing.updated_at = datetime.now()
                        updated += 1
                        messages.append({"name": name, "action": "updated", "message": f'学生"{name}"信息更新成功'})
                    else:
                        user = User(
                            name=name,
                            gender=gender,
                            class_name=class_name,
                            phone=phone,
                            parent_info=row_dict.get("parent_info", ""),
                            father_name=row_dict.get("father_name", ""),
                            father_phone=row_dict.get("father_phone", ""),
                            mother_name=row_dict.get("mother_name", ""),
                            mother_phone=row_dict.get("mother_phone", ""),
                            guardian_name=row_dict.get("guardian_name", ""),
                            guardian_phone=row_dict.get("guardian_phone", ""),
                            guardian_relation=row_dict.get("guardian_relation", ""),
                            card_id=card_id,
                            current_score=current_score_int,
                        )
                        db.session.add(user)
                        imported += 1
                        messages.append({"name": name, "action": "created", "message": f'学生"{name}"导入成功'})
                except Exception as e:
                    error_count = len(errors)
                    error_msg = str(e)
                    errors.append(
                        {
                            "row": idx + 2,
                            "message": error_msg,
                            "row_data": row_data if "row_data" in locals() else None,
                            "error_fields": ["system"],
                        }
                    )
                    messages.append(
                        {
                            "name": (
                                row_dict.get("name", "") or row_dict.get("card_id", "") or "未知"
                                if "row_dict" in locals()
                                else "未知"
                            ),
                            "action": "failed",
                            "message": error_msg,
                            "row_data": row_data if "row_data" in locals() else None,
                            "error_fields": ["system"],
                        }
                    )
        except Exception as e:
            return APIResponse.error(message=f"导入失败: {str(e)}", status_code=500)
        db.session.commit()
        failed_count = len(errors)
        return APIResponse.success(
            data={
                "total": imported + updated + failed_count,
                "success_count": imported + updated,
                "failed_count": failed_count,
                "imported": imported,
                "updated": updated,
                "errors": errors,
                "messages": messages,
            },
            message=f"导入完成: 新增{imported}条, 更新{updated}条, 失败{failed_count}条",
        )
