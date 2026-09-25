import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScoreEntryData } from '../useScoreEntryData';
import type { ScoreEntryDataParams } from '../useScoreEntryData';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    exams: { getAll: vi.fn() },
    classes: { getAll: vi.fn() },
    subjects: { getAll: vi.fn() },
    users: { getAll: vi.fn() },
    scores: { getAll: vi.fn() },
  },
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));

function makeParams(overrides: Partial<ScoreEntryDataParams> = {}): ScoreEntryDataParams {
  return {
    dispatch: vi.fn(),
    showToast: vi.fn(),
    selectedExam: '',
    selectedClass: '',
    ...overrides,
  };
}

const PUBLISHED_EXAMS = [{ id: 3, name: '期中', status: 'published' }];
const STUDENTS_ONLY = [{ id: 1, name: '张三', role: 'student' }];
const SCORES_MAP = { '1-语文': { student_id: 1, subject: '语文', score: 90 } };

describe('useScoreEntryData · 数据拉取域', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.exams.getAll.mockResolvedValue([
      { id: 3, name: '期中', status: 'published' },
      { id: 4, name: '草稿', status: 'draft' },
    ]);
    mockApi.classes.getAll.mockResolvedValue([{ id: 5, name: '1班' }]);
    mockApi.subjects.getAll.mockResolvedValue([{ id: 1, name: '语文', exam_id: 3 }]);
    mockApi.users.getAll.mockResolvedValue([
      { id: 1, name: '张三', role: 'student' },
      { id: 2, name: '老师', role: 'teacher' },
    ]);
    mockApi.scores.getAll.mockResolvedValue([{ student_id: 1, subject: '语文', score: 90 }]);
  });

  it('挂载即拉取考试/班级/科目，且仅保留 published 考试', async () => {
    const params = makeParams({ selectedExam: '' });
    renderHook(() => useScoreEntryData(params));
    await waitFor(() =>
      expect(params.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_EXAMS', payload: PUBLISHED_EXAMS })
      )
    );
    expect(mockApi.exams.getAll).toHaveBeenCalled();
    expect(mockApi.classes.getAll).toHaveBeenCalled();
    expect(mockApi.subjects.getAll).toHaveBeenCalled();
  });

  it('未选考试时不拉取学生/成绩', async () => {
    const params = makeParams({ selectedExam: '' });
    renderHook(() => useScoreEntryData(params));
    await waitFor(() => expect(mockApi.exams.getAll).toHaveBeenCalled());
    expect(mockApi.users.getAll).not.toHaveBeenCalled();
    expect(mockApi.scores.getAll).not.toHaveBeenCalled();
  });

  it('选中考试 → 拉取学生(仅 student)与成绩并写回 scoresMap', async () => {
    const params = makeParams({ selectedExam: '3', selectedClass: '5' });
    renderHook(() => useScoreEntryData(params));
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalled());
    expect(mockApi.users.getAll).toHaveBeenCalledWith({ class_id: 5, skipCache: true });
    expect(mockApi.scores.getAll).toHaveBeenCalledWith({ exam_id: '3' });

    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_EXAMS', payload: PUBLISHED_EXAMS })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_STUDENTS', payload: STUDENTS_ONLY })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_SCORES', payload: SCORES_MAP })
    );
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'CLEAR_PENDING_CHANGES' });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: false });
  });

  it('exams 返回 {data:[...]} 形态也能解析', async () => {
    mockApi.exams.getAll.mockResolvedValue({
      data: [{ id: 3, name: '期中', status: 'published' }],
    });
    const params = makeParams({ selectedExam: '' });
    renderHook(() => useScoreEntryData(params));
    await waitFor(() =>
      expect(params.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_EXAMS', payload: PUBLISHED_EXAMS })
      )
    );
  });

  it('初始拉取失败 → 提示错误', async () => {
    mockApi.exams.getAll.mockRejectedValue(new Error('network down'));
    const params = makeParams({ selectedExam: '' });
    renderHook(() => useScoreEntryData(params));
    await waitFor(() =>
      expect(params.showToast).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('获取数据失败')
      )
    );
  });

  it('学生/成绩拉取失败 → 提示错误且不崩溃', async () => {
    mockApi.users.getAll.mockRejectedValue(new Error('users 500'));
    const params = makeParams({ selectedExam: '3', selectedClass: '5' });
    renderHook(() => useScoreEntryData(params));
    await waitFor(() =>
      expect(params.showToast).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('获取数据失败')
      )
    );
  });

  it('setClassInput 变化经防抖后 dispatch SET_SELECTED_CLASS', async () => {
    const params = makeParams({ selectedExam: '3', selectedClass: '5' });
    const { result } = renderHook(() => useScoreEntryData(params));
    act(() => result.current.setClassInput('9'));
    await waitFor(
      () =>
        expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_CLASS', payload: '9' }),
      { timeout: 2000 }
    );
  });

  it('throttledRefresh 触发最新 fetchStudentsAndScores', async () => {
    const params = makeParams({ selectedExam: '3', selectedClass: '5' });
    const { result } = renderHook(() => useScoreEntryData(params));
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(1));
    act(() => result.current.throttledRefresh());
    await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(2));
  });

  it('fetchStudentsAndScores 显式调用（无 selectedExam 提前返回）', async () => {
    const params = makeParams({ selectedExam: '' });
    const { result } = renderHook(() => useScoreEntryData(params));
    await act(async () => {
      await result.current.fetchStudentsAndScores();
    });
    expect(mockApi.users.getAll).not.toHaveBeenCalled();
  });
});
