from .records_routes import ns_records
from .rules_routes import ns_rules
from .categories_routes import ns_score_categories
from .approvals_routes import ns_approvals
from .rank_routes import ns_rank
from .remote_notify_routes import ns_remote_notify
from .time_rules_routes import ns_time_rules
from .class_periods_routes import ns_class_periods

"""
积分管理模块
包含积分记录、积分规则、审批流程、排行榜等路由
"""
__all__ = [
    "ns_records",
    "ns_rules",
    "ns_score_categories",
    "ns_approvals",
    "ns_rank",
    "ns_remote_notify",
    "ns_time_rules",
    "ns_class_periods",
]
