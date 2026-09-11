import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
/**
 * 班主任评语页面（逻辑层）。
 *
 * 主渲染 JSX 已拆到 ./teacherComments/TeacherCommentsView，本文件只保留
 * 数据加载、过滤、表单校验与提交逻辑。
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MessageSquareQuote, Star } from 'lucide-react';
import api from '../services/api';
import type { TeacherComment, TeacherCommentCreateInput } from '../types';
import {
  useStableToast,
  useSubmitGuard,
  useWorkbenchClass,
  useListData,
  useClientFilter,
} from '../hooks';
import { useConfirm, type ColumnType } from '../components';
import TeacherCommentsView from './teacherComments/TeacherCommentsView';
import { COMMENT_TYPES, defaultForm, type CommentFormData } from './teacherComments/types';

function TeacherComments() {
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  // 视图筛选班级：工作台级共享（0 = 全部班级）；评语属隐私数据，后端按班级隔离
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  // M9 P1: 评语列表服务端分页状态
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const {
    data: comments,
    loading: isLoading,
    refetch: fetchComments,
  } = useListData<TeacherComment>({
    fetcher: async () => {
      // M9 P1: 服务端分页信封（comments 资源 key）
      const resp = await api.teacherComment.getAll(
        filterClassId || undefined,
        undefined,
        undefined,
        {
          page: commentPage,
          per_page: 50,
        }
      );
      setCommentTotal(resp.total);
      return resp.comments || [];
    },
    deps: [filterClassId, commentPage],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取评语列表失败:', e);
      showToast('error', '获取评语列表失败');
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CommentFormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CommentFormData, string>>>({});

  // M9 P1: 切换班级筛选时重置评语分页到首页
  useEffect(() => {
    setCommentPage(1);
  }, [filterClassId]);

  const filteredComments = useClientFilter(
    comments,
    (c) =>
      (c.student_name && c.student_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.content && c.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.term && c.term.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm]
  );

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setFormData(defaultForm);
    setErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((item: TeacherComment) => {
    setEditingId(item.id);
    setFormData({
      student_id: item.student_id,
      term: item.term || '',
      comment_type: item.comment_type || 'term',
      rating: item.rating || 0,
      content: item.content,
    });
    setErrors({});
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultForm);
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    const newErrors: Partial<Record<keyof CommentFormData, string>> = {};
    if (!formData.student_id) newErrors.student_id = '请选择学生';
    if (!formData.content.trim()) newErrors.content = '评语内容不能为空';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload: TeacherCommentCreateInput = {
        student_id: formData.student_id,
        term: formData.term || undefined,
        comment_type: formData.comment_type,
        rating: formData.rating || undefined,
        content: formData.content.trim(),
      };
      if (editingId) {
        await api.teacherComment.update(editingId, payload);
        showToast('success', '评语更新成功');
      } else {
        await api.teacherComment.create(payload);
        showToast('success', '评语添加成功');
      }
      handleCloseModal();
      fetchComments();
    } catch (error) {
      logger.error('保存评语失败:', error);
      showToast('error', getErrMsg(error, editingId ? '更新评语失败' : '添加评语失败'));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, showToast, handleCloseModal, fetchComments]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除这条评语吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.teacherComment.delete(id);
        showToast('success', '评语删除成功');
        fetchComments();
      } catch (error) {
        logger.error('删除评语失败:', error);
        showToast('error', getErrMsg(error, '删除评语失败'));
      }
    },
    [showToast, fetchComments]
  );

  const getTypeLabel = useCallback(
    (value?: string) => COMMENT_TYPES.find((t) => t.value === value)?.label || value || '学期评语',
    []
  );

  const columns = useMemo<ColumnType<TeacherComment>[]>(
    () => [
      {
        title: '学生',
        key: 'student_name',
        dataIndex: 'student_name',
        render: (_, item) => (
          <div className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center'>
              <MessageSquareQuote className='w-4 h-4 text-white' />
            </div>
            <span className='text-sm font-medium text-slate-700 dark:text-slate-300'>
              {item.student_name || `学生${item.student_id}`}
            </span>
          </div>
        ),
      },
      {
        title: '类型',
        key: 'comment_type',
        dataIndex: 'comment_type',
        render: (_, item) => (
          <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'>
            {getTypeLabel(item.comment_type)}
          </span>
        ),
      },
      {
        title: '周期',
        key: 'term',
        dataIndex: 'term',
        render: (_, item) => (
          <span className='text-sm text-slate-500 dark:text-slate-400'>{item.term || '-'}</span>
        ),
      },
      {
        title: '评分',
        key: 'rating',
        dataIndex: 'rating',
        align: 'center',
        render: (_, item) =>
          item.rating ? (
            <div className='flex items-center justify-center gap-0.5'>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-3.5 h-3.5 ${
                    n <= (item.rating || 0)
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              ))}
            </div>
          ) : (
            <span className='text-slate-400'>-</span>
          ),
      },
      {
        title: '评语内容',
        key: 'content',
        dataIndex: 'content',
        render: (_, item) => (
          <span className='text-sm text-slate-600 dark:text-slate-300 max-w-md truncate block'>
            {item.content}
          </span>
        ),
      },
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (_, item) => (
          <span className='text-xs text-slate-400 dark:text-slate-500'>
            {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '-'}
          </span>
        ),
      },
    ],
    [getTypeLabel]
  );
  return (
    <TeacherCommentsView
      columns={columns}
      commentPage={commentPage}
      setCommentPage={setCommentPage}
      commentTotal={commentTotal}
      comments={comments}
      filteredComments={filteredComments}
      isLoading={isLoading}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      showModal={showModal}
      editingId={editingId}
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      isSubmitting={isSubmitting}
      openCreateModal={openCreateModal}
      openEditModal={openEditModal}
      handleCloseModal={handleCloseModal}
      handleSubmit={handleSubmit}
      runSubmit={runSubmit}
      handleDelete={handleDelete}
    />
  );
}

export default TeacherComments;
