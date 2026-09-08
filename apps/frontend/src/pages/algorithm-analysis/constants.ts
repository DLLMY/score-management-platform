import {
  BarChart3,
  TrendingUp,
  Activity,
  Lightbulb,
  BookOpen,
  ShieldCheck,
  Brain,
  Zap,
  UserCircle,
  Users,
  LineChart,
} from 'lucide-react';

// 注：LineChart 用于参与度分析 Tab 的周趋势折线图标识
export const TABS = [
  { id: 'statistics', label: '统计分析', icon: BarChart3 },
  { id: 'prediction', label: '积分预测', icon: TrendingUp, new: true },
  { id: 'anomaly', label: '异常检测', icon: Activity, new: true },
  { id: 'ruleRecommend', label: '规则推荐', icon: Lightbulb, new: true },
  { id: 'scorePredict', label: '成绩预测', icon: BookOpen, new: true },
  { id: 'riskPredict', label: '风险评估', icon: ShieldCheck, new: true },
  { id: 'modelManager', label: '模型管理', icon: Brain, new: true },
  { id: 'ruleApplication', label: '智能规则应用', icon: Zap, new: true },
  { id: 'studentProfile', label: '学生画像', icon: UserCircle, new: true },
  { id: 'batchAttribution', label: '班级归因', icon: Users, new: true },
  { id: 'engagement', label: '参与度分析', icon: LineChart, new: true },
];

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  high: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
  medium: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50 dark:bg-yellow-500/10',
  },
  low: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-500/10' },
};

/**
 * 算法分析页可调阈值 / 目标值（集中管理，消除散落魔法数）。
 *
 * 说明：
 * - 评分分布的「分段边界」(90/80/70) 由后端 score_distribution_service 计算，
 *   此处 scoreDistributionTargets.label 仅作展示对齐；「目标占比」为教学管理目标，
 *   当前为前端单点维护常量。若需管理员后台可配置，应从后端 SystemConfig 下发
 *   （key 如 analysis.score_distribution_targets），本常量作为兜底默认值。
 * - scoreBands / scoreColorThresholds / engagementScoreThresholds / defaultDays
 *   均为展示与默认时间窗参数，集中在此便于统一调整。
 */
export type ScoreBand = { label: string; min: number; max?: number; color: string };
export const ANALYSIS_CONFIG = {
  // 评分分布目标占比（与后端 band key: excellent/good/medium/low 一一对应）
  scoreDistributionTargets: [
    { key: 'excellent', label: '90分以上', targetPct: 10, color: 'bg-green-500' },
    { key: 'good', label: '80分以上', targetPct: 30, color: 'bg-blue-500' },
    { key: 'medium', label: '70分以上', targetPct: 40, color: 'bg-yellow-500' },
    { key: 'low', label: '70分以下', targetPct: 20, color: 'bg-red-500' },
  ] as Array<{
    key: 'excellent' | 'good' | 'medium' | 'low';
    label: string;
    targetPct: number;
    color: string;
  }>,
  // 成绩分布预测分段（统计分析 Tab）
  scoreBands: [
    { label: '不及格', min: 0, max: 60, color: 'bg-red-500' },
    { label: '及格', min: 60, max: 70, color: 'bg-yellow-500' },
    { label: '良好', min: 70, max: 80, color: 'bg-blue-500' },
    { label: '优秀', min: 80, color: 'bg-green-500' },
  ] as ScoreBand[],
  // 预测成绩着色阈值
  scoreColorThresholds: { excellent: 80, good: 60 },
  // 参与度评分着色阈值
  engagementScoreThresholds: { high: 70, medium: 45 },
  // 各算法默认时间窗（天）
  defaultDays: { prediction: 7, anomaly: 30, recommend: 30 },
};
