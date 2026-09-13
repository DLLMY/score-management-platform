/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 成绩录入页的逻辑层组合根 hook（T12-7 拆分，2026-09-12）。
 *
 * 领域子 hooks（./hooks/）：useScoreEntryData（拉取/防抖/节流）、useScoreEntryDraft（M3 草稿）、
 * useScoreEntryDerived（派生 memo）、useScoreEntryBatch（批量进度/取消）、useScoreEntryActions（写操作）。
 * reducer 与 initialState 见 ./reducer；本文件仅做组合装配与列定义/键盘快捷键。
 */

import { useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { useConfirm, type ColumnType } from '../../components';
import { useModal, usePermissions, useStableToast, useSubmitGuard } from '../../hooks';
import type { User } from '../../types';
import { buildScoreEntryColumns } from './columns';
import { initialState, scoreEntryReducer } from './reducer';
import type { ScoreEntryViewProps } from './types';
import {
  useScoreEntryActions,
  useScoreEntryBatch,
  useScoreEntryData,
  useScoreEntryDerived,
  useScoreEntryDraft,
} from './hooks';

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

  const { setClassInput, fetchStudentsAndScores, throttledRefresh } = useScoreEntryData({
    dispatch,
    showToast,
    selectedExam,
    selectedClass,
  });

  const { draftAvailable, clearDraft, handleRestoreDraft, handleDiscardDraft } = useScoreEntryDraft(
    {
      dispatch,
      setClassInput,
      selectedExam,
      selectedClass,
      scores,
      pendingChanges,
      batchSubject,
      filterSubject,
    }
  );

  const { examSubjects, getSubjectId, visibleSubjects, getEntryProgress, filteredStudents } =
    useScoreEntryDerived({
      exams,
      selectedExam,
      subjects,
      filterSubject,
      statusFilter,
      students,
      scores,
    });

  const {
    batchProgress,
    setBatchProgress,
    batchFailures,
    setBatchFailures,
    runBatched,
    onCancelBatch,
  } = useScoreEntryBatch();

  const {
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
  } = useScoreEntryActions({
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
  });

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
    onCancelBatch,
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
