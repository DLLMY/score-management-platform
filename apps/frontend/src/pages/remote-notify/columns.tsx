import { AlertTriangle } from 'lucide-react';

import type { NotifyHistory } from '../../services/api';
import type { ColumnType } from '../../components';
import { formatDateTime } from '../../utils/format';

/**
 * RemoteNotify 历史记录表格列定义（E6a 抽取：纯渲染配置，无业务逻辑）。
 * 原为 RemoteNotify 内的 useMemo（deps=[]），行为完全一致。
 */
export function buildHistoryColumns(): ColumnType<NotifyHistory>[] {
  return [
    {
      title: '内容',
      key: 'text',
      dataIndex: 'text',
      render: (_, item) => (
        <div className='flex items-center gap-2'>
          {item.urgent && <AlertTriangle className='w-4 h-4 text-red-500' />}
          <span className='text-sm text-gray-800 dark:text-white truncate max-w-xs'>
            {item.text}
          </span>
        </div>
      ),
    },
    {
      title: '发送模式',
      key: 'send_mode',
      dataIndex: 'send_mode',
      render: (value) => (
        <span
          className={`px-2 py-1 rounded text-xs ${
            value === 'broadcast'
              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
              : 'bg-green-100 dark:bg-green-500/20 text-green-600'
          }`}
        >
          {value === 'broadcast' ? '广播' : '指定设备'}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      render: (value) => (
        <span
          className={`px-2 py-1 rounded text-xs ${
            value === 'sent'
              ? 'bg-green-100 dark:bg-green-500/20 text-green-600'
              : value === 'pending'
              ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600'
              : value === 'failed'
              ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
              : 'bg-gray-100 dark:bg-gray-500/20 text-gray-500'
          }`}
        >
          {value === 'sent'
            ? '成功'
            : value === 'pending'
            ? '待发送'
            : value === 'failed'
            ? '失败'
            : '未知'}
        </span>
      ),
    },
    {
      title: '时间',
      key: 'created_at',
      dataIndex: 'created_at',
      render: (value) => (
        <span className='text-sm text-gray-500 dark:text-slate-400'>
          {formatDateTime(value as string, '-')}
        </span>
      ),
    },
  ];
}
