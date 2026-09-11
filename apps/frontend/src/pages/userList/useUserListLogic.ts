import logger from '../../utils/logger';
import { downloadBlob } from '../../utils/download';
/* eslint-disable react-hooks/exhaustive-deps */
import { useReducer, useEffect, useMemo, useCallback, useState, useRef, FormEvent } from 'react';
import api, { RankRule, getAuthHeaders } from '../../services/api';
import { User } from '../../types';
import { useConfirm, type ColumnType, type SearchCondition } from '../../components';
import { validateForm } from '../../utils/validation';
import { withOptimisticUpdate } from '../../utils/optimisticUpdate';
import { PaginationState, FormData, Rule } from './types';
import { buildUserColumns } from './columns';
import {
  useAppState,
  useAutoSave,
  useDebouncedValue,
  usePermissions,
  useStableToast,
  useUndoRedo,
} from '../../hooks';

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

export type UserListState = State;
export type UserListAction = Action;

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

/**
 * 用户列表页的逻辑层 hook（状态 / reducer / effect / handler / 列定义）。
 * 主文件退化为「hook → UserListView」的薄装配。
 */
export function useUserListLogic() {
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

  const { addOperation } = useUndoRedo({ maxHistory: 50 });

  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

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
      setFetchTrigger((prev) => prev + 1);
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
        const data = (await api.classes.getAll()) as unknown;
        const classesData = Array.isArray(data)
          ? data
          : (data as { classes?: { id: number; name: string }[] }).classes || [];
        setClassList(classesData);
      } catch (error) {
        logger.error('Error fetching classes:', error);
        showToast('error', '班级列表加载失败，筛选器可能不可用');
      }
    };
    fetchClasses();
  }, []);

  const classes = useMemo(() => {
    return classList.map((c) => c.name).sort();
  }, [classList]);

  const selectedUsersArray = useMemo(() => Array.from(state.selectedUsers), [state.selectedUsers]);
  const selectedUsersData = useMemo(
    () => state.users.filter((user) => state.selectedUsers.has(Number(user.id))),
    [state.users, state.selectedUsers]
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTermInput(term);
  }, []);

  const handleClassChange = useCallback((className: string) => {
    selectedClassRef.current = className;
    dispatch({ type: 'SET_SELECTED_CLASS', payload: className });
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const handleAdvancedSearch = useCallback(() => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page: 1 } });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGINATION', payload: { ...paginationRef.current, page } });
    setFetchTrigger((prev) => prev + 1);
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
        apiParams.class_id =
          selectedClassRef.current && selectedClassRef.current !== ''
            ? Number(selectedClassRef.current)
            : undefined;
        apiParams.search =
          searchTermRef.current && searchTermRef.current !== '' ? searchTermRef.current : undefined;
      } else {
        const { keyword, classId, minScore, maxScore, sortBy, sortOrder } =
          advancedConditionsRef.current;
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

        if (Array.isArray(response)) {
          // 防御分支：后端异常时兜底，非真实总数
          dispatch({ type: 'SET_USERS', payload: response });
          dispatch({
            type: 'SET_PAGINATION',
            payload: {
              ...paginationRef.current,
              total: response.length,
              pages: Math.ceil(response.length / per_page),
            },
          });
        } else {
          dispatch({ type: 'SET_USERS', payload: data.users || [] });
          dispatch({
            type: 'SET_PAGINATION',
            payload: {
              ...paginationRef.current,
              total: data.total || 0,
              pages: data.pages || 1,
              page: data.page || page,
            },
          });
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
      dispatch({ type: 'SET_RULES', payload: Array.isArray(data) ? data : data.rules || [] });
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
          guardian_relation:
            (user as unknown as { guardian_relation: string }).guardian_relation || '',
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
              description: isEditing
                ? `更新用户: ${state.formData.name}`
                : `创建用户: ${state.formData.name}`,
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
      const ok = await confirmRef.current({
        title: '删除学生',
        message: '确定要删除该学生吗？此操作不可恢复。',
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      const deletedUser = state.users.find((u) => u.id === userId);

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

  // 启用/禁用切换（走 user-management toggle-active；PUT /users/{id} 不处理 is_active）
  const handleToggleActive = useCallback(
    async (user: User) => {
      const willEnable = !user.is_active;
      const ok = await confirmRef.current({
        title: willEnable ? '启用学生' : '禁用学生',
        message: willEnable
          ? `确定要启用该学生吗？启用后即可正常使用。`
          : `确定要禁用该学生吗？禁用后该学生将无法使用开锁等功能。`,
        confirmText: willEnable ? '启用' : '禁用',
        cancelText: '取消',
        type: willEnable ? 'info' : 'danger',
      });
      if (!ok) return;

      await wrapAsync(
        `toggle-active-${user.id}`,
        async () => {
          const res = await api.users.toggleActive(Number(user.id));
          const updated = { ...user, is_active: res.is_active } as User;
          dispatch({ type: 'UPDATE_USER', payload: updated });
          // 编辑弹窗内开关切换后同步刷新弹窗状态（editingUser 为旧引用）
          dispatch({ type: 'SET_EDITING_USER', payload: updated });
          showToast('success', res.is_active ? '已启用' : '已禁用');
          addOperation({
            type: 'update',
            description: `${willEnable ? '启用' : '禁用'}学生: ${user.name}`,
          });
        },
        {
          message: willEnable ? '启用中...' : '禁用中...',
          type: 'local',
          onError: (error) => {
            showToast('error', '操作失败: ' + error.message);
          },
        }
      );
    },
    [showToast, wrapAsync, addOperation]
  );

  const handleQuickScore = useCallback(
    async (rule: Rule) => {
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
                  showToast(
                    'success',
                    `${action}成功: ${rule.name} (${scoreChange > 0 ? '+' : ''}${scoreChange}分)`
                  );
                  dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
                  dispatch({ type: 'SET_QUICK_SCORE_USER', payload: null });
                  addOperation({
                    type: 'update',
                    description: `${state.quickScoreUser?.name} ${action} ${Math.abs(
                      scoreChange
                    )}分`,
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
    },
    [state.quickScoreUser, showToast, addOperation, wrapAsync]
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedUsersArray.length === 0) return;

    await wrapAsync(
      'batch-delete-users',
      async () => {
        await Promise.all(selectedUsersArray.map((id) => api.users.delete(id)));
      },
      {
        message: '批量删除中...',
        type: 'local',
        onSuccess: () => {
          selectedUsersArray.forEach((id) => {
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

  const handleBatchScore = useCallback(
    async (scoreChange: number) => {
      if (selectedUsersArray.length === 0) return;

      await wrapAsync(
        'batch-score-users',
        async () => {
          await Promise.all(
            selectedUsersArray.map((id) =>
              api.records.create({
                user_id: Number(id),
                rule_id: 1,
                score_change: scoreChange,
                description: '批量调整积分',
                operator: '管理员',
              })
            )
          );
        },
        {
          message: '批量评分中...',
          type: 'local',
          onSuccess: () => {
            selectedUsersArray.forEach((id) => {
              dispatch({
                type: 'UPDATE_USER_SCORE',
                payload: { userId: id, scoreChange },
              });
            });
            dispatch({ type: 'CLEAR_USER_SELECTION' });
            const action = scoreChange > 0 ? '加分' : '减分';
            showToast(
              'success',
              `成功为 ${selectedUsersArray.length} 名学生${action} ${Math.abs(scoreChange)}分`
            );
            addOperation({
              type: 'batch',
              description: `批量${action} ${selectedUsersArray.length} 名学生 ${Math.abs(
                scoreChange
              )}分`,
            });
          },
          onError: (error) => {
            showToast('error', '批量评分失败: ' + error.message);
          },
        }
      );
    },
    [selectedUsersArray, showToast, wrapAsync, addOperation]
  );

  // 导出：fetch + blob 下载（带鉴权头），失败明确提示；此前仅调用 api.export.users() 返回 URL 字符串，点击无任何反应
  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(api.export.users(), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`导出失败(${res.status})`);
      const blob = await res.blob();
      downloadBlob(blob, `users_${Date.now()}.xlsx`);
      showToast('success', '导出成功');
    } catch (e) {
      showToast('error', '导出失败: ' + ((e as Error).message || '未知错误'));
    }
  }, [showToast]);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_USER_SELECTION' });
  }, []);

  const handleSelectionChange = useCallback((keys: Array<string | number>) => {
    dispatch({ type: 'SET_SELECTED_USERS', payload: new Set(keys.map((k) => Number(k))) });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTermInput('');
    dispatch({ type: 'SET_SELECTED_CLASS', payload: '' });
    dispatch({ type: 'SET_ADVANCED_CONDITIONS', payload: {} });
  }, []);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const userColumns = useMemo<ColumnType<User>[]>(
    () =>
      buildUserColumns({
        handleOpenQuickScore,
        handleOpenModal,
        handleDelete,
        handleToggleActive,
      }),
    [handleOpenQuickScore, handleOpenModal, handleDelete, handleToggleActive]
  );

  const props = {
    state,
    dispatch,
    classes,
    classList,
    formErrors,
    selectedUsersArray,
    selectedUsersData,
    userColumns,
    autoSaveHasUnsaved: autoSave.hasUnsavedChanges,
    handleSearch,
    handleClassChange,
    handleAdvancedSearch,
    handlePageChange,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleToggleActive,
    handleQuickScore,
    handleExport,
    handleClearSelection,
    handleSelectionChange,
    handleBatchDelete,
    handleBatchScore,
    handleClearFilters,
    handleRetry,
    fetchUsers,
  };

  return props;
}
