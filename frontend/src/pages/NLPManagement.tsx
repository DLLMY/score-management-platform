import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  BookOpen,
  Brain,
  BarChart3,
  AlertTriangle,
  Check,
  X,
  Save,
  Train,
  History,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Upload,
  Download,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton } from '../components';

interface ParseResult {
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

interface MatchedRule {
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

interface Suggestion {
  intent: string;
  score_value: number;
  description: string;
}

interface Rule {
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

interface Statistics {
  total_rules: number;
  add_rules: number;
  deduct_rules: number;
  total_usage: number;
  manual_corrections: number;
  accuracy_rate: number;
  high_usage_rules: Rule[];
}

interface ModelEvaluation {
  accuracy_rate: number;
  precision: number;
  recall: number;
  f1_score: number;
  total_samples: number;
  correct_count: number;
  incorrect_count: number;
}

interface TrainingRecord {
  id: number;
  training_version: string;
  training_data_count: number;
  accuracy_before: number;
  accuracy_after: number;
  precision: number;
  recall: number;
  f1_score: number;
  training_status: string;
  training_start_at: string;
  training_end_at: string;
  algorithm_type?: string;
}

interface MLAlgorithm {
  value: string;
  label: string;
}

interface MLTrainingResult {
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

interface MLAlgorithmResult {
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

interface MLTrainAllResult {
  success: boolean;
  results: MLAlgorithmResult[];
  best_algorithm: string | null;
  best_algorithm_name: string | null;
  best_f1: number;
  training_data_count: number;
  message: string;
}

interface MLEvaluationAllResult {
  success: boolean;
  results: MLAlgorithmResult[];
  total_data_count: number;
}

interface ManualCorrectionData {
  intent: string;
  score_value: number;
  behavior_tags: string[];
  behavior_description: string;
  feedback_note: string;
}

type TabType = 'parse' | 'rules' | 'training' | 'statistics' | 'analysis';

const NLPScoringManagement = () => {
  const [activeTab, setActiveTab] = useState<TabType>('parse');
  const [inputText, setInputText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [manualCorrection, setManualCorrection] = useState<ManualCorrectionData>({
    intent: 'add',
    score_value: 5,
    behavior_tags: [],
    behavior_description: '',
    feedback_note: '',
  });
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulePage, setRulePage] = useState(1);
  const [ruleTotal, setRuleTotal] = useState(0);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [scoreTypeFilter, setScoreTypeFilter] = useState('');
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [modelEvaluation, setModelEvaluation] = useState<ModelEvaluation | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<TrainingRecord[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [newRule, setNewRule] = useState({
    behavior_keyword: '',
    behavior_description: '',
    score_value: 5,
    score_type: 'add',
    behavior_tags: '',
    match_pattern: '',
    priority: 0,
  });
  const [suggestedRules, setSuggestedRules] = useState<Rule[]>([]);
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [algorithms, setAlgorithms] = useState<MLAlgorithm[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('');
  const [useCrossValidation, setUseCrossValidation] = useState(false);
  const [trainingResult, setTrainingResult] = useState<MLTrainingResult | null>(null);
  const [trainAllResult, setTrainAllResult] = useState<MLTrainAllResult | null>(null);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
  const [evaluationAllResult, setEvaluationAllResult] = useState<MLEvaluationAllResult | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  
  // 算法分析相关状态
  const [intentAnalysis, setIntentAnalysis] = useState<any>(null);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<any>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any[]>([]);
  const [optimizerConfig, setOptimizerConfig] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<any>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('balanced');
  
  // 自学习反馈相关状态
  const [corrections, setCorrections] = useState<any[]>([]);
  const [correctionsPage, setCorrectionsPage] = useState(1);
  const [correctionTotal, setCorrectionTotal] = useState(0);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showCorrectionList, setShowCorrectionList] = useState(false);
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState('');
  
  const { showToast } = useStableToast();

  const parseText = useCallback(async () => {
    if (!inputText.trim()) {
      showToast('warning', '请输入文本');
      return;
    }

    setIsParsing(true);
    try {
      const response = await api.nlp.parse(inputText);
      // request() 已自动剥离信封 → response 直接是 NLPParsedResult（业务层）
      // 业务层 success=false 仅表示"未精确匹配到现有规则 ID"，并不等于"未识别"
      // （仍会把 extracted_name/behavior/intent/suggestions 等有效信息展示给用户）
      setParseResult(response);

      // 从后端 suggestions 中提取带 rule_id 的相似规则作为可一键应用项
      // （后端 _generate_suggestions 已包含数据库相似规则，含 rule_id + similarity）
      const ruleLikeSuggestions = (response.suggestions || []).filter(
        (s): s is typeof s & { rule_id: number } => typeof s?.rule_id === 'number'
      );
      if (ruleLikeSuggestions.length > 0) {
        const mapped: Rule[] = ruleLikeSuggestions.map((s) => ({
          id: s.rule_id,
          rule_id: s.rule_id,
          behavior_keyword: s.description || '',
          behavior_description: s.description || '',
          score_value: s.score_value,
          score_type: s.intent,
          behavior_tags: [],
          match_pattern: '',
          priority: 0,
          is_active: true,
          usage_count: 0,
          accuracy_rate: s.similarity ?? 0,
          created_at: '',
          updated_at: '',
        }));
        setSuggestedRules(mapped);
      } else {
        setSuggestedRules([]);
      }

      // 友好 toast：区分"完全未识别"vs"识别但未匹配规则"
      if (response.matched_rules.length > 0) {
        // 命中精确规则 → 不弹 toast，让 UI 主流程接管
      } else if (
        response.extracted_name ||
        response.behavior ||
        (response.suggestions && response.suggestions.length > 0)
      ) {
        showToast(
          'info',
          '已识别姓名/行为/意图，但未匹配到现有规则；已展示相似规则推荐，可一键应用或手动修正。'
        );
      } else {
        showToast(
          'info',
          '未识别到明确评分规则，可点击「手动修正」补充信息或在「规则管理」中新增规则后重试。'
        );
      }
    } catch (error) {
      logger.error('解析失败:', error);
      showToast('error', '解析失败: ' + ((error as Error).message || '请稍后重试'));
    } finally {
      setIsParsing(false);
    }
  }, [inputText, showToast]);

  const executeScoring = useCallback(async () => {
    if (!parseResult) return;

    try {
      const selectedRule = parseResult.matched_rules.find(r => r.rule_id === selectedRuleId) || parseResult.matched_rules[0];
      const response = await api.nlp.execute({ 
        text: inputText,
        manual_correction: {
          intent: selectedRule.score_type,
          score_value: selectedRule.score_value,
          behavior_tags: selectedRule.behavior_tags,
          behavior_description: selectedRule.behavior_description,
          feedback_note: '',
          created_by: 1,
        },
      });
      if (response) {
        showToast('success', '评分成功');
        setParseResult(null);
        setInputText('');
        setSelectedRuleId(null);
        fetchRules();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('评分失败:', error);
      showToast('error', '评分失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [parseResult, inputText, selectedRuleId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 一键应用 suggestions 中带 rule_id 的相似规则：
   * 直接调用 /api/nlp/execute，用该规则的 intent/score_value/description 评分。
   * 用于"识别有效但未精确匹配规则"的场景，让用户无需走手动修正流程。
   */
  const applySuggestionAsRule = useCallback(
    async (suggestion: {
      intent: string;
      score_value: number;
      description: string;
      rule_id: number;
      similarity?: number;
    }) => {
      try {
        const response = await api.nlp.execute({
          text: inputText,
          manual_correction: {
            intent: suggestion.intent,
            score_value: suggestion.score_value,
            behavior_tags: [],
            behavior_description: suggestion.description || '',
            feedback_note: `一键应用相似规则 #${suggestion.rule_id}`,
            created_by: 1,
          },
        });
        if (response) {
          showToast('success', `已应用相似规则 #${suggestion.rule_id} 扣分`);
          setParseResult(null);
          setInputText('');
          setSuggestedRules([]);
          fetchRules();
        } else {
          showToast('error', '应用失败');
        }
      } catch (error) {
        logger.error('应用相似规则失败:', error);
        showToast('error', '应用相似规则失败: ' + ((error as Error).message || '请稍后重试'));
      }
    },
    [inputText, showToast]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualExecute = useCallback(async () => {
    if (!parseResult) return;

    try {
      const response = await api.nlp.execute({
        text: inputText,
        manual_correction: {
          ...manualCorrection,
          created_by: 1,
        },
      });
      if (response) {
        showToast('success', '评分成功');
        setParseResult(null);
        setInputText('');
        setShowCorrectionModal(false);
        setManualCorrection({
          intent: 'add',
          score_value: 5,
          behavior_tags: [],
          behavior_description: '',
          feedback_note: '',
        });
        fetchRules();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('评分失败:', error);
      showToast('error', '评分失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [parseResult, inputText, manualCorrection, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const response = await api.nlp.getRules({
        page: rulePage,
        per_page: 20,
        keyword: keywordFilter || undefined,
        score_type: scoreTypeFilter || undefined,
        sort_by: 'usage_count',
        sort_order: 'desc',
      });
      if (response) {
        setRules(response.items);
        setRuleTotal(response.total);
      }
    } catch (error) {
      showToast('error', '获取规则失败');
    } finally {
      setRulesLoading(false);
    }
  }, [rulePage, keywordFilter, scoreTypeFilter, showToast]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.nlp.getRuleStatistics();
      if (response) {
        setStatistics(response as unknown as Statistics);
      }
    } catch (error) {
      showToast('error', '获取统计数据失败');
    }
  }, [showToast]);

  const fetchModelEvaluation = useCallback(async () => {
    try {
      const response = await api.nlp.evaluateModel();
      if (response) {
        setModelEvaluation(response as unknown as ModelEvaluation);
      }
    } catch (error) {
      showToast('error', '获取模型评估失败');
    }
  }, [showToast]);

  const fetchTrainingHistory = useCallback(async () => {
    try {
      const response = await api.nlp.getTrainingHistory({ page: 1, per_page: 10 });
      if (response) {
        setTrainingHistory(response.items);
      }
    } catch (error) {
      logger.error('获取训练历史失败:', error);
      showToast('error', '获取训练历史失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [showToast]);

  const handleCreateRule = useCallback(async () => {
    try {
      const response = await api.nlp.createRule({
        ...newRule,
        behavior_tags: newRule.behavior_tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      if (response) {
        showToast('success', '规则创建成功');
        setShowRuleForm(false);
        setNewRule({
          behavior_keyword: '',
          behavior_description: '',
          score_value: 5,
          score_type: 'add',
          behavior_tags: '',
          match_pattern: '',
          priority: 0,
        });
        fetchRules();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('创建规则失败:', error);
      showToast('error', '创建规则失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [newRule, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditRule = useCallback(async () => {
    if (!editingRule) return;

    try {
      const response = await api.nlp.updateRule(editingRule.id, {
        ...newRule,
        behavior_tags: newRule.behavior_tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      if (response) {
        showToast('success', '规则更新成功');
        setShowRuleForm(false);
        setEditingRule(null);
        setNewRule({
          behavior_keyword: '',
          behavior_description: '',
          score_value: 5,
          score_type: 'add',
          behavior_tags: '',
          match_pattern: '',
          priority: 0,
        });
        fetchRules();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('更新规则失败:', error);
      showToast('error', '更新规则失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [editingRule, newRule, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteRule = useCallback(async (ruleId: number) => {
    if (!window.confirm('确定要删除这个规则吗？')) return;

    try {
      const response = await api.nlp.deleteRule(ruleId);
      if (response) {
        showToast('success', '规则删除成功');
        fetchRules();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('删除规则失败:', error);
      showToast('error', '删除规则失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrainModel = useCallback(async () => {
    setIsTraining(true);
    setTrainingResult(null);
    try {
      const response = await api.nlp.trainModel({ 
        trained_by: 1,
        algorithm: selectedAlgorithm || undefined,
        use_cross_validation: useCrossValidation,
      });
      if (response) {
        setTrainingResult(response as unknown as MLTrainingResult);
        showToast('success', '模型训练成功');
        fetchModelEvaluation();
        fetchTrainingHistory();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('模型训练失败:', error);
      showToast('error', '模型训练失败: ' + ((error as Error).message || '请稍后重试'));
    } finally {
      setIsTraining(false);
    }
  }, [selectedAlgorithm, useCrossValidation, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrainAllModels = useCallback(async () => {
    setIsTraining(true);
    setTrainAllResult(null);
    try {
      const response = await api.nlp.trainAllModels({ trained_by: 1 });
      if (response) {
        setTrainAllResult(response as unknown as MLTrainAllResult);
        showToast('success', '全部模型训练成功');
        fetchModelEvaluation();
        fetchTrainingHistory();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('模型训练失败:', error);
      showToast('error', '模型训练失败: ' + ((error as Error).message || '请稍后重试'));
    } finally {
      setIsTraining(false);
    }
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEvaluateAllModels = useCallback(async () => {
    setIsEvaluatingAll(true);
    setEvaluationAllResult(null);
    try {
      const response = await api.nlp.evaluateAllModels();
      if (response) {
        setEvaluationAllResult(response as unknown as MLEvaluationAllResult);
        showToast('success', '评估完成');
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      showToast('error', '评估失败');
    } finally {
      setIsEvaluatingAll(false);
    }
  }, [showToast]);

  const fetchAlgorithms = useCallback(async () => {
    try {
      const response = await api.nlp.getAlgorithms();
      if (response) {
        setAlgorithms(response as unknown as MLAlgorithm[]);
        setLoadError(false);
      }
    } catch (error) {
      logger.error('获取算法列表失败', error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    fetchAlgorithms();
  }, [fetchAlgorithms]);

  const handleBatchImport = useCallback(async () => {
    let rulesData: unknown[] = [];
    
    if (importFile) {
      try {
        const text = await importFile.text();
        rulesData = JSON.parse(text);
      } catch (error) {
        showToast('error', '文件解析失败，请确保是有效的JSON文件');
        return;
      }
    } else if (importJsonText.trim()) {
      try {
        rulesData = JSON.parse(importJsonText);
      } catch (error) {
        showToast('error', 'JSON格式错误');
        return;
      }
    } else {
      showToast('warning', '请选择文件或输入JSON数据');
      return;
    }

    if (!Array.isArray(rulesData)) {
      showToast('error', '数据格式错误，应为数组格式');
      return;
    }

    setIsImporting(true);
    try {
      const response = await api.nlp.batchImportRules(rulesData);
      if (response) {
        showToast('success', `成功导入 ${response.imported_count} 条规则，跳过 ${response.skipped_count} 条重复规则`);
        setShowBatchImportModal(false);
        setImportFile(null);
        setImportJsonText('');
        fetchRules();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      showToast('error', '导入失败');
    } finally {
      setIsImporting(false);
    }
  }, [importFile, importJsonText, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadTemplate = useCallback(() => {
    const template = [
      {
        behavior_keyword: '行为关键词',
        behavior_description: '行为描述',
        score_value: 5,
        score_type: 'add',
        behavior_tags: ['标签1', '标签2'],
        match_pattern: '匹配模式',
        priority: 1,
      },
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nlp_rules_template.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const openEditModal = useCallback((rule: Rule) => {
    setEditingRule(rule);
    setNewRule({
      behavior_keyword: rule.behavior_keyword,
      behavior_description: rule.behavior_description,
      score_value: rule.score_value,
      score_type: rule.score_type,
      behavior_tags: rule.behavior_tags.join(','),
      match_pattern: rule.match_pattern,
      priority: rule.priority,
    });
    setShowRuleForm(true);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (activeTab === 'statistics') {
      fetchStatistics();
      fetchModelEvaluation();
    }
    if (activeTab === 'training') {
      fetchTrainingHistory();
    }
    if (activeTab === 'analysis') {
      fetchAnalysisData();
    }
  }, [activeTab, fetchStatistics, fetchModelEvaluation, fetchTrainingHistory]);

  // 获取分析数据
  const fetchAnalysisData = useCallback(async () => {
    setIsLoadingAnalysis(true);
    try {
      const [intentRes, perfRes, suggestionsRes, configRes] = await Promise.all([
        (api as any).nlp.getAnalysisIntent(),
        (api as any).nlp.getAnalysisPerformance(),
        (api as any).nlp.getAnalysisSuggestions(),
        (api as any).nlp.getOptimizationConfig(),
      ]);
      
      if (intentRes.code === 0) setIntentAnalysis(intentRes.data);
      if (perfRes.code === 0) setPerformanceAnalysis(perfRes.data);
      if (suggestionsRes.code === 0) setOptimizationSuggestions(suggestionsRes.data);
      if (configRes.code === 0) setOptimizerConfig(configRes.data);
      setLoadError(false);
    } catch (error) {
      logger.error('获取分析数据失败:', error);
      setLoadError(true);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  // 运行基准测试
  const runBenchmark = useCallback(async () => {
    setIsBenchmarking(true);
    try {
      const response = await (api as any).nlp.benchmarkIntentClassifier({ iterations: 10 });
      if (response) {
        setBenchmarkResults(response);
        showToast('success', '基准测试完成');
      }
    } catch (error) {
      showToast('error', '基准测试失败');
    } finally {
      setIsBenchmarking(false);
    }
  }, [showToast]);

  // 更新优化策略
  const updateOptimizationStrategy = useCallback(async (strategy: string) => {
    try {
      const response = await (api as any).nlp.setOptimizationConfig({ strategy });
      if (response) {
        setOptimizerConfig(response);
        setSelectedStrategy(strategy);
        showToast('success', '优化策略已更新');
        fetchAnalysisData();
      }
    } catch (error) {
      showToast('error', '更新优化策略失败');
    }
  }, [fetchAnalysisData, showToast]);

  // 重置分析指标
  const resetAnalysisMetrics = useCallback(async () => {
    try {
      const response = await (api as any).nlp.resetAnalysis();
      if (response) {
        showToast('success', '指标已重置');
        fetchAnalysisData();
      }
    } catch (error) {
      showToast('error', '重置失败');
    }
  }, [fetchAnalysisData, showToast]);

  // 获取纠正记录列表
  const fetchCorrections = useCallback(async () => {
    setCorrectionsLoading(true);
    try {
      const response = await api.nlp.getCorrections({
        page: correctionsPage,
        per_page: 20,
        status: correctionStatusFilter || undefined,
      });
      if (response) {
        setCorrections(response.items);
        setCorrectionTotal(response.total);
      }
    } catch (error) {
      showToast('error', '获取纠正记录失败');
    } finally {
      setCorrectionsLoading(false);
    }
  }, [correctionsPage, correctionStatusFilter, showToast]);

  // 记录用户反馈（自学习）
  const handleRecordFeedback = useCallback(async () => {
    if (!parseResult) return;

    setIsSubmittingFeedback(true);
    try {
      const response = await api.nlp.recordFeedback({
        text: parseResult.input_text,
        predicted_intent: parseResult.intent,
        confidence: parseResult.confidence,
        original_name: parseResult.extracted_name || undefined,
        corrected_name: manualCorrection.intent !== parseResult.intent ? manualCorrection.behavior_description : undefined,
        corrected_intent: manualCorrection.intent !== parseResult.intent ? manualCorrection.intent : undefined,
        corrected_score: manualCorrection.score_value,
        original_score: parseResult.matched_rules[0]?.score_value || undefined,
      });
      if (response) {
        showToast('success', '反馈已记录，系统将自动学习优化');
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      showToast('error', '记录反馈失败');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [parseResult, manualCorrection, showToast]);

  // 更新纠正状态
  const handleUpdateCorrection = useCallback(async (id: number, status: string) => {
    try {
      const response = await api.nlp.updateCorrection(id, { status });
      if (response) {
        showToast('success', '纠正状态已更新');
        fetchCorrections();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      showToast('error', '更新失败');
    }
  }, [fetchCorrections, showToast]);

  // 删除纠正记录
  const handleDeleteCorrection = useCallback(async (id: number) => {
    if (!window.confirm('确定要删除这条纠正记录吗？')) return;
    try {
      const response = await api.nlp.deleteCorrection(id);
      if (response) {
        showToast('success', '删除成功');
        fetchCorrections();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      showToast('error', '删除失败');
    }
  }, [fetchCorrections, showToast]);

  return (
    <div className="space-y-6">
      {loadError && (
        <div className='flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>算法/分析数据加载失败，部分功能可能不可用，请刷新重试</p>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">智能评分规则管理</h1>
            <p className="text-sm text-gray-500">基于自然语言处理的智能评分系统</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'parse', label: '智能解析', icon: Sparkles },
          { key: 'rules', label: '规则管理', icon: BookOpen },
          { key: 'training', label: '模型训练', icon: Train },
          { key: 'statistics', label: '统计分析', icon: BarChart3 },
          { key: 'analysis', label: '算法分析', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'parse' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              自然语言输入
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && parseText()}
                placeholder="输入自然语言文本，如：张三上课睡觉扣分、李四上课积极回答问题"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <PermissionButton
                permission='score.entry'
                onClick={parseText}
                disabled={isParsing}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isParsing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                解析
              </PermissionButton>
            </div>
          </div>

          {parseResult && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                解析结果
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">提取姓名</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {parseResult.extracted_name || '未识别'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">行为描述</p>
                  <p className="text-lg font-semibold text-gray-800">{parseResult.behavior}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">评分意图</p>
                  <p className={`text-lg font-semibold ${
                    parseResult.intent === 'add' ? 'text-green-600' :
                    parseResult.intent === 'deduct' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {parseResult.intent === 'add' ? '加分' :
                     parseResult.intent === 'deduct' ? '扣分' : '未知'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">置信度</p>
                  <p className="text-lg font-semibold text-blue-600">{parseResult.confidence * 100}%</p>
                </div>
              </div>

              {parseResult.matched_rules.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-3">匹配规则 {parseResult.matched_rules.length > 1 && <span className="text-xs text-gray-400">(请选择一条)</span>}</h3>
                  <div className="space-y-3">
                    {parseResult.matched_rules.map((rule, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedRuleId(rule.rule_id || index)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          (rule.rule_id === selectedRuleId || (selectedRuleId === null && index === 0))
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                            : rule.score_type === 'add'
                              ? 'border-green-200 bg-green-50 hover:border-green-300'
                              : 'border-red-200 bg-red-50 hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selectedRule"
                            checked={rule.rule_id === selectedRuleId || (selectedRuleId === null && index === 0)}
                            onChange={() => setSelectedRuleId(rule.rule_id || index)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{rule.behavior_description}</p>
                            <p className="text-sm text-gray-500">关键词: {rule.behavior_keyword}</p>
                          </div>
                          <span className={`text-xl font-bold ${
                            rule.score_type === 'add' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {rule.score_type === 'add' ? '+' : ''}{rule.score_value}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 ml-7">
                          <span>使用次数: {rule.usage_count}</span>
                          <span>准确率: {rule.accuracy_rate != null ? `${(rule.accuracy_rate * 100).toFixed(1)}%` : '--'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const genericSuggestions = (parseResult.suggestions || []).filter(
                  (s) => typeof s?.rule_id !== 'number'
                );
                const similarSuggestions = (parseResult.suggestions || []).filter(
                  (s): s is NonNullable<typeof s> & { rule_id: number } =>
                    typeof s?.rule_id === 'number'
                );
                const hasAny = genericSuggestions.length > 0 || similarSuggestions.length > 0;
                if (!hasAny) return null;
                return (
                  <div className="mb-6">
                    {genericSuggestions.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-600 mb-3">建议</h3>
                        <div className="space-y-2">
                          {genericSuggestions.map((suggestion, index) => (
                            <div
                              key={`g-${index}`}
                              className="p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                            >
                              <p className="text-gray-700">{suggestion.description}</p>
                              <p className="text-sm text-yellow-700">
                                建议{suggestion.intent === 'add' ? '加' : '扣'}分: {suggestion.score_value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {similarSuggestions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-3">
                          相似规则推荐
                          <span className="ml-2 text-xs text-gray-400">
                            （点击「一键应用」可直接套用扣分）
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {similarSuggestions.map((suggestion, index) => (
                            <div
                              key={`s-${index}`}
                              className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-800 truncate">
                                    {suggestion.description}
                                  </span>
                                  {typeof suggestion.similarity === 'number' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                      相似度 {(suggestion.similarity * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  规则 #{suggestion.rule_id} · 建议
                                  {suggestion.intent === 'add' ? '加' : '扣'}分 {suggestion.score_value}
                                </p>
                              </div>
                              <PermissionButton
                                permission="score.entry"
                                size="small"
                                type="primary"
                                onClick={() => applySuggestionAsRule(suggestion)}
                                className="!px-3 !py-1 shrink-0"
                              >
                                一键应用
                              </PermissionButton>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {suggestedRules.length > 0 && !parseResult.matched_rules.length && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-3">相似规则推荐（库内匹配）</h3>
                  <div className="space-y-2">
                    {suggestedRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300"
                        onClick={() => {
                          setManualCorrection({
                            intent: rule.score_type,
                            score_value: rule.score_value,
                            behavior_tags: rule.behavior_tags,
                            behavior_description: rule.behavior_description,
                            feedback_note: '',
                          });
                          setShowCorrectionModal(true);
                        }}
                      >
                        <p className="font-medium text-gray-800">{rule.behavior_description}</p>
                        <p className="text-sm text-gray-500">
                          关键词: {rule.behavior_keyword} | 分数: {rule.score_type === 'add' ? '+' : ''}{rule.score_value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {parseResult.success && parseResult.matched_rules.length > 0 && (
                  <PermissionButton
                    permission='score.entry'
                    onClick={executeScoring}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    确认评分
                  </PermissionButton>
                )}
                <PermissionButton
                  permission='score.entry'
                  onClick={() => {
                    setManualCorrection({
                      intent: parseResult.intent === 'unknown' ? 'add' : parseResult.intent,
                      score_value: parseResult.matched_rules[0]?.score_value || 5,
                      behavior_tags: [],
                      behavior_description: parseResult.behavior,
                      feedback_note: '',
                    });
                    setShowCorrectionModal(true);
                  }}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Edit2 className="w-5 h-5" />
                  手动修正
                </PermissionButton>
                <button
                  onClick={() => {
                    setShowCorrectionList(!showCorrectionList);
                    if (!showCorrectionList) {
                      setCorrectionsPage(1);
                      fetchCorrections();
                    }
                  }}
                  className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                    showCorrectionList
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                >
                  <Brain className="w-5 h-5" />
                  纠正记录
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">规则列表</h2>
              <div className="flex gap-2">
                <PermissionButton
                  permission='rule.manage'
                  onClick={() => setShowBatchImportModal(true)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  批量导入
                </PermissionButton>
                <PermissionButton
                  permission='rule.manage'
                  onClick={() => {
                    setEditingRule(null);
                    setNewRule({
                      behavior_keyword: '',
                      behavior_description: '',
                      score_value: 5,
                      score_type: 'add',
                      behavior_tags: '',
                      match_pattern: '',
                      priority: 0,
                    });
                    setShowRuleForm(true);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加规则
                </PermissionButton>
              </div>
            </div>
            
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => {
                  setKeywordFilter(e.target.value);
                  setRulePage(1);
                }}
                placeholder="搜索关键词"
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={scoreTypeFilter}
                onChange={(e) => {
                  setScoreTypeFilter(e.target.value);
                  setRulePage(1);
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部类型</option>
                <option value="add">加分规则</option>
                <option value="deduct">扣分规则</option>
              </select>
            </div>

            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">关键词</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">分数</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">类型</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">标签</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">使用次数</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">准确率</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{rule.behavior_keyword}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rule.behavior_description}</td>
                        <td className={`px-4 py-3 text-sm font-semibold ${
                          rule.score_type === 'add' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {rule.score_type === 'add' ? '+' : ''}{rule.score_value}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            rule.score_type === 'add' ? 'bg-green-100 text-green-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {rule.score_type === 'add' ? '加分' : '扣分'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {rule.behavior_tags.map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs mr-1">
                              {tag}
                            </span>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rule.usage_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {rule.accuracy_rate != null ? `${(rule.accuracy_rate * 100).toFixed(1)}%` : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <PermissionButton
                              permission='rule.manage'
                              onClick={() => openEditModal(rule)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Edit2 className="w-4 h-4" />
                            </PermissionButton>
                            <PermissionButton
                              permission='rule.manage'
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </PermissionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ruleTotal > 20 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setRulePage(Math.max(1, rulePage - 1))}
                  disabled={rulePage === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-600">
                  第 {rulePage} 页 / 共 {Math.ceil(ruleTotal / 20)} 页
                </span>
                <button
                  onClick={() => setRulePage(Math.min(Math.ceil(ruleTotal / 20), rulePage + 1))}
                  disabled={rulePage >= Math.ceil(ruleTotal / 20)}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'training' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">模型训练</h2>
              <div className="flex gap-3">
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={handleEvaluateAllModels}
                  disabled={isEvaluatingAll}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isEvaluatingAll ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      评估中...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4" />
                      评估所有算法
                    </>
                  )}
                </PermissionButton>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={handleTrainAllModels}
                  disabled={isTraining}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isTraining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      训练中...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      自动选择最佳算法
                    </>
                  )}
                </PermissionButton>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={handleTrainModel}
                  disabled={isTraining}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isTraining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      训练中...
                    </>
                  ) : (
                    <>
                      <Train className="w-4 h-4" />
                      开始训练
                    </>
                  )}
                </PermissionButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择算法
                </label>
                <select
                  value={selectedAlgorithm}
                  onChange={(e) => setSelectedAlgorithm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">自动选择</option>
                  {algorithms.map((algo) => (
                    <option key={algo.value} value={algo.value}>
                      {algo.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCrossValidation}
                    onChange={(e) => setUseCrossValidation(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-gray-700">使用交叉验证</span>
                </label>
              </div>
            </div>

            {modelEvaluation && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 mb-1">准确率</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {modelEvaluation.accuracy_rate != null ? `${(modelEvaluation.accuracy_rate * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 mb-1">精确率</p>
                  <p className="text-2xl font-bold text-green-700">
                    {modelEvaluation.precision != null ? `${(modelEvaluation.precision * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-600 mb-1">召回率</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {modelEvaluation.recall != null ? `${(modelEvaluation.recall * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 mb-1">F1分数</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {modelEvaluation.f1_score != null ? `${(modelEvaluation.f1_score * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
              </div>
            )}

            {trainingResult && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h3 className="text-sm font-medium text-green-700 mb-2">训练结果</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">算法</p>
                    <p className="font-medium text-gray-800">{trainingResult.algorithm_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">训练数据量</p>
                    <p className="font-medium text-gray-800">{trainingResult.training_data_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">准确率</p>
                    <p className="font-medium text-blue-600">{(trainingResult.evaluation.accuracy * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">F1分数</p>
                    <p className="font-medium text-purple-600">{(trainingResult.evaluation.f1_score * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            {(trainAllResult || evaluationAllResult) && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">算法对比</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 border">算法</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 border">准确率</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 border">精确率</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 border">召回率</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 border">F1分数</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 border">交叉验证F1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(trainAllResult?.results || evaluationAllResult?.results || []).map((result) => (
                        <tr key={result.algorithm} className={trainAllResult?.best_algorithm === result.algorithm ? 'bg-green-50' : ''}>
                          <td className="px-4 py-2 border">
                            <span className="font-medium">{result.algorithm_name}</span>
                            {trainAllResult?.best_algorithm === result.algorithm && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">最佳</span>
                            )}
                          </td>
                          <td className="px-4 py-2 border text-right">{result.evaluation ? `${(result.evaluation.accuracy * 100).toFixed(1)}%` : '-'}</td>
                          <td className="px-4 py-2 border text-right">{result.evaluation ? `${(result.evaluation.precision * 100).toFixed(1)}%` : '-'}</td>
                          <td className="px-4 py-2 border text-right">{result.evaluation ? `${(result.evaluation.recall * 100).toFixed(1)}%` : '-'}</td>
                          <td className="px-4 py-2 border text-right font-medium">{result.evaluation ? `${(result.evaluation.f1_score * 100).toFixed(1)}%` : '-'}</td>
                          <td className="px-4 py-2 border text-right">
                            {result.cross_validation ? `${(result.cross_validation.mean_f1 * 100).toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" />
              训练历史
            </h3>
            <div className="space-y-3">
              {trainingHistory.map((record) => (
                <div key={record.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{record.training_version}</span>
                    <div className="flex items-center gap-2">
                      {record.algorithm_type && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
                          {record.algorithm_type.startsWith('auto_') ? record.algorithm_type.replace('auto_', '') : record.algorithm_type}
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs ${
                        record.training_status === 'completed' ? 'bg-green-100 text-green-600' :
                        record.training_status === 'failed' ? 'bg-red-100 text-red-600' :
                        record.training_status ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {record.training_status === 'completed' ? '已完成' :
                         record.training_status === 'failed' ? '失败' :
                         record.training_status ? '进行中' : '未知'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>数据量: {record.training_data_size ?? '--'}</span>
                    <span>准确率: {record.accuracy != null ? `${(record.accuracy * 100).toFixed(1)}%` : 'N/A'}</span>
                    <span>F1: {record.f1_score != null ? (record.f1_score * 100).toFixed(1) + '%' : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statistics && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">规则总数</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics.total_rules}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">加分规则</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.add_rules}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">扣分规则</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.deduct_rules}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">总使用次数</p>
                  <p className="text-2xl font-bold text-blue-600">{statistics.total_usage}</p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-4">高频规则</h3>
              <div className="space-y-3">
                {statistics?.high_usage_rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{rule.behavior_description}</p>
                      <p className="text-sm text-gray-500">关键词: {rule.behavior_keyword}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">使用次数</p>
                      <p className="text-xl font-bold text-blue-600">{rule.usage_count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-4">模型性能指标</h3>
              {modelEvaluation && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">准确率</span>
                      <span className="font-medium">{(modelEvaluation.accuracy_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${modelEvaluation.accuracy_rate * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">精确率</span>
                      <span className="font-medium">{(modelEvaluation.precision * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${modelEvaluation.precision * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">召回率</span>
                      <span className="font-medium">{(modelEvaluation.recall * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${modelEvaluation.recall * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">F1分数</span>
                      <span className="font-medium">{(modelEvaluation.f1_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${modelEvaluation.f1_score * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      样本总数: {modelEvaluation.total_samples} |
                      正确: {modelEvaluation.correct_count} |
                      错误: {modelEvaluation.incorrect_count}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {isLoadingAnalysis ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* 操作按钮 */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={fetchAnalysisData}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新数据
                </button>
                <button
                  onClick={runBenchmark}
                  disabled={isBenchmarking}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  {isBenchmarking ? '测试中...' : '运行基准测试'}
                </button>
                <button
                  onClick={resetAnalysisMetrics}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  <RefreshCw className="w-4 h-4" />
                  重置指标
                </button>
              </div>

              {/* 性能概览 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">意图识别准确率</p>
                  <p className={`text-2xl font-bold ${
                    intentAnalysis?.summary?.accuracy == null ? 'text-gray-400'
                    : intentAnalysis.summary.accuracy >= 0.9 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {intentAnalysis?.summary?.accuracy != null ? `${(intentAnalysis.summary.accuracy * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">缓存命中率</p>
                  <p className={`text-2xl font-bold ${
                    performanceAnalysis?.summary?.cache_hit_rate == null ? 'text-gray-400'
                    : performanceAnalysis.summary.cache_hit_rate >= 0.6 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {performanceAnalysis?.summary?.cache_hit_rate != null ? `${(performanceAnalysis.summary.cache_hit_rate * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">总请求数</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {performanceAnalysis?.summary?.total_requests ?? '--'}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">平均响应时间</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {performanceAnalysis?.summary?.avg_processing_time != null ? `${performanceAnalysis.summary.avg_processing_time.toFixed(2)}ms` : '--'}
                  </p>
                </div>
              </div>

              {/* 优化策略配置 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-4">优化策略</h3>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { value: 'accuracy_first', label: '准确性优先', desc: '适合对准确性要求高的场景' },
                    { value: 'balanced', label: '平衡模式', desc: '准确性和速度兼顾' },
                    { value: 'speed_first', label: '速度优先', desc: '适合高并发场景' },
                  ].map((strategy) => (
                    <button
                      key={strategy.value}
                      onClick={() => updateOptimizationStrategy(strategy.value)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedStrategy === strategy.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-medium text-gray-800">{strategy.label}</p>
                      <p className="text-sm text-gray-500">{strategy.desc}</p>
                    </button>
                  ))}
                </div>
                {optimizerConfig && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      当前配置: TF-IDF特征数={optimizerConfig.intent_classifier?.tfidf_max_features}, 
                      N-gram范围=(1, {optimizerConfig.intent_classifier?.tfidf_ngram_range?.[1] || 4}), 
                      缓存TTL={optimizerConfig.performance?.cache_ttl}s
                    </p>
                  </div>
                )}
              </div>

              {/* 意图识别分析 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-4">意图识别分析</h3>
                <div className="space-y-4">
                  {intentAnalysis?.intent_breakdown && Object.entries(intentAnalysis.intent_breakdown).map(([intent, stats]: [string, any]) => (
                    <div key={intent} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          intent === 'add' ? 'bg-green-100 text-green-600' :
                          intent === 'deduct' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {intent === 'add' ? '加分' : intent === 'deduct' ? '扣分' : intent === 'query' ? '查询' : intent === 'reset' ? '重置' : '未知'}
                        </span>
                        <span className="text-sm text-gray-500">
                          准确率: {stats.accuracy != null ? `${(stats.accuracy * 100).toFixed(1)}%` : '--'} ({stats.correct ?? '--'}/{stats.total ?? '--'})
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            stats.accuracy == null ? 'bg-gray-300'
                            : stats.accuracy >= 0.9 ? 'bg-green-500' : stats.accuracy >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: stats.accuracy != null ? `${Math.min(stats.accuracy * 100, 100)}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 组件性能分析 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-4">组件性能</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">组件</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">调用次数</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">平均耗时</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">错误率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceAnalysis?.components && Object.entries(performanceAnalysis.components).map(([name, stats]: [string, any]) => (
                        <tr key={name} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{name}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{stats.calls ?? '--'}</td>
                          <td className={`px-4 py-3 text-sm text-right ${
                            stats.avg_time != null && stats.avg_time > 0.1 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {stats.avg_time != null ? `${(stats.avg_time * 1000).toFixed(2)}ms` : '--'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right ${
                            stats.error_rate != null && stats.error_rate > 0.05 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {stats.error_rate != null ? `${(stats.error_rate * 100).toFixed(2)}%` : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 基准测试结果 */}
              {benchmarkResults && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-4">基准测试结果</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600 mb-1">平均延迟</p>
                      <p className="text-xl font-bold text-blue-700">{benchmarkResults.avg_latency?.toFixed(2)}ms</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600 mb-1">P95延迟</p>
                      <p className="text-xl font-bold text-green-700">{benchmarkResults.p95_latency?.toFixed(2)}ms</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600 mb-1">平均准确率</p>
                      <p className="text-xl font-bold text-purple-700">{(benchmarkResults.avg_accuracy * 100).toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-600 mb-1">吞吐量</p>
                      <p className="text-xl font-bold text-yellow-700">{benchmarkResults.throughput?.toFixed(1)}/s</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 优化建议 */}
              {optimizationSuggestions.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-4">优化建议</h3>
                  <div className="space-y-3">
                    {optimizationSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${
                          suggestion.priority === 'high' ? 'bg-red-50 border-red-500' :
                          suggestion.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                          'bg-blue-50 border-blue-500'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                            suggestion.priority === 'high' ? 'text-red-500' :
                            suggestion.priority === 'medium' ? 'text-yellow-500' :
                            'text-blue-500'
                          }`} />
                          <div>
                            <p className="font-medium text-gray-800">{suggestion.issue}</p>
                            <ul className="mt-2 space-y-1 text-sm text-gray-600">
                              {suggestion.suggestions.map((s: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-gray-400">•</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 慢请求记录 */}
              {performanceAnalysis?.slow_requests?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-4">最近慢请求</h3>
                  <div className="space-y-2">
                    {performanceAnalysis.slow_requests.slice(0, 5).map((req: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">{req.timestamp}</span>
                        <span className="text-sm font-medium text-red-600">
                          {(req.processing_time * 1000).toFixed(2)}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">手动修正</h3>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">原输入文本</p>
                <p className="p-3 bg-gray-50 rounded-lg text-gray-700">{inputText}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">评分意图</label>
                <div className="flex gap-2">
                  {[
                    { value: 'add', label: '加分', icon: ThumbsUp },
                    { value: 'deduct', label: '扣分', icon: ThumbsDown },
                    { value: 'other', label: '其他', icon: AlertTriangle },
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setManualCorrection({ ...manualCorrection, intent: option.value })}
                        className={`flex-1 px-4 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                          manualCorrection.intent === option.value
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分数值</label>
                <input
                  type="number"
                  value={manualCorrection.score_value}
                  onChange={(e) => setManualCorrection({ ...manualCorrection, score_value: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">行为标签</label>
                <input
                  type="text"
                  value={manualCorrection.behavior_tags.join(',')}
                  onChange={(e) => setManualCorrection({ ...manualCorrection, behavior_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  placeholder="多个标签用逗号分隔"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">行为描述</label>
                <textarea
                  value={manualCorrection.behavior_description}
                  onChange={(e) => setManualCorrection({ ...manualCorrection, behavior_description: e.target.value })}
                  placeholder="描述学生行为"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">反馈备注</label>
                <textarea
                  value={manualCorrection.feedback_note}
                  onChange={(e) => setManualCorrection({ ...manualCorrection, feedback_note: e.target.value })}
                  placeholder="可选：添加反馈备注"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <PermissionButton
                permission='score.entry'
                onClick={handleRecordFeedback}
                disabled={isSubmittingFeedback}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Brain className="w-4 h-4" />
                {isSubmittingFeedback ? '反馈中...' : '反馈并学习'}
              </PermissionButton>
              <PermissionButton
                permission='score.entry'
                onClick={handleManualExecute}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存并执行
              </PermissionButton>
            </div>
          </div>
        </div>
      )}

      {showRuleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingRule ? '编辑规则' : '添加规则'}
              </h3>
              <button
                onClick={() => {
                  setShowRuleForm(false);
                  setEditingRule(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">行为关键词 *</label>
                <input
                  type="text"
                  value={newRule.behavior_keyword}
                  onChange={(e) => setNewRule({ ...newRule, behavior_keyword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">行为描述</label>
                <textarea
                  value={newRule.behavior_description}
                  onChange={(e) => setNewRule({ ...newRule, behavior_description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">分数值 *</label>
                  <input
                    type="number"
                    value={newRule.score_value}
                    onChange={(e) => setNewRule({ ...newRule, score_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">评分类型 *</label>
                  <select
                    value={newRule.score_type}
                    onChange={(e) => setNewRule({ ...newRule, score_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="add">加分</option>
                    <option value="deduct">扣分</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">行为标签</label>
                <input
                  type="text"
                  value={newRule.behavior_tags}
                  onChange={(e) => setNewRule({ ...newRule, behavior_tags: e.target.value })}
                  placeholder="多个标签用逗号分隔"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">匹配模式</label>
                  <input
                    type="text"
                    value={newRule.match_pattern}
                    onChange={(e) => setNewRule({ ...newRule, match_pattern: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">优先级</label>
                  <input
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRuleForm(false);
                  setEditingRule(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={editingRule ? handleEditRule : handleCreateRule}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingRule ? '保存修改' : '创建规则'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">批量导入规则</h3>
              <button
                onClick={() => {
                  setShowBatchImportModal(false);
                  setImportFile(null);
                  setImportJsonText('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  可以通过上传JSON文件或直接输入JSON数据来批量导入规则。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  上传JSON文件
                </label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-400 cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportJsonText('');
                    }}
                    className="hidden"
                    id="import-file"
                  />
                  <label htmlFor="import-file" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">点击或拖拽上传文件</p>
                    {importFile && (
                      <p className="text-sm text-blue-600 mt-1">{importFile.name}</p>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-center py-2">
                <span className="text-gray-400 text-sm">或</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    直接输入JSON数据
                  </label>
                  <button
                    onClick={handleDownloadTemplate}
                    className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    下载模板
                  </button>
                </div>
                <textarea
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    setImportFile(null);
                  }}
                  placeholder='[{"behavior_keyword": "关键词", "behavior_description": "描述", "score_value": 5, "score_type": "add", "behavior_tags": ["标签"], "match_pattern": "", "priority": 1}]'
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBatchImportModal(false);
                  setImportFile(null);
                  setImportJsonText('');
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleBatchImport}
                disabled={isImporting}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    开始导入
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrectionList && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              纠正记录（自学习）
            </h3>
            <select
              value={correctionStatusFilter}
              onChange={(e) => {
                setCorrectionStatusFilter(e.target.value);
                setCorrectionsPage(1);
                fetchCorrections();
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="pending">待验证</option>
              <option value="verified">已验证</option>
              <option value="learned">已学习</option>
              <option value="rejected">已拒绝</option>
            </select>
          </div>

          {correctionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">原文</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">字段</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">原值</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">纠正值</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">学习次数</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((correction) => (
                    <tr key={correction.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate" title={correction.original_text}>
                        {correction.original_text}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          correction.field_type === 'name' ? 'bg-blue-100 text-blue-600' :
                          correction.field_type === 'intent' ? 'bg-green-100 text-green-600' :
                          correction.field_type === 'score' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {correction.field_type === 'name' ? '姓名' :
                           correction.field_type === 'intent' ? '意图' :
                           correction.field_type === 'score' ? '分数' : correction.field_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{correction.original_value || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">{correction.corrected_value || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          correction.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                          correction.status === 'verified' ? 'bg-green-100 text-green-600' :
                          correction.status === 'learned' ? 'bg-purple-100 text-purple-600' :
                          correction.status === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {correction.status === 'pending' ? '待验证' :
                           correction.status === 'verified' ? '已验证' :
                           correction.status === 'learned' ? '已学习' :
                           correction.status === 'rejected' ? '已拒绝' : correction.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{correction.learn_count || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {correction.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateCorrection(correction.id, 'verified')}
                              className="text-green-500 hover:text-green-700"
                              title="验证"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {correction.status === 'verified' && (
                            <button
                              onClick={() => handleUpdateCorrection(correction.id, 'learned')}
                              className="text-purple-500 hover:text-purple-700"
                              title="标记已学习"
                            >
                              <Brain className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCorrection(correction.id)}
                            className="text-red-500 hover:text-red-700"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {correctionTotal > 20 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setCorrectionsPage(Math.max(1, correctionsPage - 1))}
                disabled={correctionsPage === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {correctionsPage} 页 / 共 {Math.ceil(correctionTotal / 20)} 页
              </span>
              <button
                onClick={() => setCorrectionsPage(Math.min(Math.ceil(correctionTotal / 20), correctionsPage + 1))}
                disabled={correctionsPage >= Math.ceil(correctionTotal / 20)}
                className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NLPScoringManagement;
