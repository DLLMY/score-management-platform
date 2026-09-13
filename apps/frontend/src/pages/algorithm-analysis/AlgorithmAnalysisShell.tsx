import React from 'react';
import {
  Search,
  RefreshCw,
  Target,
  Activity,
  Lightbulb,
  BookOpen,
  ShieldCheck,
  Brain,
  Zap,
  Sparkles,
  Bell,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { TABS } from './constants';
import type { AlgorithmAnalysisDeps } from './types';
import { useAlgorithmAnalysisColumns } from './useAlgorithmAnalysisColumns';
import { StatisticsTab } from './StatisticsTab';
import { PredictionTab } from './PredictionTab';
import { AnomalyTab } from './AnomalyTab';
import { RuleRecommendTab } from './RuleRecommendTab';
import { ScorePredictTab } from './ScorePredictTab';
import { RiskPredictTab } from './RiskPredictTab';
import { ModelManagerTab } from './ModelManagerTab';
import { RuleApplicationTab } from './RuleApplicationTab';
import { BatchAttributionTab } from './BatchAttributionTab';
import { EngagementTab } from './EngagementTab';
import { StudentProfileTab } from './StudentProfileTab';

/**
 * 主壳（状态 + 数据加载 + 列定义 + Tab 分发）的视图层。
 * 全部 state/effect/handler/useMemo 仍由 AlgorithmAnalysis.tsx 持有，
 * 本组件仅接收 deps（不含列定义）+ 壳层专用 setter/回调，内部 memo 列定义后合并回 deps 下发给各 Tab。
 */
export type AlgorithmAnalysisViewDeps = Omit<
  AlgorithmAnalysisDeps,
  'predictionDetailColumns' | 'scorePredictColumns' | 'attributionColumns' | 'engagementColumns'
>;

export interface AlgorithmAnalysisShellProps extends AlgorithmAnalysisViewDeps {
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  tabNavRef: React.RefObject<HTMLDivElement>;
  setSearchKeyword: React.Dispatch<React.SetStateAction<string>>;
  setPredictionDays: React.Dispatch<React.SetStateAction<number>>;
  setAnomalyDays: React.Dispatch<React.SetStateAction<number>>;
  anomalyDays: number;
  setRecommendDays: React.Dispatch<React.SetStateAction<number>>;
  recommendDays: number;
  loadPrediction: () => Promise<void>;
  loadAnomaly: () => Promise<void>;
  loadStatistics: () => Promise<void>;
}

export default function AlgorithmAnalysisShell({
  activeTab,
  setActiveTab,
  tabNavRef,
  selectedClass,
  setSelectedClass,
  searchKeyword,
  setSearchKeyword,
  classes,
  loading,
  error,
  loadWarn,
  statistics,
  predictionData,
  riskStudents,
  predictionDays,
  setPredictionDays,
  filteredPredictions,
  filteredRiskStudents,
  anomalyData,
  anomalyDays,
  setAnomalyDays,
  ruleRecommendData,
  scorePredictData,
  riskPredictData,
  recommendDays,
  setRecommendDays,
  modelTrainingData,
  modelEvaluationData,
  trainingModel,
  evaluatingModel,
  trainRuleModel,
  evaluateRuleModel,
  trainScoreModel,
  evaluateScoreModel,
  trainRiskModel,
  evaluateRiskModel,
  ruleApplicationData,
  selectedUserId,
  setSelectedUserId,
  selectedBehaviorType,
  setSelectedBehaviorType,
  handleAdjustDistribution,
  handleApplyRule,
  batchAttribution,
  batchAttributionDays,
  setBatchAttributionDays,
  batchAttributionLoading,
  batchAttributionError,
  loadBatchAttribution,
  engagementRank,
  engagementRankDays,
  setEngagementRankDays,
  engagementRankLoading,
  engagementRankError,
  engagementTrend,
  engagementTrendUserId,
  setEngagementTrendUserId,
  engagementTrendWeeks,
  setEngagementTrendWeeks,
  engagementTrendLoading,
  setEngagementTrend,
  loadEngagementRank,
  students,
  selectedProfileUserId,
  setSelectedProfileUserId,
  studentProfile,
  setStudentProfile,
  profileLoading,
  profileError,
  loadStudentProfile,
  exporting,
  handleExport,
  loadPrediction,
  loadAnomaly,
  loadStatistics,
}: AlgorithmAnalysisShellProps): React.ReactElement {
  const { predictionDetailColumns, scorePredictColumns, attributionColumns, engagementColumns } =
    useAlgorithmAnalysisColumns(setEngagementTrendUserId);

  // 列定义合并回 deps，下发给各 Tab（与原闭包行为一致）
  const deps: AlgorithmAnalysisDeps = {
    selectedClass,
    setSelectedClass,
    searchKeyword,
    loading,
    error,
    loadWarn,
    statistics,
    predictionData,
    riskStudents,
    predictionDays,
    filteredPredictions,
    filteredRiskStudents,
    anomalyData,
    ruleRecommendData,
    scorePredictData,
    riskPredictData,
    modelTrainingData,
    modelEvaluationData,
    trainingModel,
    evaluatingModel,
    trainRuleModel,
    evaluateRuleModel,
    trainScoreModel,
    evaluateScoreModel,
    trainRiskModel,
    evaluateRiskModel,
    ruleApplicationData,
    selectedUserId,
    setSelectedUserId,
    selectedBehaviorType,
    setSelectedBehaviorType,
    handleAdjustDistribution,
    handleApplyRule,
    batchAttribution,
    batchAttributionDays,
    setBatchAttributionDays,
    batchAttributionLoading,
    batchAttributionError,
    loadBatchAttribution,
    engagementRank,
    engagementRankDays,
    setEngagementRankDays,
    engagementRankLoading,
    engagementRankError,
    engagementTrend,
    engagementTrendUserId,
    setEngagementTrendUserId,
    engagementTrendWeeks,
    setEngagementTrendWeeks,
    engagementTrendLoading,
    setEngagementTrend,
    loadEngagementRank,
    classes,
    students,
    selectedProfileUserId,
    setSelectedProfileUserId,
    studentProfile,
    setStudentProfile,
    profileLoading,
    profileError,
    loadStudentProfile,
    exporting,
    handleExport,
    predictionDetailColumns,
    scorePredictColumns,
    attributionColumns,
    engagementColumns,
  };

  return (
    <div className='space-y-6'>
      {/* 页面头部 */}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-white'>智能分析</h1>
          <p className='text-gray-500 dark:text-slate-400 mt-1'>
            基于机器学习的学生行为与学业综合分析
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              placeholder='搜索学生姓名...'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className='pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
            />
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-gray-500 dark:text-slate-400 hidden sm:inline'>
              班级:
            </span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              aria-label='按班级筛选'
              data-testid='global-class-filter'
              className='px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'prediction') loadPrediction();
              else if (activeTab === 'anomaly') loadAnomaly();
              else loadStatistics();
            }}
            disabled={loading}
            className='p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors'
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div className='border-b border-gray-200 dark:border-slate-700'>
        <nav
          ref={tabNavRef}
          className='flex gap-6 overflow-x-auto'
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon className='w-4 h-4' />
              {tab.label}
              {tab.new && (
                <span className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full'>
                  NEW
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 预测和异常检测的特殊控制 */}
      {activeTab === 'prediction' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-blue-50/60 dark:bg-blue-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Target className='w-5 h-5 text-blue-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>预测天数:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setPredictionDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  predictionDays === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                {days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400'>
            <Brain className='w-4 h-4' />
            基于历史数据预测未来积分变化趋势
          </div>
        </div>
      )}

      {activeTab === 'anomaly' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-orange-50/60 dark:bg-orange-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Activity className='w-5 h-5 text-orange-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>检测范围:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setAnomalyDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  anomalyDays === days
                    ? 'bg-orange-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400'>
            <Zap className='w-4 h-4' />
            自动检测积分异常变化
          </div>
        </div>
      )}

      {activeTab === 'ruleRecommend' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-purple-50/60 dark:bg-purple-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Lightbulb className='w-5 h-5 text-purple-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>分析周期:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRecommendDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recommendDays === days
                    ? 'bg-purple-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400'>
            <Sparkles className='w-4 h-4' />
            基于关联规则挖掘智能推荐积分规则
          </div>
        </div>
      )}

      {activeTab === 'scorePredict' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-blue-50/60 dark:bg-blue-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <BookOpen className='w-5 h-5 text-blue-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>分析周期:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRecommendDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recommendDays === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400'>
            <TrendingUp className='w-4 h-4' />
            基于积分数据预测学生考试成绩
          </div>
        </div>
      )}

      {activeTab === 'riskPredict' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-red-50/60 dark:bg-red-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <ShieldCheck className='w-5 h-5 text-red-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>评估周期:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRecommendDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recommendDays === days
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-red-600 dark:text-red-400'>
            <Bell className='w-4 h-4' />
            集成学习算法实现主动风险预警
          </div>
        </div>
      )}

      {/* 加载失败警示（不阻断内容） */}
      {loadWarn && !error && (
        <div className='bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 text-amber-700 dark:text-amber-300 flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4 shrink-0' />
          部分数据加载失败（统计/班级/参与度趋势），当前展示可能不完整，请刷新重试
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className='bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4 text-red-600 dark:text-red-400'>
          {error}
        </div>
      )}

      {/* 内容区域 */}
      {!error && (
        <>
          {activeTab === 'statistics' && <StatisticsTab deps={deps} />}
          {activeTab === 'prediction' && <PredictionTab deps={deps} />}
          {activeTab === 'anomaly' && <AnomalyTab deps={deps} />}
          {activeTab === 'ruleRecommend' && <RuleRecommendTab deps={deps} />}
          {activeTab === 'scorePredict' && <ScorePredictTab deps={deps} />}
          {activeTab === 'riskPredict' && <RiskPredictTab deps={deps} />}
          {activeTab === 'modelManager' && <ModelManagerTab deps={deps} />}
          {activeTab === 'ruleApplication' && <RuleApplicationTab deps={deps} />}
          {activeTab === 'studentProfile' && <StudentProfileTab deps={deps} />}
          {activeTab === 'batchAttribution' && <BatchAttributionTab deps={deps} />}
          {activeTab === 'engagement' && <EngagementTab deps={deps} />}
        </>
      )}

      {/* 加载状态遮罩 */}
      {loading && (
        <div className='fixed inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-50 pointer-events-none'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-slate-700'>
            <Loader2 className='w-8 h-8 text-primary-500 animate-spin mx-auto' />
            <span className='ml-3 text-gray-500 dark:text-slate-400 mt-2 block text-center'>
              加载中...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
