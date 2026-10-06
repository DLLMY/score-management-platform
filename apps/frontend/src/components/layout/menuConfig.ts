// 侧边栏导航静态配置（T12 拆分：自 Sidebar.tsx 原样搬出，行为逐字节等价）
// 纯数据模块：不含逻辑，仅供 Sidebar 组装使用
import {
  Users,
  BookOpen,
  Tags,
  BarChart3,
  GraduationCap,
  Settings,
  Trophy,
  Box,
  Bell,
  ClipboardCheck,
  Home,
  Shield,
  FileKey,
  Activity,
  Sliders,
  Sparkles,
  History,
  Power,
  Upload,
  Server,
  Calendar,
  Gauge,
  LineChart,
  Clock,
  Building2,
  RefreshCw,
  Grid3x3,
  ClipboardList,
  Phone,
  BookCheck,
  CalendarCheck,
  Heart,
  PartyPopper,
  Palette,
  Smartphone,
  LayoutDashboard,
  MessageSquareQuote,
  LucideIcon,
} from 'lucide-react';

// 类型定义
export interface MenuItemData {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: MenuItemData[];
  requiresAdmin?: boolean;
  permission?: string;
  permissions?: string[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'main',
    label: '首页',
    icon: Home,
    items: [
      { path: '/dashboard', label: '数据概览', icon: Activity, permission: 'score.view' },
      { path: '/users', label: '学生管理', icon: Users, permission: 'student.view' },
      { path: '/analysis', label: '数据分析', icon: BarChart3, permission: 'algorithm.view' },
      {
        path: '/class-compare',
        label: '班级对比',
        icon: BarChart3,
        permission: 'algorithm.view',
      },
    ],
  },
  {
    id: 'scoreManagement',
    label: '积分管理',
    icon: Trophy,
    items: [
      { path: '/rules', label: '积分规则', icon: FileKey, permission: 'rule.view' },
      { path: '/rank-rules', label: '排名规则', icon: Trophy, permission: 'rule.view' },
      { path: '/categories', label: '分类管理', icon: Tags, permission: 'rule.view' },
      {
        path: '/nlp-management',
        label: '智能评分',
        icon: Sparkles,
        permission: 'algorithm.view',
      },
    ],
  },
  {
    id: 'academicManagement',
    label: '教务管理',
    icon: GraduationCap,
    items: [
      {
        path: '/class-management',
        label: '班级管理',
        icon: Building2,
        permission: 'class.view',
      },
      {
        path: '/subject-management',
        label: '科目管理',
        icon: BookOpen,
        permission: 'subject.view',
      },
      {
        path: '/course-schedule',
        label: '课程表管理',
        icon: Calendar,
        permission: 'schedule.view',
      },
      {
        path: '/class-time-settings',
        label: '时间规则设置',
        icon: Clock,
        permission: 'schedule.view',
      },
      {
        path: '/class-period-settings',
        label: '课程节次管理',
        icon: Clock,
        permission: 'period.view',
      },
    ],
  },
  {
    id: 'teacherWorkbench',
    label: '班主任工作台',
    icon: Users,
    items: [
      {
        path: '/workbench',
        label: '工作台总览',
        icon: LayoutDashboard,
        permission: 'class.view',
      },
      { path: '/seating-chart', label: '座次表', icon: Grid3x3, permission: 'class.view' },
      {
        path: '/duty-roster',
        label: '值日生表',
        icon: ClipboardList,
        permission: 'class.view',
      },
      { path: '/committee', label: '班委名单', icon: Users, permission: 'class.view' },
      { path: '/parent-contact', label: '家长联系', icon: Phone, permission: 'class.view' },
      {
        path: '/homework-check',
        label: '作业检查',
        icon: BookCheck,
        permission: 'homework.view',
      },
      {
        path: '/attendance',
        label: '考勤管理',
        icon: CalendarCheck,
        permission: 'attendance.view',
      },
      { path: '/study-groups', label: '学习小组', icon: Users, permission: 'study_group.view' },
      {
        path: '/mental-health',
        label: '心理健康',
        icon: Heart,
        permission: 'mental_health.view',
      },
      { path: '/activity', label: '文体活动', icon: PartyPopper, permission: 'activity.view' },
      { path: '/culture', label: '班级文化', icon: Palette, permission: 'culture.view' },
      {
        path: '/study-guide',
        label: '学法指导',
        icon: GraduationCap,
        permission: 'study_guide.view',
      },
      {
        path: '/teacher-comments',
        label: '评语管理',
        icon: MessageSquareQuote,
        permission: 'comment.view',
      },
      {
        path: '/phonebox-policy',
        label: '手机箱开箱策略',
        icon: Smartphone,
        permission: 'phonebox.unlock.manage',
      },
      {
        path: '/leave-management',
        label: '请假管理',
        icon: Calendar,
        permission: 'phonebox.unlock.manage',
      },
    ],
  },
  {
    id: 'examManagement',
    label: '成绩管理',
    icon: ClipboardCheck,
    items: [
      { path: '/exams', label: '考试管理', icon: ClipboardCheck, permission: 'exam.view' },
      { path: '/score-entry', label: '成绩录入', icon: FileKey, permission: 'score.entry' },
      { path: '/score-records', label: '成绩档案', icon: BookOpen, permission: 'score.view' },
      {
        path: '/score-analysis',
        label: '成绩分析',
        icon: BarChart3,
        permission: 'algorithm.view',
      },
      {
        path: '/algorithm-analysis',
        label: '算法分析',
        icon: Sparkles,
        permission: 'algorithm.view',
      },
    ],
  },
  {
    id: 'deviceManagement',
    label: '设备管理',
    icon: Box,
    items: [
      { path: '/devices', label: '设备管理', icon: Box, permission: 'device.view' },
      { path: '/device-groups', label: '设备分组', icon: Server, permission: 'device.view' },
      { path: '/firmware', label: '固件管理', icon: Upload, permission: 'firmware.manage' },
    ],
  },
  {
    id: 'notificationCenter',
    label: '通知中心',
    icon: Bell,
    items: [
      {
        path: '/notifications',
        label: '通知管理',
        icon: Bell,
        permission: 'notification.view',
      },
      {
        path: '/approvals',
        label: '审批管理',
        icon: ClipboardCheck,
        permission: 'score.approve',
      },
      {
        path: '/remote-notify',
        label: '远程通知',
        icon: Bell,
        permission: 'notification.send',
      },
      { path: '/wake-on-lan', label: '远程开机', icon: Power, permission: 'device.edit' },
    ],
  },
  {
    id: 'systemAdmin',
    label: '系统管理',
    icon: Settings,
    permission: 'system.settings',
    items: [
      { path: '/settings', label: '系统设置', icon: Sliders, permission: 'system.settings' },
      { path: '/permission', label: '权限管理', icon: Shield, permission: 'system.roles' },

      { path: '/data-sync', label: '数据同步', icon: RefreshCw, permission: 'system.settings' },
    ],
  },
  {
    id: 'opsCenter',
    label: '运维中心',
    icon: Server,
    permission: 'ops_center.view',
    items: [
      { path: '/ops-center', label: '运维总览', icon: Activity, permission: 'ops_center.view' },
      {
        path: '/ops-center/telemetry',
        label: '前端遥测',
        icon: Gauge,
        permission: 'ops_center.view',
      },
      {
        path: '/ops-center/metrics',
        label: '系统指标趋势',
        icon: LineChart,
        permission: 'ops_center.view',
      },
      { path: '/diagnostics', label: '系统诊断', icon: Server, permission: 'device.view' },
      {
        path: '/security-audit',
        label: '安全审计',
        icon: Shield,
        permission: 'system.settings',
      },
      { path: '/operation-logs', label: '操作日志', icon: History, permission: 'system.logs' },
    ],
  },
];
