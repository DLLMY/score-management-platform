/**
 * UserList页面骨架屏组件
 * 在用户数据加载时显示占位符
 *
 * M13 首屏瘦身：原实现依赖 antd（Skeleton/Card/Table/Space），
 * 强制把 antd 全量拉进共享链；改为纯 div + tailwind 自研骨架。
 */

import React from 'react';

interface UserListSkeletonProps {
  loading?: boolean;
}

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
);

const UserListSkeleton: React.FC<UserListSkeletonProps> = ({ loading = true }) => {
  if (!loading) return null;

  return (
    <div className='user-list-skeleton' role='status' aria-label='正在加载用户列表数据'>
      {/* 搜索栏骨架屏 */}
      <div className='mb-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm'>
        <div className='flex flex-wrap items-center gap-3'>
          <SkeletonBlock className='h-8 w-52' />
          <SkeletonBlock className='h-8 w-20' />
          <SkeletonBlock className='h-8 w-20' />
        </div>
      </div>

      {/* 用户表格骨架屏 */}
      <div className='rounded-lg border border-gray-100 bg-white p-4 shadow-sm'>
        {/* 表头 */}
        <div className='flex items-center gap-4 border-b border-gray-100 pb-3'>
          {['姓名', '学号', '班级', '积分', '状态', '操作'].map((h) => (
            <div key={h} className='flex-1 text-xs text-gray-400'>
              {h}
            </div>
          ))}
        </div>
        {/* 数据行 */}
        <div className='divide-y divide-gray-50'>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className='flex items-center gap-4 py-3'>
              <SkeletonBlock className='h-4 flex-1' />
              <SkeletonBlock className='h-4 flex-1' />
              <SkeletonBlock className='h-4 flex-1' />
              <SkeletonBlock className='h-4 w-16' />
              <SkeletonBlock className='h-4 w-14' />
              <SkeletonBlock className='h-4 w-24' />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserListSkeleton;
