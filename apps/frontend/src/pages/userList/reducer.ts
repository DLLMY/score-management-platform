/**
 * T12-9 拆分（2026-09-12）：reducer 与 initialState 自 useUserListLogic.ts 原样搬出。
 * UserListState / UserListAction 别名保持原导出名（UserListView 经 useUserListLogic re-export 引用）。
 */

import type { User } from '../../types';
import type { RankRule } from '../../services/api';
import type { PaginationState, FormData, Rule } from './types';
import type { SearchCondition } from '../../components';

export interface State {
  users: User[];
  rules: Rule[];
  rankRules: RankRule[];
  searchTerm: string;
  selectedClass: string;
  showModal: boolean;
  editingUser: User | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  selectedUsers: Set<number>;
  showBatchModal: boolean;
  batchScoreChange: number;
  showImportModal: boolean;
  importing: boolean;
  showQuickScoreModal: boolean;
  quickScoreUser: User | null;
  scoreTab: 'add' | 'subtract';
  pagination: PaginationState;
  formData: FormData;
  showAdvancedSearch: boolean;
  advancedConditions: SearchCondition;
}

export type Action =
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_RULES'; payload: Rule[] }
  | { type: 'SET_RANK_RULES'; payload: RankRule[] }
  | { type: 'SET_SEARCH_TERM'; payload: string }
  | { type: 'SET_SELECTED_CLASS'; payload: string }
  | { type: 'SET_SHOW_MODAL'; payload: boolean }
  | { type: 'SET_EDITING_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FETCHING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SELECTED_USERS'; payload: Set<number> }
  | { type: 'TOGGLE_USER_SELECTION'; payload: number }
  | { type: 'CLEAR_USER_SELECTION' }
  | { type: 'SET_SHOW_BATCH_MODAL'; payload: boolean }
  | { type: 'SET_BATCH_SCORE_CHANGE'; payload: number }
  | { type: 'SET_SHOW_IMPORT_MODAL'; payload: boolean }
  | { type: 'SET_IMPORTING'; payload: boolean }
  | { type: 'SET_SHOW_QUICK_SCORE_MODAL'; payload: boolean }
  | { type: 'SET_QUICK_SCORE_USER'; payload: User | null }
  | { type: 'SET_SCORE_TAB'; payload: 'add' | 'subtract' }
  | { type: 'SET_PAGINATION'; payload: PaginationState }
  | { type: 'SET_FORM_DATA'; payload: Partial<FormData> }
  | { type: 'UPDATE_USER_SCORE'; payload: { userId: number; scoreChange: number } }
  | { type: 'DELETE_USER'; payload: number }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_SHOW_ADVANCED_SEARCH'; payload: boolean }
  | { type: 'SET_ADVANCED_CONDITIONS'; payload: SearchCondition };

export type UserListState = State;
export type UserListAction = Action;

export const initialState: State = {
  users: [],
  rules: [],
  rankRules: [],
  searchTerm: '',
  selectedClass: '',
  showModal: false,
  editingUser: null,
  isLoading: true,
  isFetching: false,
  error: null,
  selectedUsers: new Set(),
  showBatchModal: false,
  batchScoreChange: 0,
  showImportModal: false,
  importing: false,
  showQuickScoreModal: false,
  quickScoreUser: null,
  scoreTab: 'add',
  pagination: {
    page: 1,
    per_page: 20,
    total: 0,
    pages: 1,
  },
  formData: {
    name: '',
    gender: '男',
    class_name: '',
    phone: '',
    parent_info: '',
    father_name: '',
    father_phone: '',
    mother_name: '',
    mother_phone: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relation: '',
    card_id: '',
    current_score: 60,
  },
  showAdvancedSearch: false,
  advancedConditions: {},
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_RULES':
      return { ...state, rules: action.payload };
    case 'SET_RANK_RULES':
      return { ...state, rankRules: action.payload };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload, pagination: { ...state.pagination, page: 1 } };
    case 'SET_SELECTED_CLASS':
      return {
        ...state,
        selectedClass: action.payload,
        pagination: { ...state.pagination, page: 1 },
      };
    case 'SET_SHOW_MODAL':
      return { ...state, showModal: action.payload };
    case 'SET_EDITING_USER':
      return { ...state, editingUser: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_FETCHING':
      return { ...state, isFetching: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SELECTED_USERS':
      return { ...state, selectedUsers: action.payload };
    case 'TOGGLE_USER_SELECTION': {
      const newSelected = new Set(state.selectedUsers);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, selectedUsers: newSelected };
    }
    case 'CLEAR_USER_SELECTION':
      return { ...state, selectedUsers: new Set() };
    case 'SET_SHOW_BATCH_MODAL':
      return { ...state, showBatchModal: action.payload };
    case 'SET_BATCH_SCORE_CHANGE':
      return { ...state, batchScoreChange: action.payload };
    case 'SET_SHOW_IMPORT_MODAL':
      return { ...state, showImportModal: action.payload };
    case 'SET_IMPORTING':
      return { ...state, importing: action.payload };
    case 'SET_SHOW_QUICK_SCORE_MODAL':
      return { ...state, showQuickScoreModal: action.payload };
    case 'SET_QUICK_SCORE_USER':
      return { ...state, quickScoreUser: action.payload };
    case 'SET_SCORE_TAB':
      return { ...state, scoreTab: action.payload };
    case 'SET_PAGINATION':
      return { ...state, pagination: action.payload };
    case 'SET_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'UPDATE_USER_SCORE':
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.userId
            ? { ...user, current_score: (user.current_score || 0) + action.payload.scoreChange }
            : user
        ),
      };
    case 'DELETE_USER': {
      // M7: 总数同步减一 + 末页分页回退（防删除后页码越界导致空列表）
      const total = Math.max(0, (state.pagination.total || 0) - 1);
      const perPage = state.pagination.per_page || 20;
      const pages = Math.max(1, Math.ceil(total / perPage));
      return {
        ...state,
        users: state.users.filter((user) => user.id !== action.payload),
        selectedUsers: new Set([...state.selectedUsers].filter((id) => id !== action.payload)),
        pagination: {
          ...state.pagination,
          total,
          pages,
          page: (state.pagination.page || 1) > pages ? pages : state.pagination.page || 1,
        },
      };
    }
    case 'ADD_USER':
      return { ...state, users: [action.payload, ...state.users] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((user) => (user.id === action.payload.id ? action.payload : user)),
      };
    case 'SET_SHOW_ADVANCED_SEARCH':
      return { ...state, showAdvancedSearch: action.payload };
    case 'SET_ADVANCED_CONDITIONS':
      return { ...state, advancedConditions: action.payload };
    default:
      return state;
  }
}
