// T12-1 拆分（2026-09-12）：自 AnalysisSections.tsx 原样搬出，行为逐字节等价。
import { Trophy } from 'lucide-react';
import { EmptyState } from '../../../components';
import { CLUSTER_COLORS } from '../constants';
import type { UserWithCluster } from '../types';

/** 积分排行榜（Top 10） */
export function TopUsersRanking({ users }: { users: UserWithCluster[] }) {
  return (
    <div className='card'>
      <div className='card-header' style={{ padding: '0.75rem 1rem' }}>
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center shadow-md shadow-yellow-500/30'>
            <Trophy className='w-4 h-4 text-white' />
          </div>
          <h3 className='text-base font-semibold text-gray-800'>积分排行榜</h3>
        </div>
      </div>
      <div className='card-body' style={{ padding: '0.75rem 1rem' }}>
        <div className='space-y-2'>
          {users.map((user, index) => {
            const clusterColors = user.cluster ? CLUSTER_COLORS[user.cluster.cluster_name] : null;
            const isTopThree = index < 3;
            const getRankColor = (idx: number) => {
              if (idx === 0) return 'from-yellow-400 to-amber-500';
              if (idx === 1) return 'from-gray-300 to-gray-500';
              if (idx === 2) return 'from-amber-600 to-orange-600';
              return 'from-gray-400 to-gray-500';
            };
            const getScoreColor = (score: number) => {
              if (score >= 80) return 'text-green-600';
              if (score >= 60) return 'text-blue-600';
              return 'text-red-600';
            };
            return (
              <div
                key={user.id}
                className={`relative p-2.5 rounded-lg transition-all duration-200 group ${
                  isTopThree
                    ? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border border-yellow-100'
                    : 'bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                {isTopThree && (
                  <div className='absolute -top-1 -left-1 w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-sm shadow-yellow-500/30'>
                    <span className='text-[8px]'>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                  </div>
                )}

                <div className='flex items-center gap-2'>
                  <div
                    className={`relative w-8 h-8 rounded-full bg-gradient-to-br ${getRankColor(
                      index
                    )} flex items-center justify-center shadow-sm transition-all duration-200`}
                  >
                    {isTopThree ? (
                      <span className='text-[11px]'>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className='text-[10px] font-bold text-white'>{index + 1}</span>
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-1.5'>
                        <p className='font-semibold text-gray-900 text-xs whitespace-nowrap'>
                          {user.name}
                        </p>
                        {clusterColors && (
                          <span
                            className={`text-[9px] px-1.5 py-0.25 rounded-full ${clusterColors.light} ${clusterColors.text} font-medium whitespace-nowrap`}
                          >
                            {user.cluster?.cluster_name}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-base font-bold ${
                          user.current_score != null
                            ? getScoreColor(user.current_score)
                            : 'text-gray-400'
                        } flex items-center gap-0.5`}
                      >
                        {user.current_score != null ? user.current_score : '--'}
                        <span className='text-[9px] text-gray-500'>分</span>
                      </span>
                    </div>
                    <p className='text-[9px] text-gray-500 truncate'>{user.class_name}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <EmptyState
              icon='users'
              title='暂无学生数据'
              description='当前筛选条件下没有学生数据'
            />
          )}
        </div>
      </div>
    </div>
  );
}
