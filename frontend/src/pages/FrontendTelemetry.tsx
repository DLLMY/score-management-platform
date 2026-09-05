/**
 * 前端遥测查看页（运维中心 · 阶段二）
 * 消费后端落库接口：
 *   GET /api/system/frontend-metrics  （前端性能/自定义指标上报记录，分页 + metric_type/name 过滤）
 *   GET /api/system/frontend-errors    （前端错误上报记录，分页 + error_type 过滤）
 * 这两个接口由 api/system/system_routes.py 提供（requires_permission ops_center.view），
 * 上报端 POST /api/system/frontend-performance(+/batch)、/api/system/frontend-error 已落库。
 */

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Activity, RefreshCw, Gauge, Filter, Bug } from 'lucide-react';
import { formatDateTime } from '../utils/format';
import { PermissionButton, DataTable } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { fetchJson } from '../hooks/useApiFetch';
import { useListFetch } from '../hooks';

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

// 通用 fetch 封装已收敛至 src/hooks/useApiFetch.ts（fetchJson<T>），本页不再保留抄本。

const PERF_TYPE_OPTIONS = ['', 'web_vital', 'api_request', 'custom']; // S7-C-P0-4: 与落库 metric_type 对齐（原 'api' 过滤恒空）
const ERROR_TYPE_OPTIONS = ['', 'javascript_error', 'api_error', 'resource_error']; // S7-C-P0-4: 与落库 error_type 对齐（原 'js_error' 过滤恒空）

export const FrontendTelemetry: React.FC = () => {
  // ---- 性能/指标（A 轨试点：useListFetch 收敛手写 load/effect/分页样板）----
  const [perfPage, setPerfPage] = useState(1);
  const [perfFilters, setPerfFilters] = useState<{ metric_type: string; name: string }>({
    metric_type: '',
    name: '',
  });
  const perf = useListFetch<PerfMetric>({
    params: {
      page: perfPage,
      pageSize: 50,
      metric_type: perfFilters.metric_type || undefined,
      name: perfFilters.name || undefined,
    },
    fetcher: async ({ page, pageSize, metric_type, name }) => {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('per_page', String(pageSize));
      if (metric_type) q.set('metric_type', String(metric_type));
      if (name) q.set('name', String(name));
      const data = await fetchJson<PageResult<PerfMetric>>(`/api/system/frontend-metrics?${q.toString()}`);
      return { items: data?.items ?? [], total: data?.total ?? 0 };
    },
    debounceDelay: 250,
  });

  // ---- 前端错误（同上收敛）----
  const [errPage, setErrPage] = useState(1);
  const [errFilters, setErrFilters] = useState<{ error_type: string }>({ error_type: '' });
  const err = useListFetch<FrontendError>({
    params: {
      page: errPage,
      pageSize: 50,
      error_type: errFilters.error_type || undefined,
    },
    fetcher: async ({ page, pageSize, error_type }) => {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('per_page', String(pageSize));
      if (error_type) q.set('error_type', String(error_type));
      const data = await fetchJson<PageResult<FrontendError>>(`/api/system/frontend-errors?${q.toString()}`);
      return { items: data?.items ?? [], total: data?.total ?? 0 };
    },
    debounceDelay: 250,
  });

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

  const handlePerfPageChange = (page: number) => setPerfPage(page);
  const handleErrPageChange = (page: number) => setErrPage(page);

  const perfColumns = useMemo<ColumnType<PerfMetric>[]>(
    () => [
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (value) => (
          <span className='text-gray-500 dark:text-slate-400 whitespace-nowrap'>
            {formatDateTime(value as string)}
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
            {formatDateTime(value as string)}
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
            perf.refetch();
            err.refetch();
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
          <span className='text-xs text-gray-400'>共 {perf.total} 条</span>
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
          dataSource={perf.items}
          loading={perf.loading}
          rowKey='id'
          total={perf.total}
          page={perfPage}
          pageSize={50}
          pageSizeOptions={[50]}
          onPageChange={handlePerfPageChange}
          error={
            perf.error
              ? { message: '指标加载失败，请刷新重试', onRetry: perf.refetch }
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
          <span className='text-xs text-gray-400'>共 {err.total} 条</span>
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
          dataSource={err.items}
          loading={err.loading}
          rowKey='id'
          total={err.total}
          page={errPage}
          pageSize={50}
          pageSizeOptions={[50]}
          onPageChange={handleErrPageChange}
          error={
            err.error
              ? { message: '错误日志加载失败，请刷新重试', onRetry: err.refetch }
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
