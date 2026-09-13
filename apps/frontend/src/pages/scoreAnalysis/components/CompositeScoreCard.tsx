// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「综合评分分布」卡片原样搬出，行为逐字节等价。
import { BarChart3 } from 'lucide-react';
import { Card } from '../../../components';

/** 综合评分分布卡片（熵权法综合评分按 20 分一档的柱状分布） */
export function CompositeScoreCard({
  compositeScoreDistribution,
}: {
  compositeScoreDistribution: number[];
}) {
  return (
    <Card className='rounded-xl'>
      <div className='p-3 border-b border-gray-100'>
        <h3 className='font-medium text-gray-800 flex items-center gap-2'>
          <BarChart3 className='w-4 h-4 text-indigo-500' />
          综合评分分布
        </h3>
      </div>
      <div className='p-3'>
        <div className='flex items-end justify-between h-14 gap-0.5'>
          {compositeScoreDistribution.map((count, index) => {
            const maxCount = Math.max(...compositeScoreDistribution, 1);
            return (
              <div key={index} className='flex-1 flex flex-col items-center'>
                <div
                  className='w-full bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t transition-all duration-500 hover:from-indigo-600 hover:to-indigo-400'
                  style={{ height: `${(count / maxCount) * 45}px`, minHeight: '5px' }}
                />
                <span className='text-[8px] text-gray-500 mt-0.5'>{index * 20}+</span>
              </div>
            );
          })}
        </div>
        <div className='mt-2 flex justify-between text-[9px] text-gray-500'>
          <span>低分</span>
          <span>高分</span>
        </div>
      </div>
    </Card>
  );
}
