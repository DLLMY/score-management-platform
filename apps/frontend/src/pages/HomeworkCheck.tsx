import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClientFilter, useListFetch } from '../hooks';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  CheckCircle,
  Clock,
  Search,
  X,
  FileText,
  Check,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import WorkbenchBreadcrumb from '../components/workbench/WorkbenchBreadcrumb';
import { HomeworkAssignment, HomeworkCreateInput } from '../types';
import { ClassSelect, SubjectSelect } from '../components/form/EntitySelect';
import { DataTable, StatCard } from '../components';
import { Pagination } from 'antd';
import type { ColumnType } from '../components/data-display/DataTable';
import { useConfirm } from '../components/ui/ConfirmDialog';

interface HomeworkFormData {
  id: number | null;
  class_id: number;
  subject_id?: number;
  title: string;
  description?: string;
  assigned_date: string;
  due_date: string;
}

const defaultForm: HomeworkFormData = {
  id: null,
  class_id: 0,
  subject_id: undefined,
  title: '',
  description: '',
  assigned_date: new Date().toISOString().split('T')[0],
  due_date: '',
};

function HomeworkCheck() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [hwPage, setHwPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  // C-2：支持从总览指标卡下钻带 ?status=pending|done 预置过滤
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>(() => {
    const s = searchParams.get('status');
    return s === 'pending' ? 'pending' : s === 'done' ? 'done' : 'all';
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<HomeworkFormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof HomeworkFormData, string>>>({});
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();

  // A 轨：作业列表迁 useListFetch（服务端分页 + class_id 服务端过滤；status/search 保持页内过滤）
  const homework = useListFetch<HomeworkAssignment>({
    params: { page: hwPage, pageSize: 50, classId: filterClassId },
    fetcher: async ({ page, pageSize, classId }) => {
      try {
        const resp = await api.homework.getAll(
          classId ? Number(classId) : undefined,
          undefined,
          { page, per_page: pageSize }
        );
        return { items: resp.assignments ?? [], total: resp.total ?? 0 };
      } catch (error) {
        logger.error('获取作业列表失败:', error);
        showToast('error', getErrMsg(error, '获取作业列表失败'));
        throw error;
      }
    },
  });
  // 既有新增/编辑等 handler 仍以 fetchAssignments 命名调用（语义 = 重新拉取当前页）
  const fetchAssignments = useCallback(() => {
    void homework.refetch();
  }, [homework]);

  // M9 P1: 切换班级筛选时重置作业分页到首页
  useEffect(() => {
    setHwPage(1);
  }, [filterClassId]);

  const filteredAssignments = useClientFilter(
    homework.items,
    (a) =>
      (a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))) &&
      (statusFilter === 'all' ||
        (statusFilter === 'pending' ? !a.is_completed : a.is_completed)),
    [searchTerm, statusFilter]
  );

  const handleOpenModal = useCallback(
    (isEdit = false, assignment?: HomeworkAssignment) => {
      if (isEdit && assignment) {
        setFormData({
          id: assignment.id,
          class_id: assignment.class_id,
          subject_id: assignment.subject_id,
          title: assignment.title,
          description: assignment.description || '',
          assigned_date: assignment.assigned_date,
          due_date: assignment.due_date,
        });
      } else {
        // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
        setFormData({
          ...defaultForm,
          class_id: filterClassId > 0 ? filterClassId : 0,
        });
      }
      setErrors({});
      setShowModal(true);
    },
    [filterClassId]
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultForm);
    setErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof HomeworkFormData, string>> = {};
    if (!formData.title.trim()) {
      newErrors.title = '请输入作业标题';
    }
    if (!formData.class_id || formData.class_id <= 0) {
      newErrors.class_id = '请选择班级';
    }
    if (!formData.due_date) {
      newErrors.due_date = '请选择截止日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    try {
      if (formData.id) {
        await api.homework.update(formData.id, {
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          title: formData.title,
          description: formData.description,
          assigned_date: formData.assigned_date,
          due_date: formData.due_date,
        } as HomeworkCreateInput);
        showToast('success', '作业更新成功');
      } else {
        await api.homework.create({
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          title: formData.title,
          description: formData.description,
          assigned_date: formData.assigned_date,
          due_date: formData.due_date,
        });
        showToast('success', '作业创建成功');
      }
      handleCloseModal();
      fetchAssignments();
    } catch (error) {
      logger.error('操作失败:', error);
      showToast('error', getErrMsg(error, formData.id ? '更新作业失败' : '创建作业失败'));
    }
  }, [formData, showToast, handleCloseModal, fetchAssignments, validateForm]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除这个作业吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.homework.delete(id);
        showToast('success', '作业删除成功');
        fetchAssignments();
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', getErrMsg(error, '删除作业失败'));
      }
    },
    [showToast, fetchAssignments]
  );

  const totalAssignments = homework.items.length;
  const completedAssignments = homework.items.filter((a) => a.is_completed).length;
  const pendingAssignments = totalAssignments - completedAssignments;

  const columns = useMemo<ColumnType<HomeworkAssignment>[]>(
    () => [
      {
        title: '作业标题',
        key: 'title',
        dataIndex: 'title',
        render: (_, assignment) => (
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center'>
              <FileText className='w-5 h-5 text-blue-600 dark:text-blue-400' />
            </div>
            <div>
              <p className='font-medium text-slate-800 dark:text-slate-200'>{assignment.title}</p>
              {assignment.description && (
                <p className='text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs'>
                  {assignment.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        title: '班级',
        key: 'class_name',
        dataIndex: 'class_name',
        render: (_, assignment) => (
          <span className='inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium'>
            {assignment.class_name || `班级 #${assignment.class_id}`}
          </span>
        ),
      },
      {
        title: '截止日期',
        key: 'due_date',
        dataIndex: 'due_date',
        render: (_, assignment) => (
          <div className='flex items-center gap-2 text-sm'>
            <Clock className='w-4 h-4 text-slate-400' />
            <span className='text-slate-600 dark:text-slate-300'>{assignment.due_date}</span>
          </div>
        ),
      },
      {
        title: '提交情况',
        key: 'submitted_count',
        dataIndex: 'submitted_count',
        align: 'center',
        render: (_, assignment) => (
          <span className='inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold'>
            {assignment.total_students
              ? `${assignment.submitted_count || 0}/${assignment.total_students}`
              : '--'}
          </span>
        ),
      },
      {
        title: '状态',
        key: 'is_completed',
        dataIndex: 'is_completed',
        align: 'center',
        render: (_, assignment) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              assignment.is_completed
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                assignment.is_completed ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {assignment.is_completed ? '已完成' : '进行中'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
              <BookOpen className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                作业检查
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理作业布置、提交检查与批改
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='作业检查' />
            <CurrentClassLabel />
            <button
              onClick={() => handleOpenModal(false)}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              布置作业
            </button>
          </div>
        </div>
      </div>

      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'>
          <StatCard
            label='作业总数'
            value={totalAssignments}
            icon={<FileText className='w-7 h-7 text-white' />}
            iconGradient='from-blue-500 to-indigo-500'
            decoGradient='from-blue-500/10 to-indigo-500/10'
            glowClass='shadow-blue-500/20'
            size='lg'
          />
          <StatCard
            label='已完成'
            value={completedAssignments}
            icon={<CheckCircle className='w-7 h-7 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
            glowClass='shadow-emerald-500/20'
            size='lg'
          />
          <StatCard
            label='待批改'
            value={pendingAssignments}
            icon={<Clock className='w-7 h-7 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
            glowClass='shadow-amber-500/20'
            size='lg'
          />
        </div>
      </div>

      <div className='flex-1 px-6 pb-6'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center gap-4'>
              <div className='relative flex-1 max-w-md'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
                <input
                  type='text'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder='搜索作业标题或描述...'
                  aria-label='搜索作业'
                  className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm'
                />
              </div>
              <div
                className='flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl'
                role='group'
                aria-label='按完成状态筛选'
              >
                {(
                  [
                    ['all', '全部'],
                    ['pending', '进行中'],
                    ['done', '已完成'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type='button'
                    onClick={() => setStatusFilter(key)}
                    aria-pressed={statusFilter === key}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      statusFilter === key
                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DataTable<HomeworkAssignment>
            columns={columns}
            dataSource={filteredAssignments}
            loading={homework.loading}
            rowKey='id'
            rowClassName={() => 'group cursor-pointer'}
            empty={{
              icon: 'file',
              title: '暂无作业数据',
              actionLabel: '布置第一个作业',
              onAction: () => handleOpenModal(false),
            }}
            scroll={{ x: 900 }}
            rowActions={(assignment) => (
              <div className='flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenModal(true, assignment);
                  }}
                  aria-label={`编辑作业 ${assignment.title}`}
                  className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                >
                  <Edit2 className='w-4 h-4' />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(assignment.id);
                  }}
                  aria-label={`删除作业 ${assignment.title}`}
                  className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            )}
          />
        </div>
        {homework.total > 50 && (
          <div className='mt-5 flex justify-center'>
            <Pagination
              current={hwPage}
              total={homework.total}
              pageSize={50}
              onChange={(p) => setHwPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <BookOpen className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑作业' : '布置作业'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  作业标题 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder='输入作业标题'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.title
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />
                {errors.title && <p className='mt-1 text-xs text-red-500'>{errors.title}</p>}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder='输入作业描述（可选）'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    班级 <span className='text-red-500'>*</span>
                  </label>
                  <ClassSelect
                    value={formData.class_id}
                    onChange={(id) => setFormData((prev) => ({ ...prev, class_id: id }))}
                    disabled={!!formData.id}
                    emptyPlaceholder='暂无班级'
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 disabled:opacity-60 ${
                      errors.class_id
                        ? 'border-red-500'
                        : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                    }`}
                  />
                  {errors.class_id && (
                    <p className='mt-1 text-xs text-red-500'>{errors.class_id}</p>
                  )}
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    科目
                  </label>
                  <SubjectSelect
                    value={formData.subject_id ?? null}
                    onChange={(id) =>
                      setFormData((prev) => ({ ...prev, subject_id: id || undefined }))
                    }
                    allowEmpty
                    emptyLabel='不指定科目'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    布置日期
                  </label>
                  <input
                    type='date'
                    value={formData.assigned_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, assigned_date: e.target.value }))
                    }
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    截止日期 <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='date'
                    value={formData.due_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                      errors.due_date
                        ? 'border-red-500'
                        : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                    }`}
                  />
                  {errors.due_date && (
                    <p className='mt-1 text-xs text-red-500'>{errors.due_date}</p>
                  )}
                </div>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleSubmit)}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeworkCheck;
