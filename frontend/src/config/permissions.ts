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
  { code: 'all', name: '全部权限', description: '拥有系统所有权限', category: '系统管理' },
  
  { code: 'student.view', name: '查看学生', description: '查看学生信息', category: '学生管理' },
  { code: 'student.edit', name: '编辑学生', description: '编辑学生信息', category: '学生管理' },
  { code: 'student.create', name: '创建学生', description: '创建学生信息', category: '学生管理' },
  { code: 'student.delete', name: '删除学生', description: '删除学生信息', category: '学生管理' },
  
  { code: 'class.view', name: '查看班级', description: '查看班级信息', category: '教务管理' },
  { code: 'class.edit', name: '编辑班级', description: '编辑班级信息', category: '教务管理' },
  { code: 'class.create', name: '创建班级', description: '创建班级', category: '教务管理' },
  { code: 'class.delete', name: '删除班级', description: '删除班级', category: '教务管理' },
  
  { code: 'subject.view', name: '查看科目', description: '查看科目信息', category: '教务管理' },
  { code: 'subject.edit', name: '编辑科目', description: '编辑科目信息', category: '教务管理' },
  { code: 'subject.create', name: '创建科目', description: '创建科目', category: '教务管理' },
  { code: 'subject.delete', name: '删除科目', description: '删除科目', category: '教务管理' },
  
  { code: 'schedule.view', name: '查看课程表', description: '查看课程表信息', category: '教务管理' },
  { code: 'schedule.edit', name: '编辑课程表', description: '编辑课程表信息', category: '教务管理' },
  
  { code: 'period.view', name: '查看课程节次', description: '查看课程节次信息', category: '教务管理' },
  { code: 'period.edit', name: '编辑课程节次', description: '编辑课程节次信息', category: '教务管理' },
  
  { code: 'rule.view', name: '查看规则', description: '查看积分规则', category: '积分管理' },
  { code: 'rule.edit', name: '编辑规则', description: '编辑积分规则', category: '积分管理' },
  { code: 'rule.create', name: '创建规则', description: '创建积分规则', category: '积分管理' },
  { code: 'rule.delete', name: '删除规则', description: '删除积分规则', category: '积分管理' },
  
  { code: 'score.view', name: '查看积分', description: '查看积分信息', category: '积分管理' },
  { code: 'score.entry', name: '录入积分', description: '录入学生成绩', category: '积分管理' },
  { code: 'score.approve', name: '审批积分', description: '审批积分调整', category: '积分管理' },
  
  { code: 'device.view', name: '查看设备', description: '查看设备信息', category: '设备管理' },
  { code: 'device.edit', name: '编辑设备', description: '编辑设备信息', category: '设备管理' },
  { code: 'device.create', name: '创建设备', description: '创建设备', category: '设备管理' },
  { code: 'device.delete', name: '删除设备', description: '删除设备', category: '设备管理' },
  
  { code: 'firmware.manage', name: '固件管理', description: '管理设备固件', category: '设备管理' },
  
  { code: 'exam.view', name: '查看考试', description: '查看考试信息', category: '成绩管理' },
  { code: 'exam.edit', name: '编辑考试', description: '编辑考试信息', category: '成绩管理' },
  { code: 'exam.create', name: '创建考试', description: '创建考试', category: '成绩管理' },
  
  { code: 'algorithm.view', name: '查看算法', description: '查看算法分析结果', category: '数据分析' },
  
  { code: 'notification.view', name: '查看通知', description: '查看通知信息', category: '通知中心' },
  { code: 'notification.send', name: '发送通知', description: '发送通知', category: '通知中心' },
  
  { code: 'system.settings', name: '系统设置', description: '管理系统设置', category: '系统管理' },
  { code: 'system.roles', name: '角色管理', description: '管理用户角色', category: '系统管理' },
  { code: 'system.logs', name: '查看日志', description: '查看系统日志', category: '系统管理' },
  { code: 'system.view', name: '系统查看', description: '查看系统健康/性能/统计等监控数据', category: '系统管理' },
  { code: 'ops_center.view', name: '运维中心查看', description: '查看系统运维中心聚合仪表盘', category: '系统管理' },

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