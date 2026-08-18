/**
 * 运维中心 - 聚合仪表盘
 * 聚合系统健康、资源/API 性能、MQTT 连接、设备概览、系统统计与最近操作日志，
 * 为管理员/运维角色提供一站式运维总览。纯前端聚合，零后端改动（复用现有 /api/system/*、/api/mqtt/* 等端点）。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Heart,
  HelpCircle,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Signal,
  TrendingUp,
  Wifi,
  WifiOff,
  XCircle,
  ListChecks,
  Users,
  FileText,
  Layers,
  LucideIcon,
} from 'lucide-react';
import { PermissionButton } from '../components';
import { getAuthHeaders } from '../services/api';

// ---------- 类型定义 ----------
interface HealthComponent {
  status?: string;
  message?: string;
  usage_percent?: number;
  hit_rate?: string | number;
  operations?: number;
  available?: number;
  free?: number;
}

interface HealthData {
  status?: string;
  timestamp?: string;
  components?: {
    database?: HealthComponent;
    redis?: HealthComponent;
    mqtt?: HealthComponent;
    cpu?: HealthComponent;
    memory?: HealthComponent;
    disk?: HealthComponent;
  };
}

interface PerfSystem {
  cpu?: { percent?: number; count?: number };
  memory?: { total?: number; available?: number; used?: number; percent?: number };
  disk?: { total?: number; used?: number; free?: number; percent?: number };
  process?: { pid?: number; memory_rss?: number; threads?: number; cpu_percent?: number };
}

interface ApiPerformance {
  uptime?: string;
  total_requests?: number;
  total_queries?: number;
  overall?: Record<string, unknown>;
  request_stats?: Record<string, unknown>;
}

interface PerformanceData {
  timestamp?: string;
  system?: PerfSystem;
  api_performance?: ApiPerformance;
  slow_requests?: SlowRequest[];
}

interface SlowRequest {
  timestamp?: string;
  method?: string;
  endpoint?: string;
  status_code?: number;
  duration?: number;
}

interface MqttStatus {
  connected?: boolean;
  subscribed_topics?: string[];
}

interface DeviceStats {
  total_devices?: number;
  online_devices?: number;
  offline_devices?: number;
  error_devices?: number;
  unresolved_alerts?: number;
  critical_alerts?: number;
}

interface SystemStats {
  timestamp?: string;
  users?: number;
  records?: number;
  rules?: number;
  categories?: number;
  devices?: number;
  admins?: number;
}

interface OperationLog {
  id?: number;
  operation_type?: string;
  target_type?: string;
  description?: string;
  operator?: string;
  ip_address?: string;
  created_at?: string;
}

type StatusType = 'healthy' | 'degraded' | 'unhealthy' | 'warning' | 'critical' | 'unknown';

// ---------- 通用 fetch 封装（剥 APIResponse 信封: {success, code, data} -> data） ----------
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) return null;
    const env = await res.json();
    // M6: 检查业务信封，success===false 时不当作成功数据返回
    if (
      env &&
      typeof env === 'object' &&
      'success' in env &&
      (env as { success?: boolean }).success === false
    ) {
      return null;
    }
    return ((env && 'data' in env ? env.data : env) ?? null) as T | null;
  } catch {
    return null;
  }
}

// ---------- 健康状态指示器 ----------
const HealthStatusBadge: React.FC<{ status?: string; message?: string }> = ({
  status,
  message,
}) => {
    const map: Record<string, { color: string; icon: LucideIcon; label: string }> = {
    healthy: { color: 'bg-green-100 text-green-600', icon: CheckCircle, label: '正常' },
    degraded: { color: 'bg-yellow-100 text-yellow-600', icon: AlertTriangle, label: '降级' },
    unhealthy: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '异常' },
    warning: { color: 'bg-orange-100 text-orange-600', icon: AlertTriangle, label: '警告' },
    critical: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '严重' },
    unknown: { color: 'bg-gray-100 text-gray-600', icon: HelpCircle, label: '未知' },
  };
  const cfg = map[status || 'unknown'] || map.unknown;
  const Icon = cfg.icon;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
    >
      <Icon size={13} />
      <span>{cfg.label}</span>
      {message && (
        <span className='opacity-75 max-w-[220px] truncate' title={message}>
          {message}
        </span>
      )}
    </div>
  );
};

// ---------- 百分比条 ----------
const PercentBar: React.FC<{ percent?: number; label: string; icon: React.ReactNode }> = ({
  percent,
  label,
  icon,
}) => {
  const pct = typeof percent === 'number' ? Math.min(100, Math.max(0, percent)) : 0;
  const color = pct < 80 ? 'bg-green-500' : pct < 95 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm text-gray-600 dark:text-slate-300 flex items-center gap-2'>
          {icon}
          {label}
        </span>
        <span className='text-sm font-semibold text-gray-800 dark:text-slate-100'>
          {typeof percent === 'number' ? `${percent.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className='w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden'>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ---------- 指标卡片 ----------
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, unit, icon, color = 'text-blue-500' }) => (
  <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
    <div className='flex items-center justify-between mb-2'>
      <span className='text-sm text-gray-500 dark:text-slate-400'>{title}</span>
      <span className={color}>{icon}</span>
    </div>
    <div className='flex items-baseline gap-1'>
      <span className='text-2xl font-bold text-gray-800 dark:text-slate-100'>{value}</span>
      {unit && <span className='text-sm text-gray-500 dark:text-slate-400'>{unit}</span>}
    </div>
  </div>
);

// ---------- 区块标题 ----------
const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <h3 className='flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-slate-100 mb-3'>
    <span className='text-primary-500'>{icon}</span>
    {title}
  </h3>
);

// ---------- 主组件 ----------
export const OpsCenter: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [mqtt, setMqtt] = useState<MqttStatus | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [partialError, setPartialError] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    const results = await Promise.all([
      fetchJson<HealthData>('/api/system/health'),
      fetchJson<PerformanceData>('/api/system/performance'),
      fetchJson<MqttStatus>('/api/mqtt/status'),
      fetchJson<DeviceStats>('/api/devices/stats'),
      fetchJson<SystemStats>('/api/system/stats'),
      (async () => {
        try {
          const res = await fetch('/api/operation-logs?page=1&per_page=8', {
            credentials: 'include',
            headers: getAuthHeaders(),
          });
          if (!res.ok) return null;
          const env = await res.json();
          const payload = env && 'data' in env ? env.data : env;
          const items = Array.isArray(payload) ? payload : payload?.items ?? [];
          return items as OperationLog[];
        } catch {
          return null;
        }
      })(),
    ]);
    const [h, p, m, ds, ss, ol] = results;
    setHealth(h);
    setPerf(p);
    setMqtt(m);
    setDeviceStats(ds);
    setSysStats(ss);
    setLogs(ol || []);
    setPartialError(results.some((r) => r === null));
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const overallStatus = (health?.status as StatusType) || 'unknown';
  const overallColor =
    overallStatus === 'healthy'
      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
      : overallStatus === 'degraded'
      ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700';
  const overallText =
    overallStatus === 'healthy'
      ? '系统运行正常'
      : overallStatus === 'degraded'
      ? '系统部分降级'
      : '系统存在异常';

  const healthItems: {
    key: string;
    label: string;
    icon: React.ReactNode;
    data?: HealthComponent;
  }[] = [
    {
      key: 'database',
      label: '数据库',
      icon: <Database size={16} />,
      data: health?.components?.database,
    },
    {
      key: 'redis',
      label: '缓存(Redis)',
      icon: <MemoryStick size={16} />,
      data: health?.components?.redis,
    },
    { key: 'mqtt', label: 'MQTT', icon: <Network size={16} />, data: health?.components?.mqtt },
    { key: 'cpu', label: 'CPU', icon: <Cpu size={16} />, data: health?.components?.cpu },
    {
      key: 'memory',
      label: '内存',
      icon: <MemoryStick size={16} />,
      data: health?.components?.memory,
    },
    { key: 'disk', label: '磁盘', icon: <HardDrive size={16} />, data: health?.components?.disk },
  ];

  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800 dark:text-slate-100'>运维中心</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
            系统健康、性能、连接与日志一站式总览
          </p>
        </div>
        <PermissionButton
          permission='ops_center.view'
          onClick={refreshAll}
          disabled={isRefreshing}
          className='flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          刷新
        </PermissionButton>
      </div>

      {/* M9: 首次加载反馈 */}
      {isRefreshing && health === null && (
        <div className='animate-pulse text-sm text-gray-400 dark:text-slate-400 flex items-center gap-2'>
          <RefreshCw size={14} className='animate-spin' />
          正在加载系统状态...
        </div>
      )}

      {partialError && (
        <div
          role='alert'
          className='flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'
        >
          <AlertTriangle size={16} className='flex-shrink-0' />
          部分运维数据加载失败，下方指标可能不完整，请点击「刷新」重试
        </div>
      )}

      {/* 整体健康 */}
      <div className={`p-4 rounded-xl border ${overallColor}`}>
        <div className='flex items-center gap-3'>
          <Heart
            size={30}
            className={
              overallStatus === 'healthy'
                ? 'text-green-500'
                : overallStatus === 'degraded'
                ? 'text-yellow-500'
                : 'text-red-500'
            }
          />
          <div>
            <span className='text-lg font-bold text-gray-800 dark:text-slate-100'>
              {overallText}
            </span>
            <p className='text-sm text-gray-600 dark:text-slate-300 mt-0.5'>
              检查时间:{' '}
              {health?.timestamp ? new Date(health.timestamp).toLocaleString('zh-CN') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 系统健康组件 */}
      <section>
        <SectionTitle icon={<Heart size={18} />} title='系统健康' />
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
          {healthItems.map((it) => (
            <div
              key={it.key}
              className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'
            >
              <div className='flex items-center gap-2 mb-2 text-gray-700 dark:text-slate-200'>
                <span className='text-primary-500'>{it.icon}</span>
                <span className='text-sm font-medium'>{it.label}</span>
              </div>
              {it.data ? (
                <HealthStatusBadge status={it.data.status} message={it.data.message} />
              ) : (
                <span className='text-xs text-gray-400'>无数据</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 资源性能 + API 性能 */}
      <section className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div>
          <SectionTitle icon={<Cpu size={18} />} title='资源性能' />
          <div className='space-y-3'>
            <PercentBar label='CPU' icon={<Cpu size={15} />} percent={perf?.system?.cpu?.percent} />
            <PercentBar
              label='内存'
              icon={<MemoryStick size={15} />}
              percent={perf?.system?.memory?.percent}
            />
            <PercentBar
              label='磁盘'
              icon={<HardDrive size={15} />}
              percent={perf?.system?.disk?.percent}
            />
            <div className='grid grid-cols-3 gap-3'>
              <MetricCard
                title='进程数'
                value={perf?.system?.process?.threads ?? '—'}
                icon={<Server size={16} />}
                color='text-purple-500'
              />
              <MetricCard
                title='CPU核'
                value={perf?.system?.cpu?.count ?? '—'}
                icon={<Cpu size={16} />}
                color='text-blue-500'
              />
              <MetricCard
                title='运行时长'
                value={perf?.api_performance?.uptime ?? '—'}
                icon={<Clock size={16} />}
                color='text-green-500'
              />
            </div>
          </div>
        </div>
        <div>
          <SectionTitle icon={<TrendingUp size={18} />} title='API 性能' />
          <div className='space-y-3'>
            <div className='grid grid-cols-3 gap-3'>
              <MetricCard
                title='总请求'
                value={perf?.api_performance?.total_requests ?? '—'}
                unit='次'
                icon={<Activity size={16} />}
                color='text-blue-500'
              />
              <MetricCard
                title='总查询'
                value={perf?.api_performance?.total_queries ?? '—'}
                unit='次'
                icon={<Database size={16} />}
                color='text-green-500'
              />
              <MetricCard
                title='慢请求'
                value={perf?.slow_requests?.length ?? 0}
                unit='个'
                icon={<AlertTriangle size={16} />}
                color='text-orange-500'
              />
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden'>
              <div className='px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 flex items-center gap-2'>
                <Clock size={15} className='text-orange-500' />
                <span className='text-sm font-semibold text-gray-700 dark:text-slate-200'>
                  最近慢请求
                </span>
              </div>
              <div className='divide-y divide-gray-50 dark:divide-slate-700 max-h-56 overflow-y-auto'>
                {perf?.slow_requests && perf.slow_requests.length > 0 ? (
                  perf.slow_requests.slice(0, 6).map((r, i) => (
                    <div key={i} className='px-4 py-2 flex items-center justify-between text-sm'>
                      <span className='text-gray-700 dark:text-slate-200 truncate'>
                        {r.method} {r.endpoint}
                      </span>
                      <span className='text-red-500 font-medium flex-shrink-0 ml-2'>
                        {(r.duration ?? 0).toFixed(2)}s
                      </span>
                    </div>
                  ))
                ) : (
                  <div className='px-4 py-6 text-center text-sm text-gray-400'>暂无慢请求记录</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MQTT + 设备概览 */}
      <section className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div>
          <SectionTitle icon={<Network size={18} />} title='MQTT 连接' />
          <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
            <div className='flex items-center gap-3'>
              {mqtt?.connected ? (
                <Wifi size={28} className='text-green-500' />
              ) : (
                <WifiOff size={28} className='text-red-500' />
              )}
              <div>
                <div className='flex items-center gap-2'>
                  <span className='text-base font-bold text-gray-800 dark:text-slate-100'>
                    {mqtt?.connected ? '已连接' : '未连接'}
                  </span>
                  <HealthStatusBadge status={mqtt?.connected ? 'healthy' : 'unhealthy'} />
                </div>
                <p className='text-sm text-gray-500 dark:text-slate-400 mt-0.5'>
                  已订阅主题: {mqtt?.subscribed_topics?.length ?? 0} 个
                </p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle icon={<Signal size={18} />} title='设备概览' />
          <div className='grid grid-cols-2 gap-3'>
            <MetricCard
              title='在线设备'
              value={deviceStats?.online_devices ?? '—'}
              unit={`/ ${deviceStats?.total_devices ?? '?'} 台`}
              icon={<Signal size={16} />}
              color='text-green-500'
            />
            <MetricCard
              title='离线设备'
              value={deviceStats?.offline_devices ?? '—'}
              unit='台'
              icon={<WifiOff size={16} />}
              color='text-gray-500'
            />
            <MetricCard
              title='异常设备'
              value={deviceStats?.error_devices ?? '—'}
              unit='台'
              icon={<AlertTriangle size={16} />}
              color='text-red-500'
            />
            <MetricCard
              title='未处理告警'
              value={deviceStats?.unresolved_alerts ?? '—'}
              unit='条'
              icon={<AlertTriangle size={16} />}
              color='text-orange-500'
            />
          </div>
        </div>
      </section>

      {/* 系统统计 */}
      <section>
        <SectionTitle icon={<Layers size={18} />} title='系统统计' />
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
          <MetricCard
            title='用户'
            value={sysStats?.users ?? '—'}
            icon={<Users size={16} />}
            color='text-blue-500'
          />
          <MetricCard
            title='积分记录'
            value={sysStats?.records ?? '—'}
            icon={<FileText size={16} />}
            color='text-green-500'
          />
          <MetricCard
            title='积分规则'
            value={sysStats?.rules ?? '—'}
            icon={<ListChecks size={16} />}
            color='text-purple-500'
          />
          <MetricCard
            title='设备'
            value={sysStats?.devices ?? '—'}
            icon={<Server size={16} />}
            color='text-orange-500'
          />
          <MetricCard
            title='管理员'
            value={sysStats?.admins ?? '—'}
            icon={<Users size={16} />}
            color='text-red-500'
          />
        </div>
      </section>

      {/* 最近操作日志 */}
      <section>
        <SectionTitle icon={<Clock size={18} />} title='最近操作日志' />
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'>
                  <th className='px-4 py-2.5 text-left font-medium'>时间</th>
                  <th className='px-4 py-2.5 text-left font-medium'>操作人</th>
                  <th className='px-4 py-2.5 text-left font-medium'>类型</th>
                  <th className='px-4 py-2.5 text-left font-medium'>描述</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='px-4 py-8 text-center text-gray-400'>
                      暂无操作日志
                    </td>
                  </tr>
                ) : (
                  logs.map((log, i) => (
                    <tr
                      key={log.id ?? i}
                      className='border-t border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                    >
                      <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap'>
                        {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '--'}
                      </td>
                      <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200'>
                        {log.operator || '-'}
                      </td>
                      <td className='px-4 py-2.5'>
                        <span className='px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
                          {log.operation_type || '-'}
                        </span>
                      </td>
                      <td
                        className='px-4 py-2.5 text-gray-700 dark:text-slate-200 max-w-xs truncate'
                        title={log.description}
                      >
                        {log.description || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OpsCenter;
