/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-8 拆分（2026-09-12）：规则管理域（规则列表 A 轨 / 增删改 / 编辑模态 / 批量导入 / 模板下载）。
 * 自 useNLPManagementLogic.ts 原样搬出，showToast / confirmRef 由组合根注入。
 */

import { useState, useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useConfirm, type ColumnType } from '../../../components';
import { useListFetch } from '../../../hooks';
import api from '../../../services/api';
import logger from '../../../utils/logger';
import { downloadTextAsFile } from '../../../utils/download';
import { buildRuleColumns } from '../columns';
import type { NLPDeps, NewRuleForm, Rule, ShowToast } from '../types';

export interface useNLPRulesParams {
  showToast: ShowToast;
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
}

export function useNLPRules(
  params: useNLPRulesParams
): Pick<
  NLPDeps,
  | 'rules'
  | 'rulesLoading'
  | 'rulePage'
  | 'setRulePage'
  | 'ruleTotal'
  | 'keywordFilter'
  | 'setKeywordFilter'
  | 'scoreTypeFilter'
  | 'setScoreTypeFilter'
  | 'showBatchImportModal'
  | 'setShowBatchImportModal'
  | 'editingRule'
  | 'setEditingRule'
  | 'newRule'
  | 'setNewRule'
  | 'showRuleForm'
  | 'setShowRuleForm'
  | 'ruleColumns'
  | 'fetchRules'
  | 'openEditModal'
  | 'handleDeleteRule'
  | 'handleCreateRule'
  | 'handleEditRule'
  | 'importFile'
  | 'setImportFile'
  | 'importJsonText'
  | 'setImportJsonText'
  | 'isImporting'
  | 'setIsImporting'
  | 'handleDownloadTemplate'
  | 'handleBatchImport'
> {
  const { showToast, confirmRef } = params;

  const [rulePage, setRulePage] = useState(1);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [scoreTypeFilter, setScoreTypeFilter] = useState('');
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
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

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

  // —— 规则表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const ruleColumns = useMemo<ColumnType<Rule>[]>(() => buildRuleColumns(), []);

  return {
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
    importFile,
    setImportFile,
    importJsonText,
    setImportJsonText,
    isImporting,
    setIsImporting,
    handleDownloadTemplate,
    handleBatchImport,
  };
}
