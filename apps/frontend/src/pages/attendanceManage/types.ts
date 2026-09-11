import type { Attendance, LeaveApplication, AttendanceStats } from '../../types';
import type { ColumnType } from '../../components';
import type { Dispatch, SetStateAction } from 'react';
import type { useSubmitGuard } from '../../hooks';

export interface QuickRecordForm {
  class_id: number;
  student_id: number;
  date: string;
  period: string;
  status: string;
}

export interface LeaveFormData {
  student_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

// M3: 考勤录入草稿（记录/请假表单 + 当前打开的弹窗）
export interface AttendanceDraft {
  recordForm: QuickRecordForm;
  leaveForm: LeaveFormData;
  activeModal: 'record' | 'leave' | null;
}

export type SetRecordForm = Dispatch<SetStateAction<QuickRecordForm>>;
export type SetLeaveForm = Dispatch<SetStateAction<LeaveFormData>>;
export type RunSubmit = ReturnType<typeof useSubmitGuard>['run'];

export interface AttendanceManageViewProps {
  // 草稿恢复
  draftAvailable: boolean;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  // 统计
  stats: AttendanceStats | null;
  // 班级筛选 + 头部操作
  filterClassId: number;
  setFilterClassId: (id: number) => void;
  showLeavesPanel: boolean;
  setShowLeavesPanel: (v: boolean) => void;
  pendingLeaves: LeaveApplication[];
  handleOpenLeaveModal: () => void;
  handleOpenRecordModal: () => void;
  // 待审批面板
  leavesError: boolean;
  leavesPage: number;
  leavesTotal: number;
  setLeavesPage: (p: number) => void;
  handleApproveLeave: (leaveId: number, approve: boolean) => void;
  // 列表
  columns: ColumnType<Attendance>[];
  filteredAttendances: Attendance[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  attendancePage: number;
  attendanceTotal: number;
  setAttendancePage: (p: number) => void;
  // 快速记录模态
  showRecordModal: boolean;
  closeRecordModal: () => void;
  recordForm: QuickRecordForm;
  setRecordForm: SetRecordForm;
  handleBatchRecord: (status: string) => void;
  handleRecordSubmit: () => void;
  // 请假模态
  showLeaveModal: boolean;
  closeLeaveModal: () => void;
  leaveForm: LeaveFormData;
  setLeaveForm: SetLeaveForm;
  handleLeaveSubmit: () => void;
  // 通用
  errors: Partial<Record<string, string>>;
  submitting: boolean;
  runSubmit: RunSubmit;
}
