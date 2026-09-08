import type React from 'react';
import type { ColumnType } from '../../components/data-display/DataTable';

// —— 业务接口定义（原 NLPManagement.tsx 内联，拆分后统一收敛到此）——
export interface ParseResult {
  success: boolean;
  input_text: string;
  extracted_name: string | null;
  user_id: number | null;
  behavior: string;
  intent: string;
  confidence: number;
  matched_rules: MatchedRule[];
  suggestions: Suggestion[];
}

export interface MatchedRule {
  rule_id: number | null;
  behavior_keyword: string;
  behavior_description: string;
  score_value: number;
  score_type: string;
  behavior_tags: string[];
  match_pattern: string;
  priority: number;
  usage_count: number;
  accuracy_rate: number;
}

export interface Suggestion {
  intent: string;
  score_value: number;
  description: string;
  rule_id?: number;
  similarity?: number;
}

export interface Rule {
  id: number;
  behavior_keyword: string;
  behavior_description: string;
  score_value: number;
  score_type: string;
  behavior_tags: string[];
  match_pattern: string;
  priority: number;
  is_active: boolean;
  usage_count: number;
  accuracy_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Statistics {
  total_rules: number;
  add_rules: number;
  deduct_rules: number;
  total_usage: number;
  manual_corrections: number;
  accuracy_rate: number;
  high_usage_rules: Rule[];
}

export interface ModelEvaluation {
  accuracy_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  total_samples: number;
  correct_count: number;
  incorrect_count: number;
}

export interface TrainingRecord {
  id: number;
  training_version: string;
  training_data_count: number;
  training_data_size?: number;
  accuracy_before: number;
  accuracy_after: number;
  accuracy?: number;
  precision: number;
  recall: number;
  f1_score: number;
  training_status: string;
  training_start_at: string;
  training_end_at: string;
  algorithm_type?: string;
}

export interface MLAlgorithm {
  value: string;
  label: string;
}

export interface MLTrainingResult {
  success: boolean;
  algorithm: string;
  algorithm_name: string;
  training_data_count: number;
  evaluation: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  cross_validation?: {
    mean_f1: number;
    std_f1: number;
    min_f1: number;
    max_f1: number;
  };
  message: string;
}

export interface MLAlgorithmResult {
  algorithm: string;
  algorithm_name: string;
  evaluation: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  cross_validation: {
    mean_f1: number;
    std_f1: number;
    min_f1: number;
    max_f1: number;
  };
}

export interface MLTrainAllResult {
  success: boolean;
  results: MLAlgorithmResult[];
  best_algorithm: string | null;
  best_algorithm_name: string | null;
  best_f1: number;
  training_data_count: number;
  message: string;
}

export interface MLEvaluationAllResult {
  success: boolean;
  results: MLAlgorithmResult[];
  total_data_count: number;
}

export interface ManualCorrectionData {
  intent: string;
  score_value: number;
  behavior_tags: string[];
  behavior_description: string;
  feedback_note: string;
  // #912 手动修正接管学生：user_id 优先；fallback corrected_name 按名查
  user_id?: number;
  corrected_name?: string;
}

export interface IntentBreakdownItem {
  total?: number;
  correct?: number;
  // 后端准确率以 0~1 浮点返回（见 nlp_analyzer_service.py 的 round(..., 4)）
  accuracy?: number;
}

export interface NlpAnalysisData {
  summary?: {
    accuracy?: number;
    cache_hit_rate?: number;
    avg_processing_time?: number;
    total_requests?: number;
  };
  // 后端真实形状：每意图一个统计对象 {total, correct, accuracy}，非 number
  intent_breakdown?: Record<string, IntentBreakdownItem>;
  components?: unknown[];
  slow_requests?: Array<{ timestamp: string; processing_time: number }>;
}

export interface NlpSuggestion {
  priority?: 'high' | 'medium' | 'low' | string;
  title?: string;
  description?: string;
  issue?: string;
  suggestions?: string[];
}

export interface NlpOptimizerConfig {
  intent_classifier?: { tfidf_max_features?: number; tfidf_ngram_range?: [number, number] };
  performance?: { cache_ttl?: number };
}

export interface NlpBenchmarkResult {
  avg_latency?: number;
  p95_latency?: number;
  avg_accuracy?: number;
  throughput?: number;
}

export interface NlpCorrection {
  id?: number;
  original_text?: string;
  field_type?: string;
  original_value?: string;
  corrected_value?: string;
  status?: string;
}

export type TabType = 'parse' | 'rules' | 'training' | 'statistics' | 'analysis';

// —— 新增/编辑规则表单局部状态形状 ——
export interface NewRuleForm {
  behavior_keyword: string;
  behavior_description: string;
  score_value: number;
  score_type: string;
  behavior_tags: string;
  match_pattern: string;
  priority: number;
}

// —— 组件性能表格行（analysis 页性能概览）——
export interface PerformanceRowStats {
  calls?: number | null;
  avg_time?: number | null;
  error_rate?: number | null;
}
export interface PerformanceRow {
  name: string;
  stats: PerformanceRowStats;
}

/**
 * 主组件（壳）向各 Tab / 模态 / 列表子模块透传的全部状态 / setter / 回调 / 列定义。
 * 单一对象透传，子模块按需解构——行为与原闭包完全一致，tsc 校验缺失引用。
 *
 * 仅收纳「子模块 JSX 直接引用」的字段；loadError/activeTab/confirmRef/showToast/
 * fetchAlgorithms 等仅由主壳自身使用的字段不在此契约中。
 */
export interface NLPDeps {
  // —— 解析 Tab ——
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  parseResult: ParseResult | null;
  setParseResult: React.Dispatch<React.SetStateAction<ParseResult | null>>;
  isParsing: boolean;
  setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRuleId: number | null;
  setSelectedRuleId: React.Dispatch<React.SetStateAction<number | null>>;
  suggestedRules: Rule[];
  setSuggestedRules: React.Dispatch<React.SetStateAction<Rule[]>>;
  showCorrectionModal: boolean;
  setShowCorrectionModal: React.Dispatch<React.SetStateAction<boolean>>;
  showCorrectionList: boolean;
  setShowCorrectionList: React.Dispatch<React.SetStateAction<boolean>>;
  parseText: () => Promise<void>;
  executeScoring: () => Promise<void>;
  applySuggestionAsRule: (suggestion: {
    intent: string;
    score_value: number;
    description: string;
    rule_id: number;
    similarity?: number;
  }) => Promise<void>;
  setManualCorrection: React.Dispatch<React.SetStateAction<ManualCorrectionData>>;
  setCorrectionsPage: React.Dispatch<React.SetStateAction<number>>;
  fetchCorrections: (page?: number) => Promise<void>;

  // —— 规则 Tab ——
  rules: Rule[];
  rulesLoading: boolean;
  rulePage: number;
  setRulePage: React.Dispatch<React.SetStateAction<number>>;
  ruleTotal: number;
  keywordFilter: string;
  setKeywordFilter: React.Dispatch<React.SetStateAction<string>>;
  scoreTypeFilter: string;
  setScoreTypeFilter: React.Dispatch<React.SetStateAction<string>>;
  showBatchImportModal: boolean;
  setShowBatchImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  editingRule: Rule | null;
  setEditingRule: React.Dispatch<React.SetStateAction<Rule | null>>;
  newRule: NewRuleForm;
  setNewRule: React.Dispatch<React.SetStateAction<NewRuleForm>>;
  showRuleForm: boolean;
  setShowRuleForm: React.Dispatch<React.SetStateAction<boolean>>;
  ruleColumns: ColumnType<Rule>[];
  fetchRules: () => Promise<void>;
  openEditModal: (rule: Rule) => void;
  handleDeleteRule: (ruleId: number) => Promise<void>;
  handleCreateRule: () => Promise<void>;
  handleEditRule: () => Promise<void>;

  // —— 训练 Tab ——
  algorithms: MLAlgorithm[];
  isTraining: boolean;
  setIsTraining: React.Dispatch<React.SetStateAction<boolean>>;
  selectedAlgorithm: string;
  setSelectedAlgorithm: React.Dispatch<React.SetStateAction<string>>;
  useCrossValidation: boolean;
  setUseCrossValidation: React.Dispatch<React.SetStateAction<boolean>>;
  modelEvaluation: ModelEvaluation | null;
  trainingResult: MLTrainingResult | null;
  setTrainingResult: React.Dispatch<React.SetStateAction<MLTrainingResult | null>>;
  trainAllResult: MLTrainAllResult | null;
  setTrainAllResult: React.Dispatch<React.SetStateAction<MLTrainAllResult | null>>;
  isEvaluatingAll: boolean;
  setIsEvaluatingAll: React.Dispatch<React.SetStateAction<boolean>>;
  evaluationAllResult: MLEvaluationAllResult | null;
  setEvaluationAllResult: React.Dispatch<React.SetStateAction<MLEvaluationAllResult | null>>;
  trainingHistory: TrainingRecord[];
  trainingResultColumns: ColumnType<MLAlgorithmResult>[];
  handleTrainModel: () => Promise<void>;
  handleTrainAllModels: () => Promise<void>;
  handleEvaluateAllModels: () => Promise<void>;

  // —— 统计 Tab ——
  statistics: Statistics | null;
  setStatistics: React.Dispatch<React.SetStateAction<Statistics | null>>;
  setModelEvaluation: React.Dispatch<React.SetStateAction<ModelEvaluation | null>>;
  fetchStatistics: () => Promise<void>;
  fetchModelEvaluation: () => Promise<void>;

  // —— 分析 Tab ——
  intentAnalysis: NlpAnalysisData | null;
  setIntentAnalysis: React.Dispatch<React.SetStateAction<NlpAnalysisData | null>>;
  performanceAnalysis: NlpAnalysisData | null;
  setPerformanceAnalysis: React.Dispatch<React.SetStateAction<NlpAnalysisData | null>>;
  optimizationSuggestions: NlpSuggestion[];
  setOptimizationSuggestions: React.Dispatch<React.SetStateAction<NlpSuggestion[]>>;
  optimizerConfig: NlpOptimizerConfig | null;
  setOptimizerConfig: React.Dispatch<React.SetStateAction<NlpOptimizerConfig | null>>;
  isLoadingAnalysis: boolean;
  setIsLoadingAnalysis: React.Dispatch<React.SetStateAction<boolean>>;
  benchmarkResults: NlpBenchmarkResult | null;
  setBenchmarkResults: React.Dispatch<React.SetStateAction<NlpBenchmarkResult | null>>;
  isBenchmarking: boolean;
  setIsBenchmarking: React.Dispatch<React.SetStateAction<boolean>>;
  selectedStrategy: string;
  setSelectedStrategy: React.Dispatch<React.SetStateAction<string>>;
  performanceColumns: ColumnType<PerformanceRow>[];
  fetchAnalysisData: () => Promise<void>;
  runBenchmark: () => Promise<void>;
  updateOptimizationStrategy: (strategy: string) => Promise<void>;
  resetAnalysisMetrics: () => Promise<void>;

  // —— 手动修正模态 ——
  manualCorrection: ManualCorrectionData;
  isSubmittingFeedback: boolean;
  handleRecordFeedback: () => Promise<void>;
  handleManualExecute: () => Promise<void>;

  // —— 批量导入模态 ——
  importFile: File | null;
  setImportFile: React.Dispatch<React.SetStateAction<File | null>>;
  importJsonText: string;
  setImportJsonText: React.Dispatch<React.SetStateAction<string>>;
  isImporting: boolean;
  setIsImporting: React.Dispatch<React.SetStateAction<boolean>>;
  handleDownloadTemplate: () => void;
  handleBatchImport: () => Promise<void>;

  // —— 纠正记录列表 ——
  corrections: NlpCorrection[];
  correctionsLoading: boolean;
  correctionsPage: number;
  correctionTotal: number;
  correctionStatusFilter: string;
  setCorrectionStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  correctionColumns: ColumnType<NlpCorrection>[];
  handleUpdateCorrection: (id: number, status: string) => Promise<void>;
  handleDeleteCorrection: (id: number) => Promise<void>;
}
