// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「行为-学业相关性分析」卡片原样搬出，行为逐字节等价。
import { TrendingUp } from 'lucide-react';
import { Card } from '../../../components';
import { formatNumber } from '../../../utils/format';

/** 行为-学业相关性分析卡片（相关系数为 null 时显示诚实空态） */
export function CorrelationCard({
  behaviorAcademicCorrelation,
}: {
  behaviorAcademicCorrelation: number | null;
}) {
  return (
    <Card className='rounded-xl'>
      <div className='p-3 border-b border-gray-100'>
        <h3 className='font-medium text-gray-800 flex items-center gap-2'>
          <TrendingUp className='w-4 h-4 text-cyan-500' />
          行为-学业相关性
        </h3>
      </div>
      <div className='p-3'>
        <div className='flex items-center justify-center h-16'>
          {behaviorAcademicCorrelation === null ? (
            <div className='text-center'>
              <div className='text-sm text-gray-400'>暂无相关数据</div>
              <div className='text-[10px] text-gray-400 mt-0.5'>需同时存在行为积分与成绩记录</div>
            </div>
          ) : (
            <div className='text-center'>
              <div
                className={`text-2xl font-bold ${
                  Math.abs(behaviorAcademicCorrelation) >= 0.7
                    ? 'text-green-600'
                    : Math.abs(behaviorAcademicCorrelation) >= 0.4
                    ? 'text-yellow-600'
                    : 'text-gray-500'
                }`}
              >
                {formatNumber(behaviorAcademicCorrelation, 2)}
              </div>
              <div className='text-[10px] text-gray-500 mt-0.5'>相关系数</div>
              <div className='text-[9px] text-gray-400 mt-0.5'>
                {behaviorAcademicCorrelation > 0
                  ? '正相关'
                  : behaviorAcademicCorrelation < 0
                  ? '负相关'
                  : '无明显相关'}
              </div>
            </div>
          )}
        </div>
        <div className='mt-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-1.5'>
          <div className='flex items-center gap-1.5'>
            <div className='w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center'>
              <span className='text-[9px] font-bold text-blue-600'>B</span>
            </div>
            <div className='flex-1 h-px bg-gradient-to-r from-blue-300 to-purple-300' />
            <div className='w-5 h-5 bg-purple-100 rounded-md flex items-center justify-center'>
              <span className='text-[9px] font-bold text-purple-600'>A</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
