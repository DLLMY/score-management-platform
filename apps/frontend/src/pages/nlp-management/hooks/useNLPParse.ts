/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-8 拆分（2026-09-12）：智能解析域（文本解析 / 执行评分 / 一键应用相似规则 / 手动修正 / 反馈记录）。
 * 自 useNLPManagementLogic.ts 原样搬出，fetchRules / showToast 由组合根注入。
 */

import { useState, useCallback } from 'react';
import api from '../../../services/api';
import logger from '../../../utils/logger';
import type {
  ManualCorrectionData,
  NLPDeps,
  ParseResult,
  Rule,
  ShowToast,
  Suggestion,
} from '../types';

export interface useNLPParseParams {
  showToast: ShowToast;
  fetchRules: () => void;
}

export function useNLPParse(
  params: useNLPParseParams
): Pick<
  NLPDeps,
  | 'inputText'
  | 'setInputText'
  | 'parseResult'
  | 'setParseResult'
  | 'isParsing'
  | 'setIsParsing'
  | 'selectedRuleId'
  | 'setSelectedRuleId'
  | 'suggestedRules'
  | 'setSuggestedRules'
  | 'showCorrectionModal'
  | 'setShowCorrectionModal'
  | 'parseText'
  | 'executeScoring'
  | 'applySuggestionAsRule'
  | 'manualCorrection'
  | 'setManualCorrection'
  | 'isSubmittingFeedback'
  | 'handleRecordFeedback'
  | 'handleManualExecute'
> {
  const { showToast, fetchRules } = params;

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
  const [suggestedRules, setSuggestedRules] = useState<Rule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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
        const mapped: Rule[] = ruleLikeSuggestions.map(
          (s): Rule => ({
            id: s.rule_id,
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
          })
        );
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

  return {
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
    parseText,
    executeScoring,
    applySuggestionAsRule,
    manualCorrection,
    setManualCorrection,
    isSubmittingFeedback,
    handleRecordFeedback,
    handleManualExecute,
  };
}
