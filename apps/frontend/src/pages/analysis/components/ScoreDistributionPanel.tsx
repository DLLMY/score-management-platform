// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ScoreDistributionItem } from '../types';

/** 积分分布柱状图 */
export function ScoreDistributionPanel({ data }: { data: ScoreDistributionItem[] }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.5rem 0.75rem' }}>
        <div className='flex items-center gap-1.5'>
          <div className='w-6 h-6 bg-primary-100 rounded-md flex items-center justify-center'>
            <BarChart3 className='w-3 h-3 text-primary-600' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-800'>积分分布</h3>
            <p className='text-[9px] text-gray-500'>各分数段学生人数统计</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.5rem 0.75rem' }}>
        <ResponsiveContainer width='100%' height={160}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
            <XAxis
              dataKey='name'
              tick={{ fontSize: 8, fill: '#64748b', fontWeight: 500 }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
            <Tooltip
              formatter={(value: unknown) => [`${value} 人`, '人数']}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '10px',
              }}
            />
            <Bar dataKey='count' radius={[4, 4, 0, 0]} barSize={30}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
