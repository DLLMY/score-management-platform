import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { DutyGroup, DutyAssignment, DutyGroupCreateInput } from '../types';
import { useStableToast, useSubmitGuard, useWorkbenchClass, useListData } from '../hooks';
import { useConfirm } from '../components';
import DutyRosterView, {
  DutyFormData,
  AssignmentFormData,
  defaultDutyForm,
  defaultAssignmentForm,
} from './dutyRoster/DutyRosterView';

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

  return (
    <DutyRosterView
      groups={groups}
      assignments={assignments}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      rotating={rotating}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      showCreateGroupModal={showCreateGroupModal}
      setShowCreateGroupModal={setShowCreateGroupModal}
      showAssignModal={showAssignModal}
      setShowAssignModal={setShowAssignModal}
      dutyForm={dutyForm}
      setDutyForm={setDutyForm}
      assignmentForm={assignmentForm}
      setAssignmentForm={setAssignmentForm}
      groupPage={groupPage}
      setGroupPage={setGroupPage}
      groupTotal={groupTotal}
      runSubmit={runSubmit}
      handleOpenCreateGroup={handleOpenCreateGroup}
      handleCreateGroup={handleCreateGroup}
      handleDeleteGroup={handleDeleteGroup}
      handleAssignDuty={handleAssignDuty}
      handleMarkComplete={handleMarkComplete}
      handleRotate={handleRotate}
    />
  );
}

export default DutyRosterPage;
