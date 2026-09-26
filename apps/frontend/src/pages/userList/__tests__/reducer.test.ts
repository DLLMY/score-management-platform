import { describe, it, expect } from 'vitest';
import { reducer, initialState, type State, type Action } from '../reducer';
import type { User } from '../../../types';

const makeUser = (over: Partial<User> = {}): User =>
  ({
    id: 1,
    name: '张三',
    card_id: 'C123',
    class_name: '一班',
    is_active: true,
    is_blacklisted: false,
    current_score: 60,
    ...over,
  } as unknown as User);

const run = (action: Action, state: State = initialState) => reducer(state, action);

describe('userList reducer', () => {
  it('SET_USERS / SET_RULES / SET_RANK_RULES', () => {
    expect(run({ type: 'SET_USERS', payload: [makeUser()] }).users).toHaveLength(1);
    expect(run({ type: 'SET_RULES', payload: [] }).rules).toEqual([]);
    expect(run({ type: 'SET_RANK_RULES', payload: [] }).rankRules).toEqual([]);
  });

  it('SET_SEARCH_TERM resets pagination page to 1', () => {
    const s = { ...initialState, pagination: { ...initialState.pagination, page: 3 } };
    const r = run({ type: 'SET_SEARCH_TERM', payload: 'x' }, s);
    expect(r.searchTerm).toBe('x');
    expect(r.pagination.page).toBe(1);
  });

  it('SET_SELECTED_CLASS resets pagination page to 1', () => {
    const s = { ...initialState, pagination: { ...initialState.pagination, page: 4 } };
    const r = run({ type: 'SET_SELECTED_CLASS', payload: 'c1' }, s);
    expect(r.selectedClass).toBe('c1');
    expect(r.pagination.page).toBe(1);
  });

  it('SET_SHOW_MODAL / SET_EDITING_USER / SET_LOADING / SET_FETCHING / SET_ERROR', () => {
    expect(run({ type: 'SET_SHOW_MODAL', payload: true }).showModal).toBe(true);
    expect(run({ type: 'SET_EDITING_USER', payload: makeUser() }).editingUser?.id).toBe(1);
    expect(run({ type: 'SET_EDITING_USER', payload: null }).editingUser).toBeNull();
    expect(run({ type: 'SET_LOADING', payload: false }).isLoading).toBe(false);
    expect(run({ type: 'SET_FETCHING', payload: true }).isFetching).toBe(true);
    expect(run({ type: 'SET_ERROR', payload: 'err' }).error).toBe('err');
    expect(run({ type: 'SET_ERROR', payload: null }).error).toBeNull();
  });

  it('SET_SELECTED_USERS / TOGGLE_USER_SELECTION toggles / CLEAR_USER_SELECTION', () => {
    const s = run({ type: 'SET_SELECTED_USERS', payload: new Set([1, 2]) });
    expect(s.selectedUsers.has(1)).toBe(true);
    const added = run({ type: 'TOGGLE_USER_SELECTION', payload: 3 }, s);
    expect(added.selectedUsers.has(3)).toBe(true);
    const removed = run({ type: 'TOGGLE_USER_SELECTION', payload: 1 }, s);
    expect(removed.selectedUsers.has(1)).toBe(false);
    expect(run({ type: 'CLEAR_USER_SELECTION' }).selectedUsers.size).toBe(0);
  });

  it('SET_SHOW_BATCH_MODAL / SET_BATCH_SCORE_CHANGE / SET_SHOW_IMPORT_MODAL / SET_IMPORTING', () => {
    expect(run({ type: 'SET_SHOW_BATCH_MODAL', payload: true }).showBatchModal).toBe(true);
    expect(run({ type: 'SET_BATCH_SCORE_CHANGE', payload: 5 }).batchScoreChange).toBe(5);
    expect(run({ type: 'SET_SHOW_IMPORT_MODAL', payload: true }).showImportModal).toBe(true);
    expect(run({ type: 'SET_IMPORTING', payload: true }).importing).toBe(true);
  });

  it('SET_SHOW_QUICK_SCORE_MODAL / SET_QUICK_SCORE_USER / SET_SCORE_TAB', () => {
    expect(run({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: true }).showQuickScoreModal).toBe(
      true
    );
    expect(run({ type: 'SET_QUICK_SCORE_USER', payload: makeUser() }).quickScoreUser?.id).toBe(1);
    expect(run({ type: 'SET_QUICK_SCORE_USER', payload: null }).quickScoreUser).toBeNull();
    expect(run({ type: 'SET_SCORE_TAB', payload: 'subtract' }).scoreTab).toBe('subtract');
  });

  it('SET_PAGINATION replaces pagination', () => {
    const p = { page: 2, per_page: 10, total: 20, pages: 2 };
    expect(run({ type: 'SET_PAGINATION', payload: p }).pagination).toEqual(p);
  });

  it('SET_FORM_DATA merges partial and retains other fields', () => {
    const r = run({ type: 'SET_FORM_DATA', payload: { name: '李四' } });
    expect(r.formData.name).toBe('李四');
    expect(r.formData.gender).toBe('男');
  });

  it('UPDATE_USER_SCORE adds score; missing current_score falls back to 0', () => {
    const s: State = {
      ...initialState,
      users: [
        makeUser({ id: 1, current_score: 60 }),
        makeUser({ id: 2, current_score: undefined }),
      ],
    };
    const r = run({ type: 'UPDATE_USER_SCORE', payload: { userId: 2, scoreChange: 5 } }, s);
    expect(r.users.find((u) => u.id === 1)!.current_score).toBe(60);
    expect(r.users.find((u) => u.id === 2)!.current_score).toBe(5);
  });

  it('DELETE_USER filters users + selectedUsers and rolls back page when exceeding pages', () => {
    const s: State = {
      ...initialState,
      users: [makeUser({ id: 1 }), makeUser({ id: 2 }), makeUser({ id: 3 })],
      selectedUsers: new Set([1, 3]),
      pagination: { page: 3, per_page: 2, total: 6, pages: 3 },
    };
    const r = run({ type: 'DELETE_USER', payload: 1 }, s);
    expect(r.users.find((u) => u.id === 1)).toBeUndefined();
    expect(r.users).toHaveLength(2);
    expect(r.selectedUsers.has(1)).toBe(false);
    expect(r.selectedUsers.has(3)).toBe(true);
    expect(r.pagination.total).toBe(5);
    expect(r.pagination.pages).toBe(3);
    expect(r.pagination.page).toBe(3);

    const s2: State = {
      ...initialState,
      users: [makeUser({ id: 1 })],
      pagination: { page: 2, per_page: 2, total: 2, pages: 1 },
    };
    const r2 = run({ type: 'DELETE_USER', payload: 1 }, s2);
    expect(r2.pagination.page).toBe(1);
    expect(r2.pagination.pages).toBe(1);
  });

  it('ADD_USER prepends / UPDATE_USER replaces by id', () => {
    const added = run({ type: 'ADD_USER', payload: makeUser({ id: 99 }) });
    expect(added.users[0].id).toBe(99);
    const s = { ...initialState, users: [makeUser({ id: 1, name: '旧' })] };
    const r = run({ type: 'UPDATE_USER', payload: makeUser({ id: 1, name: '新' }) }, s);
    expect(r.users[0].name).toBe('新');
  });

  it('SET_SHOW_ADVANCED_SEARCH / SET_ADVANCED_CONDITIONS', () => {
    expect(run({ type: 'SET_SHOW_ADVANCED_SEARCH', payload: true }).showAdvancedSearch).toBe(true);
    const cond = { keyword: 'k' } as unknown as State['advancedConditions'];
    expect(run({ type: 'SET_ADVANCED_CONDITIONS', payload: cond }).advancedConditions).toBe(cond);
  });

  it('unknown action returns the same state reference (no-op)', () => {
    const s = initialState;
    const r = reducer(s, { type: 'UNKNOWN' } as unknown as Action);
    expect(r).toBe(s);
  });
});
