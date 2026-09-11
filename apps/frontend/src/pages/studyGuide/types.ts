import type { StudyGuide, ImprovementPlan } from '../../types';
import type { useSubmitGuard } from '../../hooks';

export interface GuideFormData {
  id: number | null;
  title: string;
  guide_type: string;
  content: string;
  target_audience: string;
  is_published: boolean;
}

export interface PlanFormData {
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

export type RunSubmit = ReturnType<typeof useSubmitGuard>['run'];

export interface StudyGuideViewProps {
  // 头部 / tab
  activeTab: 'guides' | 'plans';
  setActiveTab: (t: 'guides' | 'plans') => void;
  handleOpenGuideCreate: () => void;
  handleOpenPlanCreate: () => void;
  // 工具条
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterClassId: number;
  setFilterClassId: (id: number) => void;
  // 指导文章 tab
  isLoading: boolean;
  filteredGuides: StudyGuide[];
  expandedGuide: number | null;
  setExpandedGuide: (id: number | null) => void;
  handleOpenGuideEdit: (guide: StudyGuide) => void;
  handleDeleteGuide: (guideId: number) => void;
  guidePage: number;
  guideTotal: number;
  setGuidePage: (p: number) => void;
  // 改进计划 tab
  filteredPlans: ImprovementPlan[];
  editingPlanId: number | null;
  setEditingPlanId: (id: number | null) => void;
  handleOpenPlanEdit: (plan: ImprovementPlan) => void;
  handleDeletePlan: (planId: number) => void;
  handleUpdateProgress: (planId: number, progress: number) => void;
  planPage: number;
  planTotal: number;
  setPlanPage: (p: number) => void;
  getProgressColor: (progress: number) => string;
  getProgressBg: (progress: number) => string;
  // 指导文章模态
  showGuideModal: boolean;
  closeGuideModal: () => void;
  guideForm: GuideFormData;
  selectedClassId: number;
  setSelectedClassId: (id: number) => void;
  handleGuideChange: (field: keyof GuideFormData, value: string | boolean) => void;
  guideErrors: Record<string, string>;
  handleGuideSubmit: () => void;
  guideTypes: string[];
  audiences: string[];
  // 改进计划模态
  showPlanModal: boolean;
  closePlanModal: () => void;
  planForm: PlanFormData;
  handlePlanChange: (field: keyof PlanFormData, value: string | number | null) => void;
  planErrors: Record<string, string>;
  handlePlanSubmit: () => void;
  planTypes: string[];
  // 通用
  runSubmit: RunSubmit;
  submitting: boolean;
}
