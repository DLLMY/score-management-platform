import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScoreEntryDerived } from '../useScoreEntryDerived';
import type { User, Subject } from '../../../../types';
import type { ExamData, ScoreItem } from '../../types';
import type { ScoreEntryDerivedParams } from '../useScoreEntryDerived';

function makeUsers(ids: number[]): User[] {
  return ids.map((id) => ({ id, name: `s${id}`, role: 'student' } as User));
}

function makeParams(overrides: Partial<ScoreEntryDerivedParams> = {}): ScoreEntryDerivedParams {
  return {
    exams: [],
    selectedExam: '',
    subjects: [],
    filterSubject: '',
    statusFilter: '',
    students: [],
    scores: {},
    ...overrides,
  };
}

describe('useScoreEntryDerived · 派生数据', () => {
  // ── examSubjects 解析 ──
  it('未选中考试 → examSubjects 空', () => {
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams: [{ id: 1, name: 'x' }], selectedExam: '' }))
    );
    expect(result.current.examSubjects).toEqual([]);
  });

  it('考试 subjects 为数组 → 直接映射为字符串', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文', '数学'] }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.examSubjects).toEqual(['语文', '数学']);
  });

  it('考试 subjects 为 JSON 数组字符串 → 解析', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: '["语文","数学"]' }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.examSubjects).toEqual(['语文', '数学']);
  });

  it('考试 subjects 为嵌套 JSON 字符串 → 二次解析', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: '"[\\"语文\\",\\"数学\\"]"' }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.examSubjects).toEqual(['语文', '数学']);
  });

  it('考试 subjects 为 CSV 字符串 → 按逗号拆分并去引号', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: '语文, "数学", [英语]' }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.examSubjects).toEqual(['语文', '数学', '英语']);
  });

  it('考试 subjects 为非法 JSON 且有引号 → 退回 split 并清理', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: '语文, 数学, 英语' }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.examSubjects).toEqual(['语文', '数学', '英语']);
  });

  it('考试 subjects 非数组且为空字符串 → 空', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: '' }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.examSubjects).toEqual([]);
  });

  // ── getSubjectId ──
  it('getSubjectId：按 name + exam_id 匹配', () => {
    const subjects = [
      { id: 10, name: '语文', exam_id: 1 },
      { id: 20, name: '语文', exam_id: 2 },
    ] as Subject[];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ subjects, selectedExam: '1' }))
    );
    expect(result.current.getSubjectId('语文')).toBe(10);
  });

  it('getSubjectId：无匹配 → undefined', () => {
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ subjects: [], selectedExam: '1' }))
    );
    expect(result.current.getSubjectId('物理')).toBeUndefined();
  });

  // ── visibleSubjects ──
  it('filterSubject 为空 → 返回全部 examSubjects', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文', '数学'] }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.visibleSubjects).toEqual(['语文', '数学']);
  });

  it('filterSubject 命中 → 仅返回该科目', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文', '数学'] }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1', filterSubject: '数学' }))
    );
    expect(result.current.visibleSubjects).toEqual(['数学']);
  });

  // ── getEntryProgress ──
  it('无学生或无可见科目 → 进度 0', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1' }))
    );
    expect(result.current.getEntryProgress).toBe(0);
  });

  it('部分录入 → 按比例取整', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文', '数学'] }];
    const students = makeUsers([1, 2]);
    const scores: Record<string, ScoreItem> = {
      '1-语文': { student_id: 1, subject: '语文', score: 90 },
      '1-数学': { student_id: 1, subject: '数学', score: 80 },
      // 2号学生两科都未录
    };
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1', students, scores }))
    );
    // 4 格，1号 2 格已录 → 50%
    expect(result.current.getEntryProgress).toBe(50);
  });

  it('全部录入 → 100', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const students = makeUsers([1]);
    const scores: Record<string, ScoreItem> = {
      '1-语文': { student_id: 1, subject: '语文', score: 90 },
    };
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1', students, scores }))
    );
    expect(result.current.getEntryProgress).toBe(100);
  });

  // ── filteredStudents ──
  function scoresFor(
    statusMap: Record<string, 'pending' | 'confirmed' | 'locked' | undefined>,
    score = 90
  ) {
    const map: Record<string, ScoreItem> = {};
    for (const [k, status] of Object.entries(statusMap)) {
      map[k] = { student_id: Number(k.split('-')[0]), subject: k.split('-')[1], score, status };
    }
    return map;
  }

  it('statusFilter 为空 → 返回全部学生', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const students = makeUsers([1, 2]);
    const { result } = renderHook(() =>
      useScoreEntryDerived(makeParams({ exams, selectedExam: '1', students }))
    );
    expect(result.current.filteredStudents).toHaveLength(2);
  });

  it("statusFilter='confirmed' → 仅全部 confirmed 的学生", () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const students = makeUsers([1, 2]);
    const scores = scoresFor({ '1-语文': 'confirmed', '2-语文': 'pending' });
    const { result } = renderHook(() =>
      useScoreEntryDerived(
        makeParams({ exams, selectedExam: '1', students, scores, statusFilter: 'confirmed' })
      )
    );
    expect(result.current.filteredStudents.map((s) => s.id)).toEqual([1]);
  });

  it("statusFilter='pending' → 有部分 pending 且非全 confirmed", () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const students = makeUsers([1, 2]);
    const scores = scoresFor({ '1-语文': 'pending', '2-语文': 'confirmed' });
    const { result } = renderHook(() =>
      useScoreEntryDerived(
        makeParams({ exams, selectedExam: '1', students, scores, statusFilter: 'pending' })
      )
    );
    expect(result.current.filteredStudents.map((s) => s.id)).toEqual([1]);
  });

  it("statusFilter='partial' → 有成绩但非全 confirmed 且非 pending", () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const students = makeUsers([1, 2]);
    // 1号已录但 status 为空（既非confirmed也非pending）-> partial
    const scores = scoresFor({ '1-语文': undefined, '2-语文': 'confirmed' });
    const { result } = renderHook(() =>
      useScoreEntryDerived(
        makeParams({ exams, selectedExam: '1', students, scores, statusFilter: 'partial' })
      )
    );
    expect(result.current.filteredStudents.map((s) => s.id)).toEqual([1]);
  });

  it("statusFilter='empty' → 无任何成绩", () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文'] }];
    const students = makeUsers([1, 2]);
    const scores = scoresFor({ '1-语文': 'confirmed' });
    const { result } = renderHook(() =>
      useScoreEntryDerived(
        makeParams({ exams, selectedExam: '1', students, scores, statusFilter: 'empty' })
      )
    );
    expect(result.current.filteredStudents.map((s) => s.id)).toEqual([2]);
  });

  it('params 变化时派生值随 act 更新', () => {
    const exams: ExamData[] = [{ id: 1, name: 'x', subjects: ['语文', '数学'] }];
    const { result, rerender } = renderHook(
      (p: Partial<ScoreEntryDerivedParams>) => useScoreEntryDerived(makeParams(p)),
      { initialProps: { exams, selectedExam: '1' } as Partial<ScoreEntryDerivedParams> }
    );
    expect(result.current.visibleSubjects).toEqual(['语文', '数学']);
    act(() => {
      rerender({ exams, selectedExam: '1', filterSubject: '数学' });
    });
    expect(result.current.visibleSubjects).toEqual(['数学']);
  });
});
