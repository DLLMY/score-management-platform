import type { ReactElement } from 'react';
import { Calendar, Edit2, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';

import { Button, PermissionButton, type ColumnType } from '../../components';
import { formatDateTime } from '../../utils/format';
import type { Exam } from './types';

/**
 * ExamManagement 表格列定义（E6a 抽取：渲染配置，依赖 2 个徽章函数 + 4 个操作 handler）。
 * 原为 ExamManagement 内的 useMemo，行为完全一致；调用方仍用 useMemo 包裹
 * 以保持引用稳定（依赖数组与原实现相同）。
 */
export interface ExamColumnsDeps {
  getStatusBadge: (status?: string) => ReactElement;
  getImportanceBadge: (importance?: string) => ReactElement;
  handleEditExam: (exam: Exam) => void;
  handlePublishExam: (exam: Exam) => void | Promise<void>;
  handleDeleteExam: (exam: Exam) => void | Promise<void>;
  handleCloseExam: (exam: Exam) => void | Promise<void>;
}

export function buildExamColumns(deps: ExamColumnsDeps): ColumnType<Exam>[] {
  const {
    getStatusBadge,
    getImportanceBadge,
    handleEditExam,
    handlePublishExam,
    handleDeleteExam,
    handleCloseExam,
  } = deps;
  return [
    {
      title: '考试信息',
      key: 'name',
      dataIndex: 'name',
      render: (_v, exam) => (
        <div className='flex items-center'>
          <div className='flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center'>
            <Calendar className='w-5 h-5 text-white' />
          </div>
          <div className='ml-4'>
            <div className='text-sm font-medium text-gray-900'>{exam.name}</div>
            <div className='text-sm text-gray-500'>{exam.class_name || '全部班级'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '科目',
      key: 'subjects',
      dataIndex: 'subjects',
      render: (_v, exam) => (
        <div className='text-sm text-gray-900'>
          {Array.isArray(exam.subjects) ? exam.subjects.join(', ') : exam.subjects || '-'}
        </div>
      ),
    },
    {
      title: '时间',
      key: 'time',
      render: (_v, exam) => (
        <div className='text-sm text-gray-900'>
          <div className='flex items-center gap-1'>
            <Clock className='w-4 h-4 text-gray-400' />
            {formatDateTime(exam.start_time, '-')}
          </div>
          {exam.end_time && (
            <div className='text-gray-500 text-xs mt-1'>至 {formatDateTime(exam.end_time)}</div>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      render: (_v, exam) => (
        <div className='flex items-center gap-2'>
          {getStatusBadge(exam.status)}
          {getImportanceBadge(exam.importance)}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      align: 'right',
      render: (_v, exam) => (
        <div className='text-sm font-medium space-x-2'>
          {exam.status === 'draft' && (
            <>
              <Button variant='secondary' size='sm' onClick={() => handleEditExam(exam)}>
                <Edit2 className='w-4 h-4' />
              </Button>
              <PermissionButton
                permission='exam.manage'
                size='sm'
                onClick={() => handlePublishExam(exam)}
              >
                <CheckCircle className='w-4 h-4' />
              </PermissionButton>
              <PermissionButton
                permission='exam.manage'
                variant='danger'
                size='sm'
                onClick={() => handleDeleteExam(exam)}
              >
                <Trash2 className='w-4 h-4' />
              </PermissionButton>
            </>
          )}
          {exam.status === 'published' && (
            <PermissionButton
              permission='exam.manage'
              variant='secondary'
              size='sm'
              onClick={() => handleCloseExam(exam)}
            >
              <XCircle className='w-4 h-4' />
            </PermissionButton>
          )}
          {exam.status === 'closed' && (
            <Button variant='secondary' size='sm' onClick={() => handleEditExam(exam)}>
              <Edit2 className='w-4 h-4' />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
