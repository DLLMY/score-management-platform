import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Pagination } from 'antd';
import {
  ClipboardList,
  Plus,
  Trash2,
  Check,
  CheckCircle,
  Users,
  User,
  Calendar,
  MapPin,
  X,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { DutyGroup, DutyAssignment, DutyGroupCreateInput } from '../types';
import { useStableToast } from '../hooks/useStableToast';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import WorkbenchBreadcrumb from '../components/workbench/WorkbenchBreadcrumb';
import { EmptyState, LoadingSpinner, StatCard } from '../components';
import { useListData } from '../hooks';
import { ClassSelect, StudentSelect } from '../components/form/EntitySelect';
import { useConfirm } from '../components/ui/ConfirmDialog';

interface DutyFormData {
  name: string;
  class_id: number;
  day_of_week: string;
  area: string;
}

interface AssignmentFormData {
  group_id: number;
  student_id: number;
  date: string;
  task: string;
}

const DAY_OPTIONS = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
];

const AREA_OPTIONS = [
  { value: 'classroom', label: '教室' },
  { value: 'corridor', label: '走廊' },
  { value: 'toilet', label: '卫生间' },
  { value: 'stairs', label: '楼梯' },
  { value: 'other', label: '其他' },
];

const defaultDutyForm: DutyFormData = {
  name: '',
  // 0 = 未选择，交给 ClassSelect 自动默认第一个班级，避免硬编码 class_id=1 写错班
  class_id: 0,
  day_of_week: 'monday',
  area: 'classroom',
};

const defaultAssignmentForm: AssignmentFormData = {
  group_id: 0,
  student_id: 0,
  date: new Date().toISOString().split('T')[0],
  task: '',
};

function DutyRosterPage() {
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [dutyForm, setDutyForm] = useState<DutyFormData>(defaultDutyForm);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormData>(defaultAssignmentForm);
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  // M9 P1: 值日组列表服务端分页状态
  const [groupPage, setGroupPage] = useState(1);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupPages, setGroupPages] = useState(1);
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const {
    data: groups,
    loading: isLoading,
    refetch: fetchGroups,
  } = useListData<DutyGroup>({
    fetcher: async () => {
      // M9 P1: 服务端分页信封（groups 资源 key）
      const resp = await api.duty.getAll(filterClassId || undefined, {
        page: groupPage,
        per_page: 50,
      });
      setGroupTotal(resp.total);
      setGroupPages(resp.pages);
      return resp.groups || [];
    },
    deps: [filterClassId, groupPage],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取值日组列表失败:', e);
      showToast('error', '获取值日组列表失败');
    },
  });
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // S3: 值日任务数据源——首屏拉取，否则历史任务不可见、统计恒 0（M9 P1 信封解包）
  const fetchAssignments = useCallback(async () => {
    try {
      const resp = await api.duty.getAssignments();
      setAssignments(Array.isArray(resp.assignments) ? resp.assignments : []);
    } catch (error) {
      logger.error('获取值日任务失败:', error);
      showToast('error', getErrMsg(error, '获取值日任务失败'));
    }
  }, [showToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // M9 P1: 切换班级筛选时重置值日组分页到首页
  useEffect(() => {
    setGroupPage(1);
  }, [filterClassId]);

  // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
  const handleOpenCreateGroup = useCallback(() => {
    setDutyForm({ ...defaultDutyForm, class_id: filterClassId > 0 ? filterClassId : 0 });
    setShowCreateGroupModal(true);
  }, [filterClassId]);

  const handleCreateGroup = useCallback(async () => {
    if (!dutyForm.name.trim()) {
      showToast('warning', '请输入值日组名称');
      return;
    }
    if (!dutyForm.class_id) {
      showToast('warning', '请选择班级');
      return;
    }
    setIsSubmitting(true);
    try {
      const data: DutyGroupCreateInput = {
        name: dutyForm.name,
        class_id: dutyForm.class_id,
        day_of_week: dutyForm.day_of_week,
        area: dutyForm.area,
      };
      await api.duty.createGroup(data);
      showToast('success', '值日组创建成功');
      setShowCreateGroupModal(false);
      setDutyForm(defaultDutyForm);
      fetchGroups();
    } catch (error) {
      logger.error('创建值日组失败:', error);
      showToast('error', getErrMsg(error, '创建值日组失败'));
    } finally {
      setIsSubmitting(false);
    }
  }, [dutyForm, showToast, fetchGroups]);

  const handleDeleteGroup = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个值日组吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      setIsSubmitting(true);
      try {
        await api.duty.deleteGroup(id);
        showToast('success', '值日组删除成功');
        fetchGroups();
        fetchAssignments(); // S3: 删组后同步清理该组任务与统计
      } catch (error) {
        logger.error('删除值日组失败:', error);
        showToast('error', getErrMsg(error, '删除值日组失败'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [showToast, fetchGroups, fetchAssignments]
  );

  const handleAssignDuty = useCallback(async () => {
    if (!assignmentForm.group_id || !assignmentForm.student_id) {
      showToast('warning', '请选择值日组和学生');
      return;
    }
    setIsSubmitting(true);
    try {
      const data: DutyAssignment = {
        id: 0,
        group_id: assignmentForm.group_id,
        student_id: assignmentForm.student_id,
        date: assignmentForm.date,
        task: assignmentForm.task,
        is_completed: false,
      };
      await api.duty.assignDuty(data);
      showToast('success', '值日任务分配成功');
      fetchAssignments(); // S3: 以服务端为准刷新任务列表
      setShowAssignModal(false);
      setAssignmentForm(defaultAssignmentForm);
    } catch (error) {
      logger.error('分配值日任务失败:', error);
      showToast('error', getErrMsg(error, '分配值日任务失败'));
    } finally {
      setIsSubmitting(false);
    }
  }, [assignmentForm, showToast, fetchAssignments]);

  const handleMarkComplete = useCallback(
    async (assignmentId: number) => {
      try {
        await api.duty.markComplete(assignmentId);
        showToast('success', '任务已标记完成');
        fetchAssignments(); // S3: 以服务端完成时间为准刷新
      } catch (error) {
        logger.error('标记完成失败:', error);
        showToast('error', getErrMsg(error, '标记完成失败'));
      }
    },
    [showToast, fetchAssignments]
  );

  // P1 修复：值日轮转接线（后端 /api/duty/rotate 已存在，此前无入口）
  const [rotating, setRotating] = useState(false);
  const handleRotate = useCallback(async () => {
    if (!filterClassId) {
      showToast('warning', '请先选择班级后再执行轮转');
      return;
    }
    const ok = await confirmRef.current({
      message: '将当前值日任务顺延一周，确定执行轮转吗？',
      confirmText: '轮转',
      cancelText: '取消',
    });
    if (!ok) return;
    setRotating(true);
    try {
      const result = await api.duty.rotate(filterClassId, 'weekly');
      showToast('success', `值日轮转完成，共 ${result.rotated_count} 条任务顺延`);
      fetchGroups();
      fetchAssignments();
    } catch (error) {
      logger.error('值日轮转失败:', error);
      showToast('error', getErrMsg(error, '值日轮转失败'));
    } finally {
      setRotating(false);
    }
  }, [filterClassId, showToast, confirmRef, fetchGroups, fetchAssignments]);

  // 统计只覆盖当前可见（已按班级筛选）的值日组，避免筛选后数字仍是全校口径
  const visibleGroupIds = new Set(groups.map((g) => g.id));
  const visibleAssignments = assignments.filter((a) => visibleGroupIds.has(a.group_id));
  const completedCount = visibleAssignments.filter((a) => a.is_completed).length;
  const pendingCount = visibleAssignments.length - completedCount;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
              <ClipboardList className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                值日生表管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理值日组、分配值日任务、跟踪完成情况
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
            <WorkbenchBreadcrumb current='值日生表管理' />
            <CurrentClassLabel />
            <button
              onClick={handleRotate}
              disabled={rotating}
              className='flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:shadow-md transition-all font-medium disabled:opacity-50'
            >
              <RefreshCw className={`w-4 h-4 ${rotating ? 'animate-spin' : ''}`} />
              轮转值日
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              分配任务
            </button>
            <button
              onClick={handleOpenCreateGroup}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              新建值日组
            </button>
          </div>
        </div>
      </div>

      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'>
          <StatCard
            label='值日组'
            value={groups.length}
            icon={<Users className='w-6 h-6 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
            size='sm'
          />
          <StatCard
            label='待完成'
            value={pendingCount}
            icon={<ClipboardList className='w-6 h-6 text-white' />}
            iconGradient='from-blue-500 to-indigo-500'
            decoGradient='from-blue-500/10 to-indigo-500/10'
            size='sm'
          />
          <StatCard
            label='已完成'
            value={completedCount}
            icon={<CheckCircle className='w-6 h-6 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
            size='sm'
          />
        </div>
      </div>

      <div className='flex-1 px-6 pb-6 overflow-auto'>
        {isLoading && groups.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full gap-3'>
            <LoadingSpinner text='加载中...' />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon='folder'
            title={filterClassId > 0 ? '该班级暂无值日组数据' : '暂无值日组数据'}
            description='当前没有值日组数据'
            actionLabel='创建第一个值日组'
            onAction={handleOpenCreateGroup}
          />
        ) : (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            {groups.map((group) => {
              const dayLabel =
                DAY_OPTIONS.find((d) => d.value === group.day_of_week)?.label || group.day_of_week;
              const areaLabel =
                AREA_OPTIONS.find((a) => a.value === group.area)?.label || group.area;
              const groupAssignments = assignments.filter((a) => a.group_id === group.id);

              return (
                <div
                  key={group.id}
                  className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden hover:shadow-md transition-shadow'
                >
                  <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                        <Users className='w-5 h-5 text-white' />
                      </div>
                      <div>
                        <h3 className='font-semibold text-slate-800 dark:text-slate-100'>
                          {group.name}
                        </h3>
                        <div className='flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                          <span className='flex items-center gap-1'>
                            <Calendar className='w-3 h-3' />
                            {dayLabel}
                          </span>
                          <span className='flex items-center gap-1'>
                            <MapPin className='w-3 h-3' />
                            {areaLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      aria-label={`删除值日组 ${group.name}`}
                      className='p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                  <div className='p-4'>
                    {groupAssignments.length === 0 ? (
                      <p className='text-sm text-slate-400 dark:text-slate-500 text-center py-4'>
                        暂无分配任务
                      </p>
                    ) : (
                      <div className='space-y-2'>
                        {groupAssignments.map((a) => (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              a.is_completed
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                            }`}
                          >
                            <div className='flex items-center gap-3'>
                              <User
                                className={`w-4 h-4 ${
                                  a.is_completed ? 'text-emerald-500' : 'text-slate-400'
                                }`}
                              />
                              <div>
                                <p
                                  className={`text-sm font-medium ${
                                    a.is_completed
                                      ? 'text-emerald-700 dark:text-emerald-400 line-through'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {a.student_name || `学生${a.student_id}`}
                                </p>
                                <p className='text-xs text-slate-500 dark:text-slate-400'>
                                  {a.task || '清洁任务'} · {a.date}
                                </p>
                              </div>
                            </div>
                            {!a.is_completed && (
                              <button
                                onClick={() => handleMarkComplete(a.id)}
                                className='flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:shadow-md transition-all text-xs font-medium'
                              >
                                <Check className='w-3 h-3' />
                                完成
                              </button>
                            )}
                            {a.is_completed && (
                              <span className='flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400'>
                                <CheckCircle className='w-4 h-4' />
                                已完成
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {groupTotal > 50 && (
          <div className='mt-5 flex justify-center'>
            <Pagination
              current={groupPage}
              total={groupTotal}
              pageSize={50}
              onChange={(p) => setGroupPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {showCreateGroupModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowCreateGroupModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                    <ClipboardList className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    新建值日组
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  aria-label='关闭新建值日组弹窗'
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
                  value={dutyForm.class_id}
                  onChange={(id) => setDutyForm({ ...dutyForm, class_id: id })}
                  emptyPlaceholder='暂无班级'
                />
              </div>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  组名 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={dutyForm.name}
                  onChange={(e) => setDutyForm({ ...dutyForm, name: e.target.value })}
                  placeholder='如：第一值日组'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    值日日期
                  </label>
                  <select
                    value={dutyForm.day_of_week}
                    onChange={(e) => setDutyForm({ ...dutyForm, day_of_week: e.target.value })}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    负责区域
                  </label>
                  <select
                    value={dutyForm.area}
                    onChange={(e) => setDutyForm({ ...dutyForm, area: e.target.value })}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {AREA_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleCreateGroup)}
                disabled={isLoading || isSubmitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                    <ClipboardList className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    分配值日任务
                  </h3>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  aria-label='关闭分配任务弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  选择值日组 <span className='text-red-500'>*</span>
                </label>
                <select
                  value={assignmentForm.group_id}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, group_id: parseInt(e.target.value) })
                  }
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                >
                  <option value={0}>请选择值日组</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  学生 <span className='text-red-500'>*</span>
                </label>
                <StudentSelect
                  value={assignmentForm.student_id}
                  onChange={(id) => setAssignmentForm({ ...assignmentForm, student_id: id })}
                  allowEmpty
                  emptyLabel='请选择学生'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    日期
                  </label>
                  <input
                    type='date'
                    value={assignmentForm.date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    任务描述
                  </label>
                  <input
                    type='text'
                    value={assignmentForm.task}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, task: e.target.value })}
                    placeholder='如：擦黑板'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowAssignModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={handleAssignDuty}
                disabled={isLoading || isSubmitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                分配
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DutyRosterPage;
