// T12-1 拆分（2026-09-12）：原 AnalysisSections.tsx 中的共享类型搬迁至此。
// 所有 interface 保持 export，供 ./components/* 与 ../analysis/useAnalysisLogic 引用。
import { Users, TrendingUp } from 'lucide-react';
import type { AlgorithmStatistics, ClusterData, WarningData, User } from '../../types';

export interface UserWithCluster extends User {
  cluster?: { user_id: number; cluster: number; cluster_name: string; distance?: number } | null;
}

export interface AlgorithmData {
  statistics: AlgorithmStatistics | null;
  clusters: ClusterData | null;
  warnings: WarningData | null;
}

export interface ScoreDistributionItem {
  name: string;
  count: number;
  color: string;
}

export interface ClusterPieItem {
  name: string;
  value: number;
  color: string;
}

export interface WeeklyDataItem {
  week: string;
  avg: number;
  count: number;
}

export interface BasicStat {
  label: string;
  value: number | null;
  icon: typeof Users;
  bgColor: string;
  textColor: string;
}

export interface AlgorithmStat {
  label: string;
  value: string | number;
  icon: typeof TrendingUp;
  bgColor: string;
  textColor: string;
  trend?: string;
  description: string;
}
