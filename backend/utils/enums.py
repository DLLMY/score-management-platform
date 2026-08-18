"""全项目统一枚举常量（单一真源）。

整理二次字段统一化复查中发现的多处枚举发散：
- 告警 severity 在后端 alert_service 用 level(info/warning/error)、前端 types 用 high/medium/low、
  DeviceManagement 用 critical/error/warning/info、SecurityAudit 用五值 → 统一为 ALERT_SEVERITY。
- 通知 priority 后端默认 normal、admin 路由 high/medium/low、前端含 urgent → 统一为 NOTIFICATION_PRIORITY。
- 状态枚举（Exam/Score/CompositeScore/审批/考勤）四处发散 → 统一常量集合。

纯常量模块，被模型默认值与路由序列化引用，不引入运行时副作用。
"""

# 告警严重级别（单一真源）
ALERT_SEVERITY = ["info", "warning", "error", "critical"]
ALERT_SEVERITY_DEFAULT = "info"

# 通知优先级（单一真源；low/medium/high 与 admin 路由对齐，normal 为历史默认，urgent 为前端Dashboard 既有取值）
NOTIFICATION_PRIORITY = ["normal", "low", "medium", "high", "urgent"]
NOTIFICATION_PRIORITY_DEFAULT = "normal"

# 通用状态（Exam.status 曾用 draft、Score.status 曾用 pending、CompositeScore 曾用 active）
GENERIC_STATUS = ["pending", "active", "draft", "published", "closed", "archived"]

# 审批状态
APPROVAL_STATUS = ["pending", "approved", "rejected", "cancelled"]
APPROVAL_STATUS_DEFAULT = "pending"

# 考勤状态
ATTENDANCE_STATUS = ["present", "absent", "late", "leave"]
ATTENDANCE_STATUS_DEFAULT = "present"

# 通知已读状态别名（兼容历史 status='read' 标记）
NOTIFICATION_READ_STATUS = "read"
