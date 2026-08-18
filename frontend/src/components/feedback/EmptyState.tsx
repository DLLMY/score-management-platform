import { memo, MouseEventHandler } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  FileX,
  Users,
  Database,
  Wifi,
  Bell,
  Settings,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';
import Button from '../ui/Button';

type EmptyStateIcon =
  | 'users'
  | 'data'
  | 'search'
  | 'file'
  | 'folder'
  | 'wifi'
  | 'bell'
  | 'settings'
  | 'alert';

const iconMap: Record<EmptyStateIcon, LucideIcon> = {
  users: Users,
  data: Database,
  search: Search,
  file: FileX,
  folder: FolderOpen,
  wifi: Wifi,
  bell: Bell,
  settings: Settings,
  alert: AlertCircle,
};

interface EmptyStateProps {
  icon?: EmptyStateIcon;
  title?: string;
  description?: string;
  actionLabel?: string | null;
  onAction?: MouseEventHandler<HTMLButtonElement> | null;
  secondActionLabel?: string | null;
  onSecondAction?: MouseEventHandler<HTMLButtonElement> | null;
  className?: string;
}

const EmptyState = memo<EmptyStateProps>(
  ({
    icon = 'folder',
    title = '暂无数据',
    description = '这里还没有任何内容',
    actionLabel = null,
    onAction = null,
    secondActionLabel = null,
    onSecondAction = null,
    className = '',
  }) => {
    const IconComponent = iconMap[icon] || FolderOpen;

    return (
      <div
        className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
      >
        <div className='relative mb-6'>
          <div className='w-24 h-24 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 rounded-3xl flex items-center justify-center shadow-inner'>
            <IconComponent className='w-12 h-12 text-slate-400' />
          </div>
          <div className='absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg'>
            <Plus className='w-4 h-4 text-white' />
          </div>
          <div className='absolute -top-2 -left-2 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg opacity-60 animate-bounce-in' />
          <div className='absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full opacity-40' />
        </div>

        <h3 className='text-xl font-bold text-slate-700 mb-2'>{title}</h3>

        <p className='text-slate-500 mb-6 max-w-sm'>{description}</p>

        <div className='flex items-center gap-3'>
          {actionLabel && onAction && (
            <Button onClick={onAction} variant='primary'>
              <Plus className='w-4 h-4' />
              {actionLabel}
            </Button>
          )}

          {secondActionLabel && onSecondAction && (
            <Button onClick={onSecondAction} variant='outline'>
              {secondActionLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }
);

interface SearchEmptyStateProps {
  searchTerm?: string;
  onClearSearch?: MouseEventHandler<HTMLButtonElement> | null;
  className?: string;
}

const SearchEmptyState = memo<SearchEmptyStateProps>(
  ({ searchTerm = '', onClearSearch = null, className = '' }) => {
    return (
      <div
        className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
      >
        <div className='relative mb-6'>
          <div className='w-24 h-24 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 rounded-3xl flex items-center justify-center shadow-inner'>
            <Search className='w-12 h-12 text-slate-400' />
          </div>
          <div className='absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-400 rounded-lg flex items-center justify-center shadow-lg'>
            <span className='text-white text-xs font-bold'>!</span>
          </div>
        </div>

        <h3 className='text-xl font-bold text-slate-700 mb-2'>未找到相关结果</h3>

        <p className='text-slate-500 mb-2'>
          没有找到与 "<span className='font-semibold text-slate-700'>{searchTerm}</span>" 相关的内容
        </p>

        <p className='text-slate-400 text-sm mb-6'>请尝试其他关键词或调整筛选条件</p>

        {onClearSearch && (
          <Button onClick={onClearSearch} variant='outline'>
            <Search className='w-4 h-4' />
            清除搜索
          </Button>
        )}
      </div>
    );
  }
);

interface ErrorStateProps {
  message?: string;
  onRetry?: MouseEventHandler<HTMLButtonElement> | null;
  className?: string;
}

const ErrorState = memo<ErrorStateProps>(
  ({ message = '加载失败', onRetry = null, className = '' }) => {
    return (
      <div
        className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
      >
        <div className='relative mb-6'>
          <div className='w-24 h-24 bg-gradient-to-br from-red-50 via-orange-50 to-red-50 rounded-3xl flex items-center justify-center shadow-inner'>
            <AlertCircle className='w-12 h-12 text-red-400' />
          </div>
          <div className='absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-red-400 to-orange-400 rounded-xl flex items-center justify-center shadow-lg animate-bounce-in'>
            <span className='text-white text-lg font-bold'>!</span>
          </div>
        </div>

        <h3 className='text-xl font-bold text-slate-700 mb-2'>{message}</h3>

        <p className='text-slate-500 mb-6'>请稍后重试，或联系管理员获取帮助</p>

        {onRetry && (
          <Button onClick={onRetry} variant='primary'>
            重新加载
          </Button>
        )}
      </div>
    );
  }
);

export { SearchEmptyState, ErrorState };
export default EmptyState;
