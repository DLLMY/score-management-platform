import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef, ChangeEvent, useMemo, useReducer } from 'react';
import * as LucideIcons from 'lucide-react';
import { Card, Button, Modal, LoadingSpinner, PermissionButton } from '../components';
import ImportExportPanel from '../components/special/ImportExportPanel';
import { useStableToast } from '../hooks/useStableToast';
import { useModal, useConfirmDialog } from '../hooks';
import api, { getAuthHeaders } from '../services/api';
import type { User, Subject } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useDebouncedValue, useThrottledCallback } from '../hooks';

// 班级信息类型
interface ClassInfo {
  id: number;
  name: string;
  description?: string;
}

// 考试类型
interface Exam {
  id: number;
  name: string;
  exam_time?: string;
}

// 提取需要的图标
const {
  Upload,
  CheckCircle,
  Download,
  RefreshCw,
  Save,
  Printer,
  Trash2,
  Filter,
  BarChart3,
  RotateCcw,
  Copy,
} = LucideIcons;

// 成绩项接口
interface ScoreItem {
  id?: number;
  student_id: number;
  subject_id?: number;
  subject: string;
  score?: number | null;
  status?: 'pending' | 'confirmed' | 'locked';
}

// 考试数据接口
interface ExamData extends Exam {
  subjects?: string | string[];
  status?: string;
  start_time?: string;
}

// 待保存更改接口
interface PendingChange {
  student_id: number;
  subject: string;
  subject_id?: number;
  score: number;
}

// 导入结果接口
interface ImportResult {
  successCount: number;
  failedCount: number;
  failedMessages: string[];
  errors?: Array<{ row?: number; error_fields: string[]; message: string; row_data?: Record<string, unknown> }>;
}

// 单元格位置接口
interface CellPosition {
  studentId: number;
  subject: string;
}

interface ScoreEntryState {
  exams: ExamData[];
  selectedExam: string;
  classes: ClassInfo[];
  selectedClass: string;
  students: User[];
  subjects: Subject[];
  scores: Record<string, ScoreItem>;
  loading: boolean;
  importFile: File | null;
  editingCell: CellPosition | null;
  filterSubject: string;
  statusFilter: string;
  batchSubject: string;
  importResult: ImportResult | null;
  pendingChanges: Record<string, PendingChange>;
}

type ScoreEntryAction =
  | { type: 'SET_EXAMS'; payload: ExamData[] }
  | { type: 'SET_SELECTED_EXAM'; payload: string }
  | { type: 'SET_CLASSES'; payload: ClassInfo[] }
  | { type: 'SET_SELECTED_CLASS'; payload: string }
  | { type: 'SET_STUDENTS'; payload: User[] }
  | { type: 'SET_SUBJECTS'; payload: Subject[] }
  | { type: 'SET_SCORES'; payload: Record<string, ScoreItem> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_IMPORT_FILE'; payload: File | null }
  | { type: 'SET_EDITING_CELL'; payload: CellPosition | null }
  | { type: 'SET_FILTER_SUBJECT'; payload: string }
  | { type: 'SET_STATUS_FILTER'; payload: string }
  | { type: 'SET_BATCH_SUBJECT'; payload: string }
  | { type: 'SET_IMPORT_RESULT'; payload: ImportResult | null }
  | { type: 'SET_PENDING_CHANGES'; payload: Record<string, PendingChange> }
  | { type: 'UPDATE_SCORE'; payload: { key: string; score: ScoreItem } }
  | { type: 'ADD_PENDING_CHANGE'; payload: { key: string; change: PendingChange } }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'CLEAR_PENDING_CHANGES' };

function scoreEntryReducer(state: ScoreEntryState, action: ScoreEntryAction): ScoreEntryState {
  switch (action.type) {
    case 'SET_EXAMS':
      return { ...state, exams: action.payload };
    case 'SET_SELECTED_EXAM':
      return { ...state, selectedExam: action.payload };
    case 'SET_CLASSES':
      return { ...state, classes: action.payload };
    case 'SET_SELECTED_CLASS':
      return { ...state, selectedClass: action.payload };
    case 'SET_STUDENTS':
      return { ...state, students: action.payload };
    case 'SET_SUBJECTS':
      return { ...state, subjects: action.payload };
    case 'SET_SCORES':
      return { ...state, scores: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_IMPORT_FILE':
      return { ...state, importFile: action.payload };
    case 'SET_EDITING_CELL':
      return { ...state, editingCell: action.payload };
    case 'SET_FILTER_SUBJECT':
      return { ...state, filterSubject: action.payload };
    case 'SET_STATUS_FILTER':
      return { ...state, statusFilter: action.payload };
    case 'SET_BATCH_SUBJECT':
      return { ...state, batchSubject: action.payload };
    case 'SET_IMPORT_RESULT':
      return { ...state, importResult: action.payload };
    case 'SET_PENDING_CHANGES':
      return { ...state, pendingChanges: action.payload };
    case 'UPDATE_SCORE':
      return {
        ...state,
        scores: { ...state.scores, [action.payload.key]: action.payload.score },
      };
    case 'ADD_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: { ...state.pendingChanges, [action.payload.key]: action.payload.change },
      };
    case 'REMOVE_PENDING_CHANGE': {
      const newChanges = { ...state.pendingChanges };
      delete newChanges[action.payload];
      return { ...state, pendingChanges: newChanges };
    }
    case 'CLEAR_PENDING_CHANGES':
      return { ...state, pendingChanges: {} };
    default:
      return state;
  }
}

const initialState: ScoreEntryState = {
  exams: [],
  selectedExam: '',
  classes: [],
  selectedClass: '',
  students: [],
  subjects: [],
  scores: {},
  loading: false,
  importFile: null,
  editingCell: null,
  filterSubject: '',
  statusFilter: '',
  batchSubject: '',
  importResult: null,
  pendingChanges: {},
};

const ScoreEntry: React.FC = () => {
  const { showToast } = useStableToast();
  usePermissions();
  const [state, dispatch] = useReducer(scoreEntryReducer, initialState);
  const tableRef = useRef<HTMLDivElement>(null);

  const {
    exams,
    selectedExam,
    classes,
    selectedClass,
    students,
    subjects,
    scores,
    loading,
    importFile,
    editingCell,
    filterSubject,
    statusFilter,
    batchSubject,
    importResult,
    pendingChanges,
  } = state;

  // 使用 useConfirmDialog 管理确认对话框
  const { show: showConfirm } = useConfirmDialog();

  // 使用 useModal 管理弹窗状态
  const { isOpen: showImportModal, open: openImportModal, close: closeImportModal } = useModal<null>({
    onClose: () => dispatch({ type: 'SET_IMPORT_FILE', payload: null }),
  });

  const { isOpen: showBatchModal, open: openBatchModal, close: closeBatchModal } = useModal<null>({
    onClose: () => dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' }),
  });

  const { isOpen: showImportResultModal, open: openImportResultModal, close: closeImportResultModal } = useModal<null>({});

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [examsRes, classesRes, subjectsRes] = await Promise.all([api.exams.getAll(), api.classes.getAll(), api.subjects.getAll()]);

      const allExams: ExamData[] = Array.isArray(examsRes)
        ? examsRes
        : (examsRes as { data?: ExamData[] }).data || [];
      dispatch({ type: 'SET_EXAMS', payload: allExams.filter((e) => e.status === 'published') });
      dispatch({ type: 'SET_CLASSES', payload: Array.isArray(classesRes) ? classesRes : (classesRes as { classes?: ClassInfo[] }).classes || [] });
      dispatch({ type: 'SET_SUBJECTS', payload: Array.isArray(subjectsRes) ? subjectsRes : (subjectsRes as { data?: Subject[] }).data || [] });
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    }
  }, [showToast]);

  const fetchStudentsAndScores = useCallback(async (): Promise<void> => {
    if (!selectedExam) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const usersRes = await api.users.getAll({ class_name: selectedClass, skipCache: true });
      const allUsers = Array.isArray(usersRes) ? usersRes : (usersRes as { users?: User[] }).users || [];
      dispatch({ type: 'SET_STUDENTS', payload: allUsers.filter((u) => u.role === 'student') });

      const scoresRes = await api.scores.getAll({ exam_id: selectedExam });
      const scoresList: ScoreItem[] = Array.isArray(scoresRes) ? scoresRes : (scoresRes as { data?: ScoreItem[] }).data || [];

      const scoresMap: Record<string, ScoreItem> = {};
      scoresList.forEach((score) => {
        const key = `${score.student_id}-${score.subject}`;
        scoresMap[key] = score;
      });
      dispatch({ type: 'SET_SCORES', payload: scoresMap });
      dispatch({ type: 'CLEAR_PENDING_CHANGES' });
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [selectedExam, selectedClass, showToast]);

  // 防抖搜索 - 班级选择不会频繁变化，所以使用较短延迟
  const [classInput, setClassInput] = useState(selectedClass);
  const debouncedClass = useDebouncedValue(classInput, 150);
  
  // 班级变化时更新 selectedClass
  useEffect(() => {
    if (debouncedClass !== selectedClass) {
      dispatch({ type: 'SET_SELECTED_CLASS', payload: debouncedClass });
    }
  }, [debouncedClass, selectedClass]);
  
  // 节流刷新 - 限制刷新频率（最少间隔 1 秒）
  const fetchDataRef = useRef<typeof fetchData | null>(null);
  const fetchStudentsRef = useRef<typeof fetchStudentsAndScores | null>(null);
  
  const throttledRefresh = useThrottledCallback(() => {
    if (fetchStudentsRef.current) {
      fetchStudentsRef.current();
    }
  }, 1000);
  
  useEffect(() => {
    fetchDataRef.current = fetchData;
    fetchStudentsRef.current = fetchStudentsAndScores;
  }, [fetchData, fetchStudentsAndScores]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedExam) {
      fetchStudentsAndScores();
    }
  }, [selectedExam, selectedClass, fetchStudentsAndScores]);

  const examSubjects = useMemo((): string[] => {
    const exam = exams.find((e) => e.id.toString() === selectedExam);
    if (!exam) return [];
    const raw = exam.subjects as unknown;
    // 1) 已经是数组：直接用
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x));
    }
    // 2) 不是数组但有内容：尝试多种解析方式（防御性兼容历史脏数据）
    if (typeof raw === 'string' && raw.length > 0) {
      const s = raw.trim();
      try {
        // JSON 数组字符串，例如 '["语文","数学"]'
        let v: unknown = JSON.parse(s);
        if (typeof v === 'string') {
          // 嵌套字符串：再 parse 一次
          v = JSON.parse(v);
        }
        if (Array.isArray(v)) {
          return (v as unknown[]).map((x) => String(x));
        }
      } catch {
        /* 忽略，退回 split */
      }
      // 3) CSV 形式的 fallback："语文,数学,英语" -> ['语文','数学','英语']
      return s
        .split(',')
        .map((t) => t.trim().replace(/^["'[\]]+|["'[\]]+$/g, ''))
        .filter(Boolean);
    }
    return [];
  }, [exams, selectedExam]);

  const getSubjectId = useCallback((subjectName: string): number | undefined => {
    const subject = subjects.find((s) => s.name === subjectName && s.exam_id !== undefined && s.exam_id.toString() === selectedExam);
    return subject?.id;
  }, [subjects, selectedExam]);

  const visibleSubjects = useMemo((): string[] => {
    if (!filterSubject) return examSubjects;
    return examSubjects.filter((s) => s === filterSubject);
  }, [examSubjects, filterSubject]);


  // 单个分数 onBlur 即时入库：用户改完一个分数失焦即 POST/PUT 到后端，
  // 不再依赖「保存全部」按钮批量提交。「保存全部」仍保留，用于批量修改场景。
  const handleScoreBlur = async (studentId: number, subject: string, value: string): Promise<void> => {
    const key = `${studentId}-${subject}`;
    const existing = scores[key];
    const subjectId = existing?.subject_id || getSubjectId(subject);
    const score = value === '' ? null : parseFloat(value);
    // 防御性校验：与 handleSaveAll 保持一致，避免脏科目名继续污染 scores 表
    if (typeof subject !== 'string' || /[[\]"'\\,]/.test(subject) || /\\u[0-9a-f]{4}/i.test(subject)) {
      showToast('error', `科目名异常，跳过: ${subject}`);
      return;
    }
    if (value !== '' && (Number.isNaN(score as number) || (score as number) < 0 || (score as number) > 100)) {
      showToast('error', '分数需在 0-100');
      return;
    }
    try {
      let resp: unknown;
      if (existing?.id) {
        resp = await api.scores.update(existing.id, { score });
      } else {
        resp = await api.scores.create({
          exam_id: parseInt(selectedExam),
          student_id: studentId,
          subject,
          subject_id: subjectId,
          score: score as number,
        });
      }
      const returned = (resp && (resp as { data?: unknown }).data) || resp;
      dispatch({
        type: 'UPDATE_SCORE',
        payload: {
          key,
          score: { ...existing, ...(returned as object), student_id: studentId, subject, subject_id: subjectId, score },
        },
      });
      dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: key });
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? (e as { message: string }).message : String(e);
      logger.error(`[score-blur-save] failed for ${key}:`, e);
      showToast('error', `保存失败: ${msg}`);
    }
  };

  const handleSaveAll = useCallback(async (): Promise<void> => {
    const keys = Object.keys(pendingChanges);
    if (keys.length === 0) {
      showToast('info', '没有待保存的更改');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const skipReasons: string[] = [];

    for (const key of keys) {
      const { student_id, subject, subject_id, score } = pendingChanges[key];
      // 防御性校验：科目名里若含异常字符（来自历史脏数据/解析错位），主动跳过，避免再写入 '["语文"' 这类脏 subject
      if (typeof subject !== 'string' || /[[\]"'\\,]/.test(subject) || /\\u[0-9a-f]{4}/i.test(subject)) {
        failCount++;
        skipReasons.push(`[${student_id}/${subject}] 非法的科目名`);
        logger.error(`[save-skip] bad subject "${subject}" for student ${student_id}`);
        continue;
      }
      try {
        const existingScore = scores[key];
        if (existingScore?.id) {
          await api.scores.update(existingScore.id, { score });
        } else {
          await api.scores.create({
            exam_id: parseInt(selectedExam),
            student_id,
            subject,
            subject_id,
            score,
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
        logger.error(`保存失败 [${key}]:`, err);
      }
    }

    if (failCount === 0) {
      showToast('success', `已保存 ${successCount} 条成绩`);
    } else {
      const detail = skipReasons.length > 0 ? `（${skipReasons.length} 条因科目名异常被跳过）` : '';
      showToast('error', `保存完成: ${successCount} 成功, ${failCount} 失败${detail}`);
    }

    dispatch({ type: 'CLEAR_PENDING_CHANGES' });
    fetchStudentsAndScores();
  }, [pendingChanges, scores, selectedExam, showToast, fetchStudentsAndScores]);

  const handleExport = useCallback(async (format: 'excel' | 'csv'): Promise<Blob> => {
    if (!selectedExam) {
      throw new Error('请先选择考试');
    }
    const response = await fetch(`/api/scores/export?exam_id=${selectedExam}&format=${format}`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('导出失败');
    }
    return response.blob();
  }, [selectedExam]);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!importFile || !selectedExam) return;

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('exam_id', selectedExam);

    try {
      const result = await api.scores.importScores(formData);
      const resultData = result as { success_count?: number; failed_count?: number; failed_messages?: string[]; errors?: Array<{ row?: number; error_fields: string[]; message: string; row_data?: Record<string, unknown> }> };
      const data = (result as { data?: typeof resultData })?.data || resultData;
      dispatch({
        type: 'SET_IMPORT_RESULT',
        payload: {
          successCount: data.success_count || 0,
          failedCount: data.failed_count || 0,
          failedMessages: data.failed_messages || [],
          errors: data.errors || [],
        },
      });
      closeImportModal();
      openImportResultModal();
      dispatch({ type: 'SET_IMPORT_FILE', payload: null });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      showToast('error', '导入失败: ' + (err as Error).message);
    }
  }, [importFile, selectedExam, showToast, fetchStudentsAndScores, closeImportModal, openImportResultModal]);

  const handleExportErrors = useCallback((): void => {
    if (!importResult?.errors) return;
    if (importResult.errors.length > 0) {
      api.export.errors(importResult.errors, 'scores');
    }
  }, [importResult]);

  const handleConfirmAll = useCallback(async (): Promise<void> => {
    try {
      await api.scores.confirmAll(selectedExam);
      showToast('success', '确认成功');
      fetchStudentsAndScores();
    } catch (err: unknown) {
      showToast('error', '确认失败: ' + (err as Error).message);
    }
  }, [selectedExam, showToast, fetchStudentsAndScores]);

  const handleBatchDelete = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要操作的科目');
      return;
    }

    if (!window.confirm(`确定要删除所有学生的 ${batchSubject} 成绩吗？`)) return;

    try {
      const keysToDelete = Object.keys(scores).filter((key) => key.endsWith(`-${batchSubject}`));
      let deletedCount = 0;

      for (const key of keysToDelete) {
        const scoreData = scores[key];
        if (scoreData?.id) {
          await api.scores.delete(scoreData.id);
          deletedCount++;
        }
      }

      showToast('success', `已删除 ${deletedCount} 条 ${batchSubject} 成绩`);
      closeBatchModal();
      dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      showToast('error', '批量删除失败: ' + (err as Error).message);
    }
  }, [batchSubject, scores, showToast, fetchStudentsAndScores, showConfirm, closeBatchModal]);

  const handleBatchReset = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要重置的科目');
      return;
    }

    if (!window.confirm(`确定要重置所有学生的 ${batchSubject} 成绩为空吗？`)) return;

    try {
      const keysToReset = Object.keys(scores).filter((key) => key.endsWith(`-${batchSubject}`));

      for (const key of keysToReset) {
        const scoreData = scores[key];
        if (scoreData?.id) {
          await api.scores.delete(scoreData.id);
        }
      }

      showToast('success', `已重置 ${keysToReset.length} 条 ${batchSubject} 成绩`);
      closeBatchModal();
      dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      showToast('error', '批量重置失败: ' + (err as Error).message);
    }
  }, [batchSubject, scores, showToast, fetchStudentsAndScores, showConfirm, closeBatchModal]);

  const handleBatchConfirm = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要确认的科目');
      return;
    }

    try {
      let confirmedCount = 0;
      const keysToConfirm = Object.keys(scores).filter(
        (key) =>
          key.endsWith(`-${batchSubject}`) &&
          scores[key]?.score !== undefined &&
          scores[key]?.score !== null
      );

      for (const key of keysToConfirm) {
        const scoreData = scores[key];
        if (scoreData?.id && scoreData.score !== undefined && scoreData.score !== null) {
          await api.scores.update(scoreData.id, { score: scoreData.score });
          confirmedCount++;
        }
      }

      showToast('success', `已确认 ${confirmedCount} 条 ${batchSubject} 成绩`);
      closeBatchModal();
      dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      showToast('error', '批量确认失败: ' + (err as Error).message);
    }
  }, [batchSubject, scores, showToast, fetchStudentsAndScores, closeBatchModal]);

  const handleCopyLastScore = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要复制成绩的科目');
      return;
    }
    showToast('info', '复制功能开发中，敬请期待');
  }, [batchSubject, showToast]);

  const getEntryProgress = useMemo((): number => {
    if (students.length === 0 || visibleSubjects.length === 0) return 0;

    let filled = 0;
    const total = students.length * visibleSubjects.length;

    students.forEach((student) => {
      visibleSubjects.forEach((subject) => {
        const key = `${student.id}-${subject}`;
        if (scores[key]?.score !== undefined && scores[key]?.score !== null) {
          filled++;
        }
      });
    });

    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [students, visibleSubjects, scores]);

  const filteredStudents = useMemo((): User[] => {
    let filtered = students;

    if (statusFilter) {
      filtered = filtered.filter((student) => {
        const hasAnyScore = visibleSubjects.some(
          (subject) =>
            scores[`${student.id}-${subject}`]?.score !== undefined &&
            scores[`${student.id}-${subject}`]?.score !== null
        );

        const allConfirmed = visibleSubjects.every(
          (subject) => scores[`${student.id}-${subject}`]?.status === 'confirmed'
        );

        const somePending = visibleSubjects.some(
          (subject) => scores[`${student.id}-${subject}`]?.status === 'pending'
        );

        if (statusFilter === 'confirmed') return allConfirmed;
        if (statusFilter === 'pending') return somePending && !allConfirmed;
        if (statusFilter === 'partial') return hasAnyScore && !allConfirmed && !somePending;
        if (statusFilter === 'empty') return !hasAnyScore;

        return true;
      });
    }

    return filtered;
  }, [students, statusFilter, visibleSubjects, scores]);

  const handlePrint = useCallback((): void => {
    window.print();
  }, []);

  const exportTemplate = useCallback(async (): Promise<void> => {
    try {
      const baseUrl = '/api/scores/template/download';
      const params = new URLSearchParams();
      if (selectedClass) params.append('class_name', selectedClass);
      if (selectedExam) params.append('exam_id', selectedExam);

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      const urlObject = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObject;
      a.download = `score_import_template_${selectedClass || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObject);
    } catch (error) {
      logger.error('下载模板失败:', error);
      showToast('error', '下载模板失败: ' + (error as Error).message);
    }
  }, [selectedClass, selectedExam, showToast]);

  const getStatusBadge = (status: string | null | undefined): JSX.Element | null => {
    // 历史脏数据兼容：早期前端误把"已录入"标记为 'normal'，统一视作 confirmed。
    const normalized = status === 'normal' ? 'confirmed' : status;
    if (!normalized) return null;
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      locked: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      locked: '已锁定',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[normalized] || styles.pending}`}>
        {labels[normalized] || normalized}
      </span>
    );
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editingCell) return;

      if (e.key === 'Escape') {
        dispatch({ type: 'SET_EDITING_CELL', payload: null });
        return;
      }

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveAll();
        return;
      }
    },
    [editingCell, handleSaveAll]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedExamData = exams.find((e) => e.id.toString() === selectedExam);

  return (
    <div className='space-y-6'>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 12px; }
          table { font-size: 11px; }
          .overflow-x-auto { overflow: visible !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>成绩录入</h1>
          <p className='text-gray-500 mt-1'>录入和管理学生考试成绩</p>
        </div>
        <div className='flex flex-wrap gap-2 no-print'>
          <PermissionButton permission='score.view' variant='secondary' onClick={exportTemplate}>
            <Download className='w-4 h-4 mr-2' />
            下载模板
          </PermissionButton>
          <PermissionButton permission='score.edit' variant='secondary' onClick={() => openBatchModal()}>
            <Filter className='w-4 h-4 mr-2' />
            批量操作
          </PermissionButton>
          <PermissionButton permission='score.view' variant='secondary' onClick={handlePrint}>
            <Printer className='w-4 h-4 mr-2' />
            打印
          </PermissionButton>
          <ImportExportPanel
            type="score"
            showExport={true}
            showImport={false}
            showTemplate={false}
            onDataExport={handleExport}
            permissions={{
              export: 'score.export',
            }}
          />
          <PermissionButton permission='score.edit' onClick={() => openImportModal()}>
            <Upload className='w-4 h-4 mr-2' />
            导入
          </PermissionButton>
        </div>
      </div>

      <Card>
        <div className='flex flex-wrap gap-4 items-center'>
          <div className='flex-1 min-w-[240px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>选择考试 *</label>
            <select
              value={selectedExam}
              onChange={(e) => dispatch({ type: 'SET_SELECTED_EXAM', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>请选择考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id.toString()}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-48'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>筛选班级</label>
            <select
              value={selectedClass}
              onChange={(e) => setClassInput(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-40'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>筛选科目</label>
            <select
              value={filterSubject}
              onChange={(e) => dispatch({ type: 'SET_FILTER_SUBJECT', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部科目</option>
              {examSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          <div className='w-36'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>状态筛选</label>
            <select
              value={statusFilter}
              onChange={(e) => dispatch({ type: 'SET_STATUS_FILTER', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部</option>
              <option value='empty'>未录入</option>
              <option value='partial'>部分录入</option>
              <option value='pending'>待确认</option>
              <option value='confirmed'>已确认</option>
            </select>
          </div>
          {selectedExam && selectedExamData && (
            <div className='text-sm text-gray-500'>
              考试时间:{' '}
              {selectedExamData.start_time
                ? new Date(selectedExamData.start_time).toLocaleString('zh-CN')
                : '-'}
            </div>
          )}
          <PermissionButton permission='score.view' variant='ghost' onClick={throttledRefresh}>
            <RefreshCw className='w-4 h-4 mr-2' />
            刷新
          </PermissionButton>
        </div>
      </Card>

      {selectedExam && (
        <Card>
          <div className='flex items-center justify-between p-4 border-b border-gray-200 no-print'>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-gray-500'>录入进度</span>
              <div className='w-64 h-2 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-primary-500 transition-all duration-300'
                  style={{ width: `${getEntryProgress}%` }}
              />
            </div>
            <span className='text-sm font-medium text-gray-700'>{getEntryProgress}%</span>
            {Object.keys(pendingChanges).length > 0 && (
              <span className='text-sm text-orange-500'>({Object.keys(pendingChanges).length} 条待保存)</span>
            )}
          </div>
          <div className='flex gap-2'>
            {getEntryProgress === 100 && (
              <PermissionButton
                permission='score.view'
                variant='secondary'
                onClick={() => {
                  window.location.href = `/score-analysis?exam_id=${selectedExam}`;
                }}
              >
                <BarChart3 className='w-4 h-4 mr-2' />
                查看分析
              </PermissionButton>
            )}
            <PermissionButton
              permission='score.edit'
              variant='secondary'
              onClick={handleSaveAll}
              disabled={Object.keys(pendingChanges).length === 0}
              title={Object.keys(pendingChanges).length === 0 ? '所有改动已在失焦时自动保存' : '批量保存尚未失焦的待保存改动'}
            >
              <Save className='w-4 h-4 mr-2' />
              保存全部
              {Object.keys(pendingChanges).length > 0 && (
                <span className='ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700'>
                  {Object.keys(pendingChanges).length}
                </span>
              )}
            </PermissionButton>
            <PermissionButton
              permission='score.approve'
              variant='primary'
              onClick={handleConfirmAll}
              disabled={!selectedExam || students.length === 0}
              title={students.length === 0 ? '请先选择考试' : '将该考试下所有 pending/normal 状态的成绩改为已确认'}
              >
                <CheckCircle className='w-4 h-4 mr-2' />
                确认全部
              </PermissionButton>
            </div>
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <LoadingSpinner />
            </div>
          ) : (
            <div className='overflow-x-auto' ref={tableRef}>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50'>
                    <th className='px-4 py-3 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10'>
                      学号
                    </th>
                    <th className='px-4 py-3 text-left font-medium text-gray-600 sticky left-16 bg-gray-50 z-10'>
                      姓名
                    </th>
                    {visibleSubjects.map((subject) => (
                      <th key={subject} className='px-4 py-3 text-center font-medium text-gray-600 min-w-[100px]'>
                        {subject}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={2 + visibleSubjects.length} className='px-4 py-8 text-center text-gray-500'>
                        暂无学生数据
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className='border-t border-gray-100 hover:bg-gray-50'>
                        <td className='px-4 py-2 text-gray-600 sticky left-0 bg-white z-10'>{student.card_id}</td>
                        <td className='px-4 py-2 font-medium text-gray-900 sticky left-16 bg-white z-10'>
                          {student.name}
                        </td>
                        {visibleSubjects.map((subject) => {
                          const key = `${student.id}-${subject}`;
                          const scoreData = scores[key];
                          const isPending = !!pendingChanges[key];

                          return (
                            <td
                              key={subject}
                              className={`px-4 py-2 text-center ${isPending ? 'bg-orange-50' : ''}`}
                            >
                              <div className='flex items-center justify-center gap-1.5'>
                                <input
                                  key={`${student.id}-${subject}-${scoreData?.id ?? 'empty'}`}
                                  type='number'
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  placeholder='-'
                                  defaultValue={scoreData?.score ?? ''}
                                  className='w-16 px-1.5 py-0.5 text-sm text-center border border-gray-300 rounded hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    const old = scoreData?.score ?? null;
                                    const num = v === '' ? null : parseFloat(v);
                                    if (v !== '' && (Number.isNaN(num as number) || (num as number) < 0 || (num as number) > 100)) {
                                      showToast('error', '分数需在 0-100');
                                      return;
                                    }
                                    if (num === old) return;
                                    handleScoreBlur(Number(student.id), subject, v);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    } else if (e.key === 'Escape') {
                                      (e.target as HTMLInputElement).value = String(scoreData?.score ?? '');
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                                {scoreData?.status && getStatusBadge(scoreData.status)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 导入 Modal */}
      <Modal isOpen={showImportModal} onClose={closeImportModal} title='导入成绩'>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择 Excel 文件</label>
            <input
              type='file'
              accept='.xlsx,.xls'
              onChange={(e: ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_IMPORT_FILE', payload: e.target.files?.[0] || null })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500'
            />
          </div>
          <div className='text-sm text-gray-500'>
            请确保 Excel 文件格式正确，包含学号、科目、成绩等列。
          </div>
          <div className='flex justify-end gap-2 pt-4'>
          <Button variant='secondary' onClick={closeImportModal}>
            取消
          </Button>
          <PermissionButton permission='score.edit' onClick={handleImport} disabled={!importFile}>
            导入
          </PermissionButton>
        </div>
        </div>
      </Modal>

      {/* 批量操作 Modal */}
      <Modal isOpen={showBatchModal} onClose={closeBatchModal} title='批量操作'>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择科目</label>
            <select
              value={batchSubject}
              onChange={(e) => dispatch({ type: 'SET_BATCH_SUBJECT', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>请选择科目</option>
              {examSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          <div className='flex flex-wrap gap-2 pt-4'>
            <PermissionButton permission='score.approve' variant='secondary' onClick={handleBatchConfirm} disabled={!batchSubject}>
              <CheckCircle className='w-4 h-4 mr-2' />
              批量确认
            </PermissionButton>
            <PermissionButton permission='score.edit' variant='secondary' onClick={handleBatchReset} disabled={!batchSubject}>
              <RotateCcw className='w-4 h-4 mr-2' />
              批量重置
            </PermissionButton>
            <PermissionButton permission='score.edit' variant='danger' onClick={handleBatchDelete} disabled={!batchSubject}>
              <Trash2 className='w-4 h-4 mr-2' />
              批量删除
            </PermissionButton>
            <PermissionButton permission='score.edit' variant='secondary' onClick={handleCopyLastScore} disabled={!batchSubject}>
              <Copy className='w-4 h-4 mr-2' />
              复制上次成绩
            </PermissionButton>
          </div>
          <div className='flex justify-end pt-4'>
            <Button onClick={closeBatchModal}>关闭</Button>
          </div>
        </div>
      </Modal>

      {/* 导入结果 Modal */}
      <Modal isOpen={showImportResultModal} onClose={closeImportResultModal} title='导入结果'>
        {importResult && (
          <div className='space-y-4'>
            <div className='flex gap-4'>
              <div className='flex-1 p-4 bg-green-50 rounded-lg text-center'>
                <div className='text-2xl font-bold text-green-600'>{importResult.successCount}</div>
                <div className='text-sm text-green-600'>成功</div>
              </div>
              <div className='flex-1 p-4 bg-red-50 rounded-lg text-center'>
                <div className='text-2xl font-bold text-red-600'>{importResult.failedCount}</div>
                <div className='text-sm text-red-600'>失败</div>
              </div>
            </div>
            {importResult.failedMessages.length > 0 && (
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <h4 className='font-medium text-gray-900'>失败详情</h4>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <Button size='sm' variant='secondary' onClick={handleExportErrors}>
                      <Download className='w-4 h-4 mr-1' />
                      导出错误数据
                    </Button>
                  )}
                </div>
                <div className='max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3'>
                  {importResult.failedMessages.map((msg, index) => (
                    <div key={index} className='text-sm text-red-600 py-1'>
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className='flex justify-end pt-4'>
              <Button onClick={closeImportResultModal}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ScoreEntry;
