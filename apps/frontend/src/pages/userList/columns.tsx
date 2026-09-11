import { Zap, Edit2, Trash2 } from 'lucide-react';

import type { User } from '../../types';
import { StatusTag, AnimatedScore, PermissionButton, type ColumnType } from '../../components';

/**
 * UserList 表格列定义（E6a 抽取：渲染配置，依赖 4 个操作 handler）。
 * 原为 UserList 内的 useMemo，行为完全一致；调用方仍用 useMemo 包裹
 * 以保持引用稳定（依赖数组与原实现相同）。
 */
export interface UserColumnsDeps {
  handleOpenQuickScore: (user: User) => void;
  handleOpenModal: (user?: User) => void;
  handleDelete: (userId: number) => void | Promise<void>;
  handleToggleActive: (user: User) => void | Promise<void>;
}

export function buildUserColumns(deps: UserColumnsDeps): ColumnType<User>[] {
  const { handleOpenQuickScore, handleOpenModal, handleDelete, handleToggleActive } = deps;
  return [
    {
      title: '学生信息',
      key: 'name',
      dataIndex: 'name',
      width: 240,
      render: (_v, record) => (
        <div className='flex items-center'>
          <div className='flex-shrink-0 h-10 w-10'>
            <div className='h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium'>
              {record.name.charAt(0)}
            </div>
          </div>
          <div className='ml-4'>
            <div className='text-sm font-medium text-gray-900'>{record.name}</div>
            <div className='text-sm text-gray-500'>{record.card_id}</div>
          </div>
        </div>
      ),
    },
    {
      title: '班级',
      key: 'class_name',
      dataIndex: 'class_name',
      width: 140,
      render: (_v, record) => (
        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
          {record.class_name}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'is_active',
      width: 120,
      render: (_v, record) =>
        record.is_blacklisted ? (
          <StatusTag tone='danger' label='黑名单' />
        ) : record.is_active ? (
          <StatusTag tone='success' label='启用' />
        ) : (
          <StatusTag tone='neutral' label='禁用' />
        ),
    },
    {
      title: '当前积分',
      key: 'current_score',
      dataIndex: 'current_score',
      width: 120,
      sorter: (a, b) => (a.current_score ?? 0) - (b.current_score ?? 0),
      render: (_v, record) => (
        <AnimatedScore value={record.current_score != null ? record.current_score : undefined} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      dataIndex: 'actions',
      width: 300,
      render: (_v, record) => (
        <div className='flex items-center gap-2'>
          <PermissionButton
            permission='score.entry'
            size='sm'
            variant='secondary'
            onClick={() => handleOpenQuickScore(record)}
          >
            <Zap className='w-3 h-3 mr-1' />
            评分
          </PermissionButton>
          <PermissionButton
            permission='student.edit'
            size='sm'
            variant='secondary'
            onClick={() => handleOpenModal(record)}
          >
            <Edit2 className='w-3 h-3 mr-1' />
            编辑
          </PermissionButton>
          <PermissionButton
            permission='user.manage'
            size='sm'
            variant={record.is_active ? 'danger' : 'success'}
            onClick={() => handleToggleActive(record)}
          >
            {record.is_active ? '禁用' : '启用'}
          </PermissionButton>
          <PermissionButton
            permission='student.delete'
            size='sm'
            variant='danger'
            onClick={() => handleDelete(Number(record.id))}
          >
            <Trash2 className='w-3 h-3 mr-1' />
            删除
          </PermissionButton>
        </div>
      ),
    },
  ];
}
