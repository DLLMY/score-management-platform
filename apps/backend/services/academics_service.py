"""academics 域写入/事务路径薄封装（F17 防腐层渐进重构）。

按 F17 范式：仅将写入/事务路径的 db.session 内联逻辑收口到此模块，路由层保留
get_or_404（404 语义）、请求级校验、缓存失效、操作日志、跨切面副作用与响应构造。
只读 db.session.query 路径暂缓不动。逐字节复刻原响应体/状态码/错误。

原单体（1003 行 / 31 方法 + 13 个导入助手）按领域拆分至 services/academics/ 包：
管理员-班级关联 / 成绩导入 / 科目 / 科目批量导入 / 考试 / 成绩 / 课程表 / 导入配置
共 8 个 mixin；本类仅作多继承组合，__module__ 不变，消费者
 from services.academics_service import academics_service 的导入面保持不变。
"""

from services.academics._admin_class_mixin import _AdminClassMixin
from services.academics._course_schedule_mixin import _CourseScheduleMixin
from services.academics._exam_mixin import _ExamMixin
from services.academics._import_config_mixin import _ImportConfigMixin
from services.academics._score_import_mixin import _ScoreImportMixin
from services.academics._score_mixin import _ScoreMixin
from services.academics._subject_import_mixin import _SubjectImportMixin
from services.academics._subject_mixin import _SubjectMixin

__all__ = ["AcademicsService", "academics_service"]


class AcademicsService(
    _AdminClassMixin,
    _ScoreImportMixin,
    _SubjectMixin,
    _SubjectImportMixin,
    _ExamMixin,
    _ScoreMixin,
    _CourseScheduleMixin,
    _ImportConfigMixin,
):
    """academics 域写入/事务路径服务（多继承组合层，行为与拆分前完全一致）。"""


academics_service = AcademicsService()
