/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 成绩录入页的逻辑层 hook（状态 / reducer / effect / handler / 列定义）。
 * 主文件退化为「hook → ScoreEntryView」的薄装配。
 */

import logger from '../../utils/logger';
import { downloadBlob } from '../../utils/download';
import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { useConfirm, type ColumnType } from '../../components';
import api, { getAuthHeaders } from '../../services/api';
import type { User, Subject } from '../../types';
import { buildScoreEntryColumns } from './columns';
import type { BatchFailure, ScoreEntryViewProps } from './types';
import {
  useAutoSave,
  useDebouncedValue,
  useModal,
  usePermissions,
  useStableToast,
  useSubmitGuard,
  useThrottledCallback,
} from '../../hooks';

// 班级信息类型
interface ClassInfoLocal {
  id: number;
  name: string;
  description?: string;
}

// 考试类型
interface ExamLocal {
  id: number;
  name: string;
  exam_time?: string;
}

// 成绩项接口
interface ScoreItemLocal {
  id?: number;
  student_id: number;
  subject_id?: number;
  subject: string;
  score?: number | null;
  status?: 'pending' | 'confirmed' | 'locked';
}

// 考试数据接口
interface ExamDataLocal extends ExamLocal {
  subjects?: string | string[];
  status?: string;
  start_time?: string;
}

// 待保存更改接口
interface PendingChangeLocal {
  student_id: number;
  subject: string;
  subject_id?: number;
  score: number;
}

// 成绩录入草稿（仅可序列化字段，用于 M3 本地暂存/恢复）
interface ScoreEntryDraftLocal {
  selectedExam: string;
  selectedClass: string;
  scores: Record<string, ScoreItemLocal>;
  pendingChanges: Record<string, PendingChangeLocal>;
  batchSubject: string;
  filterSubject: string;
}

// 导入结果接口
interface ImportResultLocal {
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
interface CellPositionLocal {
  studentId: number;
  subject: string;
}

interface ScoreEntryStateLocal {
  exams: ExamDataLocal[];
  selectedExam: string;
  classes: ClassInfoLocal[];
  selectedClass: string;
  students: User[];
  subjects: Subject[];
  scores: Record<string, ScoreItemLocal>;
  loading: boolean;
  importFile: File | null;
  editingCell: CellPositionLocal | null;
  filterSubject: string;
  statusFilter: string;
  batchSubject: string;
  importResult: ImportResultLocal | null;
  pendingChanges: Record<string, PendingChangeLocal>;
}

type ScoreEntryActionLocal =
  | { type: 'SET_EXAMS'; payload: ExamDataLocal[] }
  | { type: 'SET_SELECTED_EXAM'; payload: string }
  | { type: 'SET_CLASSES'; payload: ClassInfoLocal[] }
  | { type: 'SET_SELECTED_CLASS'; payload: string }
  | { type: 'SET_STUDENTS'; payload: User[] }
  | { type: 'SET_SUBJECTS'; payload: Subject[] }
  | { type: 'SET_SCORES'; payload: Record<string, ScoreItemLocal> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_IMPORT_FILE'; payload: File | null }
  | { type: 'SET_EDITING_CELL'; payload: CellPositionLocal | null }
  | { type: 'SET_FILTER_SUBJECT'; payload: string }
  | { type: 'SET_STATUS_FILTER'; payload: string }
  | { type: 'SET_BATCH_SUBJECT'; payload: string }
  | { type: 'SET_IMPORT_RESULT'; payload: ImportResultLocal | null }
  | { type: 'SET_PENDING_CHANGES'; payload: Record<string, PendingChangeLocal> }
  | { type: 'UPDATE_SCORE'; payload: { key: string; score: ScoreItemLocal } }
  | { type: 'ADD_PENDING_CHANGE'; payload: { key: string; change: PendingChangeLocal } }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'CLEAR_PENDING_CHANGES' };

function scoreEntryReducer(
  state: ScoreEntryStateLocal,
  action: ScoreEntryActionLocal
): ScoreEntryStateLocal {
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

const initialState: ScoreEntryStateLocal = {
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

/**
 * 成绩录入页逻辑 hook。
 */
export function useScoreEntryLogic(): ScoreEntryViewProps {
  const { showToast } = useStableToast();
  usePermissions();
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [state, dispatch] = useReducer(scoreEntryReducer, initialState);

  const {
    exams,
    selectedExam,
    selectedClass,
    students,
    subjects,
    scores,
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
  const [batchFailures, setBatchFailures] = useState<BatchFailure[] | null>(null);
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

      const allExams: ExamDataLocal[] = Array.isArray(examsRes)
        ? examsRes
        : (examsRes as { data?: ExamDataLocal[] }).data || [];
      dispatch({ type: 'SET_EXAMS', payload: allExams.filter((e) => e.status === 'published') });
      dispatch({
        type: 'SET_CLASSES',
        payload: Array.isArray(classesRes)
          ? classesRes
          : (classesRes as { classes?: ClassInfoLocal[] }).classes || [],
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
      const scoresList: ScoreItemLocal[] = Array.isArray(scoresRes)
        ? scoresRes
        : (scoresRes as { data?: ScoreItemLocal[] }).data || [];

      const scoresMap: Record<string, ScoreItemLocal> = {};
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
  const draftData = useMemo<ScoreEntryDraftLocal>(
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
    useAutoSave<ScoreEntryDraftLocal>({
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
      const existingId = existing?.id;
      if (existingId) {
        resp = await api.scores.update(existingId, { score: score as number });
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
        `已删除 ${success} 条 ${batchSubject} 成绩${
          failed.length > 0 ? `，${failed.length} 条失败` : ''
        }`
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
        `已重置 ${success} 条 ${batchSubject} 成绩${
          failed.length > 0 ? `，${failed.length} 条失败` : ''
        }`
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
      const confirmItems: Array<{ key: string; id: number; score: number }> = Object.entries(scores)
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
        `已确认 ${success} 条 ${batchSubject} 成绩${
          failed.length > 0 ? `，${failed.length} 条失败` : ''
        }`
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
        credentials: 'include', // 十评 P2-1：token 走 HttpOnly cookie
      });

      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      downloadBlob(blob, `score_import_template_${selectedClass || 'all'}.xlsx`);
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
    () =>
      buildScoreEntryColumns({
        visibleSubjects,
        students,
        scores,
        pendingChanges,
        handleScoreBlur,
        getStatusBadge,
        focusCell,
        showToast,
      }),
    [
      visibleSubjects,
      students,
      scores,
      pendingChanges,
      handleScoreBlur,
      getStatusBadge,
      focusCell,
      showToast,
    ]
  );

  return {
    state,
    dispatch,
    setClassInput,
    columns,
    examSubjects,
    visibleSubjects,
    getEntryProgress,
    filteredStudents,
    handleSaveAll,
    handleExport,
    handleImport,
    handleExportErrors,
    handleConfirmAll,
    handleBatchDelete,
    handleBatchReset,
    handleBatchConfirm,
    handlePrint,
    exportTemplate,
    handleRestoreDraft,
    handleDiscardDraft,
    onRefresh: throttledRefresh,
    onCancelBatch: () => {
      cancelBatchRef.current = true;
    },
    runSubmit,
    submitting,
    draftAvailable,
    batchProgress,
    batchFailures,
    setBatchFailures,
    showImportModal,
    openImportModal,
    closeImportModal,
    showBatchModal,
    openBatchModal,
    closeBatchModal,
    showImportResultModal,
    closeImportResultModal,
  };
}
