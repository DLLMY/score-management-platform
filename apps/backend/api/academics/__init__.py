from .admin_classes_routes import ns_admin_classes
from .classes_routes import ns_classes
from .course_schedule_routes import ns_course_schedule
from .exam_import_routes import ns_exam_import
from .exam_routes import ns_exam, ns_score_analysis, ns_scores
from .subject_routes import ns_subjects

"""
学业管理模块
包含班级、科目、考试等路由
"""
__all__ = [
    "ns_admin_classes",
    "ns_classes",
    "ns_course_schedule",
    "ns_exam",
    "ns_exam_import",
    "ns_score_analysis",
    "ns_scores",
    "ns_subjects",
]
