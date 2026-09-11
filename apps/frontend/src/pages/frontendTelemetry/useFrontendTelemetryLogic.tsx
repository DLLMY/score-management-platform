import { useState, useMemo, ChangeEvent } from 'react';
import { formatDateTime } from '../../utils/format';
import type { ColumnType } from '../../components';
import { fetchJson, useListFetch } from '../../hooks';

/**
 * 前端遥测页逻辑层：两路 useListFetch（性能指标 / 前端错误）+ 过滤 + columns。
 *
 * 主渲染见 ../FrontendTelemetry。
 */

export interface PerfMetric {
  id: number;
  metric_type: string;
  name: string;
  value: number;
  unit?: string | null;
  page?: string | null;
  created_at: string;
}

export interface FrontendError {
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

export const PERF_TYPE_OPTIONS = ['', 'web_vital', 'api_request', 'custom']; // S7-C-P0-4: 与落库 metric_type 对齐（原 'api' 过滤恒空）
export const ERROR_TYPE_OPTIONS = ['', 'javascript_error', 'api_error', 'resource_error']; // S7-C-P0-4: 与落库 error_type 对齐（原 'js_error' 过滤恒空）

export function useFrontendTelemetryLogic() {
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
      const data = await fetchJson<PageResult<PerfMetric>>(
        `/api/system/frontend-metrics?${q.toString()}`
      );
      // fetchJson 失败返回 null（仅 log 不抛）——此处转抛让 hook error 态可见（保持旧语义）
      if (!data) throw new Error('性能指标接口不可用');
      return { items: data.items ?? [], total: data.total ?? 0 };
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
      const data = await fetchJson<PageResult<FrontendError>>(
        `/api/system/frontend-errors?${q.toString()}`
      );
      if (!data) throw new Error('前端错误接口不可用');
      return { items: data.items ?? [], total: data.total ?? 0 };
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

  return {
    perf,
    err,
    perfFilters,
    errFilters,
    onPerfFilterChange,
    onErrFilterChange,
    handlePerfPageChange,
    handleErrPageChange,
    perfColumns,
    errColumns,
    perfPage,
    errPage,
  };
}
