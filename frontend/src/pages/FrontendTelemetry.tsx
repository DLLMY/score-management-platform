/**
 * 前端遥测查看页（运维中心 · 阶段二）
 * 消费后端落库接口：
 *   GET /api/system/frontend-metrics  （前端性能/自定义指标上报记录，分页 + metric_type/name 过滤）
 *   GET /api/system/frontend-errors    （前端错误上报记录，分页 + error_type 过滤）
 * 这两个接口由 api/system/system_routes.py 提供（requires_permission ops_center.view），
 * 上报端 POST /api/system/frontend-performance(+/batch)、/api/system/frontend-error 已落库。
 */

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { Activity, RefreshCw, Gauge, Filter, Bug } from 'lucide-react';
import { PermissionButton, DataTable } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
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

const PERF_TYPE_OPTIONS = ['', 'web_vital', 'api_request', 'custom']; // S7-C-P0-4: 与落库 metric_type 对齐（原 'api' 过滤恒空）
const ERROR_TYPE_OPTIONS = ['', 'javascript_error', 'api_error', 'resource_error']; // S7-C-P0-4: 与落库 error_type 对齐（原 'js_error' 过滤恒空）

export const FrontendTelemetry: React.FC = () => {
  // ---- 性能/指标 ----
  const [metrics, setMetrics] = useState<PerfMetric[]>([]);
  const [perfTotal, setPerfTotal] = useState(0);
  const [perfPage, setPerfPage] = useState(1);
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
    const data = await fetchJson<PageResult<PerfMetric>>(
      `/api/system/frontend-metrics?${params.toString()}`
    );
    if (data) {
      setMetrics(data.items || []);
      setPerfTotal(data.total || 0);
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
    const data = await fetchJson<PageResult<FrontendError>>(
      `/api/system/frontend-errors?${params.toString()}`
    );
    if (data) {
      setErrors(data.items || []);
      setErrTotal(data.total || 0);
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

  const onPerfFilterChange =
    (key: keyof typeof perfFilters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setPerfFilters((prev) => ({ ...prev, [key]: e.target.value }));
      setPerfPage(1);
    };
  const onErrFilterChange =
    (key: keyof typeof errFilters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setErrFilters((prev) => ({ ...prev, [key]: e.target.value }));
      setErrPage(1);
    };

  const handlePerfPageChange = useCallback((page: number) => {
    setPerfPage(page);
  }, []);

  const handleErrPageChange = useCallback((page: number) => {
    setErrPage(page);
  }, []);

  const perfColumns = useMemo<ColumnType<PerfMetric>[]>(
    () => [
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (value) => (
          <span className='text-gray-500 dark:text-slate-400 whitespace-nowrap'>
            {value ? new Date(value as string).toLocaleString('zh-CN') : '--'}
          </span>
        ),
      },
      {
        title: '类型',
        key: 'metric_type',
        dataIndex: 'metric_type',
        render: (value) => (
          <span className='px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
            {value as string}
          </span>
        ),
      },
      {
        title: '名称',
        key: 'name',
        dataIndex: 'name',
        render: (value) => (
          <span className='text-gray-700 dark:text-slate-200'>{value as string}</span>
        ),
      },
      {
        title: '值',
        key: 'value',
        dataIndex: 'value',
        render: (value, record) => (
          <span className='text-gray-800 dark:text-slate-100 font-medium'>
            {value as number}
            {record.unit ? ` ${record.unit}` : ''}
          </span>
        ),
      },
      {
        title: '页面',
        key: 'page',
        dataIndex: 'page',
        render: (value) => (
          <span className='text-gray-500 dark:text-slate-400'>
            {value ? (value as string) : '-'}
          </span>
        ),
      },
    ],
    []
  );

  const errColumns = useMemo<ColumnType<FrontendError>[]>(
    () => [
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (value) => (
          <span className='text-gray-500 dark:text-slate-400 whitespace-nowrap'>
            {value ? new Date(value as string).toLocaleString('zh-CN') : '--'}
          </span>
        ),
      },
      {
        title: '类型',
        key: 'error_type',
        dataIndex: 'error_type',
        render: (value) => (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              value === 'api_error'
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300'
                : value === 'resource_error'
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {value as string}
          </span>
        ),
      },
      {
        title: '消息',
        key: 'message',
        dataIndex: 'message',
        render: (value) => (
          <span
            className='text-gray-700 dark:text-slate-200 max-w-md truncate block'
            title={value ? (value as string) : ''}
          >
            {value as string}
          </span>
        ),
      },
      {
        title: '页面',
        key: 'page',
        dataIndex: 'page',
        render: (value) => (
          <span className='text-gray-500 dark:text-slate-400'>
            {value ? (value as string) : '-'}
          </span>
        ),
      },
      {
        title: '请求',
        key: 'request',
        render: (_value, record) => (
          <span className='text-gray-500 dark:text-slate-400 whitespace-nowrap'>
            {record.method ? `${record.method} ${record.status ?? ''}` : '-'}
            {record.url ? (
              <div className='text-xs text-gray-400 truncate max-w-[200px]' title={record.url}>
                {record.url}
              </div>
            ) : null}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-800 dark:text-slate-100'>前端遥测</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
            查看前端上报的性能指标（Web Vitals / API 耗时）与运行时错误
          </p>
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
              <option key={t} value={t}>
                {t === '' ? '全部类型' : t}
              </option>
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

        <DataTable<PerfMetric>
          columns={perfColumns}
          dataSource={metrics}
          loading={perfLoading}
          rowKey='id'
          total={perfTotal}
          page={perfPage}
          pageSize={50}
          pageSizeOptions={[50]}
          onPageChange={handlePerfPageChange}
          error={
            perfError
              ? { message: '指标加载失败，请刷新重试', onRetry: loadMetrics }
              : null
          }
          empty={{
            icon: 'folder',
            title: '暂无性能指标',
            description: '前端尚未上报数据，或当前筛选无匹配记录',
          }}
        />
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
              <option key={t} value={t}>
                {t === '' ? '全部类型' : t}
              </option>
            ))}
          </select>
        </div>

        <DataTable<FrontendError>
          columns={errColumns}
          dataSource={errors}
          loading={errLoading}
          rowKey='id'
          total={errTotal}
          page={errPage}
          pageSize={50}
          pageSizeOptions={[50]}
          onPageChange={handleErrPageChange}
          error={
            errError
              ? { message: '错误日志加载失败，请刷新重试', onRetry: loadErrors }
              : null
          }
          empty={{
            icon: 'folder',
            title: '暂无前端错误',
            description: '前端未捕获到错误上报',
          }}
        />
      </section>

      {/* 说明 */}
      <div className='flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'>
        <Activity size={15} className='flex-shrink-0' />
        上报由前端 SDK 在运行时自动收集（Web Vitals、API 耗时、JS 异常、API 错误），后端按
        ops_center.view 权限开放查看。
      </div>
    </div>
  );
};

export default FrontendTelemetry;
