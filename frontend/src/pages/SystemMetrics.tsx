/**
 * 系统指标趋势查看页（运维中心 · 阶段三）
 * 消费后端采样接口：
 *   GET /api/system/metrics  （系统指标历史采样：cpu_percent / memory_percent / disk_percent / net_sent / net_recv）
 * 由 api/system/system_routes.py 提供（requires_permission ops_center.view）。
 * 采样由 services/system_metric_service.py 后台守护线程每 60s 写入 system_metrics 表。
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart as LineChartIcon,
  RefreshCw,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PermissionButton, EmptyState } from '../components';
import { getAuthHeaders } from '../services/api';

interface MetricRow {
  id: number;
  metric_name: string;
  metric_value: number;
  unit?: string | null;
  category?: string | null;
  created_at: string;
}

interface MetricsResult {
  items: MetricRow[];
  latest: Record<string, { value: number; unit?: string | null; updated_at?: string | null }>;
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) return null;
    const env = await res.json();
    return ((env && 'data' in env ? env.data : env) ?? null) as T | null;
  } catch {
    return null;
  }
}

const HOUR_OPTIONS = [
  { value: 1, label: '近 1 小时' },
  { value: 6, label: '近 6 小时' },
  { value: 24, label: '近 24 小时' },
  { value: 72, label: '近 3 天' },
  { value: 168, label: '近 7 天' },
];

// 把扁平的采样行（每次采样写 5 行）按分钟归并成一条时间序列点
function buildSeries(rows: MetricRow[]): Array<Record<string, number | string>> {
  const byMinute = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const minute = (r.created_at || '').slice(0, 16); // YYYY-MM-DDTHH:MM
    if (!minute) continue;
    let pt = byMinute.get(minute);
    if (!pt) {
      pt = { t: minute };
      byMinute.set(minute, pt);
    }
    pt[r.metric_name] = r.metric_value;
  }
  return Array.from(byMinute.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
}

const CHART_COLORS: Record<string, string> = {
  cpu_percent: '#3b82f6',
  memory_percent: '#10b981',
  disk_percent: '#f59e0b',
  net_sent: '#8b5cf6',
  net_recv: '#ec4899',
};

export const SystemMetrics: React.FC = () => {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [latest, setLatest] = useState<MetricsResult['latest']>({});
  const [total, setTotal] = useState(0);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('hours', String(hours));
    params.set('per_page', '500');
    const data = await fetchJson<MetricsResult>(`/api/system/metrics?${params.toString()}`);
    if (data) {
      setRows(data.items || []);
      setLatest(data.latest || {});
      setTotal(data.total || 0);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, [hours]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const series = useMemo(() => buildSeries(rows), [rows]);
  const pctSeries = useMemo(() => series, [series]);

  const latestCards = [
    { key: 'cpu_percent', label: 'CPU', unit: '%', icon: <Cpu size={16} />, color: 'text-blue-500' },
    { key: 'memory_percent', label: '内存', unit: '%', icon: <MemoryStick size={16} />, color: 'text-green-500' },
    { key: 'disk_percent', label: '磁盘', unit: '%', icon: <HardDrive size={16} />, color: 'text-orange-500' },
    { key: 'net_sent', label: '网络发送', unit: 'B', icon: <Network size={16} />, color: 'text-purple-500' },
    { key: 'net_recv', label: '网络接收', unit: 'B', icon: <Network size={16} />, color: 'text-pink-500' },
  ];

  const fmtTime = (t?: string | null) => (t ? new Date(String(t)).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800 dark:text-slate-100'>系统指标趋势</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>后台每 60 秒采样的 CPU / 内存 / 磁盘 / 网络历史趋势</p>
        </div>
        <div className='flex items-center gap-3'>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className='px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          >
            {HOUR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <PermissionButton
            permission='ops_center.view'
            onClick={load}
            disabled={loading}
            className='flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            刷新
          </PermissionButton>
        </div>
      </div>

      {loadError && (
        <div role='alert' className='flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'>
          <Activity size={16} className='flex-shrink-0' />
          系统指标加载失败，请稍后重试
        </div>
      )}

      {/* 最新值卡片 */}
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
        {latestCards.map((c) => {
          const v = latest[c.key];
          return (
            <div key={c.key} className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
              <div className='flex items-center gap-2 mb-1 text-gray-500 dark:text-slate-400'>
                <span className={c.color}>{c.icon}</span>
                <span className='text-sm'>{c.label}</span>
              </div>
              <div className='text-2xl font-bold text-gray-800 dark:text-slate-100'>
                {v ? v.value : '—'}
                {v?.unit && <span className='text-sm font-normal text-gray-400 ml-0.5'>{v.unit}</span>}
              </div>
              {v?.updated_at && (
                <div className='text-xs text-gray-400 mt-1'>更新于 {new Date(v.updated_at).toLocaleTimeString('zh-CN')}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 资源使用率趋势 */}
      <section className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4'>
        <h3 className='flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-slate-100 mb-4'>
          <LineChartIcon size={18} className='text-primary-500' />
          资源使用率 (%)
        </h3>
        {loading ? (
          <div className='h-64 flex items-center justify-center text-gray-400'>加载中...</div>
        ) : pctSeries.length === 0 ? (
          <EmptyState title='暂无采样数据' description='系统指标采样线程尚未产生数据，请稍候或检查后端采样服务' />
        ) : (
          <ResponsiveContainer width='100%' height={280}>
            <LineChart data={pctSeries} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
              <XAxis dataKey='t' tickFormatter={fmtTime} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={24} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit='%' />
              <Tooltip
                labelFormatter={(l) => `时间 ${l}`}
                formatter={(val: number, name: string) => [`${val}%`, name]}
              />
              <Legend />
              <Line type='monotone' dataKey='cpu_percent' name='CPU' stroke={CHART_COLORS.cpu_percent} dot={false} strokeWidth={2} />
              <Line type='monotone' dataKey='memory_percent' name='内存' stroke={CHART_COLORS.memory_percent} dot={false} strokeWidth={2} />
              <Line type='monotone' dataKey='disk_percent' name='磁盘' stroke={CHART_COLORS.disk_percent} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* 网络吞吐趋势 */}
      <section className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4'>
        <h3 className='flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-slate-100 mb-4'>
          <Network size={18} className='text-primary-500' />
          网络吞吐 (bytes)
        </h3>
        {loading ? (
          <div className='h-64 flex items-center justify-center text-gray-400'>加载中...</div>
        ) : pctSeries.length === 0 ? (
          <EmptyState title='暂无采样数据' description='系统指标采样线程尚未产生数据' />
        ) : (
          <ResponsiveContainer width='100%' height={280}>
            <LineChart data={pctSeries} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
              <XAxis dataKey='t' tickFormatter={fmtTime} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip labelFormatter={(l) => `时间 ${l}`} formatter={(val: number, name: string) => [`${val} B`, name]} />
              <Legend />
              <Line type='monotone' dataKey='net_sent' name='发送' stroke={CHART_COLORS.net_sent} dot={false} strokeWidth={2} />
              <Line type='monotone' dataKey='net_recv' name='接收' stroke={CHART_COLORS.net_recv} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className='text-xs text-gray-400'>
        共 {total} 条采样记录（当前视图窗口 {HOUR_OPTIONS.find((o) => o.value === hours)?.label}）。保留期 30 天，过期数据自动清理。
      </div>
    </div>
  );
};

export default SystemMetrics;
