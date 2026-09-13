/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-7 拆分（2026-09-12）：M3 本地草稿域（草稿合成 / useAutoSave / 空草稿清理 / 恢复与丢弃）。
 * 自 useScoreEntryLogic.tsx 原样搬出。
 */

import { useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useAutoSave } from '../../../hooks';
import type { PendingChange, ScoreEntryAction, ScoreEntryDraft, ScoreItem } from '../types';

export interface ScoreEntryDraftParams {
  dispatch: Dispatch<ScoreEntryAction>;
  setClassInput: Dispatch<SetStateAction<string>>;
  selectedExam: string;
  selectedClass: string;
  scores: Record<string, ScoreItem>;
  pendingChanges: Record<string, PendingChange>;
  batchSubject: string;
  filterSubject: string;
}

export interface ScoreEntryDraftResult {
  draftAvailable: boolean;
  clearDraft: () => void;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
}

export function useScoreEntryDraft(params: ScoreEntryDraftParams): ScoreEntryDraftResult {
  const {
    dispatch,
    setClassInput,
    selectedExam,
    selectedClass,
    scores,
    pendingChanges,
    batchSubject,
    filterSubject,
  } = params;

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

  return { draftAvailable, clearDraft, handleRestoreDraft, handleDiscardDraft };
}
