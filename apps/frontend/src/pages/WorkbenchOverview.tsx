/**
 * 班主任工作台概览页（逻辑层）。
 *
 * 静态入口配置与指标卡类型已抽到 ./workbenchOverview/types，
 * 主渲染 JSX 已抽到 ./workbenchOverview/WorkbenchOverviewView；
 * 本文件只保留数据加载、权限过滤与指标派生。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { usePermissions, useWorkbenchClass } from '../hooks';
import { StatCard } from '../components';
import WorkbenchOverviewView from './workbenchOverview/WorkbenchOverviewView';
import {
  ENTRIES,
  GLOBAL_ENTRIES,
  defaultMetrics,
  type MetricData,
} from './workbenchOverview/types';

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

  const visibleEntries = useMemo(
    () => ENTRIES.filter((e) => hasPermission(e.permission)),
    [hasPermission]
  );
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
    <WorkbenchOverviewView
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      metrics={metrics}
      loading={loading}
      refreshing={refreshing}
      loadMetrics={loadMetrics}
      visibleEntries={visibleEntries}
      visibleGlobals={visibleGlobals}
      renderStat={renderStat}
      pendingHomework={pendingHomework}
      unresolvedAlerts={unresolvedAlerts}
    />
  );
}

export default WorkbenchOverview;
