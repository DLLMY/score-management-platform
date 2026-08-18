export interface PermissionDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
}

export interface MenuItemConfig {
  path: string;
  label: string;
  icon: string;
  permission?: string;
  permissions?: string[];
}

export interface MenuGroupConfig {
  id: string;
  label: string;
  icon: string;
  items: MenuItemConfig[];
  requiresAdmin?: boolean;
  permission?: string;
  permissions?: string[];
}

export const PERMISSIONS: PermissionDefinition[] = [
  // 系统管理
  { code: 'all', name: '全部权限', description: '拥有系统所有权限', category: '系统管理' },
  { code: 'admin_manage', name: '管理员管理', description: '管理管理员账号', category: '系统管理' },
  { code: 'system.view', name: '系统查看', description: '查看系统健康/性能/统计等监控数据', category: '系统管理' },
  { code: 'system.settings', name: '系统设置', description: '管理系统设置', category: '系统管理' },
  { code: 'system.users', name: '用户管理', description: '管理系统用户', category: '系统管理' },
  { code: 'system.roles', name: '角色管理', description: '管理用户角色', category: '系统管理' },
  { code: 'system.logs', name: '查看日志', description: '查看系统日志', category: '系统管理' },
  { code: 'system.monitor', name: '系统监控', description: '监控系统运行状态', category: '系统管理' },
  { code: 'system.cache', name: '缓存管理', description: '管理系统缓存', category: '系统管理' },
  { code: 'system.backup', name: '备份管理', description: '数据库备份与恢复', category: '系统管理' },
  { code: 'ops_center.view', name: '运维中心查看', description: '查看系统运维中心聚合仪表盘', category: '系统管理' },

  // 学生管理
  { code: 'student.view', name: '查看学生', description: '查看学生信息', category: '学生管理' },
  { code: 'student.edit', name: '编辑学生', description: '编辑学生信息', category: '学生管理' },
  { code: 'student.create', name: '创建学生', description: '创建学生信息', category: '学生管理' },
  { code: 'student.delete', name: '删除学生', description: '删除学生信息', category: '学生管理' },

  // 教务管理
  { code: 'class.view', name: '查看班级', description: '查看班级信息', category: '教务管理' },
  { code: 'class.edit', name: '编辑班级', description: '编辑班级信息', category: '教务管理' },
  { code: 'class.manage', name: '管理班级', description: '班级创建/删除等管理操作', category: '教务管理' },
  { code: 'subject.view', name: '查看科目', description: '查看科目信息', category: '教务管理' },
  { code: 'subject.manage', name: '管理科目', description: '科目增删改管理', category: '教务管理' },
  { code: 'schedule.view', name: '查看课程表', description: '查看课程表信息', category: '教务管理' },
  { code: 'schedule.manage', name: '管理课程表', description: '课程表增删改', category: '教务管理' },
  { code: 'period.view', name: '查看课程节次', description: '查看课程节次信息', category: '教务管理' },
  { code: 'period.manage', name: '管理课程节次', description: '课程节次增删改', category: '教务管理' },
  { code: 'timetable.rule.manage', name: '管理时间规则', description: '时间规则增删改', category: '教务管理' },

  // 积分管理
  { code: 'rule.view', name: '查看规则', description: '查看积分规则', category: '积分管理' },
  { code: 'rule.manage', name: '管理规则', description: '积分规则增删改', category: '积分管理' },
  { code: 'score.view', name: '查看积分', description: '查看积分信息', category: '积分管理' },
  { code: 'score.entry', name: '录入积分', description: '录入学生成绩', category: '积分管理' },
  { code: 'score.edit', name: '修改成绩', description: '修改已录入成绩、确认/批量操作', category: '积分管理' },
  { code: 'score.delete', name: '删除成绩', description: '删除成绩记录', category: '积分管理' },
  { code: 'score.approve', name: '审批积分', description: '审批积分调整', category: '积分管理' },

  // 设备管理
  { code: 'device.view', name: '查看设备', description: '查看设备信息', category: '设备管理' },
  { code: 'device.edit', name: '编辑设备', description: '编辑设备信息', category: '设备管理' },
  { code: 'device.create', name: '创建设备', description: '创建设备', category: '设备管理' },
  { code: 'device.delete', name: '删除设备', description: '删除设备', category: '设备管理' },
  { code: 'device.groups', name: '设备分组', description: '管理设备分组', category: '设备管理' },
  { code: 'phonebox.unlock.manage', name: '手机箱开箱策略', description: '管理手机箱开箱策略与放行', category: '设备管理' },

  // 成绩管理
  { code: 'exam.view', name: '查看考试', description: '查看考试信息', category: '成绩管理' },
  { code: 'exam.manage', name: '管理考试', description: '考试增删改', category: '成绩管理' },

  // 数据分析
  { code: 'algorithm.view', name: '查看算法', description: '查看算法分析结果', category: '数据分析' },
  { code: 'algorithm.manage', name: '管理分析', description: '管理算法分析参数与任务', category: '数据分析' },
  { code: 'data.view', name: '查看数据', description: '查看数据统计', category: '数据分析' },
  { code: 'data_analysis', name: '数据分析', description: '数据深度分析', category: '数据分析' },

  // 数据管理
  { code: 'data.export', name: '导出数据', description: '导出系统数据', category: '数据管理' },
  { code: 'data.import', name: '导入数据', description: '导入系统数据', category: '数据管理' },

  // 报表
  { code: 'report.export', name: '导出报表', description: '导出统计报表', category: '报表' },
  { code: 'report.import', name: '导入报表', description: '导入报表数据', category: '报表' },

  // 通知中心
  { code: 'notification.view', name: '查看通知', description: '查看通知信息', category: '通知中心' },
  { code: 'notification.send', name: '发送通知', description: '发送通知', category: '通知中心' },
  { code: 'notification.force_send', name: '强制下发', description: '远程强制下发通知（含紧急广播）', category: '通知中心' },

  // 班主任工作台 - 作业管理
  { code: 'homework.view', name: '查看作业', description: '查看作业信息', category: '班主任工作台' },
  { code: 'homework.edit', name: '编辑作业', description: '编辑作业信息', category: '班主任工作台' },
  { code: 'homework.check', name: '批改作业', description: '批改作业', category: '班主任工作台' },

  // 班主任工作台 - 考勤管理
  { code: 'attendance.view', name: '查看考勤', description: '查看考勤信息', category: '班主任工作台' },
  { code: 'attendance.edit', name: '编辑考勤', description: '编辑考勤信息', category: '班主任工作台' },
  { code: 'attendance.approve', name: '审批请假', description: '审批请假申请', category: '班主任工作台' },

  // 班主任工作台 - 心理健康
  { code: 'mental_health.view', name: '查看心理健康', description: '查看心理健康记录', category: '班主任工作台' },
  { code: 'mental_health.edit', name: '编辑心理健康', description: '编辑心理健康记录', category: '班主任工作台' },

  // 班主任工作台 - 文体活动
  { code: 'activity.view', name: '查看活动', description: '查看文体活动', category: '班主任工作台' },
  { code: 'activity.edit', name: '编辑活动', description: '编辑文体活动', category: '班主任工作台' },

  // 班主任工作台 - 班级文化
  { code: 'culture.view', name: '查看班级文化', description: '查看班级文化记录', category: '班主任工作台' },
  { code: 'culture.edit', name: '编辑班级文化', description: '编辑班级文化记录', category: '班主任工作台' },

  // 班主任工作台 - 学习小组
  { code: 'study_group.view', name: '查看学习小组', description: '查看学习小组', category: '班主任工作台' },
  { code: 'study_group.edit', name: '编辑学习小组', description: '编辑学习小组', category: '班主任工作台' },

  // 班主任工作台 - 学法指导
  { code: 'study_guide.view', name: '查看学法指导', description: '查看学法指导', category: '班主任工作台' },
  { code: 'study_guide.edit', name: '编辑学法指导', description: '编辑学法指导', category: '班主任工作台' },
];

export const PERMISSION_MAP: Record<string, PermissionDefinition> = 
  PERMISSIONS.reduce((acc, perm) => ({ ...acc, [perm.code]: perm }), {});

export const DEFAULT_PERMISSIONS_FOR_TEACHER: string[] = [
  'student.view',
  'class.view',
  'subject.view',
  'rule.view',
  'score.view',
  'score.entry',
  'device.view',
  'exam.view',
  'algorithm.view',
  'notification.view',
  'homework.view',
  'attendance.view',
  'mental_health.view',
  'activity.view',
  'study_group.view',
  'study_guide.view',
];

export const DEFAULT_PERMISSIONS_FOR_ADMIN: string[] = [
  'all',
];

export { ADMIN_ROLES } from '../utils/auth';

export const getPermissionByName = (name: string): PermissionDefinition | undefined => {
  return PERMISSIONS.find((p) => p.name === name);
};

export const getPermissionsByCategory = (category: string): PermissionDefinition[] => {
  return PERMISSIONS.filter((p) => p.category === category);
};

export const hasPermission = (permissions: string[], permissionCode: string): boolean => {
  if (permissions.includes('all')) return true;
  return permissions.includes(permissionCode);
};

export const hasAnyPermission = (permissions: string[], permissionCodes: string[]): boolean => {
  if (permissions.includes('all')) return true;
  return permissionCodes.some((code) => permissions.includes(code));
};

export const hasAllPermissions = (permissions: string[], permissionCodes: string[]): boolean => {
  if (permissions.includes('all')) return true;
  return permissionCodes.every((code) => permissions.includes(code));
};