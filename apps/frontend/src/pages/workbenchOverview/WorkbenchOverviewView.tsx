import React from 'react';
/**
 * 班主任工作台概览页视图层。
 *
 * 承接原 WorkbenchOverview.tsx 的主渲染 JSX，全部数据经
 * WorkbenchOverviewViewProps 注入。
 */

import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  BookCheck,
  PartyPopper,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Skeleton, CurrentClassLabel, ClassSelect } from '../../components';
import type { WorkbenchOverviewViewProps } from './types';

const WorkbenchOverviewView: React.FC<WorkbenchOverviewViewProps> = ({
  filterClassId,
  setFilterClassId,
  metrics,
  loading,
  refreshing,
  loadMetrics,
  visibleEntries,
  visibleGlobals,
  renderStat,
  pendingHomework,
  unresolvedAlerts,
}) => {
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
};

export default WorkbenchOverviewView;
