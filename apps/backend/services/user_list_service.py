"""学生列表只读查询视图（薄路由下沉）。

将 UserList 端点的权限隔离 + 拼音/关键词/积分筛选 + 排序 + 分页 + 响应构造
从路由层下沉为纯只读视图，路由层只保留缓存读取、信封与参数解析。
缓存写入（ttl=300, tags=["users"]）严格保留在原实现的两个分支（拼音分支、
主分支）位置，空结果提前返回路径不写缓存——与原 UserList.get 行为逐字一致，
保证契约零漂移。
"""

from models import User, ClassInfo
from utils.permission import get_admin_class_ids
from pypinyin import lazy_pinyin
from services.redis_cache_service import get_cache_service

USER_LIST_PY_FIELDS = [
    "id",
    "name",
    "gender",
    "class_name",
    "phone",
    "father_name",
    "father_phone",
    "mother_name",
    "mother_phone",
    "guardian_name",
    "guardian_phone",
    "guardian_relation",
    "card_id",
    "current_score",
    "is_active",
    "is_blacklisted",
    "created_at",
]
USER_LIST_BASIC_FIELDS = [
    "id",
    "name",
    "gender",
    "class_name",
    "phone",
    "father_name",
    "father_phone",
    "mother_name",
    "mother_phone",
    "guardian_name",
    "guardian_phone",
    "guardian_relation",
    "card_id",
    "current_score",
    "created_at",
]


def _get_classes_for_admin(admin):
    """获取管理员可以访问的班级名称列表。返回 None 表示可以访问所有班级。"""
    if not admin or admin.role in ("admin", "super_admin"):
        return None
    class_ids = get_admin_class_ids(admin.id)
    if class_ids:
        classes = ClassInfo.query.filter(ClassInfo.id.in_(class_ids)).all()
        return [c.name for c in classes]
    return []


def get_user_list_view(
    admin,
    page,
    per_page,
    search,
    class_name,
    class_id,
    keyword,
    min_score,
    max_score,
    sort_by,
    sort_order,
    cache_key,
):
    """返回学生列表分页结果（裸 dict，不含信封），与原 UserList.get 逐字一致。"""
    query = User.query
    # 根据管理员权限过滤班级
    allowed_classes = _get_classes_for_admin(admin)
    # 如果不是超级管理员且没有分配班级，返回空结果
    if allowed_classes == []:
        return {
            "users": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "pages": 0,
        }
    # 如果不是超级管理员，只显示允许的班级
    if allowed_classes is not None:
        if class_id:
            class_info = ClassInfo.query.get(class_id)
            if not class_info or class_info.name not in allowed_classes:
                return {
                    "users": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }
            query = query.filter(User.class_info_id == class_id)
        elif class_name:
            if class_name not in allowed_classes:
                return {
                    "users": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }
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
                    (User.card_id.like(f"%{search_lower}%"))
                    | (User.phone.like(f"%{search_lower}%"))
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
            result = {
                "users": [
                    {**u.to_dict(USER_LIST_PY_FIELDS), "role": "student"} for u in paginated_users
                ],
                "total": len(matched_users),
                "page": page,
                "per_page": per_page,
                "pages": max(1, (len(matched_users) + per_page - 1) // per_page),
            }
            get_cache_service().set(cache_key, result, ttl=300, tags=["users"])
            return result
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
    result = {
        "users": [
            {**u.to_dict(USER_LIST_BASIC_FIELDS), "role": "student"} for u in pagination.items
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }
    get_cache_service().set(cache_key, result, ttl=300, tags=["users"])
    return result
