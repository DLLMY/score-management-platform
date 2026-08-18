import logger from '../utils/logger';
import React, { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  X,
  Check,
  Sun,
  Moon,
  BookOpen,
  GripVertical,
  Timer,
} from 'lucide-react';
import { useStableToast } from '../hooks/useStableToast';
import api, { ClassPeriod } from '../services/api';
import { PermissionButton } from '../components';
import { usePermissions } from '../hooks/usePermissions';

const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface PeriodFormData {
  name: string;
  period_number: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  description: string;
  is_active: boolean;
  sort_order: number;
}

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

const formatTime = (hour: number, minute: number) => {
  const h = parseInt(String(hour), 10) || 0;
  const m = parseInt(String(minute), 10) || 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getPeriodType = (startHour: number) => {
  if (startHour < 12)
    return { label: '上午', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Sun };
  if (startHour < 17)
    return { label: '下午', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Sun };
  return { label: '晚间', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: Moon };
};

const ClassPeriodSettings: React.FC = () => {
  const { showToast } = useStableToast();
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ClassPeriod | null>(null);
  const [formData, setFormData] = useState<PeriodFormData>(defaultPeriodForm);
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
    if (!window.confirm(`确定要删除「${name}」吗？此操作不可恢复。`)) return;
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
    if (!window.confirm('确定要重置为默认节次吗？所有自定义节次将被删除。')) return;
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

  const totalDuration = periods
    .filter((p) => p.is_active)
    .reduce(
      (sum, p) =>
        sum +
        ((parseInt(String(p.end_hour), 10) || 0) * 60 +
          (parseInt(String(p.end_minute), 10) || 0) -
          ((parseInt(String(p.start_hour), 10) || 0) * 60 +
            (parseInt(String(p.start_minute), 10) || 0))),
      0
    );

  const activeCount = periods.filter((p) => p.is_active).length;

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
      </div>
    );
  }

  return (
    <div className='p-6 max-w-7xl mx-auto space-y-6'>
      {/* 页面头部 */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <Clock className='w-6 h-6 text-white' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-800 dark:text-white'>课程节次管理</h1>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-0.5'>
              定义每天的课程节次及时间安排，支持自定义排序和启用状态
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {hasChanges && (
            <>
              <PermissionButton
                permission='timetable.rule.manage'
                onClick={handleCancelChanges}
                className='px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2'
              >
                <X className='w-4 h-4' />
                取消
              </PermissionButton>
              <PermissionButton
                permission='timetable.rule.manage'
                onClick={handleSaveOrder}
                className='px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all font-medium shadow-lg shadow-primary-500/30 flex items-center gap-2'
              >
                <Save className='w-4 h-4' />
                保存更改
              </PermissionButton>
            </>
          )}
          <PermissionButton
            permission='timetable.rule.manage'
            onClick={handleReset}
            className='px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2'
          >
            <RotateCcw className='w-4 h-4' />
            重置默认
          </PermissionButton>
          <PermissionButton
            permission='timetable.rule.manage'
            onClick={handleAdd}
            className='px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all font-medium shadow-lg shadow-primary-500/30 flex items-center gap-2'
          >
            <Plus className='w-4 h-4' />
            添加节次
          </PermissionButton>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>总节次数</p>
              <p className='text-3xl font-bold text-gray-800 dark:text-white mt-1'>
                {periods.length}
              </p>
            </div>
            <div className='w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center'>
              <BookOpen className='w-5 h-5 text-blue-500' />
            </div>
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>已启用</p>
              <p className='text-3xl font-bold text-green-600 mt-1'>{activeCount}</p>
            </div>
            <div className='w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center'>
              <Check className='w-5 h-5 text-green-500' />
            </div>
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>每日总课时</p>
              <p className='text-3xl font-bold text-primary-600 mt-1'>
                {Math.floor(totalDuration / 60)}
                <span className='text-lg'>小时</span>
                {totalDuration % 60}
                <span className='text-lg'>分</span>
              </p>
            </div>
            <div className='w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center'>
              <Timer className='w-5 h-5 text-primary-500' />
            </div>
          </div>
        </div>
      </div>

      {/* 节次列表 */}
      <div className='bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between'>
          <h2 className='text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2'>
            <Calendar className='w-5 h-5 text-primary-500' />
            节次列表
          </h2>
          <p className='text-xs text-gray-400'>拖拽调整顺序，点击开关切换启用状态</p>
        </div>

        {periods.length === 0 ? (
          <div className='p-12 text-center'>
            <div className='w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4'>
              <Clock className='w-8 h-8 text-gray-400' />
            </div>
            <p className='text-gray-500 dark:text-gray-400 font-medium'>暂无课程节次</p>
            <p className='text-sm text-gray-400 mt-1'>点击右上角「添加节次」或「重置默认」来创建</p>
          </div>
        ) : (
          <div className='divide-y divide-gray-100 dark:divide-slate-700'>
            {periods
              .sort(
                (a, b) =>
                  (parseInt(String(a.sort_order), 10) || 0) -
                  (parseInt(String(b.sort_order), 10) || 0)
              )
              .map((period, index) => {
                const typeInfo = getPeriodType(parseInt(String(period.start_hour), 10) || 0);
                const TypeIcon = typeInfo.icon;
                const duration =
                  (parseInt(String(period.end_hour), 10) || 0) * 60 +
                  (parseInt(String(period.end_minute), 10) || 0) -
                  ((parseInt(String(period.start_hour), 10) || 0) * 60 +
                    (parseInt(String(period.start_minute), 10) || 0));
                return (
                  <div
                    key={period.id}
                    className={`px-6 py-4 flex items-center gap-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-slate-700/30 ${
                      !period.is_active ? 'opacity-60 bg-gray-50/50 dark:bg-slate-800/50' : ''
                    }`}
                  >
                    {/* 拖拽手柄 */}
                    <div className='cursor-move text-gray-300 dark:text-slate-600'>
                      <GripVertical className='w-5 h-5' />
                    </div>

                    {/* 序号 */}
                    <div className='w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-400 shrink-0'>
                      {index + 1}
                    </div>

                    {/* 类型标签 */}
                    <div
                      className={`px-2 py-1 rounded-lg text-xs font-medium border shrink-0 flex items-center gap-1 ${typeInfo.color}`}
                    >
                      <TypeIcon className='w-3 h-3' />
                      {typeInfo.label}
                    </div>

                    {/* 节次信息 */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className='font-semibold text-gray-800 dark:text-white'>
                          {period.name}
                        </span>
                        {!period.is_active && (
                          <span className='px-1.5 py-0.5 bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400 text-xs rounded'>
                            已禁用
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
                        {period.description || `第${period.period_number}节课`}
                      </p>
                    </div>

                    {/* 时间 */}
                    <div className='text-center shrink-0'>
                      <div className='flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg'>
                        <Clock className='w-3.5 h-3.5 text-primary-500' />
                        {formatTime(period.start_hour, period.start_minute)} -{' '}
                        {formatTime(period.end_hour, period.end_minute)}
                      </div>
                      <p className='text-xs text-gray-400 mt-1'>{duration} 分钟</p>
                    </div>

                    {/* 操作按钮 */}
                    <div className='flex items-center gap-1 shrink-0'>
                      <PermissionButton
                        permission='timetable.rule.manage'
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className='p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                        title='上移'
                      >
                        <ArrowUp className='w-4 h-4 text-gray-500' />
                      </PermissionButton>
                      <PermissionButton
                        permission='timetable.rule.manage'
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === periods.length - 1}
                        className='p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                        title='下移'
                      >
                        <ArrowDown className='w-4 h-4 text-gray-500' />
                      </PermissionButton>
                      <PermissionButton
                        permission='timetable.rule.manage'
                        onClick={() => handleToggleActive(period)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          period.is_active
                            ? 'hover:bg-green-50 dark:hover:bg-green-900/30 text-green-500'
                            : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400'
                        }`}
                        title={period.is_active ? '禁用' : '启用'}
                      >
                        {period.is_active ? (
                          <Check className='w-4 h-4' />
                        ) : (
                          <X className='w-4 h-4' />
                        )}
                      </PermissionButton>
                      <PermissionButton
                        permission='timetable.rule.manage'
                        onClick={() => handleEdit(period)}
                        className='p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-500'
                        title='编辑'
                      >
                        <Edit2 className='w-4 h-4' />
                      </PermissionButton>
                      <PermissionButton
                        permission='timetable.rule.manage'
                        onClick={() => handleDelete(period.id, period.name)}
                        className='p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500'
                        title='删除'
                      >
                        <Trash2 className='w-4 h-4' />
                      </PermissionButton>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 编辑/添加模态框 */}
      {showModal && (
        <div
          className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='p-6 border-b border-gray-100 dark:border-slate-700'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center'>
                    {editingPeriod ? (
                      <Edit2 className='w-5 h-5 text-white' />
                    ) : (
                      <Plus className='w-5 h-5 text-white' />
                    )}
                  </div>
                  <div>
                    <h2 className='text-xl font-bold text-gray-800 dark:text-white'>
                      {editingPeriod ? '编辑节次' : '添加新节次'}
                    </h2>
                    <p className='text-xs text-gray-500'>
                      {editingPeriod ? '修改节次的时间设置' : '创建新的课程节次定义'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className='p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5 text-gray-500' />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className='p-6 space-y-5'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  节次名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                  placeholder='例如：第一节课、早自习'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    节次编号 <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='number'
                    min='1'
                    max='20'
                    value={formData.period_number}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, period_number: parseInt(e.target.value) || 1 })
                    }
                    className='w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    排序顺序
                  </label>
                  <input
                    type='number'
                    min='0'
                    max='100'
                    value={formData.sort_order}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                    }
                    className='w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    开始时间 <span className='text-red-500'>*</span>
                  </label>
                  <div className='flex items-center gap-2'>
                    <select
                      value={formData.start_hour}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setFormData({ ...formData, start_hour: parseInt(e.target.value) })
                      }
                      className='flex-1 px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className='text-gray-500 font-medium'>:</span>
                    <select
                      value={formData.start_minute}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setFormData({ ...formData, start_minute: parseInt(e.target.value) })
                      }
                      className='flex-1 px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    结束时间 <span className='text-red-500'>*</span>
                  </label>
                  <div className='flex items-center gap-2'>
                    <select
                      value={formData.end_hour}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setFormData({ ...formData, end_hour: parseInt(e.target.value) })
                      }
                      className='flex-1 px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className='text-gray-500 font-medium'>:</span>
                    <select
                      value={formData.end_minute}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        setFormData({ ...formData, end_minute: parseInt(e.target.value) })
                      }
                      className='flex-1 px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  描述说明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors'
                  placeholder='节次描述，如：上午第一节、晚自习等'
                  rows={2}
                />
              </div>

              <div className='flex items-center gap-3'>
                <label className='flex items-center gap-3 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className='w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500'
                  />
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    启用此节次
                  </span>
                </label>
              </div>

              <div className='flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-slate-700'>
                <button
                  type='button'
                  onClick={() => setShowModal(false)}
                  className='flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium text-gray-700 dark:text-gray-300'
                >
                  取消
                </button>
                <PermissionButton
                  permission='timetable.rule.manage'
                  type='submit'
                  className='flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all font-medium shadow-lg shadow-primary-500/30'
                >
                  {editingPeriod ? '保存修改' : '添加节次'}
                </PermissionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassPeriodSettings;
