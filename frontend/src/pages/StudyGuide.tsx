import logger from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
// 删除操作修复：404自动刷新列表 v2
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Target,
  TrendingUp,
  X,
  Check,
  ChevronRight,
  Search,
  Loader2,
  User,
  Calendar,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { ClassSelect, StudentSelect, SubjectSelect } from '../components/form/EntitySelect';
import { ToggleSwitch } from '../components/form/ToggleSwitch';
import {
  StudyGuide,
  StudyGuideCreateInput,
  ImprovementPlan,
  ImprovementPlanCreateInput,
} from '../types';

interface GuideFormData {
  id: number | null;
  title: string;
  guide_type: string;
  content: string;
  target_audience: string;
  is_published: boolean;
}

interface PlanFormData {
  id: number | null;
  student_id: number;
  plan_type: string;
  subject_id: number | null;
  target_score: number | null;
  current_score: number | null;
  plan_content: string;
  start_date: string;
  end_date: string;
}

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
  const [guides, setGuides] = useState<StudyGuide[]>([]);
  const [plans, setPlans] = useState<ImprovementPlan[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  const { showToast } = useStableToast();

  const fetchGuides = useCallback(async () => {
    try {
      const data = await api.studyGuide.getGuides();
      setGuides(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('获取指导文章失败:', error);
      showToast('error', '获取指导文章失败');
    }
  }, [showToast]);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.studyGuide.getPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('获取改进计划失败:', error);
      showToast('error', '获取改进计划失败');
    }
  }, [showToast]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchGuides(), fetchPlans()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchGuides, fetchPlans]);

  const filteredGuides = guides.filter((g) => {
    return (
      !searchTerm ||
      g.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.content?.toLowerCase().includes(searchTerm.toLowerCase())
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
    setShowGuideModal(true);
  }, []);

  const handleOpenGuideEdit = useCallback((guide: StudyGuide) => {
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
      showToast('error', guideForm.id ? '更新指导文章失败' : '创建指导文章失败');
    }
  }, [guideForm, validateGuideForm, showToast, handleCloseGuideModal, fetchGuides, selectedClassId]);

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
      showToast('error', editingPlanId ? '更新改进计划失败' : '创建改进计划失败');
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
        showToast('error', '更新进度失败');
      }
    },
    [showToast, fetchPlans]
  );

  const handleDeleteGuide = useCallback(
    async (guideId: number) => {
      if (!window.confirm('确定要删除这篇指导文章吗？')) return;
      try {
        await api.studyGuide.deleteGuide(guideId);
        showToast('success', '指导文章删除成功');
      } catch (error: any) {
        // 404 说明数据已不存在（过期缓存），刷新列表即可
        const is404 = error?.status === 404 || error?.response?.status === 404 || String(error?.message || '').includes('不存在');
        if (is404) {
          showToast('info', '该文章已被删除');
        } else {
          logger.error('删除指导文章失败:', error);
          showToast('error', '删除指导文章失败');
        }
      } finally {
        fetchGuides();
      }
    },
    [showToast, fetchGuides]
  );

  const handleDeletePlan = useCallback(
    async (planId: number) => {
      if (!window.confirm('确定要删除这个改进计划吗？')) return;
      try {
        await api.studyGuide.deletePlan(planId);
        showToast('success', '改进计划删除成功');
      } catch (error: any) {
        const is404 = error?.status === 404 || error?.response?.status === 404 || String(error?.message || '').includes('不存在');
        if (is404) {
          showToast('info', '该计划已被删除');
        } else {
          logger.error('删除改进计划失败:', error);
          showToast('error', '删除改进计划失败');
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

  const handlePlanChange = useCallback((field: keyof PlanFormData, value: string | number | null) => {
    setPlanForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'from-emerald-500 to-teal-500';
    if (progress >= 50) return 'from-blue-500 to-indigo-500';
    if (progress >= 20) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getProgressBg = (progress: number) => {
    if (progress >= 80) return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    if (progress >= 50) return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    if (progress >= 20) return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  };

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <BookOpen className='w-6 h-6 text-white' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                学法指导
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理学法指导文章与学生改进计划
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {activeTab === 'guides' ? (
              <button
                onClick={handleOpenGuideCreate}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Plus className='w-5 h-5' />
                新建指导文章
              </button>
            ) : (
              <button
                onClick={handleOpenPlanCreate}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Plus className='w-5 h-5' />
                新建改进计划
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='px-6 py-4 flex items-center gap-4'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'guides' ? '搜索文章标题或内容...' : '搜索学生或计划内容...'}
            className='w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all'
          />
        </div>
        <div className='flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-1'>
          <button
            onClick={() => setActiveTab('guides')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'guides'
                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
            }`}
          >
            指导文章
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'plans'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
            }`}
          >
            改进计划
          </button>
        </div>
      </div>

      <div className='flex-1 px-6 pb-6 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='w-8 h-8 text-indigo-500 animate-spin' />
            <span className='ml-3 text-slate-500 dark:text-slate-400'>加载中...</span>
          </div>
        ) : activeTab === 'guides' ? (
          filteredGuides.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-slate-400'>
              <BookOpen className='w-16 h-16 mb-4 opacity-50' />
              <p className='text-lg'>暂无指导文章</p>
              <button
                onClick={handleOpenGuideCreate}
                className='mt-4 text-indigo-500 hover:text-indigo-600 font-medium'
              >
                创建第一篇文章
              </button>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {filteredGuides.map((guide, index) => (
                <div
                  key={guide.id}
                  className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 hover:shadow-md transition-all duration-300 group cursor-pointer'
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
                >
                  <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500' />

                  <div className='relative'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20'>
                          <BookOpen className='w-5 h-5 text-white' />
                        </div>
                        <div>
                          <h3 className='font-semibold text-slate-800 dark:text-slate-100 line-clamp-1'>
                            {guide.title}
                          </h3>
                          <div className='flex items-center gap-2 mt-1'>
                            <span className='text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'>
                              {guide.guide_type || '未分类'}
                            </span>
                            <span className='text-xs text-slate-400'>{guide.target_audience || '全体'}</span>
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity' onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenGuideEdit(guide)}
                          className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
                          title='编辑'
                        >
                          <Edit2 className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteGuide(guide.id)}
                          className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                          title='删除'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </div>

                    {guide.content && (
                      <p className='text-sm text-slate-500 dark:text-slate-400 line-clamp-2'>
                        {guide.content}
                      </p>
                    )}

                    {expandedGuide === guide.id && guide.content && (
                      <div className='mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto'>
                        {guide.content}
                      </div>
                    )}

                    <div className='mt-3 flex items-center justify-between text-xs text-slate-400'>
                      <span>{guide.is_published ? '已发布' : '草稿'}</span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${expandedGuide === guide.id ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredPlans.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-slate-400'>
            <Target className='w-16 h-16 mb-4 opacity-50' />
            <p className='text-lg'>暂无改进计划</p>
            <button
              onClick={handleOpenPlanCreate}
              className='mt-4 text-cyan-500 hover:text-cyan-600 font-medium'
            >
              创建第一个计划
            </button>
          </div>
        ) : (
          <div className='space-y-4'>
            {filteredPlans.map((plan, index) => (
              <div
                key={plan.id}
                className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 hover:shadow-md transition-all duration-300 group'
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className='flex items-start justify-between mb-4'>
                  <div className='flex items-center gap-3'>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getProgressColor(plan.progress)} flex items-center justify-center shadow-lg`}>
                      <TrendingUp className='w-5 h-5 text-white' />
                    </div>
                    <div>
                      <div className='flex items-center gap-2'>
                        <h3 className='font-semibold text-slate-800 dark:text-slate-100'>
                          {plan.student_name || `学生 #${plan.student_id}`}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getProgressBg(plan.progress)}`}>
                          {plan.plan_type || '未分类'}
                        </span>
                      </div>
                      <p className='text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5'>
                        {plan.plan_content}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={() => {
                        setEditingPlanId(plan.id);
                        handleOpenPlanEdit(plan);
                      }}
                      className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
                      title='编辑'
                    >
                      <Edit2 className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                      title='删除'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>

                <div className='flex items-center gap-4 mb-3'>
                  <div className='flex-1'>
                    <div className='flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1'>
                      <span>完成进度</span>
                      <span className='font-medium'>{plan.progress}%</span>
                    </div>
                    <div className='h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden'>
                      <div
                        className={`h-full bg-gradient-to-r ${getProgressColor(plan.progress)} rounded-full transition-all duration-500`}
                        style={{ width: `${plan.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className='flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400'>
                    {plan.current_score !== undefined && plan.current_score !== null && (
                      <span>
                        当前: <span className='font-medium text-slate-700 dark:text-slate-200'>{plan.current_score}</span>
                      </span>
                    )}
                    {plan.target_score !== undefined && plan.target_score !== null && (
                      <span>
                        目标: <span className='font-medium text-slate-700 dark:text-slate-200'>{plan.target_score}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                  {[0, 25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleUpdateProgress(plan.id, p)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        plan.progress === p
                          ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                  {plan.start_date && (
                    <div className='flex items-center gap-1 text-xs text-slate-400 ml-auto'>
                      <Calendar className='w-3 h-3' />
                      <span>{plan.start_date}</span>
                      {plan.end_date && <span> ~ {plan.end_date}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showGuideModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={handleCloseGuideModal}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center'>
                    <BookOpen className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {guideForm.id ? '编辑指导文章' : '创建指导文章'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseGuideModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  班级 <span className='text-red-500'>*</span>
                </label>
                <ClassSelect
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  disabled={!!guideForm.id}
                  emptyPlaceholder='暂无班级'
                />
                {guideForm.id && (
                  <p className='mt-1 text-xs text-slate-400'>编辑时班级不可更改</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  标题 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={guideForm.title}
                  onChange={(e) => handleGuideChange('title', e.target.value)}
                  placeholder='输入文章标题'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100 ${
                    guideErrors.title ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500'
                  }`}
                />
                {guideErrors.title && <p className='mt-1 text-xs text-red-500'>{guideErrors.title}</p>}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>文章类型</label>
                  <select
                    value={guideForm.guide_type}
                    onChange={(e) => handleGuideChange('guide_type', e.target.value)}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {guideTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>适用对象</label>
                  <select
                    value={guideForm.target_audience}
                    onChange={(e) => handleGuideChange('target_audience', e.target.value)}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {audiences.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>文章内容</label>
                <textarea
                  value={guideForm.content}
                  onChange={(e) => handleGuideChange('content', e.target.value)}
                  placeholder='输入文章内容'
                  rows={5}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none text-slate-800 dark:text-slate-100'
                />
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>发布文章</label>
                <ToggleSwitch
                  checked={guideForm.is_published}
                  onChange={(v) => handleGuideChange('is_published', v)}
                  activeClass='bg-gradient-to-r from-indigo-500 to-blue-500'
                />
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseGuideModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={handleGuideSubmit}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 font-medium'
              >
                <Check className='w-5 h-5' />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={handleClosePlanModal}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center'>
                    <Target className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {editingPlanId ? '编辑改进计划' : '创建改进计划'}
                  </h3>
                </div>
                <button
                  onClick={handleClosePlanModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  学生 <span className='text-red-500'>*</span>
                </label>
                <div className='relative'>
                  <User className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                  <StudentSelect
                    value={planForm.student_id}
                    onChange={(id) => handlePlanChange('student_id', id)}
                    allowEmpty
                    emptyLabel='请选择学生'
                    className={`w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100 ${
                      planErrors.student_id ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-cyan-500'
                    }`}
                  />
                </div>
                {planErrors.student_id && <p className='mt-1 text-xs text-red-500'>{planErrors.student_id}</p>}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>计划类型</label>
                  <select
                    value={planForm.plan_type}
                    onChange={(e) => handlePlanChange('plan_type', e.target.value)}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {planTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>科目</label>
                  <SubjectSelect
                    value={planForm.subject_id ?? null}
                    onChange={(id) => handlePlanChange('subject_id', id || null)}
                    allowEmpty
                    emptyLabel='不指定科目'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>当前分数</label>
                  <input
                    type='number'
                    value={planForm.current_score ?? ''}
                    onChange={(e) => handlePlanChange('current_score', e.target.value ? Number(e.target.value) : null)}
                    placeholder='当前分数'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>目标分数</label>
                  <input
                    type='number'
                    value={planForm.target_score ?? ''}
                    onChange={(e) => handlePlanChange('target_score', e.target.value ? Number(e.target.value) : null)}
                    placeholder='目标分数'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  计划内容 <span className='text-red-500'>*</span>
                </label>
                <textarea
                  value={planForm.plan_content}
                  onChange={(e) => handlePlanChange('plan_content', e.target.value)}
                  placeholder='输入改进计划的详细内容'
                  rows={4}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 ${
                    planErrors.plan_content ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-cyan-500'
                  }`}
                />
                {planErrors.plan_content && <p className='mt-1 text-xs text-red-500'>{planErrors.plan_content}</p>}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>开始日期</label>
                  <input
                    type='date'
                    value={planForm.start_date}
                    onChange={(e) => handlePlanChange('start_date', e.target.value)}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>结束日期</label>
                  <input
                    type='date'
                    value={planForm.end_date}
                    onChange={(e) => handlePlanChange('end_date', e.target.value)}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleClosePlanModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={handlePlanSubmit}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200 font-medium'
              >
                <Check className='w-5 h-5' />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyGuidePage;