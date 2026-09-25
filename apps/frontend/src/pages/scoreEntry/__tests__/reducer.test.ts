import { describe, it, expect } from 'vitest';
import { scoreEntryReducer, initialState } from '../reducer';
import type { ScoreEntryState, ScoreEntryAction } from '../types';

function base(): ScoreEntryState {
  return { ...initialState };
}

describe('scoreEntryReducer · 纯函数 reducer', () => {
  it('initialState 形状正确', () => {
    expect(initialState.exams).toEqual([]);
    expect(initialState.pendingChanges).toEqual({});
    expect(initialState.scores).toEqual({});
    expect(initialState.loading).toBe(false);
  });

  it('SET_EXAMS 替换 exams 且不改变其它字段', () => {
    const exams = [{ id: 1, name: '期中' }] as ScoreEntryState['exams'];
    const next = scoreEntryReducer(base(), { type: 'SET_EXAMS', payload: exams });
    expect(next.exams).toBe(exams);
    expect(next).not.toBe(base());
    expect(next.selectedClass).toBe('');
  });

  it('SET_SELECTED_EXAM', () => {
    const next = scoreEntryReducer(base(), { type: 'SET_SELECTED_EXAM', payload: '3' });
    expect(next.selectedExam).toBe('3');
  });

  it('SET_CLASSES', () => {
    const classes = [{ id: 2, name: '1班' }];
    const next = scoreEntryReducer(base(), { type: 'SET_CLASSES', payload: classes });
    expect(next.classes).toBe(classes);
  });

  it('SET_SELECTED_CLASS', () => {
    const next = scoreEntryReducer(base(), { type: 'SET_SELECTED_CLASS', payload: '5' });
    expect(next.selectedClass).toBe('5');
  });

  it('SET_STUDENTS', () => {
    const students = [{ id: 1, name: '张三' }] as ScoreEntryState['students'];
    const next = scoreEntryReducer(base(), { type: 'SET_STUDENTS', payload: students });
    expect(next.students).toBe(students);
  });

  it('SET_SUBJECTS', () => {
    const subjects = [{ id: 1, name: '语文' }] as ScoreEntryState['subjects'];
    const next = scoreEntryReducer(base(), { type: 'SET_SUBJECTS', payload: subjects });
    expect(next.subjects).toBe(subjects);
  });

  it('SET_SCORES', () => {
    const scores = { '1-语文': { student_id: 1, subject: '语文', score: 90 } };
    const next = scoreEntryReducer(base(), { type: 'SET_SCORES', payload: scores });
    expect(next.scores).toBe(scores);
  });

  it('SET_LOADING', () => {
    const next = scoreEntryReducer(base(), { type: 'SET_LOADING', payload: true });
    expect(next.loading).toBe(true);
  });

  it('SET_IMPORT_FILE', () => {
    const file = new File([''], 'x.csv');
    const next = scoreEntryReducer(base(), { type: 'SET_IMPORT_FILE', payload: file });
    expect(next.importFile).toBe(file);
  });

  it('SET_EDITING_CELL', () => {
    const cell = { studentId: 1, subject: '语文' };
    const next = scoreEntryReducer(base(), { type: 'SET_EDITING_CELL', payload: cell });
    expect(next.editingCell).toEqual(cell);
  });

  it('SET_FILTER_SUBJECT', () => {
    const next = scoreEntryReducer(base(), { type: 'SET_FILTER_SUBJECT', payload: '数学' });
    expect(next.filterSubject).toBe('数学');
  });

  it('SET_STATUS_FILTER', () => {
    const next = scoreEntryReducer(base(), { type: 'SET_STATUS_FILTER', payload: 'pending' });
    expect(next.statusFilter).toBe('pending');
  });

  it('SET_BATCH_SUBJECT', () => {
    const next = scoreEntryReducer(base(), { type: 'SET_BATCH_SUBJECT', payload: '英语' });
    expect(next.batchSubject).toBe('英语');
  });

  it('SET_IMPORT_RESULT', () => {
    const result = { successCount: 1, failedCount: 0, failedMessages: [] };
    const next = scoreEntryReducer(base(), { type: 'SET_IMPORT_RESULT', payload: result });
    expect(next.importResult).toBe(result);
  });

  it('SET_PENDING_CHANGES', () => {
    const pc = { '1-语文': { student_id: 1, subject: '语文', score: 90 } };
    const next = scoreEntryReducer(base(), { type: 'SET_PENDING_CHANGES', payload: pc });
    expect(next.pendingChanges).toBe(pc);
  });

  it('UPDATE_SCORE 按 key 合并进 scores', () => {
    const start: ScoreEntryState = {
      ...base(),
      scores: { '1-语文': { student_id: 1, subject: '语文', score: 80 } },
    };
    const next = scoreEntryReducer(start, {
      type: 'UPDATE_SCORE',
      payload: { key: '1-数学', score: { student_id: 1, subject: '数学', score: 90 } },
    });
    expect(next.scores['1-语文'].score).toBe(80);
    expect(next.scores['1-数学'].score).toBe(90);
    expect(start.scores['1-数学']).toBeUndefined(); // 不可变
  });

  it('ADD_PENDING_CHANGE 按 key 添加', () => {
    const change = { student_id: 1, subject: '数学', score: 90 };
    const next = scoreEntryReducer(base(), {
      type: 'ADD_PENDING_CHANGE',
      payload: { key: '1-数学', change },
    });
    expect(next.pendingChanges['1-数学']).toBe(change);
  });

  it('REMOVE_PENDING_CHANGE 按 key 删除', () => {
    const start: ScoreEntryState = {
      ...base(),
      pendingChanges: {
        '1-数学': { student_id: 1, subject: '数学', score: 90 },
        '2-数学': { student_id: 2, subject: '数学', score: 80 },
      },
    };
    const next = scoreEntryReducer(start, { type: 'REMOVE_PENDING_CHANGE', payload: '1-数学' });
    expect(next.pendingChanges['1-数学']).toBeUndefined();
    expect(next.pendingChanges['2-数学']).toBeDefined();
  });

  it('CLEAR_PENDING_CHANGES 清空', () => {
    const start: ScoreEntryState = {
      ...base(),
      pendingChanges: { '1-数学': { student_id: 1, subject: '数学', score: 90 } },
    };
    const next = scoreEntryReducer(start, { type: 'CLEAR_PENDING_CHANGES' });
    expect(next.pendingChanges).toEqual({});
  });

  it('未知 action → 返回原 state（不创建新对象）', () => {
    const s = base();
    const unknown = { type: 'NO_SUCH' } as unknown as ScoreEntryAction;
    expect(scoreEntryReducer(s, unknown)).toBe(s);
  });
});
