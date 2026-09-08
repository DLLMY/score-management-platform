import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200';

  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

function TableSkeleton({ rows = 5, columns = 4, showHeader = true }: TableSkeletonProps) {
  return (
    <div className='w-full'>
      {showHeader && (
        <div className='flex gap-4 mb-3 pb-3 border-b border-gray-200'>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} variant='text' height={20} className='flex-1' />
          ))}
        </div>
      )}
      <div className='space-y-3'>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className='flex gap-4 items-center'>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                variant='text'
                height={16}
                className='flex-1'
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
  showAvatar?: boolean;
  showSubtitle?: boolean;
}

function CardSkeleton({ count = 1, showAvatar = true, showSubtitle = true }: CardSkeletonProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='p-4 border border-gray-200 rounded-lg'>
          <div className='flex items-start gap-3'>
            {showAvatar && <Skeleton variant='circular' width={40} height={40} />}
            <div className='flex-1 space-y-2'>
              <Skeleton variant='text' width='70%' height={20} />
              {showSubtitle && <Skeleton variant='text' width='50%' height={16} />}
              <Skeleton variant='text' width='90%' height={14} />
              <Skeleton variant='text' width='80%' height={14} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface FormSkeletonProps {
  fieldCount?: number;
  showActions?: boolean;
}

function FormSkeleton({ fieldCount = 4, showActions = true }: FormSkeletonProps) {
  return (
    <div className='space-y-4'>
      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i}>
          <Skeleton variant='text' width='30%' height={16} className='mb-2' />
          <Skeleton variant='rectangular' height={40} />
        </div>
      ))}
      {showActions && (
        <div className='flex gap-3 pt-4'>
          <Skeleton variant='rectangular' width={100} height={40} />
          <Skeleton variant='rectangular' width={100} height={40} />
        </div>
      )}
    </div>
  );
}

interface CategoryCardSkeletonProps {
  count?: number;
}

function CategoryCardSkeleton({ count = 1 }: CategoryCardSkeletonProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='card p-5 border-2 border-gray-100'>
          <div className='flex items-start justify-between mb-4'>
            <div className='flex items-center gap-3'>
              <Skeleton variant='rectangular' width={48} height={48} className='rounded-xl' />
              <div className='space-y-2'>
                <Skeleton variant='text' width={100} height={20} />
                <Skeleton variant='rectangular' width={60} height={24} className='rounded-full' />
              </div>
            </div>
          </div>
          <Skeleton variant='text' width='100%' height={14} className='mb-4' />
          <div className='flex items-center justify-between pt-4 border-t border-gray-100'>
            <Skeleton variant='text' width={80} height={14} />
            <Skeleton variant='rectangular' width={80} height={28} className='rounded' />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DashboardSkeletonProps {
  showCharts?: boolean;
}

function DashboardSkeleton({ showCharts = true }: DashboardSkeletonProps) {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='card p-4'>
            <div className='flex items-center justify-between'>
              <div className='space-y-2'>
                <Skeleton variant='text' width={80} height={14} />
                <Skeleton variant='text' width={100} height={32} />
              </div>
              <Skeleton variant='circular' width={48} height={48} />
            </div>
          </div>
        ))}
      </div>

      {showCharts && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <div className='card p-4'>
            <Skeleton variant='text' width={150} height={24} className='mb-4' />
            <Skeleton variant='rectangular' height={300} />
          </div>
          <div className='card p-4'>
            <Skeleton variant='text' width={150} height={24} className='mb-4' />
            <Skeleton variant='rectangular' height={300} />
          </div>
        </div>
      )}
    </div>
  );
}

export {
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  CategoryCardSkeleton,
  DashboardSkeleton,
};
export default Skeleton;
