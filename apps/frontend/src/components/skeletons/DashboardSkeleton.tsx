/**
 * Dashboard页面骨架屏组件
 * 在数据加载时显示占位符，提升用户体验
 *
 * M13 首屏瘦身：原实现依赖 antd（Skeleton/Card/Row/Col/Statistic），
 * 会强制把 antd 全量（~785KB）拉进首页共享链；改为纯 div + tailwind
 * 自研骨架（animate-pulse），antd 从首屏加载路径移除。
 */

import React from 'react';

interface DashboardSkeletonProps {
  loading?: boolean;
}

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
);

const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ loading = true }) => {
  if (!loading) return null;

  const stats = ['用户总数', '积分记录', '在线设备', '待审批'];

  return (
    <div className='dashboard-skeleton' role='status' aria-label='正在加载仪表盘数据'>
      {/* 统计卡片骨架屏 */}
      <div className='mb-6 grid grid-cols-2 gap-4 md:grid-cols-4'>
        {stats.map((title) => (
          <div
            key={title}
            className='rounded-lg border border-gray-100 bg-white p-4 shadow-sm'
          >
            <div className='mb-2 text-xs text-gray-400'>{title}</div>
            <SkeletonBlock className='h-6 w-16' />
          </div>
        ))}
      </div>

      {/* 用户排名骨架屏 */}
      <div className='mb-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm'>
        <div className='mb-3 text-sm font-medium text-gray-600'>用户排名</div>
        <div className='space-y-2'>
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className='h-4 w-full' />
          ))}
        </div>
      </div>

      {/* 设备状态骨架屏 */}
      <div className='rounded-lg border border-gray-100 bg-white p-4 shadow-sm'>
        <div className='mb-3 text-sm font-medium text-gray-600'>设备状态</div>
        <div className='space-y-2'>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonBlock key={i} className='h-4 w-3/4' />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
