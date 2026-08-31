import logger from '../utils/logger';
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Star,
  User,
  Users,
  Calendar,
  CheckCircle,
  History,
} from 'lucide-react';
import api from '../services/api';
import type { ClassCommittee, CommitteeCreateInput, CommitteeTerm } from '../types';
import { useStableToast } from '../hooks/useStableToast';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import WorkbenchBreadcrumb from '../components/workbench/WorkbenchBreadcrumb';
import { useListData } from '../hooks';
import { ClassSelect, StudentSelect } from '../components/form/EntitySelect';
import { DataTable, StatCard } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { useConfirm } from '../components/ui/ConfirmDialog';

interface CommitteeFormData {
  position: string;
  class_id: number;
  student_id: number;
  responsibilities: string;
  term_start: string;
  term_end: string;
}

const POSITION_OPTIONS = [
  { value: 'monitor', label: '班长' },
  { value: 'vice_monitor', label: '副班长' },
  { value: 'study', label: '学习委员' },
  { value: 'life', label: '生活委员' },
  { value: 'sports', label: '体育委员' },
  { value: 'art', label: '文艺委员' },
  { value: 'propaganda', label: '宣传委员' },
  { value: 'organization', label: '组织委员' },
  { value: 'other', label: '其他' },
];

const defaultForm: CommitteeFormData = {
  position: 'monitor',
  // 0 = 未选择，交给 ClassSelect 自动默认第一个班级
  class_id: 0,
  student_id: 0,
  responsibilities: '',
  term_start: new Date().toISOString().split('T')[0],
  term_end: '',
};

function CommitteeListPage() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CommitteeFormData>(defaultForm);
  // 任期管理（P1 修复：后端 /api/committee/terms 已存在，此前页面未接线）
  const [showTermModal, setShowTermModal] = useState(false);
  const [terms, setTerms] = useState<CommitteeTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termForm, setTermForm] = useState({
    term_name: '',
    start_date: '',
    end_date: '',
    is_current: false,
  });
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const {
    data: committee,
    loading: isLoading,
    refetch: fetchCommittee,
  } = useListData<ClassCommittee>({
    fetcher: () => api.committee.getAll(filterClassId || undefined),
    deps: [filterClassId],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取班委名单失败:', e);
      showToast('error', '获取班委名单失败');
    },
  });

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setFormData({ ...defaultForm, class_id: filterClassId > 0 ? filterClassId : 0 });
    setShowFormModal(true);
  }, [filterClassId]);

  // ==== 任期管理（P1 接线）====
  const fetchTerms = useCallback(async () => {
    setTermsLoading(true);
    try {
      const data = await api.committee.getTerms(filterClassId || undefined);
      setTerms(data || []);
    } catch (error) {
      logger.error('获取班委任期失败:', error);
      showToast('error', '获取班委任期失败');
    } finally {
      setTermsLoading(false);
    }
  }, [filterClassId, showToast]);

  const openTermModal = useCallback(() => {
    setTermForm({ term_name: '', start_date: '', end_date: '', is_current: false });
    setShowTermModal(true);
    fetchTerms();
  }, [fetchTerms]);

  const handleCreateTerm = useCallback(async () => {
    if (!filterClassId) {
      showToast('warning', '请先选择班级');
      return;
    }
    if (!termForm.term_name.trim()) {
      showToast('warning', '请输入任期名称');
      return;
    }
    setTermsLoading(true);
    try {
      await api.committee.createTerm({
        class_id: filterClassId,
        term_name: termForm.term_name.trim(),
        start_date: termForm.start_date || undefined,
        end_date: termForm.end_date || undefined,
        is_current: termForm.is_current,
      });
      showToast('success', '任期创建成功');
      setTermForm({ term_name: '', start_date: '', end_date: '', is_current: false });
      fetchTerms();
    } catch (error) {
      logger.error('创建任期失败:', error);
      showToast('error', '创建任期失败');
    } finally {
      setTermsLoading(false);
    }
  }, [filterClassId, termForm, showToast, fetchTerms]);

  const openEditModal = useCallback((item: ClassCommittee) => {
    setEditingId(item.id);
    setFormData({
      position: item.position,
      class_id: item.class_id,
      student_id: item.student_id,
      responsibilities: item.responsibilities || '',
      term_start: item.term_start || '',
      term_end: item.term_end || '',
    });
    setShowFormModal(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.student_id) {
      showToast('warning', '请选择学生');
      return;
    }
    if (!formData.class_id) {
      showToast('warning', '请选择班级');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await api.committee.update(editingId, {
          position: formData.position,
          class_id: formData.class_id,
          student_id: formData.student_id,
          responsibilities: formData.responsibilities,
          term_start: formData.term_start,
          term_end: formData.term_end,
        });
        showToast('success', '班委信息更新成功');
      } else {
        const data: CommitteeCreateInput = {
          position: formData.position,
          class_id: formData.class_id,
          student_id: formData.student_id,
          responsibilities: formData.responsibilities,
          term_start: formData.term_start,
          term_end: formData.term_end,
        };
        await api.committee.create(data);
        showToast('success', '班委添加成功');
      }
      setShowFormModal(false);
      fetchCommittee();
    } catch (error) {
      logger.error('操作失败:', error);
      showToast('error', editingId ? '更新班委失败' : '添加班委失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, showToast, fetchCommittee]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除这条班委记录吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      setIsSubmitting(true);
      try {
        await api.committee.delete(id);
        showToast('success', '班委记录删除成功');
        fetchCommittee();
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', '删除班委记录失败');
      } finally {
        setIsSubmitting(false);
      }
    },
    [showToast, fetchCommittee]
  );

  const getPositionLabel = useCallback((value: string) => {
    return POSITION_OPTIONS.find((p) => p.value === value)?.label || value;
  }, []);

  const getPositionIcon = useCallback((position: string) => {
    const icons: Record<string, string> = {
      monitor: '🎖️',
      vice_monitor: '🥇',
      study: '📚',
      life: '🏠',
      sports: '⚽',
      art: '🎨',
      propaganda: '📢',
      organization: '🎯',
      other: '⭐',
    };
    return icons[position] || '⭐';
  }, []);

  const activeCount = committee.filter((c) => c.is_active).length;
  const ratedCount = committee.filter((c) => c.rating && c.rating > 0).length;

  const columns = useMemo<ColumnType<ClassCommittee>[]>(
    () => [
      {
        title: '职位',
        key: 'position',
        dataIndex: 'position',
        render: (_, item) => (
          <div className='flex items-center gap-2'>
            <span className='text-lg'>{getPositionIcon(item.position)}</span>
            <span className='font-medium text-slate-800 dark:text-slate-200'>
              {getPositionLabel(item.position)}
            </span>
          </div>
        ),
      },
      {
        title: '学生',
        key: 'student_name',
        dataIndex: 'student_name',
        render: (_, item) => (
          <div className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
              <User className='w-4 h-4 text-white' />
            </div>
            <span className='text-sm text-slate-700 dark:text-slate-300'>
              {item.student_name || `学生${item.student_id}`}
            </span>
          </div>
        ),
      },
      {
        title: '职责',
        key: 'responsibilities',
        dataIndex: 'responsibilities',
        render: (_, item) => (
          <span className='text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate block'>
            {item.responsibilities || '-'}
          </span>
        ),
      },
      {
        title: '任期',
        key: 'term',
        dataIndex: 'term_start',
        render: (_, item) => (
          <div className='flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400'>
            <Calendar className='w-3 h-3' />
            <span>
              {item.term_start || '-'} ~ {item.term_end || '至今'}
            </span>
          </div>
        ),
      },
      {
        title: '评价',
        key: 'rating',
        dataIndex: 'rating',
        align: 'center',
        render: (_, item) =>
          item.rating ? (
            <div className='flex items-center justify-center gap-1'>
              <Star className='w-4 h-4 text-amber-500 fill-amber-500' />
              <span className='font-medium text-slate-700 dark:text-slate-300'>
                {item.rating.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className='text-slate-400'>-</span>
          ),
      },
      {
        title: '状态',
        key: 'is_active',
        dataIndex: 'is_active',
        align: 'center',
        render: (_, item) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              item.is_active
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                item.is_active ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {item.is_active ? '在任' : '离任'}
          </span>
        ),
      },
    ],
    [getPositionIcon, getPositionLabel]
  );

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/20'>
              <Award className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                班委名单管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级班委职位、任期与评价
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='班委名单管理' />
            <CurrentClassLabel />
            <button
              onClick={openTermModal}
              className='flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:shadow-md transition-all font-medium'
            >
              <History className='w-4 h-4' />
              任期管理
            </button>
            <button
              onClick={openCreateModal}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              添加班委
            </button>
          </div>
        </div>
      </div>

      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <StatCard
            label='班委总数'
            value={committee.length}
            icon={<Users className='w-6 h-6 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
            size='sm'
          />
          <StatCard
            label='在任人数'
            value={activeCount}
            icon={<CheckCircle className='w-6 h-6 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
            size='sm'
          />
          <StatCard
            label='已评价人数'
            value={ratedCount}
            icon={<Star className='w-6 h-6 text-white' />}
            iconGradient='from-purple-500 to-pink-500'
            decoGradient='from-purple-500/10 to-pink-500/10'
            size='sm'
          />
        </div>
      </div>

      <div className='flex-1 px-6 pb-6 overflow-auto'>
        <DataTable<ClassCommittee>
          columns={columns}
          dataSource={committee}
          loading={isLoading && committee.length === 0}
          rowKey='id'
          rowClassName={() => 'group'}
          empty={{
            icon: 'folder',
            title: '暂无班委数据',
            actionLabel: '添加第一位班委',
            onAction: openCreateModal,
          }}
          scroll={{ x: 900 }}
          rowActions={(item) => (
            <div className='flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
              <button
                onClick={() => openEditModal(item)}
                aria-label='编辑班委'
                className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
              >
                <Edit2 className='w-4 h-4' />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                aria-label='删除班委'
                className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>
          )}
        />
      </div>

      {showFormModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowFormModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                    <Award className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {editingId ? '编辑班委信息' : '添加班委'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  aria-label='关闭班委编辑弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  班级 <span className='text-red-500'>*</span>
                </label>
                <ClassSelect
                  value={formData.class_id}
                  onChange={(id) => setFormData({ ...formData, class_id: id })}
                  disabled={!!editingId}
                  emptyPlaceholder='暂无班级'
                />
                {editingId && <p className='mt-1 text-xs text-slate-400'>编辑时班级不可更改</p>}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    职位
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {POSITION_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    学生 <span className='text-red-500'>*</span>
                  </label>
                  <StudentSelect
                    value={formData.student_id}
                    onChange={(id) => setFormData({ ...formData, student_id: id })}
                    allowEmpty
                    emptyLabel='请选择学生'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  职责描述
                </label>
                <textarea
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                  placeholder='描述该职位的职责'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100 resize-none'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    任期开始
                  </label>
                  <input
                    type='date'
                    value={formData.term_start}
                    onChange={(e) => setFormData({ ...formData, term_start: e.target.value })}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    任期结束
                  </label>
                  <input
                    type='date'
                    value={formData.term_end}
                    onChange={(e) => setFormData({ ...formData, term_end: e.target.value })}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowFormModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || isSubmitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTermModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowTermModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                    <History className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    班委任期管理
                  </h3>
                </div>
                <button
                  onClick={() => setShowTermModal(false)}
                  aria-label='关闭任期管理弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='px-6 py-5 space-y-5 max-h-[60vh] overflow-auto'>
              {!filterClassId ? (
                <p className='text-sm text-amber-600 dark:text-amber-400'>
                  请先在右上角选择一个班级，再进行任期管理
                </p>
              ) : (
                <>
                  <div className='space-y-2'>
                    <p className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                      现有任期
                    </p>
                    {termsLoading && terms.length === 0 ? (
                      <p className='text-sm text-slate-400 py-2'>加载中...</p>
                    ) : terms.length === 0 ? (
                      <p className='text-sm text-slate-400 dark:text-slate-500 py-2'>
                        暂无任期记录
                      </p>
                    ) : (
                      terms.map((t) => (
                        <div
                          key={t.id}
                          className='flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40'
                        >
                          <div>
                            <p className='text-sm font-medium text-slate-700 dark:text-slate-300'>
                              {t.term_name}
                              {t.is_current && (
                                <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'>
                                  当前任期
                                </span>
                              )}
                            </p>
                            <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                              {t.start_date || '未设置'} ~ {t.end_date || '至今'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className='border-t border-slate-200/50 dark:border-slate-700/50 pt-4 space-y-4'>
                    <p className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                      新建任期
                    </p>
                    <div>
                      <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                        任期名称 <span className='text-red-500'>*</span>
                      </label>
                      <input
                        type='text'
                        value={termForm.term_name}
                        onChange={(e) =>
                          setTermForm((prev) => ({ ...prev, term_name: e.target.value }))
                        }
                        placeholder='如：2026-2027学年第一学期'
                        className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                      />
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                          开始日期
                        </label>
                        <input
                          type='date'
                          value={termForm.start_date}
                          onChange={(e) =>
                            setTermForm((prev) => ({ ...prev, start_date: e.target.value }))
                          }
                          className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                          结束日期
                        </label>
                        <input
                          type='date'
                          value={termForm.end_date}
                          onChange={(e) =>
                            setTermForm((prev) => ({ ...prev, end_date: e.target.value }))
                          }
                          className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                        />
                      </div>
                    </div>
                    <label className='flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={termForm.is_current}
                        onChange={(e) =>
                          setTermForm((prev) => ({ ...prev, is_current: e.target.checked }))
                        }
                        className='w-4 h-4 accent-amber-500'
                      />
                      设为当前任期
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowTermModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                关闭
              </button>
              <button
                onClick={handleCreateTerm}
                disabled={termsLoading}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                创建任期
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommitteeListPage;
