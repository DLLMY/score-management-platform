// 远程通知 - 通知历史记录弹窗
import { History, Filter, Trash } from 'lucide-react';
import { DataTable } from '../../components';
import { type RemoteNotifyDeps } from './types';

export function HistoryPanel({ deps }: { deps: RemoteNotifyDeps }) {
  const {
    showHistory,
    closeHistory,
    historyData,
    historyStats,
    historyPage,
    setHistoryPage,
    historyTotal,
    historyFilter,
    setHistoryFilter,
    isLoadingHistory,
    handleCleanHistory,
    historyColumns,
  } = deps;

  if (!showHistory) return null;

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden'>
        <div className='flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <History className='w-5 h-5 text-primary-500' />
            通知历史记录
          </h3>
          <button
            onClick={closeHistory}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700'
          >
            <span className='text-gray-500 text-xl'>×</span>
          </button>
        </div>

        {/* 统计卡片 */}
        {historyStats && (
          <div className='grid grid-cols-4 gap-4 p-6 bg-gray-50 dark:bg-slate-700/30'>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
              <p className='text-sm text-gray-500 dark:text-slate-400'>总发送量</p>
              <p className='text-2xl font-bold text-gray-800 dark:text-white mt-1'>
                {historyStats.total_count}
              </p>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
              <p className='text-sm text-gray-500 dark:text-slate-400'>今日发送</p>
              <p className='text-2xl font-bold text-blue-600 mt-1'>{historyStats.today_count}</p>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
              <p className='text-sm text-gray-500 dark:text-slate-400'>成功率</p>
              <p className='text-2xl font-bold text-green-600 mt-1'>{historyStats.success_rate}%</p>
            </div>
            <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
              <p className='text-sm text-gray-500 dark:text-slate-400'>失败次数</p>
              <p className='text-2xl font-bold text-red-600 mt-1'>{historyStats.fail_count}</p>
            </div>
          </div>
        )}

        {/* 筛选和操作栏 */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-3'>
            <Filter className='w-4 h-4 text-gray-500' />
            <select
              value={historyFilter}
              onChange={(e) => {
                setHistoryFilter(e.target.value);
                setHistoryPage(1);
              }}
              className='px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700'
            >
              <option value=''>全部状态</option>
              <option value='sent'>发送成功</option>
              <option value='failed'>发送失败</option>
            </select>
          </div>
          <button
            onClick={handleCleanHistory}
            className='flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30'
          >
            <Trash className='w-4 h-4' />
            清理30天前记录
          </button>
        </div>

        {/* 历史记录列表 */}
        <div className='overflow-x-auto overflow-y-auto max-h-[400px]'>
          {' '}
          {/* L4: 窄屏横向滚动 */}
          <DataTable<typeof historyData[number]>
            columns={historyColumns}
            dataSource={historyData}
            loading={isLoadingHistory}
            rowKey='id'
            total={historyTotal}
            page={historyPage}
            pageSize={20}
            pageSizeOptions={[20]}
            onPageChange={(page) => setHistoryPage(page)}
            empty={{
              title: '暂无历史记录',
            }}
          />
        </div>
      </div>
    </div>
  );
}
