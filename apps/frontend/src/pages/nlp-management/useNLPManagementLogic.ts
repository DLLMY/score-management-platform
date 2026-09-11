/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../services/api';
import { useStableToast, useListFetch } from '../../hooks';
import { useConfirm, type ColumnType } from '../../components';
import logger from '../../utils/logger';
import { downloadTextAsFile } from '../../utils/download';
import type {
  ParseResult,
  ManualCorrectionData,
  Rule,
  Suggestion,
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
  NLPDeps,
} from './types';
import {
  buildRuleColumns,
  buildTrainingResultColumns,
  buildPerformanceColumns,
  buildCorrectionColumns,
} from './columns';

/**
 * 智能评分规则管理（NLPManagement）的逻辑层 hook。
 *
 * 承接原 NLPManagement.tsx 中全部 state / effect / loader / handler / 列定义，
 * 主文件退化为「hook → 各 Tab/模态」的薄装配（行为与原闭包完全一致）。
 *
 * 返回 `NLPDeps`（子模块契约）之外的壳层专用字段：activeTab / setActiveTab / loadError。
 */
export function useNLPManagementLogic(): NLPDeps & {
  /** 当前激活 Tab */
  activeTab: TabType;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  /** 算法/分析数据加载失败标记（壳层警示条用） */
  loadError: boolean;
} {
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
  const [rulePage, setRulePage] = useState(1);
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
  const [correctionsPage, setCorrectionsPage] = useState(1);
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
        (s: Suggestion): s is Suggestion & { rule_id: number } => typeof s?.rule_id === 'number'
      );
      if (ruleLikeSuggestions.length > 0) {
        const mapped: Rule[] = ruleLikeSuggestions.map((s): Rule & { rule_id: number } => ({
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

  const rulesList = useListFetch<Rule>({
    fetcher: async (p) => {
      const response = await api.nlp.getRules({
        page: p.page,
        per_page: p.pageSize,
        keyword: typeof p.keyword === 'string' ? p.keyword : undefined,
        score_type: typeof p.score_type === 'string' ? p.score_type : undefined,
        sort_by: 'usage_count',
        sort_order: 'desc',
      });
      return { items: response?.items ?? [], total: response?.total ?? 0 };
    },
    params: {
      page: rulePage,
      pageSize: 20,
      keyword: keywordFilter || undefined,
      score_type: scoreTypeFilter || undefined,
    },
  });

  // mutation 后重新拉取（保留 fetchRules 调用点语义，最小改动）
  const fetchRules = useCallback(() => rulesList.refetch(), [rulesList]);

  // 纠正记录列表（A 轨：条件加载 → useListFetch + enabled 跟随 showCorrectionList 按需拉取）
  const correctionsList = useListFetch<NlpCorrection>({
    enabled: showCorrectionList,
    fetcher: async (p) => {
      const response = await api.nlp.getCorrections({
        page: p.page,
        per_page: p.pageSize,
        status: typeof p.status === 'string' && p.status ? p.status : undefined,
      });
      return { items: response?.items ?? [], total: response?.total ?? 0 };
    },
    params: {
      page: correctionsPage,
      pageSize: 20,
      status: correctionStatusFilter || undefined,
    },
  });

  // mutation 后重新拉取（保留 fetchCorrections(page?) 调用点语义；翻页走 setCorrectionsPage 触发 params 变化自动重拉）
  const fetchCorrections = useCallback(
    async (page?: number) => {
      if (typeof page === 'number') {
        setCorrectionsPage(page);
      } else {
        await correctionsList.refetch();
      }
    },
    [correctionsList]
  );

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
    downloadTextAsFile(
      JSON.stringify(template, null, 2),
      'nlp_rules_template.json',
      'application/json'
    );
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

      // api 层这 4 个端点声明 data: unknown（后端形状由 NLP 服务决定），此处按本地契约断言。
      if (intentRes.code === 0) setIntentAnalysis((intentRes.data as NlpAnalysisData) ?? null);
      if (perfRes.code === 0) setPerformanceAnalysis((perfRes.data as NlpAnalysisData) ?? null);
      if (suggestionsRes.code === 0)
        setOptimizationSuggestions((suggestionsRes.data as NlpSuggestion[]) ?? []);
      if (configRes.code === 0) setOptimizerConfig((configRes.data as NlpOptimizerConfig) ?? null);
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

  // 纠正记录列表加载见上方 correctionsList（enabled: showCorrectionList）

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

  // —— 规则表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const ruleColumns = useMemo<ColumnType<Rule>[]>(() => buildRuleColumns(), []);

  // —— 训练对比表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const trainingResultColumns = useMemo<ColumnType<MLAlgorithmResult>[]>(
    () => buildTrainingResultColumns(trainAllResult),
    [trainAllResult]
  );

  // —— 组件性能表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const performanceColumns = useMemo<ColumnType<PerformanceRow>[]>(
    () => buildPerformanceColumns(),
    []
  );

  // —— 纠正记录表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const correctionColumns = useMemo<ColumnType<NlpCorrection>[]>(
    () => buildCorrectionColumns(),
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
    rules: rulesList.items,
    rulesLoading: rulesList.loading,
    rulePage,
    setRulePage,
    ruleTotal: rulesList.total,
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
    corrections: correctionsList.items,
    correctionsLoading: correctionsList.loading,
    correctionsPage,
    correctionTotal: correctionsList.total,
    correctionStatusFilter,
    setCorrectionStatusFilter,
    correctionColumns,
    handleUpdateCorrection,
    handleDeleteCorrection,
  };

  return { ...deps, activeTab, setActiveTab, loadError };
}
