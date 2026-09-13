// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { AlertTriangle } from 'lucide-react';
import type { User } from '../../../types';
import { CLUSTER_COLORS } from '../constants';
import type { UserWithCluster } from '../types';

/** 需关注学生（积分 < 60）网格 */
export function NeedAttentionPanel({
  users,
  usersWithCluster,
}: {
  users: User[];
  usersWithCluster: UserWithCluster[];
}) {
  return (
    <div className='card mt-4 border-l-4 border-l-amber-400'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center'>
            <AlertTriangle className='w-4 h-4 text-amber-600' />
          </div>
          <div>
            <h3 className='text-base font-semibold text-gray-800'>需关注学生</h3>
            <p className='text-[10px] text-gray-500'>积分低于60分的学生</p>
          </div>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        <div className='grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2'>
          {users.slice(0, 12).map((user) => {
            const userCluster = usersWithCluster.find((u) => u.id === user.id)?.cluster;
            const clusterColors = userCluster ? CLUSTER_COLORS[userCluster.cluster_name] : null;
            return (
              <div
                key={user.id}
                className='p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-center'
              >
                <p className='font-semibold text-gray-800 dark:text-slate-200 truncate text-sm'>
                  {user.name}
                </p>
                <p className='text-[10px] text-gray-500'>{user.class_name}</p>
                <p className='text-base font-bold text-red-600'>{user.current_score}</p>
                {clusterColors && (
                  <span
                    className={`inline-block mt-0.5 px-1 py-0.5 rounded text-[10px] ${clusterColors.light} ${clusterColors.text}`}
                  >
                    {userCluster?.cluster_name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {users.length > 12 && (
          <p className='text-center text-[10px] text-gray-500 mt-2'>
            还有 {users.length - 12} 名学生积分低于60分...
          </p>
        )}
      </div>
    </div>
  );
}
