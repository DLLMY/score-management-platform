// T12-2 拆分（2026-09-12）：原 ScoreAnalysisSections.tsx 中的共享类型搬迁至此。
// 所有 interface 保持 export，供 ./components/* 与 ../ScoreAnalysis 引用。

// 学科统计类型
export interface SubjectStats {
  count: number;
  average: number;
  max: number;
  min: number;
  pass_rate: number;
  scores?: number[];
}

// 考试分析类型
export interface ExamAnalysis {
  overall: {
    total_students: number;
    overall_average: number;
    highest_score: number;
    lowest_score: number;
    std_deviation: number;
    excellent_count: number;
    excellent_rate: number;
    pass_rate: number;
  };
  subject_stats: Record<string, SubjectStats>;
}

// 聚类学生类型
export interface ClusterStudent {
  user_id: number;
  cluster: number;
  cluster_name?: string;
}

// 聚类结果类型
export interface ClusterResult {
  n_clusters: number;
  cluster_summary: {
    label: string;
    count: number;
  }[];
  students?: ClusterStudent[];
}

// 综合评分类型
export interface CompositeScore {
  user_id: number;
  composite_score: number;
}

// 综合评分结果类型
export interface CompositeScoreResult {
  scores: CompositeScore[];
}

// 风险学生类型
export interface RiskStudent {
  user_id: number;
  risk_level: 'high' | 'medium' | 'low';
}

// 预警结果类型
export interface WarningResult {
  risk_students: RiskStudent[];
}

// 算法数据类型
export interface AlgorithmData {
  clusters: ClusterResult | null;
  compositeScores: CompositeScoreResult | null;
  warnings: WarningResult | null;
}
