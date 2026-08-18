"""RBAC种子数据初始化 - 直接写入数据库"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "instance", "score_management.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 清理旧数据
for t in [
    "role_hierarchies",
    "admin_roles",
    "role_permission_mappings",
    "role_permission",
    "permissions",
]:
    cur.execute(f"DELETE FROM {t}")
conn.commit()
print("Cleared old RBAC data")

# 权限定义
permissions = [
    ("system.settings", "系统设置", "system", "管理平台系统设置"),
    ("system.users", "用户管理", "system", "管理用户和账户"),
    ("system.roles", "角色管理", "system", "管理角色和权限分配"),
    ("system.logs", "日志查看", "system", "查看系统操作日志"),
    ("system.backup", "备份恢复", "system", "数据备份与系统恢复"),
    ("system.cache", "缓存管理", "system", "管理系统缓存"),
    ("system.monitor", "系统监控", "system", "系统运行监控"),
    ("device.view", "查看设备", "device", "查看设备列表和信息"),
    ("device.create", "创建设备", "device", "注册添加新设备"),
    ("device.edit", "编辑设备", "device", "修改设备配置"),
    ("device.delete", "删除设备", "device", "删除设备"),
    ("device.groups", "设备分组管理", "device", "管理设备分组"),
    ("student.view", "查看学生", "academic", "查看学生信息"),
    ("student.create", "添加学生", "academic", "创建新学生"),
    ("student.edit", "编辑学生", "academic", "编辑学生信息"),
    ("student.delete", "删除学生", "academic", "删除学生"),
    ("score.view", "查看成绩", "academic", "查看积分/成绩"),
    ("score.entry", "录入成绩", "academic", "录入积分/成绩"),
    ("score.edit", "修改成绩", "academic", "修改积分/成绩"),
    ("score.delete", "删除成绩", "academic", "删除积分/成绩"),
    ("score.approve", "审批成绩", "academic", "审批积分调整"),
    ("class.view", "查看班级", "academic", "查看班级信息"),
    ("class.manage", "管理班级", "academic", "管理班级和分配班主任"),
    ("exam.view", "查看考试", "academic", "查看考试信息"),
    ("exam.manage", "管理考试", "academic", "管理考试和成绩"),
    ("rule.view", "查看规则", "academic", "查看积分规则"),
    ("rule.manage", "管理规则", "academic", "管理积分规则"),
    ("schedule.view", "查看课表", "academic", "查看课程安排"),
    ("schedule.manage", "管理课表", "academic", "管理课程安排"),
    ("subject.view", "查看科目", "academic", "查看科目信息"),
    ("subject.manage", "管理科目", "academic", "管理科目"),
    ("period.view", "查看时段", "academic", "查看课程时段"),
    ("period.manage", "管理时段", "academic", "管理课程时段"),
    ("notification.view", "查看通知", "communication", "查看通知消息"),
    ("notification.send", "发送通知", "communication", "发送通知消息"),
    ("notification.force_send", "强制发送通知", "communication", "跳过上课时间检查强制发送"),
    ("timetable.rule.manage", "管理时间规则", "academic", "管理上课时间规则"),
    ("phonebox.unlock.manage", "管理本班手机箱开箱策略", "device", "班主任管理本班手机箱开箱策略"),
    ("algorithm.view", "查看分析", "analysis", "查看算法分析结果"),
    ("algorithm.manage", "管理分析", "analysis", "管理分析模型"),
    ("report.export", "导出报表", "data", "导出数据报表"),
    ("report.import", "导入数据", "data", "导入外部数据"),
    ("data.view", "查看数据", "data", "查看数据概览"),
    ("data.export", "导出数据", "data", "导出业务数据"),
    ("data.import", "导入数据", "data", "导入业务数据"),
    ("data_analysis", "数据分析", "data", "数据分析功能"),
    ("homework.view", "查看作业", "classroom", "查看作业检查"),
    ("homework.edit", "编辑作业", "classroom", "编辑和批改作业"),
    ("homework.check", "批改作业", "classroom", "批改作业"),
    ("attendance.view", "查看考勤", "classroom", "查看考勤记录"),
    ("attendance.edit", "编辑考勤", "classroom", "编辑考勤"),
    ("attendance.approve", "审批请假", "classroom", "审批请假申请"),
    ("mental_health.view", "查看心理健康", "classroom", "查看心理记录"),
    ("mental_health.edit", "编辑心理健康", "classroom", "编辑心理记录"),
    ("activity.view", "查看活动", "classroom", "查看文体活动"),
    ("activity.edit", "编辑活动", "classroom", "编辑文体活动"),
    ("study_group.view", "查看学习小组", "classroom", "查看学习小组"),
    ("study_group.edit", "编辑学习小组", "classroom", "编辑学习小组"),
    ("study_guide.view", "查看学法指导", "classroom", "查看学法指导"),
    ("study_guide.edit", "编辑学法指导", "classroom", "编辑学法指导"),
    ("culture.view", "查看班级文化", "classroom", "查看班级文化记录"),
    ("culture.edit", "编辑班级文化", "classroom", "编辑班级文化记录"),
    ("class.edit", "编辑班级事务", "classroom", "座次表/值日生/班委/家长联系的写操作"),
    ("all", "全部权限", "system", "拥有所有权限"),
]

for p in permissions:
    cur.execute(
        'INSERT INTO permissions (code, name, category, description, is_active, created_at, updated_at) VALUES (?,?,?,?,1,datetime("now"),datetime("now"))',
        p,
    )
conn.commit()
print(f"Inserted {len(permissions)} permissions")

# 角色定义 (role_code, role_name, description, permissions_csv, is_active)
roles = [
    ("super_admin", "超级管理员", "系统最高权限", "all", 1),
    (
        "admin",
        "管理员",
        "普通管理员权限",
        "system.settings,system.users,system.roles,system.logs,system.backup,system.cache,system.monitor,device.view,device.create,device.edit,device.delete,device.groups,student.view,student.create,student.edit,student.delete,score.view,score.entry,score.edit,score.delete,score.approve,class.view,class.manage,exam.view,exam.manage,rule.view,rule.manage,notification.view,notification.send,algorithm.view,algorithm.manage,report.export,report.import,data.view,data.export,data.import,data_analysis",
        1,
    ),
    # class.edit 必须有：座次表/值日生/班委/家长联系 4 个模块的写端点全靠它把关
    (
        "teacher",
        "班主任",
        "管理班级事务",
        "student.view,student.edit,score.view,score.entry,class.view,class.edit,exam.view,rule.view,notification.view,notification.send,phonebox.unlock.manage,homework.view,homework.edit,homework.check,attendance.view,attendance.edit,attendance.approve,mental_health.view,mental_health.edit,activity.view,activity.edit,culture.view,culture.edit,study_group.view,study_group.edit,study_guide.view,study_guide.edit",
        1,
    ),
    (
        "subject_teacher",
        "任课教师",
        "查看授课班级",
        "student.view,score.view,score.entry,class.view,exam.view,notification.view,data.view",
        1,
    ),
    (
        "head_teacher",
        "年级组长",
        "管理年级事务",
        "student.view,student.edit,score.view,score.entry,score.approve,class.view,class.manage,exam.view,exam.manage,rule.view,notification.view,notification.send,homework.view,attendance.view,attendance.approve,mental_health.view,activity.view,study_group.view,data.view,data.export,report.export,timetable.rule.manage",
        1,
    ),
    (
        "dashboard_viewer",
        "数据大屏",
        "数据展示",
        "data.view,data_analysis,algorithm.view,report.export,device.view,student.view,score.view,class.view",
        1,
    ),
    (
        "operator",
        "运维人员",
        "设备运维",
        "device.view,device.edit,device.groups,system.logs,system.monitor,notification.view",
        1,
    ),
    (
        "viewer",
        "查看者",
        "仅查看",
        "device.view,student.view,score.view,class.view,exam.view,rule.view,notification.view,data.view,algorithm.view",
        1,
    ),
]

for r in roles:
    cur.execute(
        'INSERT INTO role_permission (role_code, role_name, description, is_active, created_at, updated_at) VALUES (?,?,?,?,datetime("now"),datetime("now"))',
        (r[0], r[1], r[2], r[4]),
    )
    # 创建 role_permission_mappings
    for pc in r[3].split(","):
        cur.execute(
            'INSERT INTO role_permission_mappings (role_code, permission_code, created_at) VALUES (?,?,datetime("now"))',
            (r[0], pc.strip()),
        )
conn.commit()
print(f"Inserted {len(roles)} roles with permission mappings")

# 分配角色给现有管理员
cur.execute(
    'INSERT OR IGNORE INTO admin_roles (admin_id, role_code, assigned_at) VALUES (1,"super_admin",datetime("now"))'
)
cur.execute(
    'INSERT OR IGNORE INTO admin_roles (admin_id, role_code, assigned_at) VALUES (2,"teacher",datetime("now"))'
)
conn.commit()
print("Assigned roles to admins (admin=super_admin, teacher=teacher)")

# 验证
cur.execute("SELECT COUNT(*) FROM permissions")
print(f"Total permissions: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM role_permission")
print(f"Total roles: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM role_permission_mappings")
print(f"Total mappings: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM admin_roles")
print(f"Total admin-role assignments: {cur.fetchone()[0]}")

conn.close()
print("DONE")
