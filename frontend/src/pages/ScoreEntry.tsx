import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  ChangeEvent,
  useMemo,
  useReducer,
} from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Card, Button, Modal, PermissionButton, DataTable } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import ImportExportPanel from '../components/special/ImportExportPanel';
import { useStableToast } from '../hooks/useStableToast';
import { useModal } from '../hooks';
import { useConfirm } from '../components/ui/ConfirmDialog';
import api, { getAuthHeaders } from '../services/api';
import type { User, Subject } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useDebouncedValue, useThrottledCallback } from '../hooks';
import { useAutoSave } from '../hooks/useAutoSave';

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

// 成绩录入草稿（仅可序列化字段，用于 M3 本地暂存/恢复）
interface ScoreEntryDraft {
  selectedExam: string;
  selectedClass: string;
  scores: Record<string, ScoreItem>;
  pendingChanges: Record<string, PendingChange>;
  batchSubject: string;
  filterSubject: string;
}

// 导入结果接口
interface ImportResult {
  successCount: number;
  failedCount: number;
  failedMessages: string[];
  errors?: Array<{
    row?: number;
    error_fields: string[];
    message: string;
    row_data?: Record<string, unknown>;
  }>;
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
  const navigate = useNavigate();
  usePermissions();
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [state, dispatch] = useReducer(scoreEntryReducer, initialState);

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

  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // 批量提交进度（真实进度 + 可取消）
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number } | null>(
    null
  );
  // 保存失败详情条（前 5 条，可关闭）
  const [batchFailures, setBatchFailures] = useState<Array<{ key: string; error: string }> | null>(
    null
  );
  const cancelBatchRef = useRef(false);

  // 使用 useModal 管理弹窗状态
  const {
    isOpen: showImportModal,
    open: openImportModal,
    close: closeImportModal,
  } = useModal<null>({
    onClose: () => dispatch({ type: 'SET_IMPORT_FILE', payload: null }),
  });

  const {
    isOpen: showBatchModal,
    open: openBatchModal,
    close: closeBatchModal,
  } = useModal<null>({
    onClose: () => dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' }),
  });

  const {
    isOpen: showImportResultModal,
    open: openImportResultModal,
    close: closeImportResultModal,
  } = useModal<null>({});

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [examsRes, classesRes, subjectsRes] = await Promise.all([
        api.exams.getAll(),
        api.classes.getAll(),
        api.subjects.getAll(),
      ]);

      const allExams: ExamData[] = Array.isArray(examsRes)
        ? examsRes
        : (examsRes as { data?: ExamData[] }).data || [];
      dispatch({ type: 'SET_EXAMS', payload: allExams.filter((e) => e.status === 'published') });
      dispatch({
        type: 'SET_CLASSES',
        payload: Array.isArray(classesRes)
          ? classesRes
          : (classesRes as { classes?: ClassInfo[] }).classes || [],
      });
      dispatch({
        type: 'SET_SUBJECTS',
        payload: Array.isArray(subjectsRes)
          ? subjectsRes
          : (subjectsRes as { data?: Subject[] }).data || [],
      });
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    }
  }, [showToast]);

  // M8: 竞态防护——切换考试/班级时仅最新请求生效
  const fetchSeqRef = useRef(0);
  const fetchStudentsAndScores = useCallback(async (): Promise<void> => {
    if (!selectedExam) return;
    const seq = ++fetchSeqRef.current;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const usersRes = await api.users.getAll({
        class_id: selectedClass ? Number(selectedClass) : undefined,
        skipCache: true,
      });
      if (seq !== fetchSeqRef.current) return;
      const allUsers = Array.isArray(usersRes)
        ? usersRes
        : (usersRes as { users?: User[] }).users || [];
      dispatch({ type: 'SET_STUDENTS', payload: allUsers.filter((u) => u.role === 'student') });

      const scoresRes = await api.scores.getAll({ exam_id: selectedExam });
      if (seq !== fetchSeqRef.current) return;
      const scoresList: ScoreItem[] = Array.isArray(scoresRes)
        ? scoresRes
        : (scoresRes as { data?: ScoreItem[] }).data || [];

      const scoresMap: Record<string, ScoreItem> = {};
      scoresList.forEach((score) => {
        const key = `${score.student_id}-${score.subject}`;
        scoresMap[key] = score;
      });
      dispatch({ type: 'SET_SCORES', payload: scoresMap });
      dispatch({ type: 'CLEAR_PENDING_CHANGES' });
    } catch (err: unknown) {
      if (seq !== fetchSeqRef.current) return;
      showToast('error', '获取数据失败: ' + (err as Error).message);
    } finally {
      if (seq === fetchSeqRef.current) dispatch({ type: 'SET_LOADING', payload: false });
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

  // M3: 成绩录入本地草稿——把"录入会话"可序列化状态合成草稿数据，供中途刷新后恢复
  const draftData = useMemo<ScoreEntryDraft>(
    () => ({
      selectedExam,
      selectedClass,
      scores,
      pendingChanges,
      batchSubject,
      filterSubject,
    }),
    [selectedExam, selectedClass, scores, pendingChanges, batchSubject, filterSubject]
  );

  const { draftAvailable, loadDraft, restoreDraft, discardChanges, clearDraft } =
    useAutoSave<ScoreEntryDraft>({
      key: 'score-entry',
      data: draftData,
    });

  // 空草稿静默清理：无考试/无成绩时恢复条不出现
  useEffect(() => {
    if (!draftAvailable) return;
    const d = loadDraft();
    if (
      d &&
      d.selectedExam === '' &&
      Object.keys(d.scores).length === 0 &&
      Object.keys(d.pendingChanges).length === 0
    ) {
      clearDraft();
    }
  }, [draftAvailable, loadDraft, clearDraft]);

  const handleRestoreDraft = useCallback((): void => {
    const draft = restoreDraft();
    if (!draft) return;
    dispatch({ type: 'SET_SELECTED_EXAM', payload: draft.selectedExam });
    setClassInput(draft.selectedClass);
    dispatch({ type: 'SET_SELECTED_CLASS', payload: draft.selectedClass });
    dispatch({ type: 'SET_SCORES', payload: draft.scores });
    dispatch({ type: 'SET_PENDING_CHANGES', payload: draft.pendingChanges });
    dispatch({ type: 'SET_BATCH_SUBJECT', payload: draft.batchSubject });
    dispatch({ type: 'SET_FILTER_SUBJECT', payload: draft.filterSubject });
  }, [restoreDraft]);

  const handleDiscardDraft = useCallback((): void => {
    discardChanges();
  }, [discardChanges]);

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

  const getSubjectId = useCallback(
    (subjectName: string): number | undefined => {
      const subject = subjects.find(
        (s) =>
          s.name === subjectName && s.exam_id !== undefined && s.exam_id.toString() === selectedExam
      );
      return subject?.id;
    },
    [subjects, selectedExam]
  );

  const visibleSubjects = useMemo((): string[] => {
    if (!filterSubject) return examSubjects;
    return examSubjects.filter((s) => s === filterSubject);
  }, [examSubjects, filterSubject]);

  // 单个分数 onBlur 即时入库：用户改完一个分数失焦即 POST/PUT 到后端，
  // 不再依赖「保存全部」按钮批量提交。「保存全部」仍保留，用于批量修改场景。
  const handleScoreBlur = async (
    studentId: number,
    subject: string,
    value: string
  ): Promise<void> => {
    const key = `${studentId}-${subject}`;
    const existing = scores[key];
    const subjectId = existing?.subject_id || getSubjectId(subject);
    const score = value === '' ? null : parseFloat(value);
    // 防御性校验：与 handleSaveAll 保持一致，避免脏科目名继续污染 scores 表
    if (
      typeof subject !== 'string' ||
      /[[\]"'\\,]/.test(subject) ||
      /\\u[0-9a-f]{4}/i.test(subject)
    ) {
      showToast('error', `科目名异常，跳过: ${subject}`);
      return;
    }
    if (
      value !== '' &&
      (Number.isNaN(score as number) || (score as number) < 0 || (score as number) > 100)
    ) {
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
          score: {
            ...existing,
            ...(returned as object),
            student_id: studentId,
            subject,
            subject_id: subjectId,
            score,
          },
        },
      });
      dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: key });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? (e as { message: string }).message
          : String(e);
      logger.error(`[score-blur-save] failed for ${key}:`, e);
      showToast('error', `保存失败: ${msg}`);
    }
  };

  // 键盘跳格定位：data-sid/data-subject 组合 + CSS.escape，规避科目名特殊字符
  const focusCell = useCallback((studentId: number, subjectName: string): void => {
    document
      .querySelector<HTMLInputElement>(
        `input[data-sid="${studentId}"][data-subject="${CSS.escape(subjectName)}"]`
      )
      ?.focus();
  }, []);

  // 分批并发提交通用逻辑：每批 20 条并发，逐批推进进度，支持中途取消
  const runBatched = async <T,>(
    items: T[],
    fn: (item: T) => Promise<void>,
    onBatchDone?: () => void
  ): Promise<{ success: number; failed: Array<{ item: T; error: string }> }> => {
    const total = items.length;
    const failed: Array<{ item: T; error: string }> = [];
    let success = 0;
    setBatchProgress({ processed: 0, total });
    cancelBatchRef.current = false;
    const BATCH = 20;
    for (let i = 0; i < total; i += BATCH) {
      if (cancelBatchRef.current) break;
      const chunk = items.slice(i, i + BATCH);
      const results = await Promise.allSettled(chunk.map((item) => fn(item)));
      for (let idx = 0; idx < results.length; idx++) {
        const r = results[idx];
        if (r.status === 'fulfilled') success++;
        else failed.push({ item: chunk[idx], error: (r.reason as Error)?.message ?? '未知错误' });
      }
      setBatchProgress({ processed: Math.min(i + BATCH, total), total });
      onBatchDone?.();
    }
    return { success, failed };
  };

  const handleSaveAll = useCallback(async (): Promise<void> => {
    const keys = Object.keys(pendingChanges);
    if (keys.length === 0) {
      showToast('info', '没有待保存的更改');
      return;
    }
    setBatchFailures(null);

    // 防御性跳过：科目名含异常字符（历史脏数据/解析错位）跳过，避免写入脏 subject
    const skipReasons: string[] = [];
    const skippedKeys: string[] = [];
    const validKeys = keys.filter((key) => {
      const { student_id, subject } = pendingChanges[key];
      if (
        typeof subject !== 'string' ||
        /[[\]"'\\,]/.test(subject) ||
        /\\u[0-9a-f]{4}/i.test(subject)
      ) {
        skippedKeys.push(key);
        skipReasons.push(`[${student_id}/${subject}] 非法的科目名`);
        logger.error(`[save-skip] bad subject "${subject}" for student ${student_id}`);
        return false;
      }
      return true;
    });

    const { success, failed } = await runBatched(validKeys, async (key) => {
      const change = pendingChanges[key];
      const existingScore = scores[key];
      let resp: unknown;
      if (existingScore?.id) {
        resp = await api.scores.update(existingScore.id, { score: change.score });
      } else {
        resp = await api.scores.create({
          exam_id: parseInt(selectedExam),
          student_id: change.student_id,
          subject: change.subject,
          subject_id: change.subject_id,
          score: change.score,
        });
      }
      // 同步本地 scores（带上后端返回的 id），成功项逐条移除待保存
      const returned = (resp && (resp as { data?: unknown }).data) || resp;
      dispatch({
        type: 'UPDATE_SCORE',
        payload: {
          key,
          score: {
            ...existingScore,
            ...(returned as object),
            student_id: change.student_id,
            subject: change.subject,
            subject_id: change.subject_id,
            score: change.score,
          },
        },
      });
      dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: key });
    });

    const failTotal = failed.length + skippedKeys.length;
    setBatchProgress(null);

    if (failTotal === 0) {
      showToast('success', `已保存 ${success} 条成绩`);
      clearDraft();
      dispatch({ type: 'CLEAR_PENDING_CHANGES' });
      fetchStudentsAndScores();
    } else {
      const detail = skipReasons.length > 0 ? `（${skipReasons.length} 条因科目名异常被跳过）` : '';
      showToast('error', `保存完成: ${success} 成功, ${failTotal} 失败${detail}`);
      const failEntries = failed.slice(0, 5).map((f) => ({ key: f.item, error: f.error }));
      const skipEntries = skippedKeys
        .slice(0, 5 - failEntries.length)
        .map((k) => ({ key: k, error: '非法的科目名' }));
      setBatchFailures([...failEntries, ...skipEntries].slice(0, 5));
      // 失败项保留在 pendingChanges 供重试；此处不刷新，避免 CLEAR_PENDING_CHANGES 清掉失败项
    }
  }, [pendingChanges, scores, selectedExam, showToast, fetchStudentsAndScores, clearDraft]);

  const handleExport = useCallback(
    async (format: 'excel' | 'csv'): Promise<Blob> => {
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
    },
    [selectedExam]
  );

  const handleImport = useCallback(async (): Promise<void> => {
    if (!importFile || !selectedExam) return;

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('exam_id', selectedExam);

    try {
      const result = await api.scores.importScores(formData);
      const resultData = result as {
        success_count?: number;
        failed_count?: number;
        failed_messages?: string[];
        errors?: Array<{
          row?: number;
          error_fields: string[];
          message: string;
          row_data?: Record<string, unknown>;
        }>;
      };
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
  }, [
    importFile,
    selectedExam,
    showToast,
    fetchStudentsAndScores,
    closeImportModal,
    openImportResultModal,
  ]);

  const handleExportErrors = useCallback((): void => {
    if (!importResult?.errors) return;
    if (importResult.errors.length > 0) {
      api.export.errors(importResult.errors, 'scores');
    }
  }, [importResult]);

  const handleConfirmAll = useCallback(async (): Promise<void> => {
    const ok = await confirmRef.current({
      title: '确认全部成绩',
      message: '确定要确认全部学生的成绩吗？确认后将批量提交成绩状态。',
      confirmText: '确认',
      cancelText: '取消',
      type: 'info',
    });
    if (!ok) return;
    try {
      await api.scores.confirmAll(selectedExam);
      showToast('success', '确认成功');
      clearDraft();
      fetchStudentsAndScores();
    } catch (err: unknown) {
      showToast('error', '确认失败: ' + (err as Error).message);
    }
  }, [selectedExam, showToast, fetchStudentsAndScores, clearDraft]);

  const handleBatchDelete = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要操作的科目');
      return;
    }

    const ok = await confirmRef.current({
      title: '批量删除成绩',
      message: `确定要删除所有学生的 ${batchSubject} 成绩吗？`,
      confirmText: '删除',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      const keysToDelete = Object.keys(scores).filter((key) => key.endsWith(`-${batchSubject}`));
      // 幂等：keys 天然去重，仅取已有 id 的记录删除
      const items = keysToDelete
        .map((key) => ({ key, id: scores[key]?.id }))
        .filter((x): x is { key: string; id: number } => typeof x.id === 'number');

      const { success, failed } = await runBatched(items, async ({ id }) => {
        await api.scores.delete(id);
      });
      setBatchProgress(null);

      showToast(
        'success',
        `已删除 ${success} 条 ${batchSubject} 成绩${failed.length > 0 ? `，${failed.length} 条失败` : ''}`
      );
      closeBatchModal();
      dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      setBatchProgress(null);
      showToast('error', '批量删除失败: ' + (err as Error).message);
    }
  }, [batchSubject, scores, showToast, fetchStudentsAndScores, closeBatchModal]);

  const handleBatchReset = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要重置的科目');
      return;
    }

    const ok = await confirmRef.current({
      title: '批量重置成绩',
      message: `确定要重置所有学生的 ${batchSubject} 成绩为空吗？`,
      confirmText: '重置',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;

    try {
      const keysToReset = Object.keys(scores).filter((key) => key.endsWith(`-${batchSubject}`));
      const items = keysToReset
        .map((key) => ({ key, id: scores[key]?.id }))
        .filter((x): x is { key: string; id: number } => typeof x.id === 'number');

      const { success, failed } = await runBatched(items, async ({ id }) => {
        await api.scores.delete(id);
      });
      setBatchProgress(null);

      showToast(
        'success',
        `已重置 ${success} 条 ${batchSubject} 成绩${failed.length > 0 ? `，${failed.length} 条失败` : ''}`
      );
      closeBatchModal();
      dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      setBatchProgress(null);
      showToast('error', '批量重置失败: ' + (err as Error).message);
    }
  }, [batchSubject, scores, showToast, fetchStudentsAndScores, closeBatchModal]);

  const handleBatchConfirm = useCallback(async (): Promise<void> => {
    if (!batchSubject) {
      showToast('error', '请选择要确认的科目');
      return;
    }

    try {
      const confirmItems: Array<{ key: string; id: number; score: number }> = Object.entries(
        scores
      )
        .filter(([key]) => key.endsWith(`-${batchSubject}`))
        .flatMap(([key, s]) =>
          s?.id && s.score !== undefined && s.score !== null
            ? [{ key, id: s.id, score: s.score }]
            : []
        );

      const { success, failed } = await runBatched(confirmItems, async ({ id, score }) => {
        await api.scores.update(id, { score });
      });
      setBatchProgress(null);

      showToast(
        'success',
        `已确认 ${success} 条 ${batchSubject} 成绩${failed.length > 0 ? `，${failed.length} 条失败` : ''}`
      );
      clearDraft();
      closeBatchModal();
      dispatch({ type: 'SET_BATCH_SUBJECT', payload: '' });
      fetchStudentsAndScores();
    } catch (err: unknown) {
      setBatchProgress(null);
      showToast('error', '批量确认失败: ' + (err as Error).message);
    }
  }, [batchSubject, scores, showToast, fetchStudentsAndScores, closeBatchModal, clearDraft]);

  // M9: 移除占位功能「复制上次成绩」（后端无对应接口，原实现仅提示"开发中"）
  // 若需恢复：后端提供 GET /api/scores/last-exam 后在此实现

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
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedExam) params.append('exam_id', selectedExam);

      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',  // 十评 P2-1：token 走 HttpOnly cookie
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
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[normalized] || styles.pending
        }`}
      >
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

  const columns = useMemo<ColumnType<User>[]>(
    () => [
      {
        title: '学号',
        key: 'card_id',
        dataIndex: 'card_id',
        className: 'sticky left-0 bg-white z-10',
        render: (value) => <span className='text-gray-600'>{String(value ?? '')}</span>,
      },
      {
        title: '姓名',
        key: 'name',
        dataIndex: 'name',
        className: 'sticky left-16 bg-white z-10',
        render: (value) => (
          <span className='font-medium text-gray-900'>{String(value ?? '')}</span>
        ),
      },
      ...visibleSubjects.map((subject) => ({
        title: subject,
        key: `subject-${subject}`,
        width: 100,
        align: 'center' as const,
        render: (_v: unknown, student: User) => {
          const key = `${student.id}-${subject}`;
          const scoreData = scores[key];
          const isPending = !!pendingChanges[key];
          return (
            <div
              className={`flex items-center justify-center gap-1.5 ${isPending ? 'bg-orange-50' : ''}`}
            >
              <input
                key={`${student.id}-${subject}-${scoreData?.id ?? 'empty'}`}
                type='number'
                min={0}
                max={100}
                step={0.5}
                placeholder='-'
                defaultValue={scoreData?.score ?? ''}
                data-sid={student.id}
                data-subject={subject}
                aria-label={`${student.name} 的 ${subject} 成绩`}
                className='w-16 px-1.5 py-0.5 text-sm text-center border border-gray-300 rounded hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                onInput={(e) => {
                  // 越界即时红框：非受控 input 直接操作 classList（key 稳定时 React 不重渲染该 input）
                  const v = e.currentTarget.value.trim();
                  const num = parseFloat(v);
                  const invalid = v !== '' && (Number.isNaN(num) || num < 0 || num > 100);
                  e.currentTarget.classList.toggle('border-red-500', invalid);
                  e.currentTarget.classList.toggle('focus:ring-red-400', invalid);
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const old = scoreData?.score ?? null;
                  const num = v === '' ? null : parseFloat(v);
                  if (
                    v !== '' &&
                    (Number.isNaN(num as number) ||
                      (num as number) < 0 ||
                      (num as number) > 100)
                  ) {
                    showToast('error', '分数需在 0-100');
                    return;
                  }
                  if (num === old) return;
                  handleScoreBlur(Number(student.id), subject, v);
                }}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (e.key === 'Escape') {
                    target.value = String(scoreData?.score ?? '');
                    target.blur();
                    return;
                  }
                  const subjectIdx = visibleSubjects.indexOf(subject);
                  const studentIdx = students.findIndex((s) => s.id === student.id);
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    // 保存并跳下一格：同学生下一科目；末尾则换行到下一学生首列
                    e.preventDefault();
                    target.blur();
                    if (subjectIdx >= 0 && subjectIdx < visibleSubjects.length - 1) {
                      focusCell(Number(student.id), visibleSubjects[subjectIdx + 1]);
                    } else if (studentIdx >= 0 && studentIdx < students.length - 1) {
                      focusCell(Number(students[studentIdx + 1].id), visibleSubjects[0]);
                    }
                    return;
                  }
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    // 保存并切到相邻学生同一科目
                    const nextIdx = e.key === 'ArrowDown' ? studentIdx + 1 : studentIdx - 1;
                    if (studentIdx >= 0 && nextIdx >= 0 && nextIdx < students.length) {
                      target.blur();
                      focusCell(Number(students[nextIdx].id), subject);
                    }
                    return;
                  }
                }}
                onPaste={(e) => {
                  // 粘贴批量填充：按行/列拆分，从当前格向右、向下填，逐格走与 onBlur 相同的 0-100 校验
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  if (!text) return;
                  const studentIdx = students.findIndex((s) => s.id === student.id);
                  const subjectIdx = visibleSubjects.indexOf(subject);
                  if (studentIdx < 0 || subjectIdx < 0) return;
                  const rows = text.split(/\r?\n/);
                  rows.forEach((row, rIdx) => {
                    const targetStudentIdx = studentIdx + rIdx;
                    if (targetStudentIdx >= students.length) return;
                    const values = row
                      .split(/\t|,|，/)
                      .map((v) => v.trim())
                      .filter(Boolean);
                    values.forEach((val, cIdx) => {
                      const targetSubjectIdx = subjectIdx + cIdx;
                      if (targetSubjectIdx >= visibleSubjects.length) return;
                      const num = parseFloat(val);
                      if (Number.isNaN(num) || num < 0 || num > 100) {
                        showToast('error', `粘贴值 ${val} 需在 0-100，已跳过`);
                        return;
                      }
                      handleScoreBlur(
                        Number(students[targetStudentIdx].id),
                        visibleSubjects[targetSubjectIdx],
                        val
                      );
                    });
                  });
                }}
              />
              {scoreData?.status && getStatusBadge(scoreData.status)}
            </div>
          );
        },
      })),
    ],
    [visibleSubjects, scores, pendingChanges, handleScoreBlur, getStatusBadge, showToast, students, focusCell]
  );

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

      {draftAvailable && (
        <div className='flex items-center justify-between gap-3 px-4 py-2.5 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-sm'>
          <span className='text-amber-800'>检测到上次未提交的内容，是否恢复？</span>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleRestoreDraft}
              className='px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-xs'
            >
              恢复
            </button>
            <button
              onClick={handleDiscardDraft}
              className='px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs'
            >
              放弃
            </button>
          </div>
        </div>
      )}

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
          <PermissionButton
            permission='score.edit'
            variant='secondary'
            onClick={() => openBatchModal()}
          >
            <Filter className='w-4 h-4 mr-2' />
            批量操作
          </PermissionButton>
          <PermissionButton permission='score.view' variant='secondary' onClick={handlePrint}>
            <Printer className='w-4 h-4 mr-2' />
            打印
          </PermissionButton>
          <ImportExportPanel
            type='score'
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
                <option key={cls.id} value={String(cls.id)}>
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
                <span className='text-sm text-orange-500'>
                  ({Object.keys(pendingChanges).length} 条待保存)
                </span>
              )}
              <span className='hidden xl:inline text-xs text-gray-400'>
                Tab/Enter 跳格 · ↑↓ 切学生 · 粘贴可批量填充
              </span>
            </div>
            <div className='flex gap-2'>
              {getEntryProgress === 100 && (
                <PermissionButton
                  permission='score.view'
                  variant='secondary'
                  onClick={() => {
                    navigate(`/score-analysis?exam_id=${selectedExam}`);
                  }}
                >
                  <BarChart3 className='w-4 h-4 mr-2' />
                  查看分析
                </PermissionButton>
              )}
              <PermissionButton
                permission='score.edit'
                variant='secondary'
                onClick={() => runSubmit(handleSaveAll)}
                disabled={submitting || Object.keys(pendingChanges).length === 0}
                title={
                  Object.keys(pendingChanges).length === 0
                    ? '所有改动已在失焦时自动保存'
                    : '批量保存尚未失焦的待保存改动'
                }
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
                title={
                  students.length === 0
                    ? '请先选择考试'
                    : '将该考试下所有 pending/normal 状态的成绩改为已确认'
                }
              >
                <CheckCircle className='w-4 h-4 mr-2' />
                确认全部
              </PermissionButton>
            </div>
          </div>

          {batchProgress && (
            <div className='flex items-center gap-3 px-4 py-2 mx-4 mt-4 rounded-lg bg-primary-50 border border-primary-200 text-sm'>
              <div className='flex-1'>
                <div className='flex justify-between text-primary-700 mb-1'>
                  <span>
                    正在保存 {batchProgress.processed}/{batchProgress.total} 条
                  </span>
                  <span>
                    预计剩余 {Math.ceil((batchProgress.total - batchProgress.processed) * 0.8)} 秒
                  </span>
                </div>
                <div className='h-1.5 bg-primary-100 rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-primary-500 rounded-full transition-all duration-200'
                    style={{
                      width: `${batchProgress.total ? (batchProgress.processed / batchProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  cancelBatchRef.current = true;
                }}
                className='text-xs text-primary-700 border border-primary-300 rounded px-2 py-1 hover:bg-primary-100'
              >
                取消
              </button>
            </div>
          )}

          {batchFailures && batchFailures.length > 0 && (
            <div className='flex items-start justify-between gap-3 px-4 py-2 mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 text-sm'>
              <div>
                <div className='text-red-700 font-medium mb-1'>
                  {batchFailures.length} 条保存失败（已保留待保存，可重试）：
                </div>
                <ul className='space-y-0.5'>
                  {batchFailures.map((f, index) => (
                    <li key={index} className='text-xs text-red-600'>
                      [{f.key}] {f.error}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setBatchFailures(null)}
                className='shrink-0 text-xs text-red-400 hover:text-red-600'
              >
                关闭
              </button>
            </div>
          )}

          <DataTable<User>
            columns={columns}
            dataSource={filteredStudents}
            rowKey='id'
            loading={loading}
            empty={{
              title: '暂无学生数据',
            }}
            scroll={{ x: 220 + visibleSubjects.length * 100 }}
          />
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
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                dispatch({ type: 'SET_IMPORT_FILE', payload: e.target.files?.[0] || null })
              }
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
            <PermissionButton
              permission='score.edit'
              onClick={() => runSubmit(handleImport)}
              disabled={submitting || !importFile}
            >
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
            <PermissionButton
              permission='score.approve'
              variant='secondary'
              onClick={() => runSubmit(handleBatchConfirm)}
              disabled={submitting || !batchSubject}
            >
              <CheckCircle className='w-4 h-4 mr-2' />
              批量确认
            </PermissionButton>
            <PermissionButton
              permission='score.edit'
              variant='secondary'
              onClick={() => runSubmit(handleBatchReset)}
              disabled={submitting || !batchSubject}
            >
              <RotateCcw className='w-4 h-4 mr-2' />
              批量重置
            </PermissionButton>
            {/* S1: 批量删除与"修改成绩"分离，用 score.delete（teacher 无此权限不能删） */}
            <PermissionButton
              permission='score.delete'
              variant='danger'
              onClick={() => runSubmit(handleBatchDelete)}
              disabled={submitting || !batchSubject}
            >
              <Trash2 className='w-4 h-4 mr-2' />
              批量删除
            </PermissionButton>
            {/* M9: 移除占位「复制上次成绩」按钮 */}
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
