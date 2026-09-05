import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
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
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  MessageSquareQuote,
  Building2,
  FileText,
  Bell,
} from 'lucide-react';
import api from '../services/api';
import type { AttendanceStats, HomeworkAssignment, MentalHealthAlert, StudyGroup } from '../types';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import { usePermissions } from '../hooks/usePermissions';
import { ClassSelect } from '../components/form/EntitySelect';
import { StatCard, Skeleton } from '../components';

/**
 * 班主任工作台总览页。
 *
 * 背景：工作台 12 个子页此前没有聚合落地页，进入工作台后只能逐个点开子页。
 * 本页作为默认落地页：顶部展示当前班级关键指标（考勤/作业/预警/小组/活动等），
 * 中部为 12 个子功能入口卡片，右上角班级筛选与各子页共享（useWorkbenchClass）。
 * 统计全部走现有 API（class_id 过滤），任何一路失败只置灰对应卡片，不阻断页面。
 */

interface MetricData {
  attendance: AttendanceStats | null;
  homework: HomeworkAssignment[] | null;
  alerts: MentalHealthAlert[] | null;
  groups: StudyGroup[] | null;
  activityCount: number | null;
  dutyCount: number | null;
}

interface EntryItem {
  path: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  permission?: string;
}

const ENTRIES: EntryItem[] = [
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
const GLOBAL_ENTRIES: EntryItem[] = [
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

const defaultMetrics: MetricData = {
  attendance: null,
  homework: null,
  alerts: null,
  groups: null,
  activityCount: null,
  dutyCount: null,
};

function WorkbenchOverview() {
  const { hasPermission } = usePermissions();
  // 与工作台各子页共享的班级筛选（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  const [metrics, setMetrics] = useState<MetricData>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const classId = filterClassId || undefined;
      try {
        // 各路独立容错：任一失败只影响对应指标卡
        const [attendance, homework, alerts, groups, activity, duty] = await Promise.allSettled([
          api.attendance.getStats(filterClassId || 0),
          api.homework.getAll(classId),
          api.mentalHealth.getAlerts(undefined, undefined, classId),
          api.studyGroup.getAll(classId),
          api.activity.getAll(classId),
          api.duty.getAll(classId),
        ]);
        setMetrics({
          attendance: attendance.status === 'fulfilled' ? attendance.value : null,
          homework: homework.status === 'fulfilled' ? homework.value.assignments : null,
          alerts: alerts.status === 'fulfilled' ? alerts.value.alerts : null,
          groups: groups.status === 'fulfilled' ? groups.value : null,
          activityCount: activity.status === 'fulfilled' ? activity.value.activities.length : null,
          dutyCount: duty.status === 'fulfilled' ? duty.value.groups.length : null,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filterClassId]
  );

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClassId]);

  const visibleEntries = useMemo(() => ENTRIES.filter((e) => hasPermission(e.permission)), [
    hasPermission,
  ]);
  const visibleGlobals = useMemo(
    () => GLOBAL_ENTRIES.filter((e) => hasPermission(e.permission)),
    [hasPermission]
  );

  const pendingHomework = useMemo(
    () => (metrics.homework ? metrics.homework.filter((h) => !h.is_completed).length : null),
    [metrics.homework]
  );
  const unresolvedAlerts = useMemo(
    () => (metrics.alerts ? metrics.alerts.filter((a) => !a.is_resolved).length : null),
    [metrics.alerts]
  );

  /** 指标卡点击下钻目标（C-1：数值卡 → 对应功能页，权限不足时不渲染链接） */
  interface MetricLink {
    path: string;
    permission: string;
  }

  const renderStat = (
    label: string,
    value: string | number | null,
    sub: string | undefined,
    icon: React.ReactNode,
    iconGradient: string,
    decoGradient: string,
    link?: MetricLink
  ) => {
    const body = (
      <>
        <StatCard
          label={label}
          value={value === null ? '—' : value}
          icon={icon}
          iconGradient={iconGradient}
          decoGradient={decoGradient}
          size='lg'
        />
        {sub && <p className='mt-2 text-xs text-slate-400 dark:text-slate-500'>{sub}</p>}
      </>
    );
    if (link && hasPermission(link.permission)) {
      return (
        <Link
          to={link.path}
          title={`查看${label}详情`}
          className='block rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60'
        >
          {body}
        </Link>
      );
    }
    return <div>{body}</div>;
  };

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
              <LayoutDashboard className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                班主任工作台
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                班级日常管理总览 · 指标与入口随班级筛选联动
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <CurrentClassLabel />
            <button
              onClick={() => loadMetrics(true)}
              disabled={refreshing || loading}
              className='flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:shadow-md transition-all font-medium disabled:opacity-50'
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className='flex-1 px-6 py-5 overflow-auto space-y-6'>
        {/* 关键指标 */}
        <section>
          <h2 className='text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3'>
            今日概览
          </h2>
          {loading ? (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={112} className='rounded-2xl' />
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              {renderStat(
                '出勤率',
                metrics.attendance && metrics.attendance.total > 0
                  ? `${metrics.attendance.attendance_rate}%`
                  : null,
                metrics.attendance && metrics.attendance.total > 0
                  ? `出勤 ${metrics.attendance.present} / 缺勤 ${metrics.attendance.absent}`
                  : '暂无考勤数据',
                <CheckCircle2 className='w-6 h-6 text-white' />,
                'from-emerald-500 to-teal-500',
                'from-emerald-500/10 to-teal-500/10',
                { path: '/attendance', permission: 'attendance.view' }
              )}
              {renderStat(
                '待完成作业',
                pendingHomework,
                metrics.homework ? `共 ${metrics.homework.length} 项作业` : '暂无作业数据',
                <BookCheck className='w-6 h-6 text-white' />,
                'from-blue-500 to-indigo-500',
                'from-blue-500/10 to-indigo-500/10',
                { path: '/homework-check?status=pending', permission: 'homework.view' }
              )}
              {renderStat(
                '未处理预警',
                unresolvedAlerts,
                metrics.alerts ? `共 ${metrics.alerts.length} 条心理预警` : '暂无预警数据',
                <AlertTriangle className='w-6 h-6 text-white' />,
                'from-amber-500 to-orange-500',
                'from-amber-500/10 to-orange-500/10',
                { path: '/mental-health?view=alerts&resolved=0', permission: 'mental_health.view' }
              )}
              {renderStat(
                '学习小组',
                metrics.groups ? metrics.groups.length : null,
                metrics.groups && metrics.groups.length > 0
                  ? `${metrics.groups.reduce((s, g) => s + (g.member_count || 0), 0)} 名成员`
                  : '暂无小组数据',
                <Users className='w-6 h-6 text-white' />,
                'from-purple-500 to-pink-500',
                'from-purple-500/10 to-pink-500/10',
                { path: '/study-groups', permission: 'study_group.view' }
              )}
              <div className='md:hidden' />
              {renderStat(
                '文体活动',
                metrics.activityCount,
                '已发布活动',
                <PartyPopper className='w-6 h-6 text-white' />,
                'from-pink-500 to-rose-500',
                'from-pink-500/10 to-rose-500/10',
                { path: '/activity?published=1', permission: 'activity.view' }
              )}
              {renderStat(
                '值日组',
                metrics.dutyCount,
                '当前值日安排',
                <ClipboardList className='w-6 h-6 text-white' />,
                'from-cyan-500 to-blue-500',
                'from-cyan-500/10 to-blue-500/10',
                { path: '/duty-roster', permission: 'class.view' }
              )}
              {renderStat(
                '迟到/请假',
                metrics.attendance && metrics.attendance.total > 0
                  ? metrics.attendance.late + metrics.attendance.leave
                  : null,
                metrics.attendance && metrics.attendance.total > 0
                  ? `迟到 ${metrics.attendance.late} · 请假 ${metrics.attendance.leave}`
                  : '暂无考勤数据',
                <Clock className='w-6 h-6 text-white' />,
                'from-orange-500 to-amber-500',
                'from-orange-500/10 to-amber-500/10',
                { path: '/attendance', permission: 'attendance.view' }
              )}
            </div>
          )}
        </section>

        {/* 功能入口 */}
        <section>
          <h2 className='text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3'>
            功能入口
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {visibleEntries.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  className='group bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg hover:shadow-slate-500/10 hover:-translate-y-0.5 transition-all duration-200'
                >
                  <div className='flex items-start justify-between'>
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${entry.gradient} flex items-center justify-center shadow-md`}
                    >
                      <Icon className='w-6 h-6 text-white' />
                    </div>
                    <ArrowRight className='w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all' />
                  </div>
                  <h3 className='mt-3 font-semibold text-slate-800 dark:text-slate-100'>
                    {entry.label}
                  </h3>
                  <p className='mt-0.5 text-xs text-slate-400 dark:text-slate-500'>
                    {entry.description}
                  </p>
                </Link>
              );
            })}
          </div>
          {visibleEntries.length === 0 && (
            <div className='text-center py-12 text-slate-400 dark:text-slate-500'>
              当前账号暂无班主任工作台功能权限
            </div>
          )}
        </section>

        {/* 常用全局模块（P2 修复：班级/学生/成绩/通知快捷入口） */}
        {visibleGlobals.length > 0 && (
          <section>
            <h2 className='text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3'>
              常用全局模块
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              {visibleGlobals.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.path}
                    to={entry.path}
                    className='group bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg hover:shadow-slate-500/10 hover:-translate-y-0.5 transition-all duration-200'
                  >
                    <div className='flex items-start justify-between'>
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${entry.gradient} flex items-center justify-center shadow-md`}
                      >
                        <Icon className='w-6 h-6 text-white' />
                      </div>
                      <ArrowRight className='w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all' />
                    </div>
                    <h3 className='mt-3 font-semibold text-slate-800 dark:text-slate-100'>
                      {entry.label}
                    </h3>
                    <p className='mt-0.5 text-xs text-slate-400 dark:text-slate-500'>
                      {entry.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default WorkbenchOverview;
