// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import { Clock } from 'lucide-react';
import { DataTable, type ColumnType } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import type { OperationLog } from '../types';
import { SectionTitle } from './primitives';

/** 最近操作日志表格 */
export const OperationLogsSection: React.FC<{ logs: OperationLog[] }> = ({ logs }) => {
  const columns = React.useMemo<ColumnType<OperationLog>[]>(
    () => [
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (value) => (
          <span className='text-gray-500 dark:text-slate-400 whitespace-nowrap'>
            {formatDateTime(value as string)}
          </span>
        ),
      },
      {
        title: '操作人',
        key: 'operator',
        dataIndex: 'operator',
        render: (value) => (
          <span className='text-gray-700 dark:text-slate-200'>
            {value ? (value as string) : '-'}
          </span>
        ),
      },
      {
        title: '类型',
        key: 'operation_type',
        dataIndex: 'operation_type',
        render: (value) => (
          <span className='px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
            {value ? (value as string) : '-'}
          </span>
        ),
      },
      {
        title: '描述',
        key: 'description',
        dataIndex: 'description',
        render: (value) => (
          <span
            className='text-gray-700 dark:text-slate-200 max-w-xs truncate block'
            title={value ? (value as string) : ''}
          >
            {value ? (value as string) : '-'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <section>
      <SectionTitle icon={<Clock size={18} />} title='最近操作日志' />
      <DataTable<OperationLog>
        columns={columns}
        dataSource={logs}
        rowKey={(log, index) => log.id ?? index}
        empty={{
          icon: 'data',
          title: '暂无操作日志',
        }}
      />
    </section>
  );
};
