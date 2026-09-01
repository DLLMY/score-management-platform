import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Users,
  X,
  Check,
  UserPlus,
  UserMinus,
  Search,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import WorkbenchBreadcrumb from '../components/workbench/WorkbenchBreadcrumb';
import { Activity, ActivityCreateInput } from '../types';
import { ClassSelect } from '../components/form/EntitySelect';
import { ToggleSwitch } from '../components/form/ToggleSwitch';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { DateRangeField, EmptyState, LoadingSpinner } from '../components';
import { useClientFilter } from '../hooks';

interface ActivityFormData {
  id: number | null;
  title: string;
  description: string;
  activity_type: string;
  start_date: string;
  end_date: string;
  location: string;
  organizer: string;
  is_published: boolean;
}

const defaultForm: ActivityFormData = {
  id: null,
  title: '',
  description: '',
  activity_type: '文体活动',
  start_date: '',
  end_date: '',
  location: '',
  organizer: '',
  is_published: true,
};

function ActivityManage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  // 弹窗表单绑定班级：页面本地，与视图筛选严格分离
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<ActivityFormData>(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.activity.getAll();
      setActivities(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error('获取活动列表失败:', error);
      showToast('error', getErrMsg(error, '获取活动列表失败'));
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleOpenCreate = useCallback(() => {
    setFormData(defaultForm);
    setFormErrors({});
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setSelectedClassId(filterClassId > 0 ? filterClassId : 0);
    setShowModal(true);
  }, [filterClassId]);

  const handleOpenEdit = useCallback((activity: Activity) => {
    setSelectedClassId(activity.class_id ?? 0);
    setFormData({
      id: activity.id,
      title: activity.title || '',
      description: activity.description || '',
      activity_type: activity.activity_type || '文体活动',
      start_date: activity.start_date || '',
      end_date: activity.end_date || '',
      location: activity.location || '',
      organizer: activity.organizer || '',
      is_published: activity.is_published,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultForm);
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = '活动标题不能为空';
    }
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      errors.end_date = '结束日期不能早于开始日期';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (!formData.id && !selectedClassId) {
      showToast('error', '请先选择班级');
      return;
    }
    if (submitting) return; // M2: 防重复提交
    setSubmitting(true);

    try {
      const payload: ActivityCreateInput = {
        class_id: formData.id ? undefined : selectedClassId,
        title: formData.title,
        description: formData.description || undefined,
        activity_type: formData.activity_type || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        location: formData.location || undefined,
        organizer: formData.organizer || undefined,
      };

      if (formData.id) {
        await api.activity.update(formData.id, payload);
        showToast('success', '活动更新成功');
      } else {
        await api.activity.create(payload);
        showToast('success', '活动创建成功');
      }
      handleCloseModal();
      fetchActivities();
    } catch (error) {
      logger.error('保存活动失败:', error);
      showToast('error', getErrMsg(error, formData.id ? '更新活动失败' : '创建活动失败'));
    } finally {
      setSubmitting(false);
    }
  }, [
    formData,
    validateForm,
    showToast,
    handleCloseModal,
    fetchActivities,
    selectedClassId,
    submitting,
  ]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个活动吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.activity.delete(id);
        showToast('success', '活动删除成功');
        fetchActivities();
      } catch (error) {
        logger.error('删除活动失败:', error);
        showToast('error', getErrMsg(error, '删除活动失败'));
      }
    },
    [showToast, fetchActivities]
  );

  const handleRegister = useCallback(
    async (activityId: number) => {
      try {
        const studentId = Number(localStorage.getItem('studentId') || 0);
        if (!studentId) {
          showToast('warning', '未找到学生信息');
          return;
        }
        await api.activity.registerStudent(activityId, studentId);
        showToast('success', '报名成功');
        fetchActivities();
      } catch (error) {
        logger.error('报名失败:', error);
        showToast('error', getErrMsg(error, '报名失败'));
      }
    },
    [showToast, fetchActivities]
  );

  const handleCancelRegistration = useCallback(
    async (activityId: number) => {
      const ok = await confirmRef.current({
        message: '确定要取消报名吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'warning',
      });
      if (!ok) return;
      try {
        const studentId = Number(localStorage.getItem('studentId') || 0);
        if (!studentId) {
          showToast('warning', '未找到学生信息');
          return;
        }
        await api.activity.cancelRegistration(activityId, studentId);
        showToast('success', '取消报名成功');
        fetchActivities();
      } catch (error) {
        logger.error('取消报名失败:', error);
        showToast('error', getErrMsg(error, '取消报名失败'));
      }
    },
    [showToast, fetchActivities]
  );

  const handleChange = useCallback((field: keyof ActivityFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const filteredActivities = useClientFilter(
    activities,
    (a) => {
      const matchSearch =
        !searchTerm ||
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !filterType || a.activity_type === filterType;
      const matchClass = filterClassId === 0 || a.class_id === filterClassId;
      return matchSearch && matchType && matchClass;
    },
    [searchTerm, filterType, filterClassId]
  );

  const activityTypes = ['文体活动', '运动会', '文艺汇演', '志愿服务', '其他'];

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20'>
                <Calendar className='w-6 h-6 text-white' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                文体活动管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级文体活动、学生报名与参与情况
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            新建活动
          </button>
        </div>
      </div>

      <div className='px-6 py-4 flex items-center flex-wrap gap-4'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='搜索活动名称或描述...'
            aria-label='搜索活动'
            className='w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm transition-all'
          />
        </div>
        <div className='w-44 shrink-0'>
          <ClassSelect
            allowEmpty
            emptyLabel='全部班级'
            value={filterClassId}
            onChange={setFilterClassId}
          />
        </div>
        <WorkbenchBreadcrumb current='文体活动管理' />
        <CurrentClassLabel />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm'
        >
          <option value=''>全部类型</option>
          {activityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className='flex-1 px-6 pb-6 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center py-20'>
            <LoadingSpinner text='加载活动列表...' />
          </div>
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            icon='folder'
            title='暂无活动数据'
            description='还没有任何活动记录'
            actionLabel='创建第一个活动'
            onAction={handleOpenCreate}
          />
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {filteredActivities.map((activity, index) => (
              <div
                key={activity.id}
                className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 hover:shadow-md transition-all duration-300 group'
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className='absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/5 to-purple-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500' />

                <div className='relative'>
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20'>
                        <Calendar className='w-5 h-5 text-white' />
                      </div>
                      <div>
                        <h3 className='font-semibold text-slate-800 dark:text-slate-100 line-clamp-1'>
                          {activity.title}
                        </h3>
                        <span className='text-xs text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full'>
                          {activity.activity_type || '未分类'}
                        </span>
                      </div>
                    </div>
                    <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={() => handleOpenEdit(activity)}
                        className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                        title='编辑'
                      >
                        <Edit2 className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleDelete(activity.id)}
                        className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                        title='删除'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </div>

                  {activity.description && (
                    <p className='text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2'>
                      {activity.description}
                    </p>
                  )}

                  <div className='space-y-2 text-sm text-slate-500 dark:text-slate-400'>
                    {activity.start_date && (
                      <div className='flex items-center gap-2'>
                        <Calendar className='w-4 h-4' />
                        <span>
                          {activity.start_date}
                          {activity.end_date && ` ~ ${activity.end_date}`}
                        </span>
                      </div>
                    )}
                    {activity.location && (
                      <div className='flex items-center gap-2'>
                        <MapPin className='w-4 h-4' />
                        <span>{activity.location}</span>
                      </div>
                    )}
                    <div className='flex items-center gap-2'>
                      <Users className='w-4 h-4' />
                      <span>
                        已报名{' '}
                        {activity.registration_count != null ? activity.registration_count : '--'}{' '}
                        人
                      </span>
                    </div>
                  </div>

                  <div className='mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2'>
                    <button
                      onClick={() => handleRegister(activity.id)}
                      className='flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:shadow-md hover:shadow-violet-500/20 transition-all text-sm font-medium'
                    >
                      <UserPlus className='w-4 h-4' />
                      报名
                    </button>
                    <button
                      onClick={() => handleCancelRegistration(activity.id)}
                      className='flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-sm font-medium'
                    >
                      <UserMinus className='w-4 h-4' />
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-white dark:from-violet-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center'>
                    <Calendar className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑活动' : '创建活动'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  aria-label='关闭活动弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  班级 <span className='text-red-500'>*</span>
                </label>
                <ClassSelect
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  disabled={!!formData.id}
                  emptyPlaceholder='暂无班级'
                />
                {formData.id && <p className='mt-1 text-xs text-slate-400'>编辑时班级不可更改</p>}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动标题 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder='输入活动标题'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                    formErrors.title
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-violet-500'
                  }`}
                />
                {formErrors.title && (
                  <p className='mt-1 text-xs text-red-500'>{formErrors.title}</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动类型
                </label>
                <select
                  value={formData.activity_type}
                  onChange={(e) => handleChange('activity_type', e.target.value)}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-800 dark:text-slate-100'
                >
                  {activityTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder='输入活动描述'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none text-slate-800 dark:text-slate-100'
                />
              </div>

              <DateRangeField
                startValue={formData.start_date}
                endValue={formData.end_date}
                onStartChange={(v) => handleChange('start_date', v)}
                onEndChange={(v) => handleChange('end_date', v)}
                startError={null}
                endError={formErrors.end_date}
                focusColor='focus:ring-violet-500/50'
              />

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  活动地点
                </label>
                <input
                  type='text'
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder='输入活动地点'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  主办方
                </label>
                <input
                  type='text'
                  value={formData.organizer}
                  onChange={(e) => handleChange('organizer', e.target.value)}
                  placeholder='输入主办方名称'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                  发布活动
                </label>
                <ToggleSwitch
                  checked={formData.is_published}
                  onChange={(v) => handleChange('is_published', v)}
                  activeClass='bg-gradient-to-r from-violet-500 to-purple-500'
                />
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleSubmit)}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityManage;
