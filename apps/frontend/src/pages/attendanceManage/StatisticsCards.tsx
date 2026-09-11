import { CheckCircle, XCircle, Clock, Briefcase, UserCheck } from 'lucide-react';
import { StatCard } from '../../components';
import type { AttendanceStats } from '../../types';

interface StatisticsCardsProps {
  stats: AttendanceStats | null;
}

export default function StatisticsCards({ stats }: StatisticsCardsProps) {
  return (
    <div className='px-6 py-5'>
      <div className='grid grid-cols-2 md:grid-cols-5 gap-4 mb-5'>
        <StatCard
          size='sm'
          label='出勤'
          value={stats ? stats.present : '—'}
          icon={<CheckCircle className='w-6 h-6 text-white' />}
          iconGradient='from-emerald-500 to-teal-500'
          decoGradient='from-emerald-500/10 to-teal-500/10'
        />
        <StatCard
          size='sm'
          label='缺勤'
          value={stats ? stats.absent : '—'}
          icon={<XCircle className='w-6 h-6 text-white' />}
          iconGradient='from-red-500 to-pink-500'
          decoGradient='from-red-500/10 to-pink-500/10'
        />
        <StatCard
          size='sm'
          label='迟到'
          value={stats ? stats.late : '—'}
          icon={<Clock className='w-6 h-6 text-white' />}
          iconGradient='from-amber-500 to-orange-500'
          decoGradient='from-amber-500/10 to-orange-500/10'
        />
        <StatCard
          size='sm'
          label='请假'
          value={stats ? stats.leave : '—'}
          icon={<Briefcase className='w-6 h-6 text-white' />}
          iconGradient='from-blue-500 to-indigo-500'
          decoGradient='from-blue-500/10 to-indigo-500/10'
        />
        <StatCard
          size='sm'
          label='出勤率'
          value={stats ? `${(stats.attendance_rate * 100).toFixed(1)}%` : '—'}
          icon={<UserCheck className='w-6 h-6 text-white' />}
          iconGradient='from-purple-500 to-pink-500'
          decoGradient='from-purple-500/10 to-pink-500/10'
          className='col-span-2 md:col-span-1'
        />
      </div>
    </div>
  );
}
