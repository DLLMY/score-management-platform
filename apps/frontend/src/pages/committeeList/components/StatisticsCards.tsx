// T12-6 拆分（2026-09-12）：自 CommitteeListView.tsx 原样搬出，行为逐字节等价。
import { Users, CheckCircle, Star } from 'lucide-react';
import { StatCard } from '../../../components';
import type { CommitteeListViewProps } from '../types';

export function StatisticsCards({ committee, activeCount, ratedCount }: CommitteeListViewProps) {
  return (
    <>
      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <StatCard
            label='班委总数'
            value={committee.length}
            icon={<Users className='w-6 h-6 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
            size='sm'
          />
          <StatCard
            label='在任人数'
            value={activeCount}
            icon={<CheckCircle className='w-6 h-6 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
            size='sm'
          />
          <StatCard
            label='已评价人数'
            value={ratedCount}
            icon={<Star className='w-6 h-6 text-white' />}
            iconGradient='from-purple-500 to-pink-500'
            decoGradient='from-purple-500/10 to-pink-500/10'
            size='sm'
          />
        </div>
      </div>
    </>
  );
}
