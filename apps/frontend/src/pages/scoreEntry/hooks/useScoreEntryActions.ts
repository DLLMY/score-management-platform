/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-7 拆分（2026-09-12）：写操作域（单格失焦保存 / 批量保存 / 导入导出 / 批量删除重置确认 / 模板下载）。
 * 自 useScoreEntryLogic.tsx 原样搬出，共享原语由组合根注入。
 */

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useConfirm } from '../../../components';
import api, { getAuthHeaders } from '../../../services/api';
import logger from '../../../utils/logger';
import { downloadBlob } from '../../../utils/download';
import type {
  BatchFailure,
  ImportResult,
  PendingChange,
  ScoreEntryAction,
  ScoreItem,
  ShowToast,
} from '../types';
import type { ScoreEntryBatchResult } from './useScoreEntryBatch';

export interface ScoreEntryActionsParams {
  showToast: ShowToast;
  dispatch: Dispatch<ScoreEntryAction>;
  selectedExam: string;
  selectedClass: string;
  scores: Record<string, ScoreItem>;
  pendingChanges: Record<string, PendingChange>;
  importFile: File | null;
  importResult: ImportResult | null;
  batchSubject: string;
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
  fetchStudentsAndScores: () => Promise<void>;
  clearDraft: () => void;
  getSubjectId: (subjectName: string) => number | undefined;
  runBatched: ScoreEntryBatchResult['runBatched'];
  setBatchProgress: Dispatch<SetStateAction<{ processed: number; total: number } | null>>;
  setBatchFailures: Dispatch<SetStateAction<BatchFailure[] | null>>;
  closeImportModal: () => void;
  openImportResultModal: () => void;
  closeBatchModal: () => void;
}

export interface ScoreEntryActionsResult {
  handleScoreBlur: (studentId: number, subject: string, value: string) => Promise<void>;
  focusCell: (studentId: number, subjectName: string) => void;
  handleSaveAll: () => Promise<void>;
  handleExport: (format: 'excel' | 'csv') => Promise<Blob>;
  handleImport: () => Promise<void>;
  handleExportErrors: () => void;
  handleConfirmAll: () => Promise<void>;
  handleBatchDelete: () => Promise<void>;
  handleBatchReset: () => Promise<void>;
  handleBatchConfirm: () => Promise<void>;
  handlePrint: () => void;
  exportTemplate: () => Promise<void>;
}

export function useScoreEntryActions(params: ScoreEntryActionsParams): ScoreEntryActionsResult {
  const {
    showToast,
    dispatch,
    selectedExam,
    selectedClass,
    scores,
    pendingChanges,
    importFile,
    importResult,
    batchSubject,
    confirmRef,
    fetchStudentsAndScores,
    clearDraft,
    getSubjectId,
    runBatched,
    setBatchProgress,
    setBatchFailures,
    closeImportModal,
    openImportResultModal,
    closeBatchModal,
  } = params;

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

  return {
    handleScoreBlur,
    focusCell,
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
  };
}
