"""审批只读查询服务层。

将 approvals_routes 中的三类纯只读逻辑下沉到此处，保持与原路由逐字一致的响应契约：
- 列表（ApprovalList.get）
- 待审批列表（PendingApprovals.get）
- 单条详情（ApprovalResource.get，仅数据准备，403 鉴权仍留路由层）

序列化字典原在 3 处重复，此处收敛为单一 _serialize_approval；数据隔离逻辑原属路由模块级
helper _apply_approval_data_isolation，仅被两处 GET 使用，随查询一并迁入。

注意：paginate 沿用原路由默认值（error_out=True），不传 error_out 以保持 404 行为一致。
"""

from models import Approval, User
from sqlalchemy.orm import joinedload
from utils.permission import get_current_admin, get_allowed_classes


def _serialize_approval(a, detail=False):
    """审批序列化。detail=True 额外含 approver_id / comment / approve_time。"""
    data = {
        "id": a.id,
        "user_id": a.student_id,
        "student_id": a.student_id,
        "user_name": a.user.name if a.user else None,
        "type": a.type,
        "title": a.title,
        "description": a.description,
        "score_change": a.score_change,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
    if detail:
        data["approver_id"] = a.approver_id
        data["comment"] = a.comment
        data["approve_time"] = a.approve_time.isoformat() if a.approve_time else None
    return data


def apply_approval_data_isolation(query):
    """对审批查询应用数据隔离：非管理员只能查看关联班级的审批。"""
    admin = get_current_admin()
    if not admin:
        return query
    allowed_classes = get_allowed_classes(admin.id)
    if allowed_classes is None:
        return query
    if not allowed_classes:
        return query.filter(False)
    return query.join(User).filter(User.class_name.in_(allowed_classes))


def get_approval_list_view(page, per_page, status):
    """审批列表视图（含状态筛选 + 数据隔离 + 分页）。"""
    query = Approval.query.options(joinedload(Approval.user))
    if status:
        query = query.filter_by(status=status)
    query = apply_approval_data_isolation(query)
    pagination = query.order_by(Approval.created_at.desc()).paginate(
        page=page, per_page=per_page
    )
    return {
        "approvals": [_serialize_approval(a, detail=True) for a in pagination.items],
        "pagination": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }


def get_pending_approvals_view(page, per_page):
    """待审批列表视图（status=pending + 数据隔离 + 分页）。"""
    query = Approval.query.filter_by(status="pending").options(
        joinedload(Approval.user)
    )
    query = apply_approval_data_isolation(query)
    pagination = query.order_by(Approval.created_at.desc()).paginate(
        page=page, per_page=per_page
    )
    return {
        "approvals": [_serialize_approval(a, detail=False) for a in pagination.items],
        "pagination": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
    }


def get_approval_detail_view(approval_id):
    """单条审批详情（含 user 预加载）。缺失则触发 404，由 SQLAlchemy 原样抛出。"""
    return Approval.query.options(joinedload(Approval.user)).get_or_404(approval_id)
