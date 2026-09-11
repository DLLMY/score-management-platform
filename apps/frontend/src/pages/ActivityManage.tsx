import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  useStableToast,
  useSubmitGuard,
  useWorkbenchClass,
  useClientFilter,
  useListFetch,
} from '../hooks';
import { Activity, ActivityCreateInput } from '../types';
import { useConfirm } from '../components';
import ActivityManageView, {
  type ActivityFormData,
  defaultActivityForm,
} from './activityManage/ActivityManageView';

function ActivityManage() {
  const [activityPage, setActivityPage] = useState(1);
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  // 弹窗表单绑定班级：页面本地，与视图筛选严格分离
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  // C-2：支持从总览「文体活动·已发布」下钻 ?published=1|0 预置
  const [searchParams] = useSearchParams();
  const [publishedFilter, setPublishedFilter] = useState<boolean | undefined>(() => {
    const v = searchParams.get('published');
    return v === '1' ? true : v === '0' ? false : undefined;
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<ActivityFormData>(defaultActivityForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // A 轨：活动列表迁 useListFetch（服务端分页 + published 过滤），失败 toast 保留
  const activities = useListFetch<Activity>({
    params: { page: activityPage, pageSize: 50, isPublished: publishedFilter },
    fetcher: async ({ page, pageSize, isPublished }) => {
      try {
        const resp = await api.activity.getAll(
          undefined,
          isPublished === undefined ? undefined : Boolean(isPublished),
          {
            page,
            per_page: pageSize,
          }
        );
        return { items: resp.activities ?? [], total: resp.total ?? 0 };
      } catch (error) {
        logger.error('获取活动列表失败:', error);
        showToast('error', getErrMsg(error, '获取活动列表失败'));
        throw error;
      }
    },
  });
  // 既有增删/注册等 handler 仍以 fetchActivities 命名调用（语义 = 重新拉取当前页）
  const fetchActivities = useCallback(() => {
    void activities.refetch();
  }, [activities]);

  // C-2: 切换发布状态过滤时回到第一页
  useEffect(() => {
    setActivityPage(1);
  }, [publishedFilter]);

  const handleOpenCreate = useCallback(() => {
    setFormData(defaultActivityForm);
    setFormErrors({});
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setSelectedClassId(filterClassId > 0 ? filterClassId : 0);
    setShowModal(true);
  }, [filterClassId]);

  const handleOpenEdit = useCallback((activity: Activity) => {
    setSelectedClassId(activity.class_id ?? 0);
    setFormData({
      id: activity.id,
      title: activity.title || '',
      description: activity.description || '',
      activity_type: activity.activity_type || '文体活动',
      start_date: activity.start_date || '',
      end_date: activity.end_date || '',
      location: activity.location || '',
      organizer: activity.organizer || '',
      is_published: activity.is_published,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultActivityForm);
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = '活动标题不能为空';
    }
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      errors.end_date = '结束日期不能早于开始日期';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (!formData.id && !selectedClassId) {
      showToast('error', '请先选择班级');
      return;
    }
    if (submitting) return; // M2: 防重复提交
    setSubmitting(true);

    try {
      const payload: ActivityCreateInput = {
        class_id: formData.id ? undefined : selectedClassId,
        title: formData.title,
        description: formData.description || undefined,
        activity_type: formData.activity_type || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        location: formData.location || undefined,
        organizer: formData.organizer || undefined,
      };

      if (formData.id) {
        await api.activity.update(formData.id, payload);
        showToast('success', '活动更新成功');
      } else {
        await api.activity.create(payload);
        showToast('success', '活动创建成功');
      }
      handleCloseModal();
      fetchActivities();
    } catch (error) {
      logger.error('保存活动失败:', error);
      showToast('error', getErrMsg(error, formData.id ? '更新活动失败' : '创建活动失败'));
    } finally {
      setSubmitting(false);
    }
  }, [
    formData,
    validateForm,
    showToast,
    handleCloseModal,
    fetchActivities,
    selectedClassId,
    submitting,
  ]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个活动吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.activity.delete(id);
        showToast('success', '活动删除成功');
        fetchActivities();
      } catch (error) {
        logger.error('删除活动失败:', error);
        showToast('error', getErrMsg(error, '删除活动失败'));
      }
    },
    [showToast, fetchActivities]
  );

  const handleRegister = useCallback(
    async (activityId: number) => {
      try {
        const studentId = Number(localStorage.getItem('studentId') || 0);
        if (!studentId) {
          showToast('warning', '未找到学生信息');
          return;
        }
        await api.activity.registerStudent(activityId, studentId);
        showToast('success', '报名成功');
        fetchActivities();
      } catch (error) {
        logger.error('报名失败:', error);
        showToast('error', getErrMsg(error, '报名失败'));
      }
    },
    [showToast, fetchActivities]
  );

  const handleCancelRegistration = useCallback(
    async (activityId: number) => {
      const ok = await confirmRef.current({
        message: '确定要取消报名吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'warning',
      });
      if (!ok) return;
      try {
        const studentId = Number(localStorage.getItem('studentId') || 0);
        if (!studentId) {
          showToast('warning', '未找到学生信息');
          return;
        }
        await api.activity.cancelRegistration(activityId, studentId);
        showToast('success', '取消报名成功');
        fetchActivities();
      } catch (error) {
        logger.error('取消报名失败:', error);
        showToast('error', getErrMsg(error, '取消报名失败'));
      }
    },
    [showToast, fetchActivities]
  );

  const handleChange = useCallback((field: keyof ActivityFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const filteredActivities = useClientFilter(
    activities.items,
    (a) => {
      const matchSearch =
        !searchTerm ||
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !filterType || a.activity_type === filterType;
      const matchClass = filterClassId === 0 || a.class_id === filterClassId;
      return matchSearch && matchType && matchClass;
    },
    [searchTerm, filterType, filterClassId]
  );

  const handleSubmitModal = () => {
    runSubmit(handleSubmit);
  };

  return (
    <ActivityManageView
      activityPage={activityPage}
      setActivityPage={setActivityPage}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      submitting={submitting}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterType={filterType}
      setFilterType={setFilterType}
      publishedFilter={publishedFilter}
      setPublishedFilter={setPublishedFilter}
      showModal={showModal}
      formData={formData}
      formErrors={formErrors}
      activities={activities}
      filteredActivities={filteredActivities}
      onOpenCreate={handleOpenCreate}
      onOpenEdit={handleOpenEdit}
      onCloseModal={handleCloseModal}
      onSubmit={handleSubmitModal}
      onDelete={handleDelete}
      onRegister={handleRegister}
      onCancelRegistration={handleCancelRegistration}
      onChange={handleChange}
    />
  );
}

export default ActivityManage;
