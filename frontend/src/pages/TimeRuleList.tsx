import logger from '../utils/logger';
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  FormEvent,
  ChangeEvent,
} from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  Save,
  X,
  Search,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import { useForm, useModal } from '../hooks';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useStableToast } from '../hooks/useStableToast';
import { validateForm } from '../utils/validation';
import { Button, PermissionButton, DataTable } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useDebouncedValue } from '../hooks';

interface TimeRule {
  id: number;
  name: string;
  description: string;
  day_of_week: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  is_active: boolean;
  allow_unlock: boolean;
}

interface FormData {
  name: string;
  description: string;
  day_of_week: number;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  is_active: boolean;
  allow_unlock: boolean;
  [key: string]: unknown;
}

interface FormErrors {
  name?: string;
  description?: string;
  start_hour?: string;
  start_minute?: string;
  end_hour?: string;
  end_minute?: string;
  time?: string;
  [key: string]: string | undefined;
}

const weekDays = [
  { value: -1, label: '每天' },
  { value: 0, label: '周一' },
  { value: 1, label: '周二' },
  { value: 2, label: '周三' },
  { value: 3, label: '周四' },
  { value: 4, label: '周五' },
  { value: 5, label: '周六' },
  { value: 6, label: '周日' },
];

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
  } = useForm<FormData>(
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
    } catch (error: any) {
      showToast('error', '删除失败: ' + error.message);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>): Promise<void> => {
    e?.preventDefault();

    const { isValid, errors } = validateForm(formData, validationRules);

    if (!isValid) {
      setFormErrors(errors as FormErrors);
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
    } catch (error: any) {
      showToast('error', '保存失败: ' + error.message);
    }
  };

  const getDayLabel = useCallback((value: number): string => {
    const day = weekDays.find((d) => d.value === value);
    return day ? day.label : '未知';
  }, []);

  const formatTime = useCallback((hour: number, minute: number): string => {
    const h = parseInt(String(hour), 10) || 0;
    const m = parseInt(String(minute), 10) || 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }, []);

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

  const columns = useMemo<ColumnType<TimeRule>[]>(
    () => [
      {
        title: '规则名称',
        key: 'name',
        dataIndex: 'name',
        render: (_, rule) => (
          <div className='flex items-center gap-2'>
            <span className='font-medium text-gray-800'>{rule.name}</span>
            {rule.description && (
              <span className='text-xs text-gray-400'>- {rule.description}</span>
            )}
          </div>
        ),
      },
      {
        title: '时间段',
        key: 'time_range',
        render: (_, rule) => (
          <span className='text-gray-600'>
            {formatTime(rule.start_hour, rule.start_minute)} -{' '}
            {formatTime(rule.end_hour, rule.end_minute)}
          </span>
        ),
      },
      {
        title: '适用星期',
        key: 'day_of_week',
        dataIndex: 'day_of_week',
        render: (value) => <span className='text-gray-600'>{getDayLabel(value as number)}</span>,
      },
      {
        title: '状态',
        key: 'status',
        render: (_, rule) => (
          <div className='flex items-center gap-2'>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                rule.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {rule.is_active ? '启用' : '禁用'}
            </span>
            <span className={`badge ${rule.allow_unlock ? 'badge-success' : 'badge-danger'}`}>
              {rule.allow_unlock ? '允许开锁' : '禁止开锁'}
            </span>
          </div>
        ),
      },
    ],
    [formatTime, getDayLabel]
  );

  return (
    <div className='space-y-6'>
      {loadError && (
        <div className='flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            时间规则加载失败，当前列表可能不完整，请刷新重试
          </p>
        </div>
      )}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='p-3 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl'>
            <Clock className='w-6 h-6 text-indigo-600' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-800'>时间规则管理</h1>
            <p className='text-sm text-gray-500'>管理手机箱开锁的时间规则</p>
          </div>
        </div>
        <PermissionButton permission='timetable.rule.manage' onClick={handleAdd}>
          <Plus className='w-5 h-5' />
          添加规则
        </PermissionButton>
      </div>

      <div className='card'>
        <div className='card-body p-0'>
          <div className='px-6 py-4 border-b border-gray-200 bg-gray-50'>
            <div className='flex flex-wrap items-center gap-3'>
              <div className='relative max-w-md flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                <input
                  type='text'
                  placeholder='搜索规则名称或描述...'
                  value={searchTerm}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50'
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className='px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/50'
              >
                <option value='all'>全部状态</option>
                <option value='active'>启用</option>
                <option value='inactive'>禁用</option>
              </select>
            </div>
          </div>
          <DataTable<TimeRule>
            columns={columns}
            dataSource={filteredRules}
            loading={loading}
            rowKey='id'
            empty={{
              title: '暂无时间规则',
              description: '点击上方按钮添加',
            }}
            scroll={{ x: 800 }}
            rowActions={(rule) => (
              <div className='flex items-center gap-2'>
                <PermissionButton
                  permission='timetable.rule.manage'
                  onClick={() => handleEdit(rule)}
                  className='btn-icon text-gray-500 hover:text-primary-600'
                  title='编辑'
                >
                  <Edit2 className='w-4 h-4' />
                </PermissionButton>
                <PermissionButton
                  permission='timetable.rule.manage'
                  onClick={() => handleDelete(rule.id)}
                  className='btn-icon text-gray-500 hover:text-danger-600'
                  title='删除'
                >
                  <Trash2 className='w-4 h-4' />
                </PermissionButton>
              </div>
            )}
          />
        </div>
      </div>

      {showModal && (
        <div className='modal-overlay' onClick={closeModal}>
          <div className='modal-content max-w-md' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center'>
                  {editingRule ? (
                    <Edit2 className='w-5 h-5 text-white' />
                  ) : (
                    <Plus className='w-5 h-5 text-white' />
                  )}
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    {editingRule ? '编辑时间规则' : '添加新规则'}
                  </h3>
                  <p className='text-xs text-gray-500'>
                    {editingRule ? '修改规则的详细信息' : '创建新的时间规则'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSubmit(handleSubmit);
              }}
              className='modal-body'
            >
              <div className='form-group'>
                <label className='form-label'>
                  规则名称 <span className='text-danger-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) {
                      setFormErrors({ ...formErrors, name: undefined });
                    }
                  }}
                  className={`form-input ${
                    formErrors.name ? 'border-danger-300 focus:ring-danger-500' : ''
                  }`}
                  placeholder='如：上午上课'
                />
                {formErrors.name && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className='form-group'>
                <label className='form-label'>描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) {
                      setFormErrors({ ...formErrors, description: undefined });
                    }
                  }}
                  className={`form-textarea ${
                    formErrors.description ? 'border-danger-300 focus:ring-danger-500' : ''
                  }`}
                  placeholder='规则描述'
                  rows={2}
                />
                {formErrors.description && (
                  <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className='form-group'>
                <label className='form-label'>适用星期</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setFormData({ ...formData, day_of_week: parseInt(e.target.value) })
                  }
                  className='form-select'
                >
                  {weekDays.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='form-group'>
                  <label className='form-label'>开始时间</label>
                  <div className='flex gap-2 items-center'>
                    <select
                      value={formData.start_hour}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setFormData({ ...formData, start_hour: parseInt(e.target.value) });
                        if (formErrors.start_hour || formErrors.time) {
                          setFormErrors({ ...formErrors, start_hour: undefined, time: undefined });
                        }
                      }}
                      className={`form-select flex-1 ${
                        formErrors.start_hour ? 'border-danger-300 focus:ring-danger-500' : ''
                      }`}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className='text-gray-400 font-semibold'>:</span>
                    <select
                      value={formData.start_minute}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setFormData({ ...formData, start_minute: parseInt(e.target.value) });
                        if (formErrors.start_minute || formErrors.time) {
                          setFormErrors({
                            ...formErrors,
                            start_minute: undefined,
                            time: undefined,
                          });
                        }
                      }}
                      className={`form-select flex-1 ${
                        formErrors.start_minute ? 'border-danger-300 focus:ring-danger-500' : ''
                      }`}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <option key={m} value={m}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(formErrors.start_hour || formErrors.start_minute) && (
                    <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                      <AlertCircle className='w-4 h-4' />
                      {formErrors.start_hour || formErrors.start_minute}
                    </p>
                  )}
                </div>
                <div className='form-group'>
                  <label className='form-label'>结束时间</label>
                  <div className='flex gap-2 items-center'>
                    <select
                      value={formData.end_hour}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setFormData({ ...formData, end_hour: parseInt(e.target.value) });
                        if (formErrors.end_hour || formErrors.time) {
                          setFormErrors({ ...formErrors, end_hour: undefined, time: undefined });
                        }
                      }}
                      className={`form-select flex-1 ${
                        formErrors.end_hour ? 'border-danger-300 focus:ring-danger-500' : ''
                      }`}
                    >
                      {Array.from({ length: 25 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className='text-gray-400 font-semibold'>:</span>
                    <select
                      value={formData.end_minute}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setFormData({ ...formData, end_minute: parseInt(e.target.value) });
                        if (formErrors.end_minute || formErrors.time) {
                          setFormErrors({ ...formErrors, end_minute: undefined, time: undefined });
                        }
                      }}
                      className={`form-select flex-1 ${
                        formErrors.end_minute ? 'border-danger-300 focus:ring-danger-500' : ''
                      }`}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                        <option key={m} value={m}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(formErrors.end_hour || formErrors.end_minute) && (
                    <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                      <AlertCircle className='w-4 h-4' />
                      {formErrors.end_hour || formErrors.end_minute}
                    </p>
                  )}
                </div>
              </div>

              {formErrors.time && (
                <div className='form-group'>
                  <p className='text-sm text-danger-600 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.time}
                  </p>
                </div>
              )}

              <div className='flex items-center gap-8'>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        formData.is_active ? 'left-6' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className='text-sm text-gray-700'>启用规则</span>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData({ ...formData, allow_unlock: !formData.allow_unlock })
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.allow_unlock ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        formData.allow_unlock ? 'left-6' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className='text-sm text-gray-700'>允许开锁</span>
                </div>
              </div>

              <div className='modal-footer'>
                <Button variant='outline' onClick={closeModal}>
                  取消
                </Button>
                <Button type='submit' disabled={submitting}>
                  <Save className='w-4 h-4' />
                  保存
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRuleList;
