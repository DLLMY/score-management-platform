import type { ReactNode } from 'react';
/**
 * 班主任工作台概览页（WorkbenchOverview）的类型契约与静态配置。
 *
 * ENTRIES / GLOBAL_ENTRIES / defaultMetrics 均为纯数据（图标为组件引用，非 JSX），
 * 与视图层同侧；逻辑层只消费。
 */

import { useWorkbenchClass } from '../../hooks';
import type {
  AttendanceStats,
  HomeworkAssignment,
  MentalHealthAlert,
  StudyGroup,
} from '../../types';

import {
  Grid3x3,
  ClipboardList,
  Users,
  Phone,
  BookCheck,
  CalendarCheck,
  Heart,
  PartyPopper,
  Palette,
  GraduationCap,
  Smartphone,
  MessageSquareQuote,
  Building2,
  FileText,
  Bell,
} from 'lucide-react';

export interface MetricData {
  attendance: AttendanceStats | null;
  homework: HomeworkAssignment[] | null;
  alerts: MentalHealthAlert[] | null;
  groups: StudyGroup[] | null;
  activityCount: number | null;
  dutyCount: number | null;
}

export interface EntryItem {
  path: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  /** 入口所需权限（必填：ENTRIES / GLOBAL_ENTRIES 各项均显式声明） */
  permission: string;
}

export const ENTRIES: EntryItem[] = [
  {
    path: '/seating-chart',
    label: '座次表',
    description: '座位编排与调整',
    icon: Grid3x3,
    gradient: 'from-emerald-500 to-teal-500',
    permission: 'class.view',
  },
  {
    path: '/duty-roster',
    label: '值日生表',
    description: '值日组与任务分配',
    icon: ClipboardList,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    permission: 'class.view',
  },
  {
    path: '/committee',
    label: '班委名单',
    description: '班委职位与任期',
    icon: Users,
    gradient: 'from-amber-500 to-orange-500',
    permission: 'class.view',
  },
  {
    path: '/parent-contact',
    label: '家长联系',
    description: '联系方式与沟通日志',
    icon: Phone,
    gradient: 'from-cyan-500 to-blue-500',
    permission: 'class.view',
  },
  {
    path: '/homework-check',
    label: '作业检查',
    description: '布置、提交与批改',
    icon: BookCheck,
    gradient: 'from-blue-500 to-indigo-500',
    permission: 'homework.view',
  },
  {
    path: '/attendance',
    label: '考勤管理',
    description: '记录考勤与请假审批',
    icon: CalendarCheck,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    permission: 'attendance.view',
  },
  {
    path: '/study-groups',
    label: '学习小组',
    description: '小组成员与积分',
    icon: Users,
    gradient: 'from-purple-500 to-pink-500',
    permission: 'study_group.view',
  },
  {
    path: '/mental-health',
    label: '心理健康',
    description: '心理记录与预警',
    icon: Heart,
    gradient: 'from-cyan-500 via-blue-500 to-indigo-500',
    permission: 'mental_health.view',
  },
  {
    path: '/activity',
    label: '文体活动',
    description: '活动发布与报名',
    icon: PartyPopper,
    gradient: 'from-pink-500 to-rose-500',
    permission: 'activity.view',
  },
  {
    path: '/culture',
    label: '班级文化',
    description: '文化墙与展示',
    icon: Palette,
    gradient: 'from-violet-500 to-purple-500',
    permission: 'culture.view',
  },
  {
    path: '/study-guide',
    label: '学法指导',
    description: '学法经验与计划',
    icon: GraduationCap,
    gradient: 'from-orange-500 to-amber-500',
    permission: 'study_guide.view',
  },
  {
    path: '/teacher-comments',
    label: '评语管理',
    description: '学生阶段评价与寄语',
    icon: MessageSquareQuote,
    gradient: 'from-emerald-500 to-teal-500',
    permission: 'comment.view',
  },
  {
    path: '/phonebox-policy',
    label: '手机箱开箱策略',
    description: '开箱时段与规则',
    icon: Smartphone,
    gradient: 'from-slate-600 to-slate-800',
    permission: 'phonebox.unlock.manage',
  },
];

/** 工作台常用的全局模块快捷入口（P2 修复：此前总览页无这些入口） */
export const GLOBAL_ENTRIES: EntryItem[] = [
  {
    path: '/users',
    label: '学生信息',
    description: '本班学生名单与档案',
    icon: Users,
    gradient: 'from-blue-500 to-indigo-500',
    permission: 'student.view',
  },
  {
    path: '/class-management',
    label: '班级管理',
    description: '班级信息与班主任分配',
    icon: Building2,
    gradient: 'from-slate-500 to-slate-700',
    permission: 'class.view',
  },
  {
    path: '/score-records',
    label: '成绩档案',
    description: '查看积分与成绩明细',
    icon: FileText,
    gradient: 'from-purple-500 to-violet-500',
    permission: 'score.view',
  },
  {
    path: '/notifications',
    label: '通知发布',
    description: '向学生推送通知消息',
    icon: Bell,
    gradient: 'from-rose-500 to-pink-500',
    permission: 'notification.view',
  },
];

export const defaultMetrics: MetricData = {
  attendance: null,
  homework: null,
  alerts: null,
  groups: null,
  activityCount: null,
  dutyCount: null,
};

/** 当前班级 state（来自 useWorkbenchClass） */
export type WorkbenchClassTuple = ReturnType<typeof useWorkbenchClass>;

/**
 * 班主任工作台概览页视图层（WorkbenchOverviewView）所需的全部 props。
 */
export interface WorkbenchOverviewViewProps {
  /** 当前班级筛选（0 = 全部班级） */
  filterClassId: WorkbenchClassTuple[0];
  setFilterClassId: WorkbenchClassTuple[1];
  /** 各指标卡数据 */
  metrics: MetricData;
  loading: boolean;
  refreshing: boolean;
  loadMetrics: (silent?: boolean) => Promise<void>;
  /** 按权限过滤后的班级入口 */
  visibleEntries: EntryItem[];
  /** 按权限过滤后的全局入口 */
  visibleGlobals: EntryItem[];
  /** 指标卡渲染器（返回 JSX） */
  renderStat: (
    label: string,
    value: string | number | null,
    sub: string | undefined,
    icon: React.ReactNode,
    iconGradient: string,
    decoGradient: string,
    link?: { path: string; permission: string }
  ) => React.ReactNode;
  /** 待交作业数（数据未就绪时为 null，由 renderStat 渲染占位） */
  pendingHomework: number | null;
  /** 未处理心理预警数（同上） */
  unresolvedAlerts: number | null;
}
