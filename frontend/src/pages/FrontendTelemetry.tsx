/**
 * 前端遥测查看页（运维中心 · 阶段二）
 * 消费后端落库接口：
 *   GET /api/system/frontend-metrics  （前端性能/自定义指标上报记录，分页 + metric_type/name 过滤）
 *   GET /api/system/frontend-errors    （前端错误上报记录，分页 + error_type 过滤）
 * 这两个接口由 api/system/system_routes.py 提供（requires_permission ops_center.view），
 * 上报端 POST /api/system/frontend-performance(+/batch)、/api/system/frontend-error 已落库。
 */

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import {
  Activity,
  RefreshCw,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Filter,
  Bug,
} from 'lucide-react';
import { PermissionButton, EmptyState } from '../components';
import { getAuthHeaders } from '../services/api';

interface PerfMetric {
  id: number;
  metric_type: string;
  name: string;
  value: number;
  unit?: string | null;
  page?: string | null;
  created_at: string;
}

interface FrontendError {
  id: number;
  error_type: string;
  message: string;
  page?: string | null;
  url?: string | null;
  method?: string | null;
  status?: number | null;
  created_at: string;
}

interface PageResult<T> {
  items: T[];
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

const PERF_TYPE_OPTIONS = ['', 'web_vital', 'api', 'custom'];
const ERROR_TYPE_OPTIONS = ['', 'js_error', 'api_error', 'resource_error'];

export const FrontendTelemetry: React.FC = () => {
  // ---- 性能/指标 ----
  const [metrics, setMetrics] = useState<PerfMetric[]>([]);
  const [perfTotal, setPerfTotal] = useState(0);
  const [perfPage, setPerfPage] = useState(1);
  const [perfPages, setPerfPages] = useState(1);
  const [perfFilters, setPerfFilters] = useState<{ metric_type: string; name: string }>({
    metric_type: '',
    name: '',
  });
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState(false);

  // ---- 前端错误 ----
  const [errors, setErrors] = useState<FrontendError[]>([]);
  const [errTotal, setErrTotal] = useState(0);
  const [errPage, setErrPage] = useState(1);
  const [errPages, setErrPages] = useState(1);
  const [errFilters, setErrFilters] = useState<{ error_type: string }>({ error_type: '' });
  const [errLoading, setErrLoading] = useState(true);
  const [errError, setErrError] = useState(false);

  const loadMetrics = useCallback(async () => {
    setPerfLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(perfPage));
    params.set('per_page', '50');
    if (perfFilters.metric_type) params.set('metric_type', perfFilters.metric_type);
    if (perfFilters.name) params.set('name', perfFilters.name);
    const data = await fetchJson<PageResult<PerfMetric>>(`/api/system/frontend-metrics?${params.toString()}`);
    if (data) {
      setMetrics(data.items || []);
      setPerfTotal(data.total || 0);
      setPerfPages(data.pages || 1);
      setPerfError(false);
    } else {
      setPerfError(true);
    }
    setPerfLoading(false);
  }, [perfPage, perfFilters.metric_type, perfFilters.name]);

  const loadErrors = useCallback(async () => {
    setErrLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(errPage));
    params.set('per_page', '50');
    if (errFilters.error_type) params.set('error_type', errFilters.error_type);
    const data = await fetchJson<PageResult<FrontendError>>(`/api/system/frontend-errors?${params.toString()}`);
    if (data) {
      setErrors(data.items || []);
      setErrTotal(data.total || 0);
      setErrPages(data.pages || 1);
      setErrError(false);
    } else {
      setErrError(true);
    }
    setErrLoading(false);
  }, [errPage, errFilters.error_type]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  const onPerfFilterChange = (key: keyof typeof perfFilters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPerfFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setPerfPage(1);
  };
  const onErrFilterChange = (key: keyof typeof errFilters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setErrFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setErrPage(1);
  };

  const perfPagesSafe = useMemo(() => Math.max(1, perfPages), [perfPages]);
  const errPagesSafe = useMemo(() => Math.max(1, errPages), [errPages]);

  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800 dark:text-slate-100'>前端遥测</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>查看前端上报的性能指标（Web Vitals / API 耗时）与运行时错误</p>
        </div>
        <PermissionButton
          permission='ops_center.view'
          onClick={() => {
            loadMetrics();
            loadErrors();
          }}
          className='flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
        >
          <RefreshCw size={16} />
          刷新
        </PermissionButton>
      </div>

      {/* 性能指标 */}
      <section className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden'>
        <div className='px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2'>
          <Gauge size={18} className='text-primary-500' />
          <span className='font-semibold text-gray-800 dark:text-slate-100'>性能指标</span>
          <span className='text-xs text-gray-400'>共 {perfTotal} 条</span>
        </div>

        {/* 过滤 */}
        <div className='px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-slate-700'>
          <div className='flex items-center gap-1.5 text-gray-500 dark:text-slate-400'>
            <Filter size={15} />
            <span className='text-sm'>筛选</span>
          </div>
          <select
            value={perfFilters.metric_type}
            onChange={onPerfFilterChange('metric_type')}
            className='px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          >
            {PERF_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t === '' ? '全部类型' : t}</option>
            ))}
          </select>
          <input
            type='text'
            placeholder='指标名称（如 LCP / FCP / api_duration）'
            value={perfFilters.name}
            onChange={onPerfFilterChange('name')}
            className='px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 min-w-[220px]'
          />
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'>
                <th className='px-4 py-2.5 text-left font-medium'>时间</th>
                <th className='px-4 py-2.5 text-left font-medium'>类型</th>
                <th className='px-4 py-2.5 text-left font-medium'>名称</th>
                <th className='px-4 py-2.5 text-left font-medium'>值</th>
                <th className='px-4 py-2.5 text-left font-medium'>页面</th>
              </tr>
            </thead>
            <tbody>
              {perfLoading ? (
                <tr><td colSpan={5} className='px-4 py-10 text-center text-gray-400'>加载中...</td></tr>
              ) : perfError ? (
                <tr><td colSpan={5} className='px-4 py-10 text-center text-amber-600'>指标加载失败，请刷新重试</td></tr>
              ) : metrics.length === 0 ? (
                <tr><td colSpan={5}><EmptyState title='暂无性能指标' description='前端尚未上报数据，或当前筛选无匹配记录' /></td></tr>
              ) : (
                metrics.map((m) => (
                  <tr key={m.id} className='border-t border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30'>
                    <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap'>
                      {m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : '--'}
                    </td>
                    <td className='px-4 py-2.5'>
                      <span className='px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
                        {m.metric_type}
                      </span>
                    </td>
                    <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200'>{m.name}</td>
                    <td className='px-4 py-2.5 text-gray-800 dark:text-slate-100 font-medium'>
                      {m.value}{m.unit ? ` ${m.unit}` : ''}
                    </td>
                    <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400'>{m.page || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {perfPagesSafe > 1 && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>共 {perfTotal} 条</div>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPerfPage((p) => Math.max(1, p - 1))}
                disabled={perfPage <= 1}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700'
              >
                <ChevronLeft size={15} />上一页
              </button>
              <span className='text-sm text-gray-600 dark:text-slate-300'>第 {perfPage} / {perfPagesSafe} 页</span>
              <button
                onClick={() => setPerfPage((p) => Math.min(perfPagesSafe, p + 1))}
                disabled={perfPage >= perfPagesSafe}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700'
              >
                下一页<ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 前端错误 */}
      <section className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden'>
        <div className='px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2'>
          <Bug size={18} className='text-red-500' />
          <span className='font-semibold text-gray-800 dark:text-slate-100'>前端错误</span>
          <span className='text-xs text-gray-400'>共 {errTotal} 条</span>
        </div>

        <div className='px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-slate-700'>
          <div className='flex items-center gap-1.5 text-gray-500 dark:text-slate-400'>
            <Filter size={15} />
            <span className='text-sm'>筛选</span>
          </div>
          <select
            value={errFilters.error_type}
            onChange={onErrFilterChange('error_type')}
            className='px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100'
          >
            {ERROR_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t === '' ? '全部类型' : t}</option>
            ))}
          </select>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'>
                <th className='px-4 py-2.5 text-left font-medium'>时间</th>
                <th className='px-4 py-2.5 text-left font-medium'>类型</th>
                <th className='px-4 py-2.5 text-left font-medium'>消息</th>
                <th className='px-4 py-2.5 text-left font-medium'>页面</th>
                <th className='px-4 py-2.5 text-left font-medium'>请求</th>
              </tr>
            </thead>
            <tbody>
              {errLoading ? (
                <tr><td colSpan={5} className='px-4 py-10 text-center text-gray-400'>加载中...</td></tr>
              ) : errError ? (
                <tr><td colSpan={5} className='px-4 py-10 text-center text-amber-600'>错误日志加载失败，请刷新重试</td></tr>
              ) : errors.length === 0 ? (
                <tr><td colSpan={5}><EmptyState title='暂无前端错误' description='前端未捕获到错误上报' /></td></tr>
              ) : (
                errors.map((e) => (
                  <tr key={e.id} className='border-t border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30'>
                    <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap'>
                      {e.created_at ? new Date(e.created_at).toLocaleString('zh-CN') : '--'}
                    </td>
                    <td className='px-4 py-2.5'>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        e.error_type === 'api_error'
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300'
                          : e.error_type === 'resource_error'
                            ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {e.error_type}
                      </span>
                    </td>
                    <td className='px-4 py-2.5 text-gray-700 dark:text-slate-200 max-w-md truncate' title={e.message}>{e.message}</td>
                    <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400'>{e.page || '-'}</td>
                    <td className='px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap'>
                      {e.method ? `${e.method} ${e.status ?? ''}` : '-'}
                      {e.url ? <div className='text-xs text-gray-400 truncate max-w-[200px]' title={e.url}>{e.url}</div> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {errPagesSafe > 1 && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>共 {errTotal} 条</div>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setErrPage((p) => Math.max(1, p - 1))}
                disabled={errPage <= 1}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700'
              >
                <ChevronLeft size={15} />上一页
              </button>
              <span className='text-sm text-gray-600 dark:text-slate-300'>第 {errPage} / {errPagesSafe} 页</span>
              <button
                onClick={() => setErrPage((p) => Math.min(errPagesSafe, p + 1))}
                disabled={errPage >= errPagesSafe}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700'
              >
                下一页<ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 说明 */}
      <div className='flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'>
        <Activity size={15} className='flex-shrink-0' />
        上报由前端 SDK 在运行时自动收集（Web Vitals、API 耗时、JS 异常、API 错误），后端按 ops_center.view 权限开放查看。
      </div>
    </div>
  );
};

export default FrontendTelemetry;
