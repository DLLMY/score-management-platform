import bcrypt
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import delete as _sa_delete
from sqlalchemy import select as _sa_select
from sqlalchemy import update as _sa_update

db = SQLAlchemy()


# 反射结果缓存：父表名 -> [(子表, 子列)]，metadata 在运行期固定，可安全缓存
_CHILD_FK_CACHE = {}


def _child_foreign_keys(parent_table):
    """列出所有引用 parent_table 的 (子表, 子外键列)。"""
    cached = _CHILD_FK_CACHE.get(parent_table.name)
    if cached is not None:
        return cached
    result = []
    for table in db.metadata.sorted_tables:
        for fk in table.foreign_key_constraints:
            referred = fk.referred_table
            if referred is not None and referred.name == parent_table.name:
                for element in fk.elements:
                    result.append((table, element.parent))
    _CHILD_FK_CACHE[parent_table.name] = result
    return result


def cascade_delete_related_records(
    target, pk_value, nullable_action="set_null", _visited=None, _depth=0, _max_depth=8
):
    """递归清理所有引用某条父记录的子表数据，使父记录可以被安全删除。

    本项目 SQLite 启用了外键约束（config.py 的 "foreign_keys": 1 +
    utils/initializer.py 的 PRAGMA foreign_keys=ON），并且存在大量 NOT NULL 外键
    （如 scores.student_id / scores.exam_id / seating_seat.chart_id /
    duty_assignment.group_id）。直接 db.session.delete(obj) 会出现两类失败：
    ORM 先把子表外键置空触发 NOT NULL 报错，或数据库外键约束直接拦截删除。

    处理策略（按子外键是否可空区分，避免误删业务数据）：
      * NOT NULL 外键 -> 子记录必须删除；删除前先递归清理它自己的子表（多级级联，
        例如 class_info -> seating_chart -> seating_seat）。
      * 可空外键     -> 仅将该外键置为 NULL，保留业务数据。例如删除管理员时，
        scores.entered_by 会被解除引用，而不会连带删掉上万条成绩。

    参数 nullable_action 可设为 "delete"，让可空外键的子记录也一并删除，
    适用于「删除学生」这类需要彻底清理个人数据的场景。
    """
    table = getattr(target, "__table__", target)
    if _visited is None:
        _visited = set()
    key = (table.name, pk_value)
    if key in _visited or _depth > _max_depth:
        return
    _visited.add(key)

    for child_table, child_col in _child_foreign_keys(table):
        # 自引用表由 _visited 阻断循环
        if child_col.nullable and nullable_action == "set_null":
            db.session.execute(
                _sa_update(child_table).where(child_col == pk_value).values({child_col.name: None})
            )
            continue

        # 需要删除子记录：若子表自身还有孙表，先逐行递归清理
        if _child_foreign_keys(child_table):
            child_pk_cols = list(child_table.primary_key.columns)
            if child_pk_cols:
                child_pk = child_pk_cols[0]
                child_ids = (
                    db.session.execute(_sa_select(child_pk).where(child_col == pk_value))
                    .scalars()
                    .all()
                )
                for child_id in child_ids:
                    cascade_delete_related_records(
                        child_table,
                        child_id,
                        nullable_action=nullable_action,
                        _visited=_visited,
                        _depth=_depth + 1,
                        _max_depth=_max_depth,
                    )
        db.session.execute(_sa_delete(child_table).where(child_col == pk_value))


def cascade_delete_user_related_records(user_id):
    """删除用户前清理其全部关联记录（个人数据彻底清理，含可空外键子表）。"""
    cascade_delete_related_records(User, user_id, nullable_action="delete")


def is_bcrypt_hash(password: str) -> bool:
    """检查密码是否已经是bcrypt哈希"""
    return password is not None and len(password) >= 60 and password.startswith("$2b$")


def hash_password(password: str) -> str:
    """将明文密码转换为bcrypt哈希"""
    if is_bcrypt_hash(password):
        return password
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_by_id(model_class, obj_id):
    """通用的按ID查询方法"""
    if obj_id is None:
        return None
    return model_class.query.get(obj_id)


# 班主任工作台 - 座次表

# 班主任工作台 - 文体活动
from models.activity import Activity, ActivityRegistration
from models.alert_models import Alert, StudentCluster
from models.archive_models import (
    AttendanceArchive,
    OperationLogArchive,
    ScoreArchive,
)

# 班主任工作台 - 考勤管理
from models.attendance import Attendance

# 班主任工作台 - 班委名单
from models.committee import ClassCommittee, CommitteeTerm

# 班主任工作台 - 班级文化
from models.culture import CultureItem, CultureRecord
from models.device_models import (
    Device,
    DeviceFirmwareUpdate,
    DeviceGroup,
    DeviceGroupMapping,
    DeviceHeartbeat,
    FirmwareVersion,
    MQTTConfig,
    MQTTLog,
    PhoneBoxPolicy,
    ProcessedMessage,
)

# 班主任工作台 - 值日生表
from models.duty import DutyAssignment, DutyGroup

# 班主任工作台 - 作业检查
from models.homework import HomeworkAssignment, HomeworkSubmission

# 班主任工作台 - 心理健康
from models.mental_health import MentalHealthRecord
from models.nlp_models import (
    NLPBehaviorKeyword,
    NLPCorrection,
    NLPMatchResult,
    NLPModelTraining,
    NLPRuleUsage,
    NLPScoringRule,
)

# 通知配置（单行持久化，替代 current_app.config 内存实现）
from models.notification_config import NotificationConfig
from models.notify_models import (
    Approval,
    Notification,
    NotifyAudit,
    NotifyHistory,
    NotifyTemplate,
    ScheduledNotify,
)

# 班主任工作台 - 家长联系
from models.parent import ContactLog, ParentContact
from models.score_models import (
    ClassPeriod,
    CompositeScore,
    CourseSchedule,
    Exam,
    Score,
    ScoreCategory,
    ScoreRankRule,
    ScoreRecord,
    ScoreRule,
    Subject,
    SubjectClass,
    WarningConfig,
)
from models.seating import SeatingChart, SeatingSeat

# 班主任工作台 - 学习小组
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupScore

# 班主任工作台 - 学法指导
from models.study_guide import ImprovementPlan, StudyGuide
from models.system_models import (
    AdminClass,
    ClassInfo,
    FrontendErrorLog,
    FrontendPerfMetric,
    ImportConfig,
    OperationLog,
    RateLimitRecord,
    SystemConfig,
    SystemMetric,
    TimeRule,
)

# 班主任工作台 - 评语管理（P1 新增）
from models.teacher_comment import TeacherComment

# === F16 拆包：以下为新增子模块再导出（保持 from models import X 兼容）===
from models.user_models import (
    Admin,
    AdminRole,
    LoginAttempt,
    Permission,
    PermissionLog,
    RoleHierarchy,
    RolePermission,
    RolePermissionMapping,
    SecurityAudit,
    SubAccount,
    User,
)

# 显式导出清单（消除 pyflakes F401 再导出噪音；from models import X 保持兼容）
__all__ = [
    "Activity",
    "ActivityRegistration",
    "Admin",
    "AdminClass",
    "AdminRole",
    "Alert",
    "Approval",
    "Attendance",
    "AttendanceArchive",
    "ClassCommittee",
    "ClassInfo",
    "ClassPeriod",
    "CommitteeTerm",
    "CompositeScore",
    "ContactLog",
    "CourseSchedule",
    "CultureItem",
    "CultureRecord",
    "Device",
    "DeviceFirmwareUpdate",
    "DeviceGroup",
    "DeviceGroupMapping",
    "DeviceHeartbeat",
    "DutyAssignment",
    "DutyGroup",
    "Exam",
    "FirmwareVersion",
    "FrontendErrorLog",
    "FrontendPerfMetric",
    "HomeworkAssignment",
    "HomeworkSubmission",
    "ImportConfig",
    "ImprovementPlan",
    "LoginAttempt",
    "MQTTConfig",
    "MQTTLog",
    "MentalHealthRecord",
    "NLPBehaviorKeyword",
    "NLPCorrection",
    "NLPMatchResult",
    "NLPModelTraining",
    "NLPRuleUsage",
    "NLPScoringRule",
    "Notification",
    "NotificationConfig",
    "NotifyAudit",
    "NotifyHistory",
    "NotifyTemplate",
    "OperationLog",
    "OperationLogArchive",
    "ParentContact",
    "Permission",
    "PermissionLog",
    "PhoneBoxPolicy",
    "ProcessedMessage",
    "RateLimitRecord",
    "RoleHierarchy",
    "RolePermission",
    "RolePermissionMapping",
    "ScheduledNotify",
    "Score",
    "ScoreArchive",
    "ScoreCategory",
    "ScoreRankRule",
    "ScoreRecord",
    "ScoreRule",
    "SeatingChart",
    "SeatingSeat",
    "SecurityAudit",
    "StudentCluster",
    "StudyGroup",
    "StudyGroupMember",
    "StudyGroupScore",
    "StudyGuide",
    "SubAccount",
    "Subject",
    "SubjectClass",
    "SystemConfig",
    "SystemMetric",
    "TeacherComment",
    "TimeRule",
    "User",
    "WarningConfig",
    "db",
]
