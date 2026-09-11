/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 评分规则列表页的逻辑层 hook。
 *
 * 承接原 RuleList.tsx 中全部 state / effect / loader / handler，
 * 主文件退化为「hook → RuleView」的薄装配。
 */

import logger from '../../utils/logger';
import { downloadBlob, downloadTextAsFile } from '../../utils/download';
import { useState, useEffect, useCallback, useMemo, useRef, FormEvent, ChangeEvent } from 'react';
import {
  useDebouncedValue,
  useForm,
  useModal,
  useSubmitGuard,
  useStableToast,
  useListFetch,
  usePermissions,
} from '../../hooks';
import { useConfirm } from '../../components';
import api, { request } from '../../services/api';
import { validateForm } from '../../utils/validation';
import type { RuleViewProps } from '../rule/RuleSections';
import type { Rule, Category, FormData, FormErrors, RuleTemplate } from '../RuleList';

/**
 * 评分规则列表页逻辑 hook。
 *
 * 返回值与 RuleView 的 props 契约一致，主文件可直接展开传入。
 */
export function useRuleListLogic(): RuleViewProps {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState<boolean>(false);

  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  usePermissions();
  const RULE_PER_PAGE = 50;

  const {
    formData,
    setFormData,
    resetForm,
    errors: formErrors,
    setErrors: setFormErrors,
  } = useForm<FormData>(
    {
      name: '',
      description: '',
      category_id: '',
      score: 0,
      is_active: true,
      daily_limit: 0,
      min_interval: 0,
    },
    {
      name: { required: true, maxLength: 100 },
      score: { required: true, min: -1000, max: 1000 },
      description: { maxLength: 500 },
      daily_limit: { min: 0, max: 100 },
      min_interval: { min: 0, max: 1440 },
    }
  );

  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<Rule | null>({
    onClose: () => {
      resetForm();
      setEditingRule(null);
    },
  });

  const {
    isOpen: showImportModal,
    open: openImportModal,
    close: closeImportModal,
  } = useModal<null>({});
  const {
    isOpen: showTemplateModal,
    open: openTemplateModal,
    close: closeTemplateModal,
  } = useModal<null>({});

  const validationRules = useMemo(
    () => ({
      name: ['required', { maxLength: 100 }],
      score: ['required', 'integer', { min: -1000 }, { max: 1000 }],
      description: [{ maxLength: 500 }],
      daily_limit: ['integer', { min: 0 }, { max: 100 }],
      min_interval: ['integer', { min: 0 }, { max: 1440 }],
    }),
    []
  );

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.scoreCategories.getAll();
      setCategories(data);
      setLoadError(false);
    } catch (err) {
      logger.error('获取分类失败:', err);
      setLoadError(true);
    }
  }, []);

  // A 轨：规则列表迁 useListFetch（本页无分页 UI，取第 1 页 50 条；分类走服务端过滤）
  const rules = useListFetch<Rule>({
    params: { page: 1, pageSize: RULE_PER_PAGE, categoryId: selectedCategory || undefined },
    fetcher: async ({ page, pageSize, categoryId }) => {
      setError(null);
      try {
        const data = await api.rules.getAll({
          page,
          per_page: pageSize,
          category_id: categoryId ? Number(categoryId) : undefined,
          is_active: null,
        });
        if (Array.isArray(data)) {
          // 防御分支：后端异常时兜底，非真实总数
          return { items: data as Rule[], total: data.length };
        }
        return {
          items: (data as { rules: Rule[] }).rules || [],
          total: (data as { total: number }).total ?? 0,
        };
      } catch (err) {
        setError('获取规则列表失败: ' + (err as Error).message);
        throw err;
      }
    },
  });
  // 既有刷新/导入等路径仍以 fetchRules 命名调用（语义 = 重新拉取）
  const fetchRules = useCallback(async (): Promise<void> => {
    await rules.refetch();
  }, [rules]);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = (await request('/api/rules/templates', {
        skipDataExtract: true,
      })) as { success?: boolean; templates?: unknown[] };
      if (data.success) {
        setTemplates((data.templates as RuleTemplate[]) || []);
        setLoadError(false);
      }
    } catch (err) {
      logger.error('获取规则模板失败:', err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, [fetchCategories, fetchTemplates]);

  const handleSubmit = useCallback(
    async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();

      const { isValid, errors } = validateForm(formData, validationRules);

      if (!isValid) {
        setFormErrors(errors as FormErrors);
        return;
      }

      setFormErrors({});

      const submitData = {
        ...formData,
        category_id: formData.category_id ? Number(formData.category_id) : null,
      };

      try {
        if (editingRule) {
          await api.rules.update(editingRule.id, submitData);
          showToast('success', '规则更新成功');
          // 后端更新仅返回 message（被 request 解包为 null），不能拿返回值替换列表项，改为重新拉取
          fetchRules();
        } else {
          const newRule = await api.rules.create(submitData);
          showToast('success', '规则添加成功');

          rules.mutate({
            items: [newRule as Rule, ...rules.items],
            total: rules.total + 1,
          });
        }
        closeModal();
      } catch (err) {
        showToast('error', '操作失败: ' + (err as Error).message);
      }
    },
    [formData, editingRule, showToast, validationRules, rules]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除该规则吗？此操作不可撤销。',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;

      try {
        await api.rules.delete(id);
        showToast('success', '删除成功');

        rules.mutate({
          items: rules.items.filter((rule) => rule.id !== id),
          total: Math.max(0, rules.total - 1),
        });
      } catch (err) {
        showToast('error', '删除失败: ' + (err as Error).message);
      }
    },
    [showToast, rules]
  );

  const handleExport = useCallback(async () => {
    try {
      const data = await api.rules.export();
      const list = Array.isArray(data) ? data : (data as { rules?: unknown[] })?.rules || [];
      if (list.length === 0) {
        showToast('warning', '暂无规则数据可导出');
        return;
      }
      downloadTextAsFile(JSON.stringify(data, null, 2), 'score_rules.json', 'application/json');
      showToast('success', '导出成功');
    } catch (err) {
      showToast('error', '导出失败: ' + (err as Error).message);
    }
  }, [showToast]);

  const handleExportFile = useCallback(
    async (format: 'excel' | 'pdf') => {
      try {
        const apiUrl =
          format === 'pdf'
            ? '/api/export/rules?format=pdf'
            : '/api/import_export/export/rules?format=excel';

        const response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('导出失败');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `rules.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) {
            filename = match[1];
          }
        }

        downloadBlob(blob, filename);

        showToast('success', '导出成功');
      } catch (err) {
        showToast('error', '导出失败: ' + (err as Error).message);
      }
    },
    [showToast]
  );

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      setApplyingTemplate(true);
      try {
        const data = (await request('/api/rules/templates/apply', {
          method: 'POST',
          skipDataExtract: true,
          body: JSON.stringify({ template_id: templateId }),
        })) as { success?: boolean; message?: string };
        if (data.success) {
          showToast('success', data.message);
          closeTemplateModal();
          fetchRules();
        } else {
          showToast('error', data.message || '应用模板失败');
        }
      } catch (err) {
        showToast('error', '应用模板失败: ' + (err as Error).message);
      } finally {
        setApplyingTemplate(false);
      }
    },
    [showToast, fetchRules]
  );

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch(api.rules.downloadTemplate());
      const blob = await response.blob();
      downloadBlob(blob, 'rule_import_template.csv');
    } catch (error) {
      logger.error('下载模板失败:', error);
      showToast('error', '下载模板失败: ' + (error as Error).message);
    }
  }, [showToast]);

  const handleImport = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validExtensions = ['.xlsx', '.xls'];
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validExtensions.includes(extension)) {
        showToast('error', '仅支持 .xlsx 和 .xls 格式的Excel文件');
        e.target.value = '';
        return;
      }

      setImporting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const result = (await request('/api/import_export/import/rules', {
          method: 'POST',
          skipDataExtract: true,
          body: formData,
        })) as {
          success?: boolean;
          success_count?: number;
          failed_count?: number;
          message?: string;
        };

        if (result.success) {
          showToast(
            'success',
            `导入完成：成功 ${result.success_count || 0} 条，失败 ${result.failed_count || 0} 条`
          );
          closeImportModal();
          fetchRules();
        } else {
          showToast('error', result.message || '导入失败');
        }
      } catch (err) {
        showToast('error', '导入失败: ' + (err as Error).message);
      }
      setImporting(false);
      e.target.value = '';
    },
    [showToast, fetchRules, closeImportModal]
  );

  const filteredRules = useMemo(() => {
    return rules.items.filter((rule) => {
      if (!rule) return false;
      const matchesSearch =
        (rule.name && rule.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (rule.description &&
          rule.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      const categoryId = selectedCategory ? parseInt(selectedCategory) : null;
      const matchesCategory = !selectedCategory || rule.category_id === categoryId;
      return matchesSearch && matchesCategory;
    });
  }, [rules.items, debouncedSearchTerm, selectedCategory]);

  const getCategoryName = useMemo(() => {
    return (categoryId: number | null): string => {
      const cat = categories.find((c) => c.id === categoryId);
      return cat ? cat.name : '-';
    };
  }, [categories]);

  const getCategoryColor = useMemo(() => {
    return (categoryId: number | null): string => {
      const cat = categories.find((c) => c.id === categoryId);
      return cat ? cat.color : '#6b7280';
    };
  }, [categories]);

  return {
    loadError,
    error,
    categories,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    filteredRules,
    rulesLoading: rules.loading,
    editingRule,
    setEditingRule,
    setFormData,
    openModal,
    closeModal,
    showModal,
    openImportModal,
    closeImportModal,
    showImportModal,
    openTemplateModal,
    closeTemplateModal,
    showTemplateModal,
    templates,
    formData,
    formErrors,
    setFormErrors,
    submitting,
    runSubmit,
    handleSubmit,
    handleDelete,
    handleExport,
    handleExportFile,
    handleDownloadTemplate,
    handleImport,
    importing,
    handleApplyTemplate,
    applyingTemplate,
    fetchRules,
    setError,
    getCategoryColor,
    getCategoryName,
  };
}
