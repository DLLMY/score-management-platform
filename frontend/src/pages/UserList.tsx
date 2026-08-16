import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
import { useReducer, useEffect, useMemo, useCallback, useState, FormEvent, useRef } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Download,
  Zap,
  Filter,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  User as UserIcon,
} from 'lucide-react';
import api, { RankRule, getAuthHeaders } from '../services/api';
import { User } from '../types';
import {
  Button,
  Modal,
  SearchFilter,
  SearchCondition,
  ImportExportPanel,
  Pagination,
  PermissionButton,
  BatchActionBar,
  AdvancedSearch,
  EmptyState,
  TableSkeleton,
  UserTableRow,
} from '../components';
import { useStableToast } from '../hooks/useStableToast';
import { validateForm } from '../utils/validation';
import { useAppState } from '../hooks/useAppState';
import { usePermissions } from '../hooks/usePermissions';
import { useDebouncedValue } from '../hooks';
import { useAutoSave } from '../hooks/useAutoSave';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { withOptimisticUpdate } from '../utils/optimisticUpdate';

interface PaginationState {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

interface FormData {
  name: string;
  gender: string;
  class_name: string;
  phone: string;
  parent_info: string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relation: string;
  card_id: string;
  current_score: number;
}

interface Rule {
  id: number;
  name: string;
  score: number;
  description?: string;
  is_active: boolean;
  daily_limit?: number;
  min_interval?: number;
}

interface State {
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

type Action =
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

const initialState: State = {
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

function reducer(state: State, action: Action): State {
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
      return { ...state, selectedClass: action.payload, pagination: { ...state.pagination, page: 1 } };
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
    case 'DELETE_USER':
      return {
        ...state,
        users: state.users.filter((user) => user.id !== action.payload),
        selectedUsers: new Set([...state.selectedUsers].filter((id) => id !== action.payload)),
      };
    case 'ADD_USER':
      return { ...state, users: [action.payload, ...state.users] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.id ? action.payload : user
        ),
      };
    case 'SET_SHOW_ADVANCED_SEARCH':
      return { ...state, showAdvancedSearch: action.payload };
    case 'SET_ADVANCED_CONDITIONS':
      return { ...state, advancedConditions: action.payload };
    default:
      return state;
  }
}

function UserList() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { showToast } = useStableToast();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [classList, setClassList] = useState<{ id: number; name: string }[]>([]);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [searchTermInput, setSearchTermInput] = useState('');
  const advancedConditionsRef = useRef(state.advancedConditions);
  const selectedClassRef = useRef(state.selectedClass);
  const searchTermRef = useRef(state.searchTerm);
  const showAdvancedSearchRef = useRef(state.showAdvancedSearch);
  const paginationRef = useRef(state.pagination);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const debouncedSearchTerm = useDebouncedValue(searchTermInput, 300);
  
  const { wrapAsync } = useAppState();
  usePermissions();

  const {
    addOperation,
  } = useUndoRedo({ maxHistory: 50 });

  const autoSave = useAutoSave({
    key: 'user-form',
    data: state.formData,
    onSave: async (data) => {
      if (state.editingUser) {
        await api.users.update(Number(state.editingUser.id), {
          ...data,
        });
      }
    },
    debounceMs: 3000,
    enabled: state.showModal && !!state.editingUser,
  });

  useEffect(() => {
    if (debouncedSearchTerm !== searchTermRef.current) {
      searchTermRef.current = debouncedSearchTerm;
      dispatch({ type: 'SET_SEARCH_TERM', payload: debouncedSearchTerm });
      dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
      setFetchTrigger(prev => prev + 1);
    }
  }, [debouncedSearchTerm]);
  
  useEffect(() => {
    advancedConditionsRef.current = state.advancedConditions;
  }, [state.advancedConditions]);
  
  useEffect(() => {
    selectedClassRef.current = state.selectedClass;
  }, [state.selectedClass]);
  
  useEffect(() => {
    searchTermRef.current = state.searchTerm;
  }, [state.searchTerm]);
  
  useEffect(() => {
    showAdvancedSearchRef.current = state.showAdvancedSearch;
  }, [state.showAdvancedSearch]);
  
  useEffect(() => {
    paginationRef.current = state.pagination;
  }, [state.pagination]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await api.classes.getAll() as unknown;
        const classesData = Array.isArray(data) ? data : ((data as { classes?: { id: number; name: string }[] }).classes || []);
        setClassList(classesData);
      } catch (error) {
        logger.error('Error fetching classes:', error);
        showToast('error', '班级列表加载失败，筛选器可能不可用');
      }
    };
    fetchClasses();
  }, []);

  const classes = useMemo(() => {
    return classList.map(c => c.name).sort();
  }, [classList]);

  const filteredUsers = state.users;
  const selectedUsersArray = useMemo(() => Array.from(state.selectedUsers), [state.selectedUsers]);
  const selectedUsersData = useMemo(() => 
    state.users.filter(user => state.selectedUsers.has(Number(user.id))),
    [state.users, state.selectedUsers]
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTermInput(term);
  }, []);

  const handleClassChange = useCallback((className: string) => {
    selectedClassRef.current = className;
    dispatch({ type: 'SET_SELECTED_CLASS', payload: className });
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
    setFetchTrigger(prev => prev + 1);
  }, []);

  const handleAdvancedSearch = useCallback(() => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
    setFetchTrigger(prev => prev + 1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page } });
    setFetchTrigger(prev => prev + 1);
  }, []);

  const fetchUsers = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    dispatch({ type: 'SET_FETCHING', payload: true });
    
    try {
      const { page, per_page } = paginationRef.current;
      
      const apiParams: Record<string, unknown> = {
        page,
        per_page,
        skipCache: true,
        signal: controller.signal,
      };
      
      if (!showAdvancedSearchRef.current) {
        apiParams.class_id = selectedClassRef.current && selectedClassRef.current !== '' ? Number(selectedClassRef.current) : undefined;
        apiParams.search = searchTermRef.current && searchTermRef.current !== '' ? searchTermRef.current : undefined;
      } else {
        const { keyword, classId, minScore, maxScore, sortBy, sortOrder } = advancedConditionsRef.current;
        apiParams.class_id = classId ? Number(classId) : undefined;
        apiParams.keyword = keyword || undefined;
        apiParams.min_score = minScore;
        apiParams.max_score = maxScore;
        apiParams.sort_by = sortBy || 'name';
        apiParams.sort_order = sortOrder || 'asc';
      }
      
      const response = await api.users.getAll(apiParams);
      
      if (response !== null) {
        const data = response as { users?: User[]; total?: number; pages?: number; page?: number };
        
        if (Array.isArray(response)) { // 防御分支：后端异常时兜底，非真实总数
          dispatch({ type: 'SET_USERS', payload: response });
          dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, total: response.length, pages: Math.ceil(response.length / per_page) } });
        } else {
          dispatch({ type: 'SET_USERS', payload: data.users || [] });
          dispatch({ type: 'SET_PAGINATION', payload: { 
            ...paginationRef.current, 
            total: data.total || 0,
            pages: data.pages || 1,
            page: data.page || page
          } });
        }
      }
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') {
        dispatch({ type: 'SET_ERROR', payload: '加载用户列表失败' });
        logger.error('Error fetching users:', error);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_FETCHING', payload: false });
      abortControllerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTrigger]);

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.rules.getAll();
      dispatch({ type: 'SET_RULES', payload: Array.isArray(data) ? data : (data.rules || []) });
    } catch (error) {
      logger.error('Error fetching rules:', error);
      showToast('error', '积分规则加载失败，快捷评分可能不可用');
    }
  }, [showToast]);

  const fetchRankRules = useCallback(async () => {
    try {
      const data = await api.rankRules.getAll();
      dispatch({ type: 'SET_RANK_RULES', payload: data });
    } catch (error) {
      logger.error('Error fetching rank rules:', error);
      showToast('error', '排名规则加载失败，排名规则可能不可用');
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRules();
    fetchRankRules();
  }, [fetchRules, fetchRankRules]);

  const handleOpenModal = useCallback((user?: User) => {
    if (user) {
      dispatch({ type: 'SET_EDITING_USER', payload: user });
      dispatch({
        type: 'SET_FORM_DATA',
        payload: {
          name: user.name,
          gender: (user as unknown as { gender: string }).gender || '男',
          class_name: user.class_name,
          phone: (user as unknown as { phone: string }).phone || '',
          father_name: (user as unknown as { father_name: string }).father_name || '',
          father_phone: (user as unknown as { father_phone: string }).father_phone || '',
          mother_name: (user as unknown as { mother_name: string }).mother_name || '',
          mother_phone: (user as unknown as { mother_phone: string }).mother_phone || '',
          guardian_name: user.guardian_name || '',
          guardian_phone: user.guardian_phone || '',
          guardian_relation: (user as unknown as { guardian_relation: string }).guardian_relation || '',
          card_id: user.card_id,
          current_score: user.current_score || 0,
        },
      });
    } else {
      dispatch({ type: 'SET_EDITING_USER', payload: null });
      dispatch({
        type: 'SET_FORM_DATA',
        payload: {
          name: '',
          gender: '男',
          class_name: '',
          phone: '',
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
      });
    }
    setFormErrors({});
    dispatch({ type: 'SET_SHOW_MODAL', payload: true });
  }, []);

  const handleCloseModal = useCallback(() => {
    dispatch({ type: 'SET_SHOW_MODAL', payload: false });
    dispatch({ type: 'SET_EDITING_USER', payload: null });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const validationRules = {
        name: { required: true, minLength: 2 },
        card_id: { required: true },
        class_name: { required: true },
      };

      const submitData = {
        ...state.formData,
        current_score: state.formData.current_score,
      };

      const { isValid, errors } = validateForm(submitData, validationRules);

      if (!isValid) {
        setFormErrors(errors);
        return;
      }

      setFormErrors({});

      const isEditing = !!state.editingUser;
      
      await wrapAsync(
        isEditing ? `update-user-${state.editingUser!.id}` : 'create-user',
        async () => {
          if (isEditing && state.editingUser) {
            const res = await api.users.update(Number(state.editingUser.id), submitData);
            // 后端返回 {success,code,data:{user:{...}}}，request() 解包后得到 {user:{...}}，
            // 需取出内层 user 对象，否则 reducer 按 action.payload.id 匹配会失败、列表无法刷新。
            const updatedUser = ((res as { user?: User })?.user ?? res) as User;
            dispatch({ type: 'UPDATE_USER', payload: updatedUser });
          } else {
            const res = await api.users.create(submitData);
            const createdUser = ((res as { user?: User })?.user ?? res) as User;
            dispatch({ type: 'ADD_USER', payload: createdUser });
          }
        },
        {
          message: isEditing ? '更新中...' : '创建中...',
          type: 'local',
          onSuccess: () => {
            showToast('success', isEditing ? '用户信息更新成功' : '用户创建成功');
            handleCloseModal();
            addOperation({
              type: isEditing ? 'update' : 'create',
              description: isEditing ? `更新用户: ${state.formData.name}` : `创建用户: ${state.formData.name}`,
            });
          },
          onError: (error) => {
            showToast('error', '操作失败: ' + error.message);
          },
        }
      );
    },
    [state.formData, state.editingUser, showToast, handleCloseModal, wrapAsync, addOperation]
  );

  const handleDelete = useCallback(
    async (userId: number) => {
      const deletedUser = state.users.find(u => u.id === userId);
      
      await wrapAsync(
        `delete-user-${userId}`,
        async () => {
          await api.users.delete(userId);
        },
        {
          message: '删除中...',
          type: 'local',
          onSuccess: () => {
            dispatch({ type: 'DELETE_USER', payload: userId });
            showToast('success', '删除成功');
            if (deletedUser) {
              addOperation({
                type: 'delete',
                description: `删除用户: ${deletedUser.name}`,
              undo: async () => {
                const created = await api.users.create({ ...deletedUser });
                // 后端返回 {user:{...}}，需解包内层 user，否则 ADD_USER 按 payload.id 匹配会失败
                const restored = ((created as { user?: User }).user ?? created) as User;
                dispatch({ type: 'ADD_USER', payload: restored });
              },
              });
            }
          },
          onError: (error) => {
            showToast('error', '删除失败: ' + error.message);
          },
        }
      );
    },
    [showToast, state.users, wrapAsync, addOperation]
  );

  const handleOpenQuickScore = useCallback((user: User) => {
    dispatch({ type: 'SET_QUICK_SCORE_USER', payload: user });
    dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: true });
  }, []);

  const handleQuickScore = useCallback(async (rule: Rule) => {
    if (!state.quickScoreUser) return;

    const userId = Number(state.quickScoreUser.id);
    const scoreChange = rule.score;
    const action = scoreChange > 0 ? '加分' : '减分';

    try {
      await wrapAsync(
        `quick-score-${userId}`,
        async () => {
          await withOptimisticUpdate(
            { userId, scoreChange },
            () =>
              api.records.create({
                user_id: Number(userId),
                rule_id: rule.id,
                score_change: scoreChange,
                description: rule.name,
                operator: '管理员',
              }),
            {
              update: () => {
                dispatch({
                  type: 'UPDATE_USER_SCORE',
                  payload: { userId, scoreChange },
                });
              },
              revert: () => {
                dispatch({
                  type: 'UPDATE_USER_SCORE',
                  payload: { userId, scoreChange: -scoreChange },
                });
              },
              onSuccess: () => {
                showToast('success', `${action}成功: ${rule.name} (${scoreChange > 0 ? '+' : ''}${scoreChange}分)`);
                dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
                dispatch({ type: 'SET_QUICK_SCORE_USER', payload: null });
                addOperation({
                  type: 'update',
                  description: `${state.quickScoreUser?.name} ${action} ${Math.abs(scoreChange)}分`,
                  undo: async () => {
                    await api.records.create({
                      user_id: Number(userId),
                      rule_id: rule.id,
                      score_change: -scoreChange,
                      description: `撤销${rule.name}`,
                      operator: '管理员',
                    });
                    dispatch({
                      type: 'UPDATE_USER_SCORE',
                      payload: { userId, scoreChange: -scoreChange },
                    });
                  },
                });
              },
              onError: (error) => {
                showToast('error', '评分失败: ' + error.message);
              },
            }
          );
        },
        {
          message: '评分中...',
          type: 'local',
        }
      );
    } catch (error) {
      logger.error('Optimistic update failed:', error);
    }
  }, [state.quickScoreUser, showToast, addOperation, wrapAsync]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedUsersArray.length === 0) return;

    await wrapAsync(
      'batch-delete-users',
      async () => {
        await Promise.all(selectedUsersArray.map(id => api.users.delete(id)));
      },
      {
        message: '批量删除中...',
        type: 'local',
        onSuccess: () => {
          selectedUsersArray.forEach(id => {
            dispatch({ type: 'DELETE_USER', payload: id });
          });
          dispatch({ type: 'CLEAR_USER_SELECTION' });
          showToast('success', `成功删除 ${selectedUsersArray.length} 名学生`);
          addOperation({
            type: 'batch',
            description: `批量删除 ${selectedUsersArray.length} 名学生`,
          });
        },
        onError: (error) => {
          showToast('error', '批量删除失败: ' + error.message);
        },
      }
    );
  }, [selectedUsersArray, showToast, wrapAsync, addOperation]);

  const handleBatchScore = useCallback(async (scoreChange: number) => {
    if (selectedUsersArray.length === 0) return;

    await wrapAsync(
      'batch-score-users',
      async () => {
        await Promise.all(selectedUsersArray.map(id => 
          api.records.create({
            user_id: Number(id),
            rule_id: 1,
            score_change: scoreChange,
            description: '批量调整积分',
            operator: '管理员',
          })
        ));
      },
      {
        message: '批量评分中...',
        type: 'local',
        onSuccess: () => {
          selectedUsersArray.forEach(id => {
            dispatch({
              type: 'UPDATE_USER_SCORE',
              payload: { userId: id, scoreChange },
            });
          });
          dispatch({ type: 'CLEAR_USER_SELECTION' });
          const action = scoreChange > 0 ? '加分' : '减分';
          showToast('success', `成功为 ${selectedUsersArray.length} 名学生${action} ${Math.abs(scoreChange)}分`);
          addOperation({
            type: 'batch',
            description: `批量${action} ${selectedUsersArray.length} 名学生 ${Math.abs(scoreChange)}分`,
          });
        },
        onError: (error) => {
          showToast('error', '批量评分失败: ' + error.message);
        },
      }
    );
  }, [selectedUsersArray, showToast, wrapAsync, addOperation]);

  // 导出：fetch + blob 下载（带鉴权头），失败明确提示；此前仅调用 api.export.users() 返回 URL 字符串，点击无任何反应
  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(api.export.users(), { headers: getAuthHeaders(), credentials: 'include' });
      if (!res.ok) throw new Error(`导出失败(${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('success', '导出成功');
    } catch (e) {
      showToast('error', '导出失败: ' + ((e as Error).message || '未知错误'));
    }
  }, [showToast]);

  const handleToggleUserSelection = useCallback((userId: number) => {
    dispatch({ type: 'TOGGLE_USER_SELECTION', payload: userId });
  }, []);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_USER_SELECTION' });
  }, []);

  const batchActions = useMemo(() => [
    {
      id: 'batch-delete',
      label: '批量删除',
      icon: <Trash2 className='w-4 h-4' />,
      variant: 'danger' as const,
      handler: handleBatchDelete,
      confirmMessage: '确定要删除选中的学生吗？此操作不可恢复。',
    },
    {
      id: 'batch-add-score',
      label: '批量加分',
      icon: <Zap className='w-4 h-4' />,
      variant: 'primary' as const,
      handler: () => handleBatchScore(5),
      confirmMessage: '确定要为选中的学生加5分吗？',
    },
    {
      id: 'batch-subtract-score',
      label: '批量减分',
      icon: <Zap className='w-4 h-4' />,
      variant: 'secondary' as const,
      handler: () => handleBatchScore(-5),
      confirmMessage: '确定要为选中的学生减5分吗？',
    },
  ], [handleBatchDelete, handleBatchScore]);

  const advancedSearchFields = useMemo(() => [
    {
      id: 'keyword',
      label: '关键词',
      type: 'text' as const,
      placeholder: '搜索姓名、卡号或手机号',
      value: state.advancedConditions.keyword,
      onChange: (value: unknown) => dispatch({ 
        type: 'SET_ADVANCED_CONDITIONS', 
        payload: { ...state.advancedConditions, keyword: value as string } 
      }),
    },
    {
      id: 'classId',
      label: '班级',
      type: 'select' as const,
      options: classList.map(c => ({ value: String(c.id), label: c.name })),
      value: state.advancedConditions.classId,
      onChange: (value: unknown) => dispatch({ 
        type: 'SET_ADVANCED_CONDITIONS', 
        payload: { ...state.advancedConditions, classId: value as string } 
      }),
    },
    {
      id: 'minScore',
      label: '最低积分',
      type: 'number' as const,
      placeholder: '最低积分',
      value: state.advancedConditions.minScore,
      onChange: (value: unknown) => dispatch({ 
        type: 'SET_ADVANCED_CONDITIONS', 
        payload: { ...state.advancedConditions, minScore: value as number } 
      }),
    },
    {
      id: 'maxScore',
      label: '最高积分',
      type: 'number' as const,
      placeholder: '最高积分',
      value: state.advancedConditions.maxScore,
      onChange: (value: unknown) => dispatch({ 
        type: 'SET_ADVANCED_CONDITIONS', 
        payload: { ...state.advancedConditions, maxScore: value as number } 
      }),
    },
  ], [state.advancedConditions, classes]);

  if (state.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 rounded w-28 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded w-28 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded w-28 animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="h-12 bg-gray-200 rounded mb-4 animate-pulse" />
          <TableSkeleton rows={8} columns={6} />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <EmptyState
        icon='alert'
        title='加载失败'
        description={state.error}
        actionLabel='重试'
        onAction={() => {
          dispatch({ type: 'SET_ERROR', payload: null });
          setFetchTrigger(prev => prev + 1);
        }}
      />
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">学生管理</h1>
            <p className="text-gray-500 mt-1">管理学生信息和积分</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PermissionButton permission='student.manage' variant='secondary' onClick={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: true })}>
              <Upload className="w-4 h-4 mr-2" />
              导入学生
            </PermissionButton>
            <PermissionButton permission='student.manage' variant='secondary' onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              导出学生
            </PermissionButton>
            <PermissionButton permission='student.manage' onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              添加学生
            </PermissionButton>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <SearchFilter 
            value={state.searchTerm} 
            onChange={handleSearch} 
            placeholder="搜索学生姓名、卡号或手机号" 
            loading={state.isFetching}
            autoSearch={false}
          />
        </div>

        <EmptyState
          icon='search'
          title='暂无搜索结果'
          description='没有找到匹配的用户'
          actionLabel='清除筛选'
          onAction={() => {
            setSearchTermInput('');
            dispatch({ type: 'SET_SELECTED_CLASS', payload: '' });
            dispatch({ type: 'SET_ADVANCED_CONDITIONS', payload: {} });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">学生管理</h1>
          <p className="text-gray-500 mt-1">管理学生信息和积分</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PermissionButton permission='student.manage' variant='secondary' onClick={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: true })}>
            <Upload className="w-4 h-4 mr-2" />
            导入学生
          </PermissionButton>
          <PermissionButton permission='student.manage' variant='secondary' onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出学生
          </PermissionButton>
          <PermissionButton permission='student.manage' onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            添加学生
          </PermissionButton>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <SearchFilter 
            value={state.searchTerm} 
            onChange={handleSearch} 
            placeholder="搜索学生姓名、卡号或手机号" 
            loading={state.isFetching}
            autoSearch={false}
          />
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={state.selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              disabled={state.isFetching}
            >
              <option value="">全部班级</option>
              {classList.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_SHOW_ADVANCED_SEARCH', payload: !state.showAdvancedSearch })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              state.showAdvancedSearch
                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">高级筛选</span>
            {state.showAdvancedSearch ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
        {state.showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <AdvancedSearch
            fields={advancedSearchFields}
            onSearch={handleAdvancedSearch}
            onReset={() => {
              dispatch({ type: 'SET_ADVANCED_CONDITIONS', payload: {} });
              handleAdvancedSearch();
            }}
          />
          </div>
        )}
      </div>

      {selectedUsersArray.length > 0 && (
        <BatchActionBar
          selectedItems={selectedUsersData}
          selectedIds={state.selectedUsers}
          onClearSelection={handleClearSelection}
          actions={batchActions}
          getItemName={(user) => user.name}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => {
                      const allSelected = filteredUsers.every(user => state.selectedUsers.has(Number(user.id)));
                      if (allSelected) {
                        dispatch({ type: 'CLEAR_USER_SELECTION' });
                      } else {
                        const allIds = new Set(filteredUsers.map(u => Number(u.id)));
                        dispatch({ type: 'SET_SELECTED_USERS', payload: allIds });
                      }
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    {filteredUsers.every(user => state.selectedUsers.has(Number(user.id))) ? (
                      <CheckSquare className="w-5 h-5 text-primary-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学生信息</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">班级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前积分</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  isSelected={state.selectedUsers.has(Number(user.id))}
                  onToggleSelection={handleToggleUserSelection}
                  onOpenQuickScore={handleOpenQuickScore}
                  onOpenEdit={handleOpenModal}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200">
          <Pagination
            currentPage={state.pagination.page}
            totalPages={state.pagination.pages}
            totalItems={state.pagination.total}
            itemsPerPage={state.pagination.per_page}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      <Modal
        isOpen={state.showModal}
        onClose={handleCloseModal}
        title={state.editingUser ? '编辑学生' : '添加学生'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {autoSave.hasUnsavedChanges && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700">有未保存的更改，自动保存中...</span>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
            <input
              type="text"
              value={state.formData.name}
              onChange={(e) => dispatch({ type: 'SET_FORM_DATA', payload: { name: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入学生姓名"
            />
            {formErrors.name && <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
            <select
              value={state.formData.gender}
              onChange={(e) => dispatch({ type: 'SET_FORM_DATA', payload: { gender: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">班级 *</label>
            <select
              value={state.formData.class_name}
              onChange={(e) => dispatch({ type: 'SET_FORM_DATA', payload: { class_name: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">请选择班级</option>
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            {formErrors.class_name && <p className="mt-1 text-sm text-red-600">{formErrors.class_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">卡号 *</label>
            <input
              type="text"
              value={state.formData.card_id}
              onChange={(e) => dispatch({ type: 'SET_FORM_DATA', payload: { card_id: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入卡号"
            />
            {formErrors.card_id && <p className="mt-1 text-sm text-red-600">{formErrors.card_id}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">初始积分</label>
            <input
              type="number"
              value={state.formData.current_score}
              onChange={(e) => dispatch({ type: 'SET_FORM_DATA', payload: { current_score: parseInt(e.target.value) || 0 } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              取消
            </Button>
            <Button type="submit" disabled={state.isFetching}>
              {state.editingUser ? '更新' : '创建'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={state.showImportModal}
        onClose={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: false })}
        title="导入学生"
      >
        <ImportExportPanel
           type="user"
          onImportComplete={() => {
            fetchUsers();
            dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: false });
          }}
        />
      </Modal>

      <Modal
        isOpen={state.showQuickScoreModal}
        onClose={() => {
          dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
          dispatch({ type: 'SET_QUICK_SCORE_USER', payload: null });
        }}
        title={`快速评分 - ${state.quickScoreUser?.name || ''}`}
      >
        {state.quickScoreUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{state.quickScoreUser.name}</p>
                <p className="text-sm text-gray-500">
                  班级: {state.quickScoreUser.class_name || '未分配'} | 
                  当前积分: <span className="font-bold text-primary-600">{state.quickScoreUser.current_score}</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">选择评分规则</h3>
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                {state.rules.map((rule) => (
                  <button
                    key={rule.id}
                    onClick={() => handleQuickScore(rule)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all hover:border-primary-300 ${
                      rule.score > 0 
                        ? 'border-green-200 hover:bg-green-50' 
                        : 'border-red-200 hover:bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{rule.name}</p>
                        <p className="text-sm text-gray-500">{rule.description || '无描述'}</p>
                      </div>
                      <span className={`font-bold text-lg ${
                        rule.score > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {rule.score > 0 ? '+' : ''}{rule.score}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default UserList;