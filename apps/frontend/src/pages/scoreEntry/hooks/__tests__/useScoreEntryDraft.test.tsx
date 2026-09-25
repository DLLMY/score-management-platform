import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScoreEntryDraft } from '../useScoreEntryDraft';
import type { ScoreEntryDraftParams } from '../useScoreEntryDraft';

const mockAutoSave = {
  draftAvailable: false,
  loadDraft: vi.fn(),
  restoreDraft: vi.fn(),
  discardChanges: vi.fn(),
  clearDraft: vi.fn(),
};

vi.mock('../../../../hooks', async () => {
  const actual = await vi.importActual('../../../../hooks');
  return { ...actual, useAutoSave: () => mockAutoSave };
});

function makeParams(overrides: Partial<ScoreEntryDraftParams> = {}): ScoreEntryDraftParams {
  return {
    dispatch: vi.fn(),
    setClassInput: vi.fn(),
    selectedExam: '',
    selectedClass: '',
    scores: {},
    pendingChanges: {},
    batchSubject: '',
    filterSubject: '',
    ...overrides,
  } as ScoreEntryDraftParams;
}

describe('useScoreEntryDraft · 本地草稿域', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAutoSave.draftAvailable = false;
    mockAutoSave.restoreDraft.mockReset();
    mockAutoSave.discardChanges.mockReset();
    mockAutoSave.clearDraft.mockReset();
    mockAutoSave.loadDraft.mockReset();
  });

  it('透传 draftAvailable / clearDraft', () => {
    mockAutoSave.draftAvailable = true;
    const { result } = renderHook(() => useScoreEntryDraft(makeParams()));
    expect(result.current.draftAvailable).toBe(true);
    expect(result.current.clearDraft).toBe(mockAutoSave.clearDraft);
  });

  it('handleRestoreDraft：恢复并 dispatch 全部字段 + 设置 classInput', () => {
    mockAutoSave.restoreDraft.mockReturnValue({
      selectedExam: '1',
      selectedClass: '2',
      scores: { '1-语文': { student_id: 1, subject: '语文', score: 90 } },
      pendingChanges: { '1-数学': { student_id: 1, subject: '数学', score: 80 } },
      batchSubject: '数学',
      filterSubject: '语文',
    });
    const params = makeParams();
    const { result } = renderHook(() => useScoreEntryDraft(params));
    act(() => result.current.handleRestoreDraft());
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_EXAM', payload: '1' });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_CLASS', payload: '2' });
    expect(params.setClassInput).toHaveBeenCalledWith('2');
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_SCORES',
        payload: { '1-语文': { student_id: 1, subject: '语文', score: 90 } },
      })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_PENDING_CHANGES',
        payload: { '1-数学': { student_id: 1, subject: '数学', score: 80 } },
      })
    );
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_BATCH_SUBJECT', payload: '数学' });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_FILTER_SUBJECT', payload: '语文' });
  });

  it('handleRestoreDraft：restoreDraft 返回 null → 不 dispatch', () => {
    mockAutoSave.restoreDraft.mockReturnValue(null);
    const params = makeParams();
    const { result } = renderHook(() => useScoreEntryDraft(params));
    act(() => result.current.handleRestoreDraft());
    expect(params.dispatch).not.toHaveBeenCalled();
  });

  it('handleDiscardDraft：调用 discardChanges', () => {
    const params = makeParams();
    const { result } = renderHook(() => useScoreEntryDraft(params));
    act(() => result.current.handleDiscardDraft());
    expect(mockAutoSave.discardChanges).toHaveBeenCalled();
  });

  it('空草稿静默清理：draftAvailable 且 loadDraft 为空 → clearDraft', async () => {
    mockAutoSave.draftAvailable = true;
    mockAutoSave.loadDraft.mockReturnValue({ selectedExam: '', scores: {}, pendingChanges: {} });
    const params = makeParams();
    renderHook(() => useScoreEntryDraft(params));
    await waitFor(() => expect(mockAutoSave.clearDraft).toHaveBeenCalled());
  });

  it('非空草稿不触发清理', async () => {
    mockAutoSave.draftAvailable = true;
    mockAutoSave.loadDraft.mockReturnValue({
      selectedExam: '1',
      scores: { '1-语文': { student_id: 1, subject: '语文', score: 90 } },
      pendingChanges: {},
    });
    const params = makeParams();
    renderHook(() => useScoreEntryDraft(params));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockAutoSave.clearDraft).not.toHaveBeenCalled();
  });
});
