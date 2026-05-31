import { useReducer, useEffect, useMemo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Eye,
  RefreshCw,
  User,
  Upload,
  Download,
  CheckSquare,
  Square,
  FileText,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import {
  Card,
  Button,
  Modal,
  Badge,
  SearchFilter,
  LoadingSpinner,
  VirtualList,
  AnimatedScore,
  ImportExportPanel,
} from '../components';
import { useToast } from '../context/ToastContext';
import { validateForm } from '../utils/validation';

const initialState = {
  users: [],
  rules: [],
  rankRules: [],
  searchTerm: '',
  selectedClass: '',
  showModal: false,
  editingUser: null,
  isLoading: true,
  error: null,
  selectedUsers: [],
  showBatchModal: false,
  batchScoreChange: 0,
  showImportModal: false,
  importing: false,
  showQuickScoreModal: false,
  quickScoreUser: null,
  scoreTab: 'add',
  pagination: {
    page: 1,
    per_page: 50,
    total: 0,
    pages: 0,
  },
  formData: {
    name: '',
    gender: '',
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
    current_score: 0,
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_RULES':
      return { ...state, rules: action.payload };
    case 'SET_RANK_RULES':
      return { ...state, rankRules: action.payload };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.payload };
    case 'SET_SELECTED_CLASS':
      return { ...state, selectedClass: action.payload };
    case 'SET_SHOW_MODAL':
      return { ...state, showModal: action.payload };
    case 'SET_EDITING_USER':
      return { ...state, editingUser: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SELECTED_USERS':
      return { ...state, selectedUsers: action.payload };
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
      return { ...state, pagination: { ...state.pagination, ...action.payload } };
    case 'SET_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'RESET_FORM_DATA':
      return {
        ...state,
        formData: {
          name: '',
          gender: '',
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
          current_score: 0,
        },
      };
    case 'UPDATE_USER_SCORE': {
      const { userId, scoreChange } = action.payload;
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === userId ? { ...user, current_score: user.current_score + scoreChange } : user
        ),
      };
    }
    case 'ADD_USER':
      return { ...state, users: [action.payload, ...state.users] };
    case 'UPDATE_USER': {
      const { userId, updatedUser } = action.payload;
      return {
        ...state,
        users: state.users.map((user) => (user.id === userId ? updatedUser : user)),
      };
    }
    case 'DELETE_USER':
      return {
        ...state,
        users: state.users.filter((user) => user.id !== action.payload),
        selectedUsers: state.selectedUsers.filter((id) => id !== action.payload),
      };
    case 'DELETE_USERS':
      return {
        ...state,
        users: state.users.filter((user) => !action.payload.includes(user.id)),
        selectedUsers: [],
      };
    case 'BATCH_UPDATE_SCORE': {
      const { userIds, scoreChange } = action.payload;
      return {
        ...state,
        users: state.users.map((user) =>
          userIds.includes(user.id)
            ? { ...user, current_score: user.current_score + scoreChange }
            : user
        ),
        selectedUsers: [],
      };
    }
    case 'ADD_USERS':
      return { ...state, users: [...action.payload, ...state.users] };
    default:
      return state;
  }
}

function UserList() {
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchUsers = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const data = await api.users.getAll({
        page: state.pagination.page,
        per_page: state.pagination.per_page,
        search: state.searchTerm,
        class_name: state.selectedClass,
      });
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_USERS', payload: data });
        dispatch({ type: 'SET_PAGINATION', payload: { total: data.length, pages: 1 } });
      } else {
        dispatch({ type: 'SET_USERS', payload: data.users || [] });
        dispatch({ type: 'SET_PAGINATION', payload: { total: data.total, pages: data.pages } });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: '获取学生列表失败: ' + err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.pagination.page, state.pagination.per_page, state.searchTerm, state.selectedClass]);

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.rules.getAll();
      dispatch({ type: 'SET_RULES', payload: Array.isArray(data) ? data : data.rules || [] });
    } catch (err) {
      console.error('获取规则失败:', err);
    }
  }, []);

  const fetchRankRules = useCallback(async () => {
    try {
      const data = await api.rankRules.getAll();
      dispatch({ type: 'SET_RANK_RULES', payload: data.rules || data });
    } catch (err) {
      console.error('获取排名规则失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRankRules();
    fetchRules();
  }, [fetchUsers, fetchRankRules, fetchRules]);

  const handleSearch = useCallback(() => {
    dispatch({ type: 'SET_PAGINATION', payload: { page: 1 } });
    fetchUsers();
  }, [fetchUsers]);

  const getRankInfo = useCallback(
    (score) => {
      const rule = state.rankRules.find((r) => score >= r.min_score && score <= r.max_score);
      return rule || { name: '未定义', color: '#6b7280' };
    },
    [state.rankRules]
  );

  const [formErrors, setFormErrors] = useState({});
  const [showExportPanel, setShowExportPanel] = useState(false);

  const validationRules = {
    name: ['required', { maxLength: 50 }],
    card_id: ['required', 'cardId'],
    class_name: [{ maxLength: 50 }],
    phone: ['phone'],
    father_phone: ['phone'],
    mother_phone: ['phone'],
    guardian_phone: ['phone'],
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { isValid, errors } = validateForm(state.formData, validationRules);

    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    try {
      if (state.editingUser) {
        const result = await api.users.update(state.editingUser.id, state.formData);
        showToast('学生信息更新成功', 'success');
        dispatch({ type: 'UPDATE_USER', payload: { userId: state.editingUser.id, updatedUser: result.user } });
      } else {
          const result = await api.users.create(state.formData);
          showToast('学生添加成功', 'success');
          dispatch({ type: 'ADD_USER', payload: result.user });
        }
      dispatch({ type: 'SET_SHOW_MODAL', payload: false });
      dispatch({ type: 'SET_EDITING_USER', payload: null });
      dispatch({ type: 'RESET_FORM_DATA' });
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  };

  const handleDelete = useCallback(
    async (id) => {
      if (!window.confirm('确定要删除该学生吗？此操作不可撤销。')) {
        return;
      }

      try {
        await api.users.delete(id);
        showToast('删除成功', 'success');
        dispatch({ type: 'DELETE_USER', payload: id });
      } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
      }
    },
    [showToast]
  );

  const handleAddScore = useCallback(
    async (userId, score) => {
      try {
        await api.records.create({
          user_id: userId,
          score_change: score,
          description: score > 0 ? '手动加分' : '手动扣分',
          operator: '管理员',
        });
        showToast(score > 0 ? '加分成功' : '扣分成功', 'success');
        dispatch({ type: 'UPDATE_USER_SCORE', payload: { userId, scoreChange: score } });
      } catch (err) {
        showToast('操作失败: ' + err.message, 'error');
      }
    },
    [showToast]
  );

  const handleOpenQuickScore = (user) => {
    dispatch({ type: 'SET_QUICK_SCORE_USER', payload: user });
    dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: true });
  };

  const handleQuickScore = async (rule) => {
    try {
      await api.records.create({
        user_id: state.quickScoreUser.id,
        rule_id: rule.id,
        score_change: rule.score,
        description: rule.name,
        operator: '管理员',
      });
      const action = rule.score > 0 ? '加分' : '减分';
      const scoreText = rule.score > 0 ? `+${rule.score}分` : `${rule.score}分`;
      showToast(`${action}成功: ${rule.name} (${scoreText})`, 'success');
      dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
      dispatch({
        type: 'UPDATE_USER_SCORE',
        payload: { userId: state.quickScoreUser.id, scoreChange: rule.score },
      });
      dispatch({ type: 'SET_QUICK_SCORE_USER', payload: null });
    } catch (err) {
      showToast('操作失败: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const toggleUserSelection = useCallback(
    (userId) => {
      dispatch({
        type: 'SET_SELECTED_USERS',
        payload: state.selectedUsers.includes(userId)
          ? state.selectedUsers.filter((id) => id !== userId)
          : [...state.selectedUsers, userId],
      });
    },
    [state.selectedUsers]
  );

  const handleBatchDelete = async () => {
    if (state.selectedUsers.length === 0) {
      showToast('请选择要删除的学生', 'error');
      return;
    }

    if (
      !window.confirm(`确定要删除选中的 ${state.selectedUsers.length} 名学生吗？此操作不可撤销。`)
    ) {
      return;
    }

    try {
      await api.users.batchDelete(state.selectedUsers);
      showToast(`成功删除 ${state.selectedUsers.length} 名学生`, 'success');
      dispatch({ type: 'DELETE_USERS', payload: state.selectedUsers });
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
  };

  const handleBatchScore = async () => {
    if (state.selectedUsers.length === 0) {
      showToast('请选择要调整的学生', 'error');
      return;
    }

    if (state.batchScoreChange === 0) {
      showToast('请输入调整分数', 'error');
      return;
    }

    try {
      const description = state.batchScoreChange > 0 ? '批量加分' : '批量扣分';
      await api.users.batchUpdateScore(state.selectedUsers, state.batchScoreChange, description);
      showToast(`成功调整 ${state.selectedUsers.length} 名学生的积分`, 'success');
      dispatch({
        type: 'BATCH_UPDATE_SCORE',
        payload: { userIds: state.selectedUsers, scoreChange: state.batchScoreChange },
      });
      dispatch({ type: 'SET_SHOW_BATCH_MODAL', payload: false });
      dispatch({ type: 'SET_BATCH_SCORE_CHANGE', payload: 0 });
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(api.users.downloadTemplate());
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user_import_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载模板失败:', error);
      showToast('下载模板失败: ' + error.message, 'error');
    }
  };

  const handleImport = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('请选择CSV格式的文件', 'error');
      return;
    }

    dispatch({ type: 'SET_IMPORTING', payload: true });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/users/import-file', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message, 'success');

        if (result.errors && result.errors.length > 0) {
          const errorMsg =
            result.errors.slice(0, 5).join('; ') +
            (result.errors.length > 5 ? `...共${result.errors.length}条错误` : '');
          showToast('部分数据导入失败: ' + errorMsg, 'error');
        }

        dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: false });

        if (result.users && result.users.length > 0) {
          dispatch({ type: 'ADD_USERS', payload: result.users });
        }
      } else {
        throw new Error(result.error || '导入失败');
      }
    } catch (err) {
      console.error('导入错误:', err);
      showToast('导入失败: ' + (err.message || '未知错误'), 'error');
    } finally {
      dispatch({ type: 'SET_IMPORTING', payload: false });
    }
  };

  const filteredUsers = useMemo(() => {
    return state.users.filter((user) => {
      const searchLower = (state.searchTerm || '').toLowerCase();
      const matchesSearch =
        !state.searchTerm ||
        (user.name && user.name.toLowerCase().includes(searchLower)) ||
        (user.card_id && user.card_id.toLowerCase().includes(searchLower)) ||
        (user.class_name && user.class_name.toLowerCase().includes(searchLower));
      const matchesClass = !state.selectedClass || user.class_name === state.selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [state.users, state.searchTerm, state.selectedClass]);

  const classes = useMemo(() => 
    [...new Set(state.users.map((u) => u.class_name).filter(Boolean))].sort(), 
    [state.users]
  );

  const renderUserRow = useCallback(
    (user) => {
      const isSelected = state.selectedUsers.includes(user.id);
      const rankInfo = getRankInfo(user.current_score);

      return (
        <div
          className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-100 transition-all duration-300 ${
            isSelected ? 'bg-primary-50/30 ring-2 ring-primary-200' : 'hover:bg-gray-50/50'
          }`}
        >
          <div className='flex-shrink-0'>
            <button
              onClick={() => toggleUserSelection(user.id)}
              className='text-primary-600 hover:text-primary-800 transition-all duration-200 transform hover:scale-110'
            >
              {isSelected ? <CheckSquare className='w-5 h-5' /> : <Square className='w-5 h-5' />}
            </button>
          </div>

          <div className='flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform duration-200 hover:scale-105'>
            <User className='w-5 h-5' />
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
              <Link
                to={`/users/${user.id}`}
                className='font-semibold text-gray-800 hover:text-primary-600 transition-colors truncate'
              >
                {user.name}
              </Link>
              <Badge variant={user.gender === '男' ? 'blue' : 'purple'}>{user.gender}</Badge>
              <span className='text-gray-600 text-sm'>{user.class_name}</span>
            </div>
            <div className='flex items-center gap-2 text-sm'>
              <span className='text-gray-500'>学号:</span>
              <span className='font-mono text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded'>
                {user.card_id}
              </span>
              <span className='text-gray-300'>|</span>
              <span className='text-gray-500'>{user.phone || '暂无电话'}</span>
            </div>
          </div>

          <div className='flex-shrink-0 flex items-center gap-2'>
            <span
              className='px-2 sm:px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105'
              style={{ backgroundColor: `${rankInfo.color}20`, color: rankInfo.color }}
            >
              {rankInfo.name}
            </span>
          </div>

          <div className='flex-shrink-0 text-right min-w-[80px]'>
            <AnimatedScore score={user.current_score} />
          </div>

          <div className='flex-shrink-0 flex items-center gap-1'>
            <button
              onClick={() => handleOpenQuickScore(user)}
              className='p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all duration-200 transform hover:scale-110'
              title='快速操作'
            >
              <Zap className='w-4 h-4' />
            </button>
            <button
              onClick={() => handleAddScore(user.id, 10)}
              className='p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all duration-200 transform hover:scale-110'
              title='+10分'
            >
              <ArrowUpRight className='w-4 h-4' />
            </button>
            <button
              onClick={() => handleAddScore(user.id, -10)}
              className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 transform hover:scale-110'
              title='-10分'
            >
              <ArrowDownRight className='w-4 h-4' />
            </button>
            <Link
              to={`/users/${user.id}`}
              className='p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200 transform hover:scale-110'
            >
              <Eye className='w-4 h-4' />
            </Link>
            <button
              onClick={() => {
                dispatch({ type: 'SET_EDITING_USER', payload: user });
                dispatch({ type: 'SET_FORM_DATA', payload: user });
                dispatch({ type: 'SET_SHOW_MODAL', payload: true });
              }}
              className='p-2 text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all duration-200 transform hover:scale-110'
            >
              <Edit2 className='w-4 h-4' />
            </button>
            <button
              onClick={() => handleDelete(user.id)}
              className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 transform hover:scale-110'
            >
              <Trash2 className='w-4 h-4' />
            </button>
          </div>
        </div>
      );
    },
    [state.selectedUsers, getRankInfo, toggleUserSelection, handleAddScore, handleDelete]
  );

  return (
    <div className='max-w-7xl mx-auto'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <Users className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>学生管理</h2>
            <p className='text-sm text-gray-500'>管理学生信息和积分数据</p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <Button variant='outline' onClick={fetchUsers} disabled={state.isLoading}>
            <RefreshCw className={`w-4 h-4 ${state.isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <div className='relative'>
            <Button variant='outline' onClick={() => setShowExportPanel(!showExportPanel)}>
              <Download className='w-4 h-4' />
              导入/导出
            </Button>
            {showExportPanel && (
              <div className='absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50'>
                <ImportExportPanel type='user' />
              </div>
            )}
          </div>
          {state.selectedUsers.length > 0 && (
            <>
              <Button
                variant='warning'
                onClick={() => dispatch({ type: 'SET_SHOW_BATCH_MODAL', payload: true })}
              >
                <Plus className='w-4 h-4' />
                批量调整积分 ({state.selectedUsers.length})
              </Button>
              <Button variant='danger' onClick={handleBatchDelete}>
                <Trash2 className='w-4 h-4' />
                批量删除 ({state.selectedUsers.length})
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              dispatch({ type: 'SET_EDITING_USER', payload: null });
              dispatch({ type: 'SET_SHOW_MODAL', payload: true });
            }}
          >
            <Plus className='w-5 h-5' />
            添加学生
          </Button>
        </div>
      </div>

      {state.error && (
        <div className='mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3'>
          <span>{state.error}</span>
          <button
            onClick={() => {
              dispatch({ type: 'SET_ERROR', payload: null });
              fetchUsers();
            }}
            className='ml-auto text-red-600 hover:text-red-800'
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>
      )}

      <div className='card'>
        <div className='card-header flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <SearchFilter
            searchTerm={state.searchTerm}
            onSearchChange={(value) => dispatch({ type: 'SET_SEARCH_TERM', payload: value })}
            onSearch={handleSearch}
            filters={[
              { label: '全部班级', value: '' },
              ...classes.map((c) => ({ label: c, value: c })),
            ]}
            activeFilter={state.selectedClass}
            onFilterChange={(value) => {
              dispatch({ type: 'SET_SELECTED_CLASS', payload: value });
              dispatch({ type: 'SET_PAGINATION', payload: { page: 1 } });
            }}
            placeholder='搜索姓名、班级或学号...'
          />
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl'>
              <Users className='w-4 h-4 text-primary-600' />
              <span className='text-sm font-semibold text-primary-700'>
                {filteredUsers.length} 名学生
              </span>
            </div>
          </div>
        </div>

        <div className='card-body'>
          {state.isLoading ? (
            <div className='flex items-center justify-center py-16'>
              <LoadingSpinner size='lg' text='加载中...' />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className='text-center py-20'>
              <div className='w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5'>
                <Users className='w-12 h-12 text-gray-400' />
              </div>
              <h3 className='text-xl font-semibold text-gray-600 mb-2'>暂无学生数据</h3>
              <p className='text-gray-500 mb-6'>添加学生开始管理积分系统</p>
              <Button onClick={() => dispatch({ type: 'SET_SHOW_MODAL', payload: true })}>
                <Plus className='w-5 h-5' />
                添加第一个学生
              </Button>
            </div>
          ) : (
            <VirtualList
              items={filteredUsers}
              itemHeight={80}
              renderItem={renderUserRow}
              keyExtractor={(user) => user.id}
              containerHeight={600}
            />
          )}
        </div>
      </div>

      {state.pagination.pages > 1 && (
        <div className='flex items-center justify-between mt-6 pt-4 border-t border-gray-100'>
          <div className='text-sm text-gray-600'>
            共 <span className='font-semibold'>{state.pagination.total}</span> 条记录，当前第{' '}
            <span className='font-semibold'>{state.pagination.page}</span> /{' '}
            <span className='font-semibold'>{state.pagination.pages}</span> 页
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='small'
              disabled={state.pagination.page <= 1}
              onClick={() =>
                dispatch({ type: 'SET_PAGINATION', payload: { page: state.pagination.page - 1 } })
              }
            >
              上一页
            </Button>
            <div className='flex items-center gap-1'>
              {[...Array(Math.min(5, state.pagination.pages))].map((_, idx) => {
                let pageNum;
                if (state.pagination.pages <= 5) {
                  pageNum = idx + 1;
                } else if (state.pagination.page <= 3) {
                  pageNum = idx + 1;
                } else if (state.pagination.page >= state.pagination.pages - 2) {
                  pageNum = state.pagination.pages - 4 + idx;
                } else {
                  pageNum = state.pagination.page - 2 + idx;
                }
                return (
                  <button
                    key={idx}
                    onClick={() => dispatch({ type: 'SET_PAGINATION', payload: { page: pageNum } })}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      state.pagination.page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              variant='outline'
              size='small'
              disabled={state.pagination.page >= state.pagination.pages}
              onClick={() =>
                dispatch({ type: 'SET_PAGINATION', payload: { page: state.pagination.page + 1 } })
              }
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={state.showModal}
        onClose={() => {
          dispatch({ type: 'SET_SHOW_MODAL', payload: false });
          dispatch({ type: 'SET_EDITING_USER', payload: null });
        }}
        title={state.editingUser ? '编辑学生信息' : '添加新学生'}
        size='md'
      >
        <form onSubmit={handleSubmit} className='space-y-5'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                姓名 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={state.formData.name}
                onChange={(e) => {
                  dispatch({ type: 'SET_FORM_DATA', payload: { name: e.target.value } });
                  if (formErrors.name) {
                    setFormErrors((prev) => ({ ...prev, name: null }));
                  }
                }}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                  formErrors.name
                    ? 'border-danger-300 focus:ring-danger-500'
                    : 'border-gray-200 focus:ring-primary-500'
                }`}
                placeholder='请输入学生姓名'
              />
              {formErrors.name && (
                <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                  <AlertCircle className='w-4 h-4' />
                  {formErrors.name}
                </p>
              )}
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>性别</label>
              <select
                value={state.formData.gender}
                onChange={(e) =>
                  dispatch({ type: 'SET_FORM_DATA', payload: { gender: e.target.value } })
                }
                className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              >
                <option value=''>请选择性别</option>
                <option value='男'>男</option>
                <option value='女'>女</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>班级</label>
              <input
                type='text'
                value={state.formData.class_name}
                onChange={(e) => {
                  dispatch({ type: 'SET_FORM_DATA', payload: { class_name: e.target.value } });
                  if (formErrors.class_name) {
                    setFormErrors((prev) => ({ ...prev, class_name: null }));
                  }
                }}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                  formErrors.class_name
                    ? 'border-danger-300 focus:ring-danger-500'
                    : 'border-gray-200 focus:ring-primary-500'
                }`}
                placeholder='如：高三(1)班'
              />
              {formErrors.class_name && (
                <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                  <AlertCircle className='w-4 h-4' />
                  {formErrors.class_name}
                </p>
              )}
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>联系电话</label>
              <input
                type='tel'
                value={state.formData.phone}
                onChange={(e) => {
                  dispatch({ type: 'SET_FORM_DATA', payload: { phone: e.target.value } });
                  if (formErrors.phone) {
                    setFormErrors((prev) => ({ ...prev, phone: null }));
                  }
                }}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                  formErrors.phone
                    ? 'border-danger-300 focus:ring-danger-500'
                    : 'border-gray-200 focus:ring-primary-500'
                }`}
                placeholder='请输入联系电话'
              />
              {formErrors.phone && (
                <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                  <AlertCircle className='w-4 h-4' />
                  {formErrors.phone}
                </p>
              )}
            </div>
          </div>
          <div className='border-t border-gray-100 pt-5'>
            <h3 className='text-sm font-semibold text-gray-800 mb-4'>家长信息</h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>父亲姓名</label>
                <input
                  type='text'
                  value={state.formData.father_name}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FORM_DATA', payload: { father_name: e.target.value } })
                  }
                  className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  placeholder='请输入父亲姓名'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>父亲电话</label>
                <input
                  type='tel'
                  value={state.formData.father_phone}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FORM_DATA', payload: { father_phone: e.target.value } })
                  }
                  className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  placeholder='请输入父亲电话'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>母亲姓名</label>
                <input
                  type='text'
                  value={state.formData.mother_name}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FORM_DATA', payload: { mother_name: e.target.value } })
                  }
                  className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  placeholder='请输入母亲姓名'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>母亲电话</label>
                <input
                  type='tel'
                  value={state.formData.mother_phone}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FORM_DATA', payload: { mother_phone: e.target.value } })
                  }
                  className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  placeholder='请输入母亲电话'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>监护人姓名</label>
                <input
                  type='text'
                  value={state.formData.guardian_name}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FORM_DATA', payload: { guardian_name: e.target.value } })
                  }
                  className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  placeholder='请输入监护人姓名（非父母时填写）'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>监护人电话</label>
                  <input
                    type='tel'
                    value={state.formData.guardian_phone}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_FORM_DATA',
                        payload: { guardian_phone: e.target.value },
                      })
                    }
                    className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                    placeholder='监护人电话'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>监护关系</label>
                  <input
                    type='text'
                    value={state.formData.guardian_relation}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_FORM_DATA',
                        payload: { guardian_relation: e.target.value },
                      })
                    }
                    className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                    placeholder='如：祖父'
                  />
                </div>
              </div>
            </div>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                学号 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={state.formData.card_id}
                onChange={(e) => {
                  dispatch({ type: 'SET_FORM_DATA', payload: { card_id: e.target.value } });
                  if (formErrors.card_id) {
                    setFormErrors((prev) => ({ ...prev, card_id: null }));
                  }
                }}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                  formErrors.card_id
                    ? 'border-danger-300 focus:ring-danger-500'
                    : 'border-gray-200 focus:ring-primary-500'
                }`}
                placeholder='请输入学号'
              />
              {formErrors.card_id && (
                <p className='mt-2 text-sm text-danger-600 flex items-center gap-1'>
                  <AlertCircle className='w-4 h-4' />
                  {formErrors.card_id}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>初始积分</label>
            <input
              type='number'
              min='0'
              value={state.formData.current_score}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FORM_DATA',
                  payload: { current_score: parseInt(e.target.value) || 0 },
                })
              }
              className='w-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='0'
            />
          </div>
          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            <Button
              variant='outline'
              onClick={() => {
                dispatch({ type: 'SET_SHOW_MODAL', payload: false });
                dispatch({ type: 'SET_EDITING_USER', payload: null });
              }}
            >
              取消
            </Button>
            <Button type='submit'>{state.editingUser ? '保存修改' : '添加学生'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={state.showBatchModal}
        onClose={() => dispatch({ type: 'SET_SHOW_BATCH_MODAL', payload: false })}
        title='批量调整积分'
        size='sm'
      >
        <div className='space-y-6'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-3'>
              调整分数（可输入负数）
            </label>
            <input
              type='number'
              value={state.batchScoreChange}
              onChange={(e) =>
                dispatch({ type: 'SET_BATCH_SCORE_CHANGE', payload: parseInt(e.target.value) || 0 })
              }
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='输入正数加分，负数扣分'
            />
            <p className='text-xs text-gray-500 mt-2'>
              将为选中的 {state.selectedUsers.length} 名学生统一调整积分
            </p>
          </div>

          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            <Button
              variant='outline'
              onClick={() => {
                dispatch({ type: 'SET_SHOW_BATCH_MODAL', payload: false });
                dispatch({ type: 'SET_BATCH_SCORE_CHANGE', payload: 0 });
              }}
            >
              取消
            </Button>
            <Button onClick={handleBatchScore}>确认调整</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={state.showImportModal}
        onClose={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: false })}
        title='导入学生数据'
        size='md'
      >
        <div className='space-y-6'>
          <div className='bg-blue-50 border border-blue-200 rounded-xl p-4'>
            <div className='flex items-start gap-3'>
              <FileText className='w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5' />
              <div>
                <h4 className='font-medium text-blue-800'>导入说明</h4>
                <ul className='text-sm text-blue-700 mt-2 space-y-1'>
                  <li>• 支持 CSV 格式文件</li>
                  <li>• 第一行必须为表头（姓名、性别、班级、电话、家长信息、学号、初始积分）</li>
                  <li>• 学号为必填项，其他为可选项</li>
                  <li>• 如果学号已存在，将更新该学生信息</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-3'>选择导入文件</label>
            <div
              className='border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors'
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const event = { target: { files: [file] } };
                  handleImport(event);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <input
                type='file'
                accept='.csv'
                onChange={handleImport}
                className='hidden'
                id='importFile'
                disabled={state.importing}
              />
              <label htmlFor='importFile' className='cursor-pointer block'>
                <Upload className='w-12 h-12 text-gray-400 mx-auto mb-3' />
                <p className='text-gray-600 font-medium'>
                  {state.importing ? '正在导入...' : '点击选择文件或拖拽到此处'}
                </p>
                <p className='text-sm text-gray-500 mt-1'>支持 .csv 格式</p>
              </label>
            </div>
          </div>

          <div className='flex items-center justify-between pt-4 border-t border-gray-100'>
            <button
              onClick={handleDownloadTemplate}
              className='flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium'
            >
              <Download className='w-4 h-4' />
              下载导入模板
            </button>
            <Button
              variant='outline'
              onClick={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: false })}
            >
              关闭
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={state.showQuickScoreModal}
        onClose={() => {
          dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
          dispatch({ type: 'SET_QUICK_SCORE_USER', payload: null });
        }}
        title={state.quickScoreUser ? `快速操作 - ${state.quickScoreUser.name}` : '快速操作'}
        size='lg'
      >
        <div className='space-y-6'>
          {state.quickScoreUser && (
            <div className='flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200'>
              <div className='w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-sm'>
                <User className='w-6 h-6' />
              </div>
              <div>
                <h3 className='font-semibold text-gray-800'>{state.quickScoreUser.name}</h3>
                <p className='text-sm text-gray-600'>
                  {state.quickScoreUser.class_name} · 当前积分:{' '}
                  <span className='font-bold text-amber-600'>
                    {state.quickScoreUser.current_score}分
                  </span>
                </p>
              </div>
            </div>
          )}

          <div>
            <div className='flex gap-2 mb-4'>
              <button
                onClick={() => dispatch({ type: 'SET_SCORE_TAB', payload: 'add' })}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  state.scoreTab === 'add'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <TrendingUp className='w-4 h-4' />
                  加分规则
                </span>
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_SCORE_TAB', payload: 'subtract' })}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  state.scoreTab === 'subtract'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className='flex items-center gap-2'>
                  <TrendingDown className='w-4 h-4' />
                  扣分规则
                </span>
              </button>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {state.scoreTab === 'add'
                ? state.rules
                    .filter((r) => r.is_active && r.score > 0)
                    .map((rule) => (
                      <button
                        key={rule.id}
                        onClick={() => handleQuickScore(rule)}
                        className='p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-md transition-all text-left group'
                      >
                        <div className='flex items-start justify-between mb-2'>
                          <span className='font-semibold text-gray-800 group-hover:text-green-600'>
                            {rule.name}
                          </span>
                          <span className='text-lg font-bold text-green-600'>+{rule.score}分</span>
                        </div>
                        {rule.description && (
                          <p className='text-xs text-gray-500 line-clamp-2'>{rule.description}</p>
                        )}
                        <div className='flex items-center gap-2 mt-2'>
                          {rule.daily_limit > 0 && (
                            <span className='text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full'>
                              每日{rule.daily_limit}次
                            </span>
                          )}
                          {rule.min_interval > 0 && (
                            <span className='text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full'>
                              间隔{rule.min_interval}秒
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                : state.rules
                    .filter((r) => r.is_active && r.score < 0)
                    .map((rule) => (
                      <button
                        key={rule.id}
                        onClick={() => handleQuickScore(rule)}
                        className='p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-red-500 hover:shadow-md transition-all text-left group'
                      >
                        <div className='flex items-start justify-between mb-2'>
                          <span className='font-semibold text-gray-800 group-hover:text-red-600'>
                            {rule.name}
                          </span>
                          <span className='text-lg font-bold text-red-600'>{rule.score}分</span>
                        </div>
                        {rule.description && (
                          <p className='text-xs text-gray-500 line-clamp-2'>{rule.description}</p>
                        )}
                        <div className='flex items-center gap-2 mt-2'>
                          {rule.daily_limit > 0 && (
                            <span className='text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full'>
                              每日{rule.daily_limit}次
                            </span>
                          )}
                          {rule.min_interval > 0 && (
                            <span className='text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full'>
                              间隔{rule.min_interval}秒
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
            </div>

            {state.scoreTab === 'add' &&
              state.rules.filter((r) => r.is_active && r.score > 0).length === 0 && (
                <div className='text-center py-12 text-gray-500'>
                  <div className='text-sm'>暂无可用的加分规则，请先创建规则</div>
                </div>
              )}
            {state.scoreTab === 'subtract' &&
              state.rules.filter((r) => r.is_active && r.score < 0).length === 0 && (
                <div className='text-center py-12 text-gray-500'>
                  <div className='text-sm'>暂无可用的扣分规则，请先创建规则</div>
                </div>
              )}
          </div>

          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            <Button
              variant='outline'
              onClick={() => {
                dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: false });
                dispatch({ type: 'SET_QUICK_SCORE_USER', payload: null });
              }}
            >
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default UserList;
