import { useState, useCallback, useMemo, useRef, FormEvent } from 'react';
import api, { RankRule } from '../services/api';
import {
  useForm,
  useModal,
  useListData,
  useDebouncedValue,
  useSubmitGuard,
  useStableToast,
} from '../hooks';
import type { FormErrors as UseFormErrors } from '../hooks';
import { validateForm } from '../utils/validation';
import { useConfirm } from '../components';
import RankRuleListView, { FormData } from './rankRuleList/RankRuleListView';

function RankRuleList() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingRule, setEditingRule] = useState<RankRule | null>(null);
  const {
    data: rankRules,
    loading: isLoading,
    error,
    refetch: fetchRankRules,
  } = useListData<RankRule>({ fetcher: () => api.rankRules.getAll(), debounceDelay: 0 });

  const {
    formData,
    setFormData,
    resetForm,
    errors: formErrors,
    setErrors: setFormErrors,
  } = useForm<FormData>(
    {
      name: '',
      min_score: 0,
      max_score: 100,
      color: '#3B82F6',
      icon: 'Star',
      description: '',
      is_active: true,
      unlock_min_score: null,
      weekly_unlock_limit: null,
    },
    {
      name: { required: true, maxLength: 50 },
      min_score: { required: true, min: 0, max: 10000 },
      max_score: { required: true, min: 0, max: 10000 },
      description: { maxLength: 200 },
    }
  );

  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<RankRule | null>({
    onClose: () => {
      resetForm();
      setEditingRule(null);
    },
  });

  const validationRules = {
    name: ['required', { maxLength: 50 }],
    min_score: ['required', 'integer', { min: 0 }, { max: 10000 }],
    max_score: ['required', 'integer', { min: 0 }, { max: 10000 }],
    description: [{ maxLength: 200 }],
  };

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>): Promise<void> => {
    e?.preventDefault();

    const { isValid, errors } = validateForm(formData, validationRules);

    if (!isValid) {
      setFormErrors(errors as UseFormErrors<FormData>);
      return;
    }

    if (formData.min_score >= formData.max_score) {
      setFormErrors({ range: '最低分必须小于最高分' });
      return;
    }

    setFormErrors({});

    try {
      if (editingRule) {
        await api.rankRules.update(editingRule.id, formData);
        showToast('success', '排名规则更新成功');
        // 后端更新仅返回 message（解包为 null），重新拉取列表
        fetchRankRules();
      } else {
        await api.rankRules.create(formData);
        showToast('success', '排名规则添加成功');
        fetchRankRules();
      }
      closeModal();
    } catch (err: unknown) {
      showToast('error', '操作失败: ' + (err as Error).message);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    const ok = await confirmRef.current({
      message: '确定要删除该排名规则吗？此操作不可撤销。',
      confirmText: '确定',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await api.rankRules.delete(id);
      showToast('success', '删除成功');
      fetchRankRules();
    } catch (err: unknown) {
      showToast('error', '删除失败: ' + (err as Error).message);
    }
  };

  const filteredRules = useMemo(() => {
    return rankRules.filter(
      (rule) =>
        rule && rule.name && rule.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [rankRules, debouncedSearchTerm]);

  const sortedRules = useMemo(() => {
    return [...filteredRules].sort((a, b) => b.min_score - a.min_score);
  }, [filteredRules]);

  const handleAddClick = useCallback(() => {
    setEditingRule(null);
    openModal();
  }, [openModal]);

  const handleEditClick = useCallback(
    (rule: RankRule) => {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        min_score: rule.min_score,
        max_score: rule.max_score,
        color: rule.color,
        icon: rule.icon,
        description: rule.description,
        is_active: rule.is_active,
        unlock_min_score: rule.unlock_min_score,
        weekly_unlock_limit: rule.weekly_unlock_limit,
      });
      openModal();
    },
    [openModal, setFormData]
  );

  return (
    <RankRuleListView
      rankRules={rankRules}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filteredCount={filteredRules.length}
      sortedRules={sortedRules}
      editingRule={editingRule}
      onAddClick={handleAddClick}
      onEditClick={handleEditClick}
      handleDelete={handleDelete}
      formData={formData}
      setFormData={setFormData}
      formErrors={formErrors}
      setFormErrors={setFormErrors}
      showModal={showModal}
      closeModal={closeModal}
      submitting={submitting}
      runSubmit={runSubmit}
      handleSubmit={handleSubmit}
      fetchRankRules={fetchRankRules}
    />
  );
}

export default RankRuleList;
