import React from 'react';
import { LineChart, Loader2, Download, BarChart3 } from 'lucide-react';
import { DataTable } from '../../components';
import type { EngagementStudentRank } from '../../types';
import type { AlgorithmAnalysisDeps } from './types';
import { EngagementTrendChart } from './EngagementTrendChart';

export function EngagementTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const {
    engagementRank,
    classes,
    selectedClass,
    setSelectedClass,
    setEngagementTrendUserId,
    setEngagementTrend,
    engagementRankDays,
    setEngagementRankDays,
    loadEngagementRank,
    handleExport,
    exporting,
    engagementRankError,
    engagementRankLoading,
    engagementTrend,
    engagementTrendUserId,
    engagementTrendWeeks,
    setEngagementTrendWeeks,
    engagementTrendLoading,
    engagementColumns,
  } = deps;

  const data = engagementRank;
  const students = data?.students || [];
  const ranked = students.filter((s) => s.has_data);
  const trend = engagementTrend;
  const trendStudent = students.find((s) => s.user_id === engagementTrendUserId) || null;

  return (
    <div className='space-y-6'>
      {/* 控制区 */}
      <div className='flex flex-col sm:flex-row sm:items-end gap-4 bg-purple-50/60 dark:bg-purple-500/10 rounded-lg p-4'>
        <div className='flex items-center gap-2'>
          <LineChart className='w-5 h-5 text-purple-500' />
          <label
            htmlFor='engagement-class'
            className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
          >
            选择班级:
          </label>
          <select
            id='engagement-class'
            data-testid='engagement-class-select'
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setEngagementTrendUserId(null);
              setEngagementTrend(null);
            }}
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
              onClick={() => {
                setSelectedClass('');
                setEngagementTrendUserId(null);
                setEngagementTrend(null);
              }}
              className='text-xs text-purple-600 dark:text-purple-400 hover:underline'
              title='清除选择'
            >
              清除
            </button>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <label
            htmlFor='engagement-days'
            className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
          >
            统计天数:
          </label>
          <input
            id='engagement-days'
            data-testid='engagement-days-input'
            type='number'
            min={7}
            max={180}
            value={engagementRankDays}
            onChange={(e) => setEngagementRankDays(Number(e.target.value) || 30)}
            className='w-20 px-2 py-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white'
          />
        </div>
        <button
          onClick={() => loadEngagementRank()}
          disabled={engagementRankLoading || !selectedClass}
          className='px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors'
        >
          {engagementRankLoading ? '计算中...' : '生成全班参与度排名'}
        </button>
        <button
          onClick={() => handleExport('engagement', engagementRankDays)}
          disabled={exporting !== null || !selectedClass}
          className='px-4 py-2 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5'
        >
          <Download className='w-4 h-4' />
          {exporting === 'engagement' ? '导出中...' : '导出 Excel'}
        </button>
      </div>

      {engagementRankError && (
        <div className='text-center py-8 text-red-500'>{engagementRankError}</div>
      )}

      {!selectedClass && !engagementRankLoading && (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <LineChart className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p className='text-sm'>请先在上方【选择班级】下拉框中选择班级后开始分析</p>
          <p className='text-xs mt-2 text-gray-400 dark:text-slate-500'>
            （页面顶部"班级"下拉框与此处同效，二选一即可）
          </p>
        </div>
      )}

      {selectedClass && !engagementRankLoading && !engagementRankError && data && (
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
              <div className='text-sm text-gray-500 dark:text-slate-400'>有效参与度</div>
              <div className='text-3xl font-bold text-green-600 mt-1'>{data.with_data}</div>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <div className='text-sm text-gray-500 dark:text-slate-400'>高参与度</div>
              <div className='text-3xl font-bold text-purple-600 mt-1'>
                {ranked.filter((s) => s.level === 'high').length}
              </div>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <div className='text-sm text-gray-500 dark:text-slate-400'>异常隔离</div>
              <div className='text-3xl font-bold text-red-600 mt-1'>{data.failed}</div>
            </div>
          </div>

          {/* 排名榜 */}
          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <BarChart3 className='w-5 h-5 text-purple-500' />
                全班参与度排名榜
              </h3>
            </div>
            <div className='p-6'>
              <DataTable<EngagementStudentRank>
                columns={engagementColumns}
                dataSource={students}
                rowKey={(s, idx) => s.user_id ?? idx}
                rowClassName={() => 'cursor-pointer'}
                onRowClick={(s) => {
                  if (s.has_data) {
                    setEngagementTrendUserId(s.user_id);
                    const el = document.getElementById('engagement-trend-section');
                    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                  }
                }}
                empty={{ title: '该班级暂无参与度数据' }}
                scroll={{ x: 980 }}
              />
            </div>
          </div>
        </>
      )}

      {engagementRankLoading && (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-purple-500' />
          <p className='text-sm'>正在计算全班参与度...</p>
        </div>
      )}

      {/* 个人周趋势 */}
      {selectedClass && engagementTrendUserId && (
        <div
          id='engagement-trend-section'
          className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'
        >
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <LineChart className='w-5 h-5 text-purple-500' />
              {trendStudent ? `${trendStudent.name} 的参与度周趋势` : '参与度周趋势'}
            </h3>
            <div className='flex items-center gap-2'>
              <span className='text-sm text-gray-500 dark:text-slate-400'>近</span>
              <select
                value={engagementTrendWeeks}
                onChange={(e) => setEngagementTrendWeeks(Number(e.target.value))}
                className='px-2 py-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm'
              >
                {[4, 6, 8, 12].map((w) => (
                  <option key={w} value={w}>
                    {w}周
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className='p-6'>
            {engagementTrendLoading && (
              <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
                <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-purple-500' />
                <p className='text-sm'>加载周趋势...</p>
              </div>
            )}
            {!engagementTrendLoading && trend && <EngagementTrendChart trend={trend} />}
          </div>
        </div>
      )}
    </div>
  );
}
