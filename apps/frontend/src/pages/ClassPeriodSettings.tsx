import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useStableToast, usePermissions } from '../hooks';
import api, { ClassPeriod } from '../services/api';
import { useConfirm } from '../components';
import ClassPeriodSettingsView from './classPeriodSettings/ClassPeriodSettingsView';
import type { PeriodFormData } from './classPeriodSettings/types';

const defaultPeriodForm: PeriodFormData = {
  name: '',
  period_number: 1,
  start_hour: 8,
  start_minute: 0,
  end_hour: 8,
  end_minute: 40,
  description: '',
  is_active: true,
  sort_order: 0,
};

const ClassPeriodSettings = () => {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ClassPeriod | null>(null);
  const [formData, setFormData] = useState<PeriodFormData>(defaultPeriodForm);
  // 视图层以 Partial 形式增量更新表单字段，此处收敛为合并语义，避免直接替换丢失其他字段
  const setFormDataMerged = useCallback(
    (data: Partial<PeriodFormData>) => setFormData((prev) => ({ ...prev, ...data })),
    [setFormData]
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPeriods, setOriginalPeriods] = useState<ClassPeriod[]>([]);

  usePermissions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.classPeriods.getAll();
      const data = response.periods || [];
      setPeriods(data);
      setOriginalPeriods(JSON.parse(JSON.stringify(data)));
      setHasChanges(false);
    } catch (error) {
      logger.error('Failed to fetch periods:', error);
      showToast('error', '获取课程节次失败');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (period: ClassPeriod) => {
    setEditingPeriod(period);
    setFormData({
      name: period.name,
      period_number: period.period_number,
      start_hour: period.start_hour,
      start_minute: period.start_minute,
      end_hour: period.end_hour,
      end_minute: period.end_minute,
      description: period.description || '',
      is_active: period.is_active,
      sort_order: period.sort_order,
    });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingPeriod(null);
    const maxNum = Math.max(...periods.map((p) => p.period_number), 0);
    setFormData({
      ...defaultPeriodForm,
      period_number: maxNum + 1,
      sort_order: periods.length,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirmRef.current({
      message: `确定要删除「${name}」吗？此操作不可恢复。`,
      confirmText: '确定',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.classPeriods.delete(id);
      setPeriods((prev) => prev.filter((p) => p.id !== id));
      setHasChanges(true);
      showToast('success', '删除成功');
    } catch (error) {
      logger.error('Failed to delete period:', error);
      showToast('error', '删除失败');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', '请输入节次名称');
      return;
    }
    if (
      formData.start_hour > formData.end_hour ||
      (formData.start_hour === formData.end_hour && formData.start_minute >= formData.end_minute)
    ) {
      showToast('error', '结束时间必须晚于开始时间');
      return;
    }
    try {
      if (editingPeriod) {
        const updated = await api.classPeriods.update(editingPeriod.id, formData);
        setPeriods((prev) => prev.map((p) => (p.id === editingPeriod.id ? updated : p)));
      } else {
        const created = await api.classPeriods.create(formData);
        setPeriods((prev) => [...prev, created]);
      }
      setShowModal(false);
      setEditingPeriod(null);
      setHasChanges(true);
      showToast('success', editingPeriod ? '修改成功' : '添加成功');
    } catch (error) {
      logger.error('Failed to save period:', error);
      showToast('error', '保存失败');
    }
  };

  const handleReset = async () => {
    const ok = await confirmRef.current({
      message: '确定要重置为默认节次吗？所有自定义节次将被删除。',
      confirmText: '确定',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;
    try {
      await api.classPeriods.reset();
      await fetchData();
      showToast('success', '已重置为默认节次');
    } catch (error) {
      logger.error('Failed to reset periods:', error);
      showToast('error', '重置失败');
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= periods.length) return;
    const newPeriods = [...periods];
    const [moved] = newPeriods.splice(index, 1);
    newPeriods.splice(newIndex, 0, moved);
    // 更新 sort_order
    const updated = newPeriods.map((p, i) => ({ ...p, sort_order: i }));
    setPeriods(updated);
    setHasChanges(true);
  };

  const handleToggleActive = (period: ClassPeriod) => {
    setPeriods((prev) =>
      prev.map((p) => (p.id === period.id ? { ...p, is_active: !p.is_active } : p))
    );
    setHasChanges(true);
  };

  const handleSaveOrder = async () => {
    try {
      const batchData = periods.map((p) => ({
        id: p.id,
        sort_order: p.sort_order,
        is_active: p.is_active,
      }));
      await api.classPeriods.batchUpdate(batchData);
      setOriginalPeriods(JSON.parse(JSON.stringify(periods)));
      setHasChanges(false);
      showToast('success', '排序和状态已保存');
    } catch (error) {
      logger.error('Failed to save order:', error);
      showToast('error', '保存失败');
    }
  };

  const handleCancelChanges = () => {
    setPeriods(JSON.parse(JSON.stringify(originalPeriods)));
    setHasChanges(false);
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
      </div>
    );
  }

  return (
    <ClassPeriodSettingsView
      periods={periods}
      hasChanges={hasChanges}
      showModal={showModal}
      editingPeriod={editingPeriod}
      formData={formData}
      handleAdd={handleAdd}
      handleEdit={handleEdit}
      handleDelete={handleDelete}
      handleReset={handleReset}
      handleMove={handleMove}
      handleToggleActive={handleToggleActive}
      handleSaveOrder={handleSaveOrder}
      handleCancelChanges={handleCancelChanges}
      setFormData={setFormDataMerged}
      handleSubmit={handleSubmit}
      setShowModal={setShowModal}
    />
  );
};

export default ClassPeriodSettings;
