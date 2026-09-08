import { memo } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface SkeletonTextProps {
  rows?: number;
  className?: string;
}

function SkeletonText({ rows = 1, className = '' }: SkeletonTextProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className='animate-pulse bg-gray-200 rounded mb-2 last:mb-0'
          style={{
            height: '16px',
            width: `${80 - i * 10}%`,
          }}
        />
      ))}
    </div>
  );
}

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return <div className={`animate-pulse bg-gray-200 rounded-full ${sizes[size]} ${className}`} />;
}

interface SkeletonCardProps {
  className?: string;
}

function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${className}`}>
      <div className='flex items-center gap-4'>
        <SkeletonAvatar size='md' />
        <div className='flex-1'>
          <SkeletonText rows={2} />
        </div>
        <Skeleton className='w-16 h-8' />
      </div>
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
  className?: string;
}

function SkeletonList({ count = 5, className = '' }: SkeletonListProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className='mb-3 last:mb-0' />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonList };
export default memo(Skeleton);
