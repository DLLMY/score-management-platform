from .classes_routes import ns_classes
from .admin_classes_routes import ns_admin_classes
from .subject_routes import ns_subjects
from .exam_routes import ns_exam, ns_scores, ns_score_analysis
from .exam_import_routes import ns_exam_import
from .course_schedule_routes import ns_course_schedule

"""
学业管理模块
包含班级、科目、考试等路由
"""
__all__ = [
    "ns_classes",
    "ns_admin_classes",
    "ns_subjects",
    "ns_exam",
    "ns_scores",
    "ns_score_analysis",
    "ns_exam_import",
    "ns_course_schedule",
]
