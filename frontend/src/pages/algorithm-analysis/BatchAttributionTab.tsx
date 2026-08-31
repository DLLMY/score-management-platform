import React from 'react';
import { Users, Download, Loader2, BarChart3 } from 'lucide-react';
import { DataTable } from '../../components';
import type { BatchAttributionStudent } from '../../types';
import type { AlgorithmAnalysisDeps } from './types';

export function BatchAttributionTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const {
    batchAttribution,
    classes,
    selectedClass,
    setSelectedClass,
    batchAttributionDays,
    setBatchAttributionDays,
    loadBatchAttribution,
    handleExport,
    exporting,
    batchAttributionLoading,
    batchAttributionError,
    attributionColumns,
  } = deps;

  const data = batchAttribution;
  const students = data?.students || [];
  const failed = data?.failed_students || [];

  return (
    <div className='space-y-6'>
      {/* 控制区 */}
      <div className='flex flex-col sm:flex-row sm:items-end gap-4 bg-purple-50/60 dark:bg-purple-500/10 rounded-lg p-4'>
        <div className='flex items-center gap-2'>
          <Users className='w-5 h-5 text-purple-500' />
          <label
            htmlFor='batch-attribution-class'
            className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
          >
            选择班级:
          </label>
          <select
            id='batch-attribution-class'
            data-testid='batch-attribution-class-select'
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className='px-3 py-1.5 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[140px]'
          >
            <option value=''>全部班级</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.name}>
                {cls.name}
              </option>
            ))}
          </select>
          {selectedClass && (
            <button
              type='button'
              onClick={() => setSelectedClass('')}
              className='text-xs text-purple-600 dark:text-purple-400 hover:underline'
              title='清除选择'
            >
              清除
            </button>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <label
            htmlFor='batch-attribution-days'
            className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
          >
            归因窗口(天):
          </label>
          <input
            id='batch-attribution-days'
            data-testid='batch-attribution-days-input'
            type='number'
            min={7}
            max={180}
            value={batchAttributionDays}
            onChange={(e) => setBatchAttributionDays(Number(e.target.value) || 30)}
            className='w-20 px-2 py-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white'
          />
        </div>
        <button
          onClick={() => loadBatchAttribution()}
          disabled={batchAttributionLoading || !selectedClass}
          className='px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors'
        >
          {batchAttributionLoading ? '归因中...' : '生成全班成绩波动归因'}
        </button>
        <button
          onClick={() => handleExport('attribution', batchAttributionDays)}
          disabled={exporting !== null || !selectedClass}
          className='px-4 py-2 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5'
        >
          <Download className='w-4 h-4' />
          {exporting === 'attribution' ? '导出中...' : '导出 Excel'}
        </button>
      </div>

      {batchAttributionError && (
        <div className='text-center py-8 text-red-500'>{batchAttributionError}</div>
      )}

      {!selectedClass && !batchAttributionLoading && (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <Users className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p className='text-sm'>请先在上方【选择班级】下拉框中选择班级后开始归因</p>
          <p className='text-xs mt-2 text-gray-400 dark:text-slate-500'>
            （页面顶部"班级"下拉框与此处同效，二选一即可）
          </p>
        </div>
      )}

      {selectedClass && !batchAttributionLoading && !batchAttributionError && data && (
        <>
          {/* 汇总卡片 */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <div className='text-sm text-gray-500 dark:text-slate-400'>班级人数</div>
              <div className='text-3xl font-bold text-gray-800 dark:text-white mt-1'>
                {data.total}
              </div>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <div className='text-sm text-gray-500 dark:text-slate-400'>有效归因</div>
              <div className='text-3xl font-bold text-green-600 mt-1'>{data.with_data}</div>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <div className='text-sm text-gray-500 dark:text-slate-400'>缺数据</div>
              <div className='text-3xl font-bold text-gray-600 mt-1'>
                {data.analyzed - data.with_data}
              </div>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <div className='text-sm text-gray-500 dark:text-slate-400'>异常隔离</div>
              <div className='text-3xl font-bold text-red-600 mt-1'>{data.failed}</div>
            </div>
          </div>

          {/* 表格 */}
          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <BarChart3 className='w-5 h-5 text-purple-500' />
                全班成绩波动归因
              </h3>
            </div>
            <div className='p-6'>
              <DataTable<BatchAttributionStudent>
                columns={attributionColumns}
                dataSource={students}
                rowKey={(s, idx) => s.user_id ?? idx}
                empty={{ title: '该班级暂无归因数据' }}
                scroll={{ x: 760 }}
              />

              {failed.length > 0 && (
                <div className='mt-4 p-4 bg-red-50/50 dark:bg-red-500/5 rounded-lg border border-red-200/50 dark:border-red-500/20'>
                  <div className='text-sm font-medium text-red-600 mb-2'>
                    异常隔离（{failed.length} 人，不影响其余结果）
                  </div>
                  <div className='space-y-1 text-sm text-gray-600 dark:text-slate-300'>
                    {failed.map((f) => (
                      <div key={f.user_id}>
                        {f.name}：{f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {batchAttributionLoading && (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-purple-500' />
          <p className='text-sm'>正在批量归因...</p>
        </div>
      )}
    </div>
  );
}
