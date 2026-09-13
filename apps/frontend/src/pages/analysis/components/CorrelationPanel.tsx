// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import type { AlgorithmStatistics } from '../../../types';

/** 相关性分析（Pearson 相关系数） */
export function CorrelationPanel({ statistics }: { statistics: AlgorithmStatistics | null }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center'>
            <Sparkles className='w-4 h-4 text-purple-600' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-gray-800'>相关性分析</h3>
            <p className='text-[10px] text-gray-500'>行为与学业关联度</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        {statistics ? (
          (() => {
            const corr = statistics.correlation;
            const hasCorr = corr !== null && corr !== undefined && !Number.isNaN(corr);
            if (!hasCorr) {
              // correlation 无有效值（如仅有积分无成绩记录）→ 诚实显示"暂无"，不误判负相关
              return (
                <div className='flex flex-col items-center justify-center h-[160px] text-center'>
                  <Sparkles className='w-8 h-8 text-gray-300 mb-2' />
                  <p className='text-[10px] text-gray-500'>暂无关联数据</p>
                  <p className='text-[10px] text-gray-400 mt-1'>需同时存在积分与成绩记录</p>
                </div>
              );
            }
            return (
              <div className='flex flex-col items-center justify-center h-[160px]'>
                <div
                  className={`text-4xl font-bold ${
                    corr > 0.5 ? 'text-green-600' : corr > 0 ? 'text-yellow-600' : 'text-red-600'
                  }`}
                >
                  {corr.toFixed(2)}
                </div>
                <p className='text-[10px] text-gray-500 mt-2'>Pearson相关系数</p>
                <div className='mt-3 flex items-center gap-2'>
                  {corr > 0.5 ? (
                    <>
                      <TrendingUp className='w-4 h-4 text-green-500' />
                      <span className='text-xs text-green-600 font-medium'>强正相关</span>
                    </>
                  ) : corr > 0 ? (
                    <>
                      <TrendingUp className='w-4 h-4 text-yellow-500' />
                      <span className='text-xs text-yellow-600 font-medium'>弱正相关</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className='w-4 h-4 text-red-500' />
                      <span className='text-xs text-red-600 font-medium'>负相关</span>
                    </>
                  )}
                </div>
                <div className='mt-3 p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg w-full'>
                  <p className='text-[10px] text-gray-500 text-center'>
                    积分与成绩呈
                    {corr > 0.5 ? '强正向关联' : corr > 0 ? '一定正向关联' : '负向关联'}
                  </p>
                </div>
              </div>
            );
          })()
        ) : (
          <div className='flex flex-col items-center justify-center h-[160px] text-center'>
            <TrendingUp className='w-8 h-8 text-gray-300 mb-2' />
            <p className='text-[10px] text-gray-500'>暂无相关数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
