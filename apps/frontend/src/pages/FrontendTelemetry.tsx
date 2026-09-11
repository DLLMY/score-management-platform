import React from 'react';
import { Activity, RefreshCw, Gauge, Filter, Bug } from 'lucide-react';
import { PermissionButton, DataTable } from '../components';
import {
  useFrontendTelemetryLogic,
  PERF_TYPE_OPTIONS,
  ERROR_TYPE_OPTIONS,
} from './frontendTelemetry/useFrontendTelemetryLogic';
import type { PerfMetric, FrontendError } from './frontendTelemetry/useFrontendTelemetryLogic';

/**
 * 前端遥测查看页（装配层）
 * 数据来源：GET /api/system/frontend-metrics、GET /api/system/frontend-errors
 * 列表加载与 columns 见 ./frontendTelemetry/useFrontendTelemetryLogic。
 */
export const FrontendTelemetry: React.FC = () => {
  const {
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
  } = useFrontendTelemetryLogic();

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
          error={perf.error ? { message: '指标加载失败，请刷新重试', onRetry: perf.refetch } : null}
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
            err.error ? { message: '错误日志加载失败，请刷新重试', onRetry: err.refetch } : null
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
