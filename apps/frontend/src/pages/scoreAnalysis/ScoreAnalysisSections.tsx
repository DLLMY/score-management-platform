// T12-2 拆分（2026-09-12）：原 973 行巨型 View 已按区块拆至 ./components，
// 类型迁至 ./types、色板迁至 ./constants、图表渲染 helper 迁至 ./helpers。
// 本文件退化为**布局编排**（只做结构拼装与 props 透传），并继续 re-export 全部类型——
// ../ScoreAnalysis 从本文件导入 ScoreAnalysisView 与 5 个类型，导入路径零改动。
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '../../components';
import type { ClassInfo, Exam } from '../../services/api';
import {
  AlgorithmInsightSection,
  AlgorithmOverviewCards,
  ClusterFeatureCard,
  CompositeScoreCard,
  CorrelationCard,
  ExamDetailPanel,
  ExamOverviewCards,
  FilterBar,
  RiskAlertBanner,
  RiskDistributionCard,
} from './components';
import type {
  AlgorithmData,
  ClusterResult,
  ClusterStudent,
  CompositeScore,
  CompositeScoreResult,
  ExamAnalysis,
  RiskStudent,
  SubjectStats,
  WarningResult,
} from './types';

export type {
  AlgorithmData,
  ClusterResult,
  ClusterStudent,
  CompositeScore,
  CompositeScoreResult,
  ExamAnalysis,
  RiskStudent,
  SubjectStats,
  WarningResult,
};

interface ScoreAnalysisViewProps {
  exams: Exam[];
  selectedExam: string;
  setSelectedExam: (v: string) => void;
  classes: ClassInfo[];
  selectedClass: string;
  setSelectedClass: (v: string) => void;
  loadWarn: boolean;
  examAnalysis: ExamAnalysis | null;
  clusters: ClusterResult | null;
  compositeScores: CompositeScoreResult | null;
  warnings: WarningResult | null;
  loading: boolean;
  handleRefresh: () => void;
  handleExport: () => void;
  riskStats: { high: number; medium: number; low: number; total: number };
  compositeScoreDistribution: number[];
  behaviorAcademicCorrelation: number | null;
  riskStudents: RiskStudent[];
  clusterSummary: { label: string; count: number }[];
}

export function ScoreAnalysisView(props: ScoreAnalysisViewProps): React.ReactElement {
  const {
    exams,
    selectedExam,
    setSelectedExam,
    classes,
    selectedClass,
    setSelectedClass,
    loadWarn,
    examAnalysis,
    clusters,
    compositeScores,
    warnings,
    loading,
    handleRefresh,
    handleExport,
    riskStats,
    compositeScoreDistribution,
    behaviorAcademicCorrelation,
    riskStudents,
    clusterSummary,
  } = props;

  return (
    <div className='p-5 space-y-5'>
      {loadWarn && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            算法分析数据加载失败，相关图表可能不完整，请刷新重试
          </p>
        </div>
      )}
      <div>
        <h1 className='text-xl font-bold text-gray-900'>数据分析</h1>
        <p className='text-sm text-gray-500 mt-1'>学生积分数据统计与分析</p>
      </div>

      {/* 筛选栏 */}
      <FilterBar
        exams={exams}
        selectedExam={selectedExam}
        setSelectedExam={setSelectedExam}
        classes={classes}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        handleRefresh={handleRefresh}
        handleExport={handleExport}
        loading={loading}
      />

      {/* 算法洞察统计卡片 */}
      <AlgorithmOverviewCards clusters={clusters} examAnalysis={examAnalysis} />

      {/* 算法洞察区域 */}
      <AlgorithmInsightSection
        clusters={clusters}
        compositeScores={compositeScores}
        warnings={warnings}
        riskStudents={riskStudents}
      />

      {/* 风险预警提醒 */}
      {riskStats.total > 0 && <RiskAlertBanner riskStats={riskStats} />}

      {loading ? (
        <div className='flex items-center justify-center py-12'>
          <LoadingSpinner />
        </div>
      ) : (
        <div className='space-y-4'>
          {/* 考试分析统计卡片 */}
          <ExamOverviewCards examAnalysis={examAnalysis} />

          {/* 主内容区域：三列布局 */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
            {/* 左侧：考试分析 */}
            <ExamDetailPanel examAnalysis={examAnalysis} />

            {/* 右侧：算法分析仪表盘 */}
            <div className='space-y-4'>
              <RiskDistributionCard riskStats={riskStats} riskStudents={riskStudents} />
              <CorrelationCard behaviorAcademicCorrelation={behaviorAcademicCorrelation} />
              <CompositeScoreCard compositeScoreDistribution={compositeScoreDistribution} />
              <ClusterFeatureCard clusterSummary={clusterSummary} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
