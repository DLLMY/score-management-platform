import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
// 删除操作修复：404自动刷新列表 v2
import api from '../services/api';
import { useStableToast, useSubmitGuard, useWorkbenchClass, useListData } from '../hooks';
import { useConfirm } from '../components';
import type {
  StudyGuide,
  StudyGuideCreateInput,
  ImprovementPlan,
  ImprovementPlanCreateInput,
} from '../types';
import type { GuideFormData, PlanFormData } from './studyGuide/types';
import StudyGuideView from './studyGuide/StudyGuideView';

const defaultGuideForm: GuideFormData = {
  id: null,
  title: '',
  guide_type: '学法指导',
  content: '',
  target_audience: '全班',
  is_published: true,
};

const defaultPlanForm: PlanFormData = {
  id: null,
  student_id: 0,
  plan_type: '培优',
  subject_id: null,
  target_score: null,
  current_score: null,
  plan_content: '',
  start_date: '',
  end_date: '',
};

const guideTypes = ['学法指导', '学习方法', '应试技巧', '心理辅导', '其他'];
const planTypes = ['培优', '补差', '专项提升', '综合提升'];
const audiences = ['全班', '优生', '后进生', '中等生', '个人'];

function StudyGuidePage() {
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  // 弹窗表单绑定班级：页面本地，与视图筛选严格分离
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'guides' | 'plans'>('guides');

  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [guideForm, setGuideForm] = useState<GuideFormData>(defaultGuideForm);
  const [planForm, setPlanForm] = useState<PlanFormData>(defaultPlanForm);
  const [guideErrors, setGuideErrors] = useState<Record<string, string>>({});
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);

  // M9 P1 服务端分页状态
  const [guidePage, setGuidePage] = useState(1);
  const [guideTotal, setGuideTotal] = useState(0);
  const [planPage, setPlanPage] = useState(1);
  const [planTotal, setPlanTotal] = useState(0);

  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const {
    data: guides,
    loading: guidesLoading,
    refetch: fetchGuides,
  } = useListData<StudyGuide>({
    fetcher: async () => {
      const resp = await api.studyGuide.getGuides(undefined, undefined, {
        page: guidePage,
        per_page: 50,
      });
      setGuideTotal(resp.total);
      return resp.guides || [];
    },
    debounceDelay: 0,
    deps: [guidePage],
    onError: (e) => {
      logger.error('获取指导文章失败:', e);
      showToast('error', '获取指导文章失败');
    },
  });
  const {
    data: plans,
    loading: plansLoading,
    refetch: fetchPlans,
  } = useListData<ImprovementPlan>({
    fetcher: async () => {
      const resp = await api.studyGuide.getPlans(undefined, {
        page: planPage,
        per_page: 50,
      });
      setPlanTotal(resp.total);
      return resp.plans || [];
    },
    debounceDelay: 0,
    deps: [planPage],
    onError: (e) => {
      logger.error('获取改进计划失败:', e);
      showToast('error', '获取改进计划失败');
    },
  });
  // 合并 loading：原实现 Promise.all 双拉取，两个 hook 任一加载中即显示占位
  const isLoading = guidesLoading || plansLoading;

  // M9 P1：切换班级筛选时重置两个分页游标
  useEffect(() => {
    setGuidePage(1);
    setPlanPage(1);
  }, [filterClassId]);

  const filteredGuides = guides.filter((g) => {
    const matchClass = filterClassId === 0 || g.class_id === filterClassId;
    return (
      matchClass &&
      (!searchTerm ||
        g.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.content?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const filteredPlans = plans.filter((p) => {
    return (
      !searchTerm ||
      p.plan_content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenGuideCreate = useCallback(() => {
    setGuideForm(defaultGuideForm);
    setGuideErrors({});
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setSelectedClassId(filterClassId > 0 ? filterClassId : 0);
    setShowGuideModal(true);
  }, [filterClassId]);

  const handleOpenGuideEdit = useCallback((guide: StudyGuide) => {
    setSelectedClassId(guide.class_id ?? 0);
    setGuideForm({
      id: guide.id,
      title: guide.title || '',
      guide_type: guide.guide_type || '学法指导',
      content: guide.content || '',
      target_audience: guide.target_audience || '全班',
      is_published: guide.is_published,
    });
    setGuideErrors({});
    setShowGuideModal(true);
  }, []);

  const handleCloseGuideModal = useCallback(() => {
    setShowGuideModal(false);
    setGuideForm(defaultGuideForm);
    setGuideErrors({});
  }, []);

  const validateGuideForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!guideForm.title.trim()) {
      errors.title = '标题不能为空';
    }
    setGuideErrors(errors);
    return Object.keys(errors).length === 0;
  }, [guideForm]);

  const handleGuideSubmit = useCallback(async () => {
    if (!validateGuideForm()) return;
    if (!guideForm.id && !selectedClassId) {
      showToast('error', '请先选择班级');
      return;
    }

    try {
      const payload: StudyGuideCreateInput = {
        class_id: guideForm.id ? undefined : selectedClassId,
        title: guideForm.title,
        guide_type: guideForm.guide_type || undefined,
        content: guideForm.content || undefined,
        target_audience: guideForm.target_audience || undefined,
      };

      if (guideForm.id) {
        await api.studyGuide.updateGuide(guideForm.id, payload);
        showToast('success', '指导文章更新成功');
      } else {
        await api.studyGuide.createGuide(payload);
        showToast('success', '指导文章创建成功');
      }
      handleCloseGuideModal();
      fetchGuides();
    } catch (error) {
      logger.error('保存指导文章失败:', error);
      showToast('error', getErrMsg(error, guideForm.id ? '更新指导文章失败' : '创建指导文章失败'));
    }
  }, [
    guideForm,
    validateGuideForm,
    showToast,
    handleCloseGuideModal,
    fetchGuides,
    selectedClassId,
  ]);

  const handleOpenPlanCreate = useCallback(() => {
    setPlanForm(defaultPlanForm);
    setPlanErrors({});
    setShowPlanModal(true);
  }, []);

  const handleOpenPlanEdit = useCallback((plan: ImprovementPlan) => {
    setPlanForm({
      id: plan.id,
      student_id: plan.student_id,
      plan_type: plan.plan_type || '培优',
      subject_id: plan.subject_id ?? null,
      target_score: plan.target_score ?? null,
      current_score: plan.current_score ?? null,
      plan_content: plan.plan_content || '',
      start_date: plan.start_date || '',
      end_date: plan.end_date || '',
    });
    setPlanErrors({});
    setShowPlanModal(true);
  }, []);

  const handleClosePlanModal = useCallback(() => {
    setShowPlanModal(false);
    setPlanForm(defaultPlanForm);
    setPlanErrors({});
    setEditingPlanId(null);
  }, []);

  const validatePlanForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!planForm.plan_content?.trim()) {
      errors.plan_content = '计划内容不能为空';
    }
    if (!planForm.student_id || planForm.student_id <= 0) {
      errors.student_id = '请选择学生';
    }
    setPlanErrors(errors);
    return Object.keys(errors).length === 0;
  }, [planForm]);

  const handlePlanSubmit = useCallback(async () => {
    if (!validatePlanForm()) return;

    try {
      const payload: ImprovementPlanCreateInput = {
        student_id: planForm.student_id,
        plan_type: planForm.plan_type || undefined,
        subject_id: planForm.subject_id ?? undefined,
        target_score: planForm.target_score ?? undefined,
        current_score: planForm.current_score ?? undefined,
        plan_content: planForm.plan_content || undefined,
        start_date: planForm.start_date || undefined,
        end_date: planForm.end_date || undefined,
      };

      if (editingPlanId) {
        await api.studyGuide.updatePlan(editingPlanId, payload);
        showToast('success', '改进计划更新成功');
      } else {
        await api.studyGuide.createPlan(payload);
        showToast('success', '改进计划创建成功');
      }
      handleClosePlanModal();
      fetchPlans();
    } catch (error) {
      logger.error('保存改进计划失败:', error);
      showToast('error', getErrMsg(error, editingPlanId ? '更新改进计划失败' : '创建改进计划失败'));
    }
  }, [planForm, editingPlanId, validatePlanForm, showToast, handleClosePlanModal, fetchPlans]);

  const handleUpdateProgress = useCallback(
    async (planId: number, progress: number) => {
      try {
        await api.studyGuide.updatePlanProgress(planId, progress);
        showToast('success', '进度更新成功');
        fetchPlans();
      } catch (error) {
        logger.error('更新进度失败:', error);
        showToast('error', getErrMsg(error, '更新进度失败'));
      }
    },
    [showToast, fetchPlans]
  );

  const handleDeleteGuide = useCallback(
    async (guideId: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这篇指导文章吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.studyGuide.deleteGuide(guideId);
        showToast('success', '指导文章删除成功');
      } catch (error: unknown) {
        // 404 说明数据已不存在（过期缓存），刷新列表即可
        const errObj = error as { status?: number; response?: { status?: number } } | null;
        const is404 =
          errObj?.status === 404 ||
          errObj?.response?.status === 404 ||
          String((error as Error)?.message || '').includes('不存在');
        if (is404) {
          showToast('info', '该文章已被删除');
        } else {
          logger.error('删除指导文章失败:', error);
          showToast('error', getErrMsg(error, '删除指导文章失败'));
        }
      } finally {
        fetchGuides();
      }
    },
    [showToast, fetchGuides]
  );

  const handleDeletePlan = useCallback(
    async (planId: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个改进计划吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.studyGuide.deletePlan(planId);
        showToast('success', '改进计划删除成功');
      } catch (error: unknown) {
        const errObj = error as { status?: number; response?: { status?: number } } | null;
        const is404 =
          errObj?.status === 404 ||
          errObj?.response?.status === 404 ||
          String((error as Error)?.message || '').includes('不存在');
        if (is404) {
          showToast('info', '该计划已被删除');
        } else {
          logger.error('删除改进计划失败:', error);
          showToast('error', getErrMsg(error, '删除改进计划失败'));
        }
      } finally {
        fetchPlans();
      }
    },
    [showToast, fetchPlans]
  );

  const handleGuideChange = useCallback((field: keyof GuideFormData, value: string | boolean) => {
    setGuideForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handlePlanChange = useCallback(
    (field: keyof PlanFormData, value: string | number | null) => {
      setPlanForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'from-emerald-500 to-teal-500';
    if (progress >= 50) return 'from-blue-500 to-indigo-500';
    if (progress >= 20) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getProgressBg = (progress: number) => {
    if (progress >= 80)
      return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    if (progress >= 50) return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    if (progress >= 20)
      return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  };

  return (
    <StudyGuideView
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      handleOpenGuideCreate={handleOpenGuideCreate}
      handleOpenPlanCreate={handleOpenPlanCreate}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      isLoading={isLoading}
      filteredGuides={filteredGuides}
      expandedGuide={expandedGuide}
      setExpandedGuide={setExpandedGuide}
      handleOpenGuideEdit={handleOpenGuideEdit}
      handleDeleteGuide={handleDeleteGuide}
      guidePage={guidePage}
      guideTotal={guideTotal}
      setGuidePage={setGuidePage}
      filteredPlans={filteredPlans}
      editingPlanId={editingPlanId}
      setEditingPlanId={setEditingPlanId}
      handleOpenPlanEdit={handleOpenPlanEdit}
      handleDeletePlan={handleDeletePlan}
      handleUpdateProgress={handleUpdateProgress}
      planPage={planPage}
      planTotal={planTotal}
      setPlanPage={setPlanPage}
      getProgressColor={getProgressColor}
      getProgressBg={getProgressBg}
      showGuideModal={showGuideModal}
      closeGuideModal={handleCloseGuideModal}
      guideForm={guideForm}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      handleGuideChange={handleGuideChange}
      guideErrors={guideErrors}
      handleGuideSubmit={handleGuideSubmit}
      guideTypes={guideTypes}
      audiences={audiences}
      showPlanModal={showPlanModal}
      closePlanModal={handleClosePlanModal}
      planForm={planForm}
      handlePlanChange={handlePlanChange}
      planErrors={planErrors}
      handlePlanSubmit={handlePlanSubmit}
      planTypes={planTypes}
      runSubmit={runSubmit}
      submitting={submitting}
    />
  );
}

export default StudyGuidePage;
