// T12-6 拆分（2026-09-12）：自 CommitteeListView.tsx 原样搬出，行为逐字节等价。
import { Edit2, Trash2 } from 'lucide-react';
import { DataTable } from '../../../components';
import { columns } from '../constants';
import type { ClassCommittee } from '../../../types';
import type { CommitteeListViewProps } from '../types';

export function CommitteeTable({
  committee,
  isLoading,
  openCreateModal,
  openEditModal,
  handleDelete,
}: CommitteeListViewProps) {
  return (
    <>
      <div className='flex-1 px-6 pb-6 overflow-auto'>
        <DataTable<ClassCommittee>
          columns={columns}
          dataSource={committee}
          loading={isLoading && committee.length === 0}
          rowKey='id'
          rowClassName={() => 'group'}
          empty={{
            icon: 'folder',
            title: '暂无班委数据',
            actionLabel: '添加第一位班委',
            onAction: openCreateModal,
          }}
          scroll={{ x: 900 }}
          rowActions={(item) => (
            <div className='flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
              <button
                onClick={() => openEditModal(item)}
                aria-label='编辑班委'
                className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
              >
                <Edit2 className='w-4 h-4' />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                aria-label='删除班委'
                className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>
          )}
        />
      </div>
    </>
  );
}
