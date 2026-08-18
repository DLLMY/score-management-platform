/**
 * 安全审计查看页
 * 消费现有后端接口：
 *   GET /api/security/audit-logs   （列表，支持 event_type/severity/date/user_id 过滤 + 分页）
 *   GET /api/security/audit-stats  （统计概览）
 * 这两个接口已在 api/system/security_routes.py 实现（requires_permission system.settings）。
 * 本页为纯前端查看层，零后端改动。
 */

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  XCircle,
  Info,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { PermissionButton, EmptyState } from '../components';
import { getAuthHeaders } from '../services/api';

interface AuditLog {
  id: number;
  event_type: string;
  severity: string;
  user_id: number | null;
  user_type?: string;
  ip_address?: string;
  request_path?: string;
  request_method?: string;
  event_details?: string;
  created_at: string;
}

interface AuditStats {
  total?: number;
  last_24h?: number;
  last_7d?: number;
  by_severity?: Record<string, number>;
  by_type?: Record<string, number>;
  top_ips?: { ip: string; count: number }[];
}

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

const SeverityBadge: React.FC<{ severity?: string }> = ({ severity }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map: Record<string, { color: string; icon: any; label: string }> = {
    info: { color: 'bg-blue-100 text-blue-600', icon: Info, label: '信息' },
    debug: { color: 'bg-gray-100 text-gray-600', icon: Info, label: '调试' },
    warning: { color: 'bg-orange-100 text-orange-600', icon: AlertTriangle, label: '警告' },
    error: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '错误' },
    critical: { color: 'bg-red-100 text-red-700', icon: XCircle, label: '严重' },
  };
  const cfg = map[severity || 'info'] || map.info;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
};

export const SecurityAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<{
    event_type: string;
    severity: string;
    start_date: string;
    end_date: string;
  }>({
    event_type: '',
    severity: '',
    start_date: '',
    end_date: '',
  });
  const [pagination, setPagination] = useState<{
    page: number;
    per_page: number;
    total: number;
    pages: number;
  }>({
    page: 1,
    per_page: 20,
    total: 0,
    pages: 1,
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('per_page', String(pagination.per_page));
    if (filters.event_type) params.set('event_type', filters.event_type);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);

    const data = await fetchJson<{
      logs: AuditLog[];
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>(`/api/security/audit-logs?${params.toString()}`);
    if (data) {
      setLogs(data.logs || []);
      setPagination((prev) => ({ ...prev, total: data.total || 0, pages: data.pages || 1 }));
      setLoadError(false);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, [
    filters.event_type,
    filters.severity,
    filters.start_date,
    filters.end_date,
    pagination.page,
    pagination.per_page,
  ]);

  const loadStats = useCallback(async () => {
    const data = await fetchJson<AuditStats>('/api/security/audit-stats');
    if (data) setStats(data);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const totalPages = useMemo(() => Math.max(1, pagination.pages), [pagination.pages]);

  const onFilterChange =
    (key: keyof typeof filters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFilters((prev) => ({ ...prev, [key]: e.target.value }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    };

  const severityOptions = ['', 'info', 'debug', 'warning', 'error', 'critical'];

  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800 dark:text-slate-100'>安全审计</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
            查看登录失败、权限校验、异常访问等安全事件
          </p>
        </div>
        <PermissionButton
          permission='system.settings'
          onClick={loadLogs}
          disabled={loading}
          className='flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50'
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新
        </PermissionButton>
      </div>

      {loadError && (
        <div
          role='alert'
          className='flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'
        >
          <AlertTriangle size={16} className='flex-shrink-0' />
          安全审计日志加载失败，请稍后重试
        </div>
      )}

      {/* 统计概览 */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
          <div className='flex items-center gap-2 mb-1 text-gray-500 dark:text-slate-400'>
            <Shield size={15} />
            累计事件
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-slate-100'>
            {stats?.total ?? '—'}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
          <div className='flex items-center gap-2 mb-1 text-gray-500 dark:text-slate-400'>
            <Clock size={15} />近 24 小时
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-slate-100'>
            {stats?.last_24h ?? '—'}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
          <div className='flex items-center gap-2 mb-1 text-gray-500 dark:text-slate-400'>
            <Clock size={15} />近 7 天
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-slate-100'>
            {stats?.last_7d ?? '—'}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
          <div className='flex items-center gap-2 mb-1 text-gray-500 dark:text-slate-400'>
            <AlertTriangle size={15} />
            警告/错误
          </div>
          <div className='text-2xl font-bold text-gray-800 dark:text-slate-100'>
            {(stats?.by_severity?.warning || 0) +
              (stats?.by_severity?.error || 0) +
              (stats?.by_severity?.critical || 0)}
          </div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
        <div className='flex items-center gap-2 mb-3 text-gray-700 dark:text-slate-200'>
          <Filter size={16} className='text-primary-500' />
          <span className='text-sm font-medium'>筛选</span>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
          <input
            type='text'
            placeholder='事件类型（如 login / access_denied）'
            value={filters.event_type}
            onChange={onFilterChange('event_type')}
            className='px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          />
          <select
            value={filters.severity}
            onChange={onFilterChange('severity')}
            className='px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          >
            {severityOptions.map((s) => (
              <option key={s} value={s}>
                {s === '' ? '全部级别' : s}
              </option>
            ))}
          </select>
          <input
            type='date'
            value={filters.start_date}
            onChange={onFilterChange('start_date')}
            className='px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          />
          <input
            type='date'
            value={filters.end_date}
            onChange={onFilterChange('end_date')}
            className='px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          />
        </div>
      </div>

      {/* 日志表 */}
      <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'>
                <th className='px-4 py-2.5 text-left font-medium'>时间</th>
                <th className='px-4 py-2.5 text-left font-medium'>类型</th>
                <th className='px-4 py-2.5 text-left font-medium'>级别</th>
                <th className='px-4 py-2.5 text-left font-medium'>用户ID</th>
                <th className='px-4 py-2.5 text-left font-medium'>IP</th>
                <th className='px-4 py-2.5 text-left font-medium'>路径</th>
                <th className='px-4 py-2.5 text-left font-medium'>详情</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className='px-4 py-10 text-center text-gray-400'>
                    加载中...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title='暂无安全审计日志'
                      description='当前筛选条件下没有匹配的记录'
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className='border-t border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                  >
                    <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap'>
                      {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '--'}
                    </td>
                    <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200'>
                      {log.event_type}
                    </td>
                    <td className='px-4 py-2.5'>
                      <SeverityBadge severity={log.severity} />
                    </td>
                    <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200'>
                      {log.user_id ?? '-'}
                    </td>
                    <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200'>
                      {log.ip_address || '-'}
                    </td>
                    <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200'>
                      {log.request_path || '-'}
                    </td>
                    <td
                      className='px-4 py-2.5 text-gray-600 dark:text-slate-300 max-w-xs truncate'
                      title={log.event_details}
                    >
                      {log.event_details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>
              共 {pagination.total} 条记录
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page <= 1}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700'
              >
                <ChevronLeft size={15} />
                上一页
              </button>
              <span className='text-sm text-gray-600 dark:text-slate-300'>
                第 {pagination.page} / {totalPages} 页
              </span>
              <button
                onClick={() =>
                  setPagination((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }))
                }
                disabled={pagination.page >= totalPages}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700'
              >
                下一页
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAuditPage;
