// T12-1 拆分（2026-09-12）：原 727 行展示组件已按 Panel 拆至 ./components，
// 共享类型迁至 ./types、色板/映射表迁至 ./constants。
//
// 本文件保留为**兼容层**（纯 re-export），入口壳 ../Analysis 与
// ../analysis/useAnalysisLogic 的导入路径零改动，行为逐字节等价。
export type {
  UserWithCluster,
  AlgorithmData,
  ScoreDistributionItem,
  ClusterPieItem,
  WeeklyDataItem,
  BasicStat,
  AlgorithmStat,
} from './types';
export { CLUSTER_COLORS, RISK_COLORS, getClusterColor } from './constants';
export {
  BasicStatsGrid,
  AlgorithmInsightCards,
  ScoreDistributionPanel,
  ClusterDistributionPanel,
  RiskWarningPanel,
  TopUsersRanking,
  ScoreTrendPanel,
  CorrelationPanel,
  NeedAttentionPanel,
} from './components';
