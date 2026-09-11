import logger from '../utils/logger';
import React, { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from 'react';
import api from '../services/api';
import { useForm, useModal, useDebouncedValue, useSubmitGuard, useStableToast } from '../hooks';
import { validateForm } from '../utils/validation';
import { useConfirm } from '../components';
import TimeRuleListView, {
  type TimeRule,
  type TimeRuleFormData,
  type TimeRuleFormErrors,
} from './timeRuleList/TimeRuleListView';

const TimeRuleList: React.FC = () => {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [rules, setRules] = useState<TimeRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<TimeRule | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    formData,
    setFormData,
    resetForm,
    errors: formErrors,
    setErrors: setFormErrors,
  } = useForm<TimeRuleFormData>(
    {
      name: '',
      description: '',
      day_of_week: -1,
      start_hour: 8,
      start_minute: 0,
      end_hour: 12,
      end_minute: 0,
      is_active: true,
      allow_unlock: false,
    },
    {
      name: { required: true, maxLength: 50 },
      description: { maxLength: 200 },
    }
  );

  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<TimeRule | null>({
    onClose: () => {
      resetForm();
      setEditingRule(null);
    },
  });

  const validationRules = {
    name: ['required', { maxLength: 50 }],
    description: [{ maxLength: 200 }],
    start_hour: ['required', 'integer', { min: 0 }, { max: 23 }],
    start_minute: ['required', 'integer', { min: 0 }, { max: 59 }],
    end_hour: ['required', 'integer', { min: 0 }, { max: 23 }],
    end_minute: ['required', 'integer', { min: 0 }, { max: 59 }],
  };

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const fetchRules = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.timeRules.getAll();
      setRules(response);
      setLoadError(false);
    } catch (error: unknown) {
      logger.error('获取时间规则失败:', error);
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleAdd = (): void => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      day_of_week: -1,
      start_hour: 8,
      start_minute: 0,
      end_hour: 12,
      end_minute: 0,
      is_active: true,
      allow_unlock: false,
    });
    openModal();
  };

  const handleEdit = (rule: TimeRule): void => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      day_of_week: rule.day_of_week,
      start_hour: rule.start_hour,
      start_minute: rule.start_minute,
      end_hour: rule.end_hour,
      end_minute: rule.end_minute,
      is_active: rule.is_active,
      allow_unlock: rule.allow_unlock,
    });
    openModal();
  };

  const handleDelete = async (id: number): Promise<void> => {
    const ok = await confirmRef.current({
      title: '删除确认',
      message: '确定要删除这条规则吗？',
      confirmText: '删除',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.timeRules.delete(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      showToast('success', '删除成功');
    } catch (error: unknown) {
      showToast('error', '删除失败: ' + (error as Error).message);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>): Promise<void> => {
    e?.preventDefault();

    const { isValid, errors } = validateForm(formData, validationRules);

    if (!isValid) {
      setFormErrors(errors as TimeRuleFormErrors);
      return;
    }

    if (
      formData.start_hour > formData.end_hour ||
      (formData.start_hour === formData.end_hour && formData.start_minute >= formData.end_minute)
    ) {
      setFormErrors({ time: '结束时间必须晚于开始时间' });
      return;
    }

    setFormErrors({});

    try {
      if (editingRule) {
        await api.timeRules.update(editingRule.id, formData);
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? { ...r, ...formData, id: editingRule.id } : r))
        );
        showToast('success', '更新成功');
      } else {
        await api.timeRules.create(formData);
        await fetchRules();
        showToast('success', '添加成功');
      }
      closeModal();
    } catch (error: unknown) {
      showToast('error', '保存失败: ' + (error as Error).message);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runSubmit(handleSubmit);
  };

  const filteredRules = useMemo(() => {
    const keyword = debouncedSearchTerm.toLowerCase();
    return rules.filter((rule) => {
      if (statusFilter !== 'all') {
        const isActive = statusFilter === 'active';
        if (rule.is_active !== isActive) return false;
      }
      if (!keyword) return true;
      return (
        rule.name.toLowerCase().includes(keyword) ||
        rule.description.toLowerCase().includes(keyword)
      );
    });
  }, [rules, debouncedSearchTerm, statusFilter]);

  return (
    <TimeRuleListView
      loading={loading}
      loadError={loadError}
      filteredRules={filteredRules}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      showModal={showModal}
      closeModal={closeModal}
      editingRule={editingRule}
      formData={formData}
      setFormData={setFormData}
      formErrors={formErrors}
      setFormErrors={setFormErrors}
      submitting={submitting}
      onSubmit={onSubmit}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
};

export default TimeRuleList;
