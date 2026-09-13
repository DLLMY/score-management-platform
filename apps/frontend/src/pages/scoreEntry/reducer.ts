/**
 * T12-7 拆分（2026-09-12）：reducer 与 initialState 自 useScoreEntryLogic.tsx 原样搬出。
 * 类型直接复用 ./types 的正式定义（原 hook 内 *Local 系列与之逐字段相同，已去重）。
 */

import type { ScoreEntryAction, ScoreEntryState } from './types';

export function scoreEntryReducer(
  state: ScoreEntryState,
  action: ScoreEntryAction
): ScoreEntryState {
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

export const initialState: ScoreEntryState = {
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
