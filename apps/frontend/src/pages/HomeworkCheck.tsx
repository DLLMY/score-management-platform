import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useClientFilter,
  useListFetch,
  useStableToast,
  useSubmitGuard,
  useWorkbenchClass,
} from '../hooks';
import { HomeworkAssignment, HomeworkCreateInput } from '../types';
import api from '../services/api';
import { useConfirm } from '../components';
import HomeworkCheckView, {
  HomeworkFormData,
  HomeworkFormErrors,
  defaultForm,
} from './homeworkCheck/HomeworkCheckView';

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
  const [errors, setErrors] = useState<HomeworkFormErrors>({});
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();

  // A 轨：作业列表迁 useListFetch（服务端分页 + class_id 服务端过滤；status/search 保持页内过滤）
  const homework = useListFetch<HomeworkAssignment>({
    params: { page: hwPage, pageSize: 50, classId: filterClassId },
    fetcher: async ({ page, pageSize, classId }) => {
      try {
        const resp = await api.homework.getAll(classId ? Number(classId) : undefined, undefined, {
          page,
          per_page: pageSize,
        });
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
      (statusFilter === 'all' || (statusFilter === 'pending' ? !a.is_completed : a.is_completed)),
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
    const newErrors: HomeworkFormErrors = {};
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

  return (
    <HomeworkCheckView
      assignments={filteredAssignments}
      loading={homework.loading}
      total={homework.total}
      hwPage={hwPage}
      setHwPage={setHwPage}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      totalAssignments={totalAssignments}
      completedAssignments={completedAssignments}
      pendingAssignments={pendingAssignments}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      submitting={submitting}
      runSubmit={runSubmit}
      handleSubmit={handleSubmit}
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      handleOpenModal={handleOpenModal}
      handleDelete={handleDelete}
    />
  );
}

export default HomeworkCheck;
