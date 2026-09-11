import type { ReactElement } from 'react';
import { GraduationCap, Users, UserCheck } from 'lucide-react';
import { StatCard } from '../../components';

interface StatisticsCardsProps {
  classTotal: number;
  totalStudents: number;
  classesWithTeacher: number;
}

export default function StatisticsCards({
  classTotal,
  totalStudents,
  classesWithTeacher,
}: StatisticsCardsProps): ReactElement {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      <StatCard
        label='班级总数'
        value={classTotal}
        icon={<GraduationCap className='w-7 h-7 text-white' />}
        iconGradient='from-blue-500 to-indigo-500'
        decoGradient='from-blue-500/10 to-indigo-500/10'
        glowClass='shadow-blue-500/20'
      />
      <StatCard
        label='学生总数'
        value={totalStudents}
        icon={<Users className='w-7 h-7 text-white' />}
        iconGradient='from-emerald-500 to-teal-500'
        decoGradient='from-emerald-500/10 to-teal-500/10'
        glowClass='shadow-emerald-500/20'
      />
      <StatCard
        label='已分配班主任'
        value={classesWithTeacher}
        icon={<UserCheck className='w-7 h-7 text-white' />}
        iconGradient='from-amber-500 to-orange-500'
        decoGradient='from-amber-500/10 to-orange-500/10'
        glowClass='shadow-amber-500/20'
      />
    </div>
  );
}
