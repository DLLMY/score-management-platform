// T12-6 拆分（2026-09-12）：自 ParentContactView.tsx 原样搬出，行为逐字节等价。
import { Users, MessageCircle, Check } from 'lucide-react';
import { StatCard } from '../../../components';
import type { ParentContactViewProps } from '../types';

export function StatisticsCards({ contacts, totalLogs, resolvedLogs }: ParentContactViewProps) {
  return (
    <>
      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <StatCard
            label='家长联系人'
            value={contacts.items.length}
            icon={<Users className='w-6 h-6 text-white' />}
            iconGradient='from-cyan-500 to-blue-500'
            decoGradient='from-cyan-500/10 to-blue-500/10'
            size='sm'
          />
          <StatCard
            label='联系日志'
            value={totalLogs}
            icon={<MessageCircle className='w-6 h-6 text-white' />}
            iconGradient='from-purple-500 to-pink-500'
            decoGradient='from-purple-500/10 to-pink-500/10'
            size='sm'
          />
          <StatCard
            label='已跟进'
            value={resolvedLogs}
            icon={<Check className='w-6 h-6 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
            size='sm'
          />
        </div>
      </div>
    </>
  );
}
