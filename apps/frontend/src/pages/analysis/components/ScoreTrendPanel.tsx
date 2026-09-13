// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WeeklyDataItem } from '../types';

/** 积分趋势（当前无真实周级数据，显示诚实空态） */
export function ScoreTrendPanel({ weeklyData }: { weeklyData: WeeklyDataItem[] }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center'>
            <TrendingUp className='w-4 h-4 text-success-600' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-gray-800'>积分趋势</h3>
            <p className='text-[10px] text-gray-500'>近8周平均积分变化</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        {weeklyData.length > 0 ? (
          <ResponsiveContainer width='100%' height={220}>
            <AreaChart data={weeklyData}>
              <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
              <XAxis
                dataKey='week'
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                domain={[60, 100]}
              />
              <Tooltip
                formatter={(value: unknown) => [`${value}分`, '平均分']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <defs>
                <linearGradient id='colorAvg' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#22c55e' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#22c55e' stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type='monotone'
                dataKey='avg'
                stroke='#22c55e'
                strokeWidth={2}
                fillOpacity={1}
                fill='url(#colorAvg)'
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className='flex flex-col items-center justify-center h-[220px] text-gray-400'>
            <TrendingUp className='w-6 h-6 mb-2 text-gray-300' />
            <p className='text-xs'>暂无趋势数据</p>
            <p className='text-[10px] mt-1'>需连续多周积分记录后生成周均趋势</p>
          </div>
        )}
      </div>
    </div>
  );
}
