/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
import { memo, useState } from 'react';
import { Crown, Award, Star } from 'lucide-react';
import type { User } from '../../../types';
import type { ClusterData } from '../useDashboardLogic';
import { getLevel, getUserCluster, getRankColor, getScoreColor } from '../helpers';
import { CLUSTER_COLORS } from '../constants';

export const UserCard = memo(
  ({
    user,
    globalIndex,
    clusters,
  }: {
    user: User;
    globalIndex: number;
    clusters: ClusterData | null;
  }) => {
    const level = getLevel(user.current_score || 0);
    const isTopThree = globalIndex < 3;
    const score = user.current_score || 0;
    const [isHovered, setIsHovered] = useState(false);
    const cluster = getUserCluster(clusters, user.id);
    const clusterColors = cluster ? CLUSTER_COLORS[cluster.cluster_name] : null;

    return (
      <div
        key={user.id}
        className={`relative group rounded-xl p-3.5 transition-all duration-400 ${
          isTopThree
            ? 'bg-white border border-gray-200/60 shadow-md hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-300/60 bg-gradient-to-r from-yellow-50/30 to-transparent'
            : 'bg-white hover:bg-white border border-gray-200/50 hover:border-gray-300/60'
        } ${isHovered ? '-translate-y-1.5' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ animationDelay: `${globalIndex * 50}ms` }}
      >
        {isTopThree && (
          <div className='absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/40'>
            {globalIndex === 0 ? (
              <Crown className='w-4 h-4 text-white' />
            ) : globalIndex === 1 ? (
              <Award className='w-4 h-4 text-white' />
            ) : (
              <Star className='w-4 h-4 text-white' />
            )}
          </div>
        )}

        <div className='flex items-center gap-3.5'>
          <div
            className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${getRankColor(
              globalIndex
            )} flex items-center justify-center shadow-md overflow-hidden transition-all duration-300 ${
              isHovered ? 'scale-110 rotate-3' : ''
            }`}
          >
            {globalIndex < 3 ? (
              <span className='text-base'>
                {globalIndex === 0 ? '🥇' : globalIndex === 1 ? '🥈' : '🥉'}
              </span>
            ) : (
              <span className='text-sm font-bold text-white'>{globalIndex + 1}</span>
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center justify-between mb-1'>
              <p className='font-semibold text-gray-900 text-sm truncate'>{user.name}</p>
              <span
                className={`text-xl font-bold ${getScoreColor(
                  score
                )} flex items-center gap-1 transition-all duration-300 ${
                  isHovered ? 'scale-110' : ''
                }`}
              >
                {score}
                <span className='text-xs text-gray-500'>分</span>
              </span>
            </div>
            <div className='flex items-center justify-between mt-1.5'>
              <span className='text-xs text-gray-500 whitespace-nowrap font-medium'>
                {user.class_name || '未分班'}
              </span>
              <div className='flex items-center gap-1.5'>
                {clusterColors && cluster && (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${clusterColors.light} ${clusterColors.text} font-medium whitespace-nowrap shadow-sm`}
                  >
                    {cluster.cluster_name}
                  </span>
                )}
                <span
                  className={`text-xs px-2.5 py-1 rounded-full bg-gradient-to-r ${
                    level.color
                  } text-white flex items-center gap-1 transition-all duration-300 ${
                    isHovered ? 'scale-105 shadow-md' : ''
                  } whitespace-nowrap`}
                >
                  <span className='text-xs'>{level.icon}</span>
                  <span className='font-semibold'>{level.text}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
