import React from 'react';
import { Inbox, Search, FileText, Users, AlertCircle, RefreshCw, Plus } from 'lucide-react';

export interface EmptyStateProps {
  type?: 'noData' | 'noResults' | 'error' | 'loading';
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({
  type = 'noData',
  title,
  description,
  icon,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const defaultConfig = {
    noData: {
      icon: icon || <Inbox className='w-16 h-16 text-gray-300' />,
      title: title || '暂无数据',
      description: description || '还没有任何数据，点击下方按钮开始添加',
    },
    noResults: {
      icon: icon || <Search className='w-16 h-16 text-gray-300' />,
      title: title || '未找到结果',
      description: description || '没有找到匹配的数据，请尝试调整搜索条件',
    },
    error: {
      icon: icon || <AlertCircle className='w-16 h-16 text-red-300' />,
      title: title || '加载失败',
      description: description || '数据加载失败，请检查网络连接或稍后重试',
    },
    loading: {
      icon: icon || <RefreshCw className='w-16 h-16 text-gray-300 animate-spin' />,
      title: title || '加载中',
      description: description || '正在加载数据，请稍候...',
    },
  };

  const config = defaultConfig[type];

  return (
    <div className='flex flex-col items-center justify-center py-16 px-4'>
      <div className='mb-4'>{config.icon}</div>
      <h3 className='text-lg font-semibold text-gray-900 mb-2'>{config.title}</h3>
      <p className='text-sm text-gray-500 text-center max-w-md mb-6'>{config.description}</p>

      {(action || secondaryAction) && (
        <div className='flex gap-3'>
          {action && (
            <button
              onClick={action.onClick}
              className='flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium'
            >
              {action.icon || <Plus className='w-4 h-4' />}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className='flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface EmptyStatePresets {
  NoUsers: (onCreate?: () => void) => React.ReactElement;
  NoRules: (onCreate?: () => void) => React.ReactElement;
  NoRecords: (onCreate?: () => void) => React.ReactElement;
  NoDevices: (onCreate?: () => void) => React.ReactElement;
  NoResults: (onReset?: () => void) => React.ReactElement;
  Error: (onRetry?: () => void) => React.ReactElement;
}

const presets: EmptyStatePresets = {
  NoUsers: (onCreate) => (
    <EmptyState
      type='noData'
      icon={<Users className='w-16 h-16 text-gray-300' />}
      title='暂无学生数据'
      description='还没有添加任何学生，点击下方按钮开始添加'
      action={onCreate ? { label: '添加学生', onClick: onCreate } : undefined}
    />
  ),

  NoRules: (onCreate) => (
    <EmptyState
      type='noData'
      icon={<FileText className='w-16 h-16 text-gray-300' />}
      title='暂无积分规则'
      description='还没有创建任何积分规则，点击下方按钮开始创建'
      action={onCreate ? { label: '创建规则', onClick: onCreate } : undefined}
    />
  ),

  NoRecords: (onCreate) => (
    <EmptyState
      type='noData'
      icon={<FileText className='w-16 h-16 text-gray-300' />}
      title='暂无积分记录'
      description='还没有任何积分记录，开始添加记录吧'
      action={onCreate ? { label: '添加记录', onClick: onCreate } : undefined}
    />
  ),

  NoDevices: (onCreate) => (
    <EmptyState
      type='noData'
      icon={<Inbox className='w-16 h-16 text-gray-300' />}
      title='暂无设备'
      description='还没有添加任何设备，点击下方按钮开始添加'
      action={onCreate ? { label: '添加设备', onClick: onCreate } : undefined}
    />
  ),

  NoResults: (onReset) => (
    <EmptyState
      type='noResults'
      action={onReset ? { label: '清除筛选', onClick: onReset } : undefined}
    />
  ),

  Error: (onRetry) => (
    <EmptyState type='error' action={onRetry ? { label: '重试', onClick: onRetry } : undefined} />
  ),
};

export { EmptyState, presets };
export default EmptyState;
