import { useState, useCallback, useMemo, useRef, FormEvent, ChangeEvent } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  RefreshCw,
  Trophy,
  Star,
  Award,
  Medal,
  Crown,
  Sparkles,
  Zap,
  RotateCcw,
  Shield,
  Eye,
  Monitor,
  CheckCircle,
  TrendingUp,
  Rocket,
} from 'lucide-react';
import api, { RankRule } from '../services/api';
import { useForm, useModal, useListData } from '../hooks';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useStableToast } from '../hooks/useStableToast';
import { validateForm } from '../utils/validation';
import { PermissionButton } from '../components';
import { ToggleSwitch } from '../components/form/ToggleSwitch';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useDebouncedValue } from '../hooks';

const ICONS = [
  'Star',
  'Award',
  'Medal',
  'Crown',
  'Sparkles',
  'Zap',
  'RotateCcw',
  'Shield',
  'AlertCircle',
  'Eye',
  'Search',
  'Monitor',
  'CheckCircle',
  'TrendingUp',
  'Rocket',
];

const COLORS: string[] = [
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#84CC16',
];

interface FormData {
  name: string;
  min_score: number;
  max_score: number;
  color: string;
  icon: string;
  description: string;
  is_active: boolean;
  unlock_min_score: number | null;
  weekly_unlock_limit: number | null;
  [key: string]: unknown;
}

interface FormErrors {
  name?: string;
  min_score?: string;
  max_score?: string;
  description?: string;
  range?: string;
  [key: string]: string | undefined;
}

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  Star,
  Award,
  Medal,
  Crown,
  Sparkles,
  Zap,
  RotateCcw,
  Shield,
  AlertCircle,
  Eye,
  Search,
  Monitor,
  CheckCircle,
  TrendingUp,
  Rocket,
};

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
      color: COLORS[0],
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
      setFormErrors(errors as FormErrors);
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

  const getIconComponent = useCallback((iconName: string) => {
    return ICON_MAP[iconName] || Star;
  }, []);

  const sortedRules = useMemo(() => {
    return [...filteredRules].sort((a, b) => b.min_score - a.min_score);
  }, [filteredRules]);

  return (
    <div className='max-w-6xl mx-auto'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30'>
            <Trophy className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='page-title'>排名规则</h2>
            <p className='page-subtitle'>管理积分排名等级和分数段配置</p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => fetchRankRules()}
            className='btn btn-outline flex items-center gap-2'
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={() => {
              setEditingRule(null);
              openModal();
            }}
            className='btn btn-primary shadow-lg hover:shadow-xl transition-all'
          >
            <Plus className='w-5 h-5 mr-2' />
            添加等级
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center gap-3'>
          <AlertCircle className='w-5 h-5' />
          <span>{error.message}</span>
          <button
            onClick={() => {
              fetchRankRules();
            }}
            className='ml-auto text-danger-600 hover:text-danger-800'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>
      )}

      <div className='bg-white rounded-2xl border border-gray-200/50 shadow-lg'>
        <div className='px-6 py-5 border-b border-gray-200/50 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
            <input
              type='text'
              placeholder='搜索等级名称...'
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className='w-full md:w-72 px-12 py-3 bg-gray-100/50 border border-gray-200/50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50'
            />
          </div>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2 px-4 py-2 bg-primary-50/80 rounded-xl'>
              <Trophy className='w-4 h-4 text-primary-500' />
              <span className='text-sm font-semibold text-primary-600'>
                {filteredRules.length} 个等级
              </span>
            </div>
          </div>
        </div>

        <div className='px-6 py-6'>
          {isLoading ? (
            <div className='flex items-center justify-center py-16'>
              <div className='flex flex-col items-center'>
                <div className='w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mb-3' />
                <span className='text-gray-400 text-sm'>加载中...</span>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {sortedRules.map((rule) => {
                const IconComponent = getIconComponent(rule.icon);
                return (
                  <div
                    key={rule.id}
                    className='bg-white rounded-2xl p-6 border border-gray-200/50 hover:border-gray-300/70 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden shadow-sm'
                    style={{ borderColor: `${rule.color}40` }}
                  >
                    <div
                      className='absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-5'
                      style={{ backgroundColor: rule.color }}
                    />

                    <div className='relative'>
                      <div className='flex items-start justify-between mb-4'>
                        <div className='flex items-center gap-4'>
                          <div
                            className='w-14 h-14 rounded-xl flex items-center justify-center shadow-md'
                            style={{ backgroundColor: `${rule.color}15` }}
                          >
                            <IconComponent className='w-7 h-7' style={{ color: rule.color }} />
                          </div>
                          <div>
                            <h3 className='text-xl font-bold text-gray-800'>{rule.name}</h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold mt-1 inline-block ${
                                rule.is_active
                                  ? 'bg-green-50 text-green-600 border border-green-200/30'
                                  : 'bg-gray-100/50 text-gray-500'
                              }`}
                            >
                              {rule.is_active ? '启用' : '禁用'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className='bg-gray-50/80 rounded-xl p-4 mb-4'>
                        <div className='flex items-center justify-between'>
                          <span className='text-sm text-gray-500'>分数范围</span>
                          <span className='font-bold text-lg' style={{ color: rule.color }}>
                            {rule.min_score} - {rule.max_score} 分
                          </span>
                        </div>
                        {(rule.unlock_min_score !== null || rule.weekly_unlock_limit !== null) && (
                          <div className='mt-2 pt-2 border-t border-gray-200/50 grid grid-cols-2 gap-2 text-xs'>
                            {rule.unlock_min_score !== null && (
                              <div className='flex items-center gap-1'>
                                <span className='text-gray-400'>开门分数:</span>
                                <span className='font-semibold text-amber-600'>
                                  {rule.unlock_min_score}
                                </span>
                              </div>
                            )}
                            {rule.weekly_unlock_limit !== null && (
                              <div className='flex items-center gap-1'>
                                <span className='text-gray-400'>每周次数:</span>
                                <span className='font-semibold text-blue-600'>
                                  {rule.weekly_unlock_limit}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className='mt-3 h-2 bg-gray-200 rounded-full overflow-hidden'>
                          <div
                            className='h-full rounded-full transition-all'
                            style={{
                              width: `${((rule.max_score - rule.min_score) / 100) * 100}%`,
                              backgroundColor: rule.color,
                            }}
                          />
                        </div>
                      </div>

                      {rule.description && (
                        <p className='text-sm text-gray-600 mb-4'>{rule.description}</p>
                      )}

                      <div className='flex items-center justify-between pt-4 border-t border-gray-200/50'>
                        <div className='flex items-center gap-2'>
                          <div
                            className='w-5 h-5 rounded-full border-2 border-gray-300'
                            style={{ backgroundColor: rule.color }}
                          />
                          <span className='text-xs text-gray-500 font-mono'>{rule.color}</span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <button
                            onClick={() => {
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
                            }}
                            className='p-2.5 rounded-xl text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-all'
                          >
                            <Edit2 className='w-5 h-5' />
                          </button>
                          <PermissionButton
                            permission='rank-rule.manage'
                            onClick={() => handleDelete(rule.id)}
                            className='p-2.5 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all'
                          >
                            <Trash2 className='w-5 h-5' />
                          </PermissionButton>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredRules.length === 0 && (
                <div className='col-span-full text-center py-20'>
                  <div className='w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5'>
                    <Trophy className='w-12 h-12 text-gray-400' />
                  </div>
                  <h3 className='text-xl font-semibold text-gray-700 mb-2'>暂无排名规则</h3>
                  <p className='text-gray-500 mb-6'>添加等级开始配置排名体系</p>
                  <button
                    onClick={() => openModal()}
                    className='bg-gradient-to-r from-primary-500 via-blue-500 to-accent-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] transition-all'
                  >
                    <Plus className='w-5 h-5 mr-2 inline' />
                    添加第一个等级
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className='fixed inset-0 bg-black/40 backdrop-blur-md flex items-start justify-center z-[100] p-4 pt-16'
          onClick={closeModal}
        >
          <div
            className='bg-white rounded-2xl border border-gray-200/50 w-full max-w-md overflow-hidden shadow-xl animate-slide-up'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='px-6 py-5 border-b border-gray-200/50 flex items-center justify-between bg-gray-50/50'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center'>
                  {editingRule ? (
                    <Edit2 className='w-5 h-5 text-white' />
                  ) : (
                    <Plus className='w-5 h-5 text-white' />
                  )}
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    {editingRule ? '编辑等级' : '添加新等级'}
                  </h3>
                  <p className='text-xs text-gray-500'>
                    {editingRule ? '修改等级的详细信息' : '创建新的积分等级'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className='p-2.5 hover:bg-gray-100/50 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSubmit(handleSubmit);
              }}
              className='px-6 py-6 space-y-5'
            >
              <div className='mb-5'>
                <label className='block text-sm font-semibold text-gray-700 mb-2.5'>
                  等级名称 <span className='text-red-500'>*</span>
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
                  className={`w-full px-4 py-3 bg-gray-100/50 border border-gray-200/50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                    formErrors.name ? 'border-red-500/50 focus:ring-red-500/50' : ''
                  }`}
                  placeholder='如：卓越、优秀、合格'
                />
                {formErrors.name && (
                  <p className='mt-2 text-sm text-red-500 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.name}
                  </p>
                )}
              </div>

              {formErrors.range && (
                <div className='mb-5'>
                  <p className='text-sm text-red-500 flex items-center gap-1'>
                    <AlertCircle className='w-4 h-4' />
                    {formErrors.range}
                  </p>
                </div>
              )}

              <div className='grid grid-cols-2 gap-4'>
                <div className='mb-5'>
                  <label className='block text-sm font-semibold text-gray-700 mb-2.5'>
                    最低分 <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='number'
                    min='0'
                    value={formData.min_score}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setFormData({ ...formData, min_score: parseInt(e.target.value) || 0 });
                      if (formErrors.min_score || formErrors.range) {
                        setFormErrors({ ...formErrors, min_score: undefined, range: undefined });
                      }
                    }}
                    className={`w-full px-4 py-3 bg-gray-100/50 border border-gray-200/50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                      formErrors.min_score ? 'border-red-500/50 focus:ring-red-500/50' : ''
                    }`}
                    placeholder='0'
                  />
                  {formErrors.min_score && (
                    <p className='mt-2 text-sm text-red-500 flex items-center gap-1'>
                      <AlertCircle className='w-4 h-4' />
                      {formErrors.min_score}
                    </p>
                  )}
                </div>
                <div className='mb-5'>
                  <label className='block text-sm font-semibold text-gray-700 mb-2.5'>
                    最高分 <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='number'
                    min='0'
                    value={formData.max_score}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setFormData({ ...formData, max_score: parseInt(e.target.value) || 100 });
                      if (formErrors.max_score || formErrors.range) {
                        setFormErrors({ ...formErrors, max_score: undefined, range: undefined });
                      }
                    }}
                    className={`w-full px-4 py-3 bg-gray-100/50 border border-gray-200/50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                      formErrors.max_score ? 'border-red-500/50 focus:ring-red-500/50' : ''
                    }`}
                    placeholder='100'
                  />
                  {formErrors.max_score && (
                    <p className='mt-2 text-sm text-red-500 flex items-center gap-1'>
                      <AlertCircle className='w-4 h-4' />
                      {formErrors.max_score}
                    </p>
                  )}
                </div>
              </div>

              <div className='mb-5'>
                <label className='block text-sm font-semibold text-gray-700 mb-2.5'>描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) {
                      setFormErrors({ ...formErrors, description: undefined });
                    }
                  }}
                  className='w-full px-4 py-3 bg-gray-100/50 border border-gray-200/50 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 resize-none'
                  rows={3}
                  placeholder='等级描述...'
                />
              </div>

              <div className='mb-5'>
                <label className='block text-sm font-semibold text-gray-700 mb-2.5'>图标</label>
                <div className='flex flex-wrap gap-2'>
                  {ICONS.map((iconName) => {
                    const Icon = ICON_MAP[iconName];
                    return (
                      <button
                        key={iconName}
                        type='button'
                        onClick={() => setFormData({ ...formData, icon: iconName })}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          formData.icon === iconName
                            ? 'bg-primary-100 ring-2 ring-primary-500'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <Icon className='w-5 h-5 text-gray-600' />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className='mb-5'>
                <label className='block text-sm font-semibold text-gray-700 mb-2.5'>颜色</label>
                <div className='flex flex-wrap gap-2'>
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type='button'
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-all ${
                        formData.color === color
                          ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl mb-5'>
                <label className='text-sm font-medium text-gray-700 dark:text-slate-300'>
                  启用
                </label>
                <ToggleSwitch
                  checked={formData.is_active}
                  onChange={(v) => setFormData({ ...formData, is_active: v })}
                />
              </div>

              <div className='flex gap-3 pt-4'>
                <button
                  type='button'
                  onClick={closeModal}
                  className='flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors'
                >
                  取消
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  className='flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50'
                >
                  {editingRule ? '保存修改' : '添加等级'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RankRuleList;
