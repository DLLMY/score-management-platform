import logger from '../utils/logger';
import { downloadTextAsFile } from '../utils/download';
/**
 * 智能评分规则管理（NLPManagement）
 * 主壳：状态 + 数据加载器 + 列定义 + Tab/模态/列表分发。
 * 各 Tab / 模态 / 列表渲染逻辑已抽到 ./nlp-management/ 子模块，
 * 通过单一 NLPDeps 对象透传，行为与原闭包完全一致（T12 拆分）。
 */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sparkles, BookOpen, Train, BarChart3, Brain, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import type { ColumnType } from '../components/data-display/DataTable';
import type {
  ParseResult,
  ManualCorrectionData,
  Rule,
  Statistics,
  ModelEvaluation,
  TrainingRecord,
  MLAlgorithm,
  MLTrainingResult,
  MLTrainAllResult,
  MLEvaluationAllResult,
  MLAlgorithmResult,
  NlpAnalysisData,
  NlpSuggestion,
  NlpOptimizerConfig,
  NlpBenchmarkResult,
  NlpCorrection,
  TabType,
  NewRuleForm,
  PerformanceRow,
} from './nlp-management/types';
import type { NLPDeps } from './nlp-management/types';
import { ParseTab } from './nlp-management/ParseTab';
import { RulesTab } from './nlp-management/RulesTab';
import { TrainingTab } from './nlp-management/TrainingTab';
import { StatisticsTab } from './nlp-management/StatisticsTab';
import { AnalysisTab } from './nlp-management/AnalysisTab';
import { CorrectionModal } from './nlp-management/CorrectionModal';
import { RuleFormModal } from './nlp-management/RuleFormModal';
import { BatchImportModal } from './nlp-management/BatchImportModal';
import { CorrectionsList } from './nlp-management/CorrectionsList';

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
  const [newRule, setNewRule] = useState<NewRuleForm>({
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
  const [evaluationAllResult, setEvaluationAllResult] = useState<MLEvaluationAllResult | null>(
    null
  );
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);

  // 算法分析相关状态
  const [intentAnalysis, setIntentAnalysis] = useState<NlpAnalysisData | null>(null);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<NlpAnalysisData | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<NlpSuggestion[]>([]);
  const [optimizerConfig, setOptimizerConfig] = useState<NlpOptimizerConfig | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<NlpBenchmarkResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('balanced');

  // 自学习反馈相关状态
  const [corrections, setCorrections] = useState<NlpCorrection[]>([]);
  const [correctionsPage, setCorrectionsPage] = useState(1);
  const [correctionTotal, setCorrectionTotal] = useState(0);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showCorrectionList, setShowCorrectionList] = useState(false);
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState('');

  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

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
      const selectedRule =
        parseResult.matched_rules.find((r) => r.rule_id === selectedRuleId) ||
        parseResult.matched_rules[0];
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
        const resp = response as { results?: Array<{ success?: boolean }> };
        const okCount = Array.isArray(resp.results)
          ? resp.results.filter((r) => r && r.success).length
          : 0;
        showToast(
          'success',
          Array.isArray(resp.results) && resp.results.length
            ? `成功评分 ${okCount} 条指令`
            : '评分成功'
        );
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
          const resp = response as { results?: Array<{ success?: boolean }> };
          const okCount = Array.isArray(resp.results)
            ? resp.results.filter((r) => r && r.success).length
            : 0;
          showToast(
            'success',
            Array.isArray(resp.results) && resp.results.length
              ? `成功评分 ${okCount} 条指令（相似规则 #${suggestion.rule_id}）`
              : `已应用相似规则 #${suggestion.rule_id}`
          );
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
        const resp = response as { results?: Array<{ success?: boolean }> };
        const okCount = Array.isArray(resp.results)
          ? resp.results.filter((r) => r && r.success).length
          : 0;
        showToast(
          'success',
          Array.isArray(resp.results) && resp.results.length
            ? `成功评分 ${okCount} 条指令`
            : '评分成功'
        );
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
    // M3: 规则必填与数值边界校验
    if (!newRule.behavior_keyword.trim()) {
      showToast('warning', '行为关键词不能为空');
      return;
    }
    if (!newRule.behavior_description.trim()) {
      showToast('warning', '行为描述不能为空');
      return;
    }
    const sv = Number(newRule.score_value);
    if (!sv || isNaN(sv) || Math.abs(sv) > 100) {
      showToast('warning', '分值需为 1-100 之间的数值（扣分为负）');
      return;
    }
    try {
      const response = await api.nlp.createRule({
        ...newRule,
        behavior_tags: newRule.behavior_tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
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
        behavior_tags: newRule.behavior_tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
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

  const handleDeleteRule = useCallback(
    async (ruleId: number) => {
      const ok = await confirmRef.current({
        title: '删除规则',
        message: '确定要删除这个规则吗？',
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;

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
    },
    [showToast]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrainModel = useCallback(async () => {
    // #912 实机修复：未选算法时后端 train(None) 会走 train_all 全量训练（万级样本
    // + 全算法含深度学习，10 分钟级），且与「训练全部模型」入口语义重复。
    // 这里明确拦截，避免用户误触超重负载。
    if (!selectedAlgorithm) {
      showToast('warning', '请先选择算法，或使用「训练全部模型」');
      return;
    }
    setIsTraining(true);
    setTrainingResult(null);
    try {
      const response = await api.nlp.trainModel({
        trained_by: 1,
        algorithm: selectedAlgorithm,
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
        showToast(
          'success',
          `成功导入 ${response.imported_count} 条规则，跳过 ${response.skipped_count} 条重复规则`
        );
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
    downloadTextAsFile(JSON.stringify(template, null, 2), 'nlp_rules_template.json', 'application/json');
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
        api.nlp.getAnalysisIntent(),
        api.nlp.getAnalysisPerformance(),
        api.nlp.getAnalysisSuggestions(),
        api.nlp.getOptimizationConfig(),
      ]);

      if (intentRes.code === 0) setIntentAnalysis(intentRes.data);
      if (perfRes.code === 0) setPerformanceAnalysis(perfRes.data);
      if (suggestionsRes.code === 0) setOptimizationSuggestions((suggestionsRes.data as unknown[]) ?? []);
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
      const response = await api.nlp.benchmarkIntentClassifier({ iterations: 10 });
      if (response) {
        setBenchmarkResults(response as NlpBenchmarkResult);
        showToast('success', '基准测试完成');
      }
    } catch (error) {
      showToast('error', '基准测试失败');
    } finally {
      setIsBenchmarking(false);
    }
  }, [showToast]);

  // 更新优化策略
  const updateOptimizationStrategy = useCallback(
    async (strategy: string) => {
      try {
        const response = await api.nlp.setOptimizationConfig({ strategy });
        if (response) {
          setOptimizerConfig(response as NlpOptimizerConfig);
          setSelectedStrategy(strategy);
          showToast('success', '优化策略已更新');
          fetchAnalysisData();
        }
      } catch (error) {
        showToast('error', '更新优化策略失败');
      }
    },
    [fetchAnalysisData, showToast]
  );

  // 重置分析指标
  const resetAnalysisMetrics = useCallback(async () => {
    try {
      const response = await api.nlp.resetAnalysis();
      if (response) {
        showToast('success', '指标已重置');
        fetchAnalysisData();
      }
    } catch (error) {
      showToast('error', '重置失败');
    }
  }, [fetchAnalysisData, showToast]);

  // 获取纠正记录列表
  const fetchCorrections = useCallback(async (page?: number) => {
    setCorrectionsLoading(true);
    try {
      const response = await api.nlp.getCorrections({
        page: page ?? correctionsPage,
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
        corrected_name:
          manualCorrection.intent !== parseResult.intent
            ? manualCorrection.behavior_description
            : undefined,
        corrected_intent:
          manualCorrection.intent !== parseResult.intent ? manualCorrection.intent : undefined,
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
  const handleUpdateCorrection = useCallback(
    async (id: number, status: string) => {
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
    },
    [fetchCorrections, showToast]
  );

  // 删除纠正记录
  const handleDeleteCorrection = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除纠正记录',
        message: '确定要删除这条纠正记录吗？',
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
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
    },
    [fetchCorrections, showToast]
  );

  // —— 规则表格列定义 ——
  const ruleColumns = useMemo<ColumnType<Rule>[]>(
    () => [
      {
        title: '关键词',
        key: 'behavior_keyword',
        dataIndex: 'behavior_keyword',
        render: (value) => (
          <span className='text-sm font-medium text-gray-800'>{String(value ?? '')}</span>
        ),
      },
      {
        title: '描述',
        key: 'behavior_description',
        dataIndex: 'behavior_description',
        render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '')}</span>,
      },
      {
        title: '分数',
        key: 'score_value',
        dataIndex: 'score_value',
        render: (_, rule) => (
          <span
            className={`text-sm font-semibold ${
              rule.score_type === 'add' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {rule.score_type === 'add' ? '+' : ''}
            {rule.score_value}
          </span>
        ),
      },
      {
        title: '类型',
        key: 'score_type',
        dataIndex: 'score_type',
        render: (value) => {
          const scoreType = String(value ?? '');
          return (
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                scoreType === 'add' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}
            >
              {scoreType === 'add' ? '加分' : '扣分'}
            </span>
          );
        },
      },
      {
        title: '标签',
        key: 'behavior_tags',
        dataIndex: 'behavior_tags',
        render: (value) => (
          <>
            {(value as string[])?.map((tag, i) => (
              <span key={i} className='px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs mr-1'>
                {tag}
              </span>
            ))}
          </>
        ),
      },
      {
        title: '使用次数',
        key: 'usage_count',
        dataIndex: 'usage_count',
        render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '')}</span>,
      },
      {
        title: '准确率',
        key: 'accuracy_rate',
        dataIndex: 'accuracy_rate',
        render: (value) => (
          <span className='text-sm text-gray-600'>
            {value != null ? `${(Number(value) * 100).toFixed(1)}%` : '--'}
          </span>
        ),
      },
    ],
    []
  );

  // —— 训练对比表格列定义 ——
  const trainingResultColumns = useMemo<ColumnType<MLAlgorithmResult>[]>(
    () => [
      {
        title: '算法',
        key: 'algorithm',
        dataIndex: 'algorithm_name',
        render: (value, result) => (
          <>
            <span className='font-medium'>{String(value)}</span>
            {trainAllResult?.best_algorithm === result.algorithm && (
              <span className='ml-2 px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded'>
                最佳
              </span>
            )}
          </>
        ),
      },
      {
        title: '准确率',
        key: 'accuracy',
        align: 'right',
        render: (_, result) => (
          <span>{result.evaluation ? `${(result.evaluation.accuracy * 100).toFixed(1)}%` : '-'}</span>
        ),
      },
      {
        title: '精确率',
        key: 'precision',
        align: 'right',
        render: (_, result) => (
          <span>
            {result.evaluation ? `${(result.evaluation.precision * 100).toFixed(1)}%` : '-'}
          </span>
        ),
      },
      {
        title: '召回率',
        key: 'recall',
        align: 'right',
        render: (_, result) => (
          <span>{result.evaluation ? `${(result.evaluation.recall * 100).toFixed(1)}%` : '-'}</span>
        ),
      },
      {
        title: 'F1分数',
        key: 'f1_score',
        align: 'right',
        render: (_, result) => (
          <span className='font-medium'>
            {result.evaluation ? `${(result.evaluation.f1_score * 100).toFixed(1)}%` : '-'}
          </span>
        ),
      },
      {
        title: '交叉验证F1',
        key: 'cross_validation',
        align: 'right',
        render: (_, result) => (
          <span>
            {result.cross_validation ? `${(result.cross_validation.mean_f1 * 100).toFixed(1)}%` : '-'}
          </span>
        ),
      },
    ],
    [trainAllResult]
  );

  // —— 组件性能表格列定义 ——
  const performanceColumns = useMemo<ColumnType<PerformanceRow>[]>(
    () => [
      {
        title: '组件',
        key: 'name',
        dataIndex: 'name',
        render: (value) => <span className='text-sm font-medium text-gray-800'>{String(value)}</span>,
      },
      {
        title: '调用次数',
        key: 'calls',
        align: 'right',
        render: (_, record) => (
          <span className='text-sm text-gray-600'>{record.stats.calls ?? '--'}</span>
        ),
      },
      {
        title: '平均耗时',
        key: 'avg_time',
        align: 'right',
        render: (_, record) => (
          <span
            className={`text-sm ${
              record.stats.avg_time != null && record.stats.avg_time > 0.1
                ? 'text-red-600'
                : 'text-gray-600'
            }`}
          >
            {record.stats.avg_time != null ? `${(record.stats.avg_time * 1000).toFixed(2)}ms` : '--'}
          </span>
        ),
      },
      {
        title: '错误率',
        key: 'error_rate',
        align: 'right',
        render: (_, record) => (
          <span
            className={`text-sm ${
              record.stats.error_rate != null && record.stats.error_rate > 0.05
                ? 'text-red-600'
                : 'text-gray-600'
            }`}
          >
            {record.stats.error_rate != null
              ? `${(record.stats.error_rate * 100).toFixed(2)}%`
              : '--'}
          </span>
        ),
      },
    ],
    []
  );

  // —— 纠正记录表格列定义 ——
  const correctionColumns = useMemo<ColumnType<NlpCorrection>[]>(
    () => [
      {
        title: '原文',
        key: 'original_text',
        dataIndex: 'original_text',
        width: 200,
        ellipsis: true,
        render: (value) => (
          <span title={value ? String(value) : undefined} className='text-sm text-gray-800'>
            {String(value ?? '')}
          </span>
        ),
      },
      {
        title: '字段',
        key: 'field_type',
        dataIndex: 'field_type',
        render: (value) => {
          const fieldType = String(value ?? '');
          return (
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                fieldType === 'name'
                  ? 'bg-blue-100 text-blue-600'
                  : fieldType === 'intent'
                    ? 'bg-green-100 text-green-600'
                    : fieldType === 'score'
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-gray-100 text-gray-600'
              }`}
            >
              {fieldType === 'name'
                ? '姓名'
                : fieldType === 'intent'
                  ? '意图'
                  : fieldType === 'score'
                    ? '分数'
                    : fieldType}
            </span>
          );
        },
      },
      {
        title: '原值',
        key: 'original_value',
        dataIndex: 'original_value',
        render: (value) => (
          <span className='text-sm text-gray-600'>{value ? String(value) : '-'}</span>
        ),
      },
      {
        title: '纠正值',
        key: 'corrected_value',
        dataIndex: 'corrected_value',
        render: (value) => (
          <span className='text-sm font-medium text-blue-600'>{value ? String(value) : '-'}</span>
        ),
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'status',
        render: (value) => {
          const status = String(value ?? '');
          return (
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                status === 'pending'
                  ? 'bg-yellow-100 text-yellow-600'
                  : status === 'verified'
                    ? 'bg-green-100 text-green-600'
                    : status === 'learned'
                      ? 'bg-purple-100 text-purple-600'
                      : status === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status === 'pending'
                ? '待验证'
                : status === 'verified'
                  ? '已验证'
                  : status === 'learned'
                    ? '已学习'
                    : status === 'rejected'
                      ? '已拒绝'
                      : status}
            </span>
          );
        },
      },
      {
        title: '学习次数',
        key: 'learn_count',
        dataIndex: 'learn_count',
        render: (value) => (
          <span className='text-sm text-gray-600'>{value ? Number(value) : 0}</span>
        ),
      },
    ],
    []
  );

  // —— 主壳 → 子模块透传契约 ——
  const deps: NLPDeps = {
    // 解析 Tab
    inputText,
    setInputText,
    parseResult,
    setParseResult,
    isParsing,
    setIsParsing,
    selectedRuleId,
    setSelectedRuleId,
    suggestedRules,
    setSuggestedRules,
    showCorrectionModal,
    setShowCorrectionModal,
    showCorrectionList,
    setShowCorrectionList,
    parseText,
    executeScoring,
    applySuggestionAsRule,
    setManualCorrection,
    setCorrectionsPage,
    fetchCorrections,

    // 规则 Tab
    rules,
    rulesLoading,
    rulePage,
    setRulePage,
    ruleTotal,
    keywordFilter,
    setKeywordFilter,
    scoreTypeFilter,
    setScoreTypeFilter,
    showBatchImportModal,
    setShowBatchImportModal,
    editingRule,
    setEditingRule,
    newRule,
    setNewRule,
    showRuleForm,
    setShowRuleForm,
    ruleColumns,
    fetchRules,
    openEditModal,
    handleDeleteRule,
    handleCreateRule,
    handleEditRule,

    // 训练 Tab
    algorithms,
    isTraining,
    setIsTraining,
    selectedAlgorithm,
    setSelectedAlgorithm,
    useCrossValidation,
    setUseCrossValidation,
    modelEvaluation,
    trainingResult,
    setTrainingResult,
    trainAllResult,
    setTrainAllResult,
    isEvaluatingAll,
    setIsEvaluatingAll,
    evaluationAllResult,
    setEvaluationAllResult,
    trainingHistory,
    trainingResultColumns,
    handleTrainModel,
    handleTrainAllModels,
    handleEvaluateAllModels,

    // 统计 Tab
    statistics,
    setStatistics,
    setModelEvaluation,
    fetchStatistics,
    fetchModelEvaluation,

    // 分析 Tab
    intentAnalysis,
    setIntentAnalysis,
    performanceAnalysis,
    setPerformanceAnalysis,
    optimizationSuggestions,
    setOptimizationSuggestions,
    optimizerConfig,
    setOptimizerConfig,
    isLoadingAnalysis,
    setIsLoadingAnalysis,
    benchmarkResults,
    setBenchmarkResults,
    isBenchmarking,
    setIsBenchmarking,
    selectedStrategy,
    setSelectedStrategy,
    performanceColumns,
    fetchAnalysisData,
    runBenchmark,
    updateOptimizationStrategy,
    resetAnalysisMetrics,

    // 手动修正模态
    manualCorrection,
    isSubmittingFeedback,
    handleRecordFeedback,
    handleManualExecute,

    // 批量导入模态
    importFile,
    setImportFile,
    importJsonText,
    setImportJsonText,
    isImporting,
    setIsImporting,
    handleDownloadTemplate,
    handleBatchImport,

    // 纠正记录列表
    corrections,
    correctionsLoading,
    correctionsPage,
    correctionTotal,
    correctionStatusFilter,
    setCorrectionStatusFilter,
    correctionColumns,
    handleUpdateCorrection,
    handleDeleteCorrection,
  };

  return (
    <div className='space-y-6'>
      {loadError && (
        <div className='flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            算法/分析数据加载失败，部分功能可能不可用，请刷新重试
          </p>
        </div>
      )}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center'>
            <Brain className='w-6 h-6 text-white' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-gray-800'>智能评分规则管理</h1>
            <p className='text-sm text-gray-500'>基于自然语言处理的智能评分系统</p>
          </div>
        </div>
      </div>

      <div className='flex gap-2 mb-6'>
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
              <Icon className='w-4 h-4' />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'parse' && <ParseTab deps={deps} />}
      {activeTab === 'rules' && <RulesTab deps={deps} />}
      {activeTab === 'training' && <TrainingTab deps={deps} />}
      {activeTab === 'statistics' && <StatisticsTab deps={deps} />}
      {activeTab === 'analysis' && <AnalysisTab deps={deps} />}

      {showCorrectionModal && <CorrectionModal deps={deps} />}
      {showRuleForm && <RuleFormModal deps={deps} />}
      {showBatchImportModal && <BatchImportModal deps={deps} />}
      {showCorrectionList && <CorrectionsList deps={deps} />}
    </div>
  );
};

export default NLPScoringManagement;
