import { useMemo } from 'react';
import type { Dispatch, FormEvent } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Download,
  Zap,
  Filter,
  ChevronUp,
  ChevronDown,
  User as UserIcon,
} from 'lucide-react';
import type { User } from '../../types';
import {
  Modal,
  SearchFilter,
  ImportExportPanel,
  PermissionButton,
  BatchActionBar,
  AdvancedSearch,
  EmptyState,
  TableSkeleton,
  DataTable,
  Button,
  ToggleSwitch,
  type ColumnType,
} from '../../components';
import type { UserListState, UserListAction } from './useUserListLogic';
import type { Rule } from './types';

interface UserListViewProps {
  state: UserListState;
  dispatch: Dispatch<UserListAction>;
  classes: string[];
  classList: { id: number; name: string }[];
  formErrors: Record<string, string>;
  selectedUsersArray: number[];
  selectedUsersData: User[];
  userColumns: ColumnType<User>[];
  autoSaveHasUnsaved: boolean;
  handleSearch: (term: string) => void;
  handleClassChange: (className: string) => void;
  handleAdvancedSearch: () => void;
  handlePageChange: (page: number) => void;
  handleOpenModal: (user?: User) => void;
  handleCloseModal: () => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  handleToggleActive: (user: User) => void;
  handleQuickScore: (rule: Rule) => void;
  handleExport: () => void;
  handleClearSelection: () => void;
  handleSelectionChange: (keys: Array<string | number>) => void;
  handleBatchDelete: () => Promise<void>;
  handleBatchScore: (scoreChange: number) => Promise<void>;
  handleClearFilters: () => void;
  handleRetry: () => void;
  fetchUsers: () => Promise<void>;
}

function UserListView(props: UserListViewProps) {
  const {
    state,
    dispatch,
    classes,
    classList,
    formErrors,
    selectedUsersArray,
    selectedUsersData,
    userColumns,
    autoSaveHasUnsaved,
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
  } = props;

  const batchActions = useMemo(
    () => [
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
    ],
    [handleBatchDelete, handleBatchScore]
  );

  const advancedSearchFields = useMemo(
    () => [
      {
        id: 'keyword',
        label: '关键词',
        type: 'text' as const,
        placeholder: '搜索姓名、卡号或手机号',
        value: state.advancedConditions.keyword,
        onChange: (value: unknown) =>
          dispatch({
            type: 'SET_ADVANCED_CONDITIONS',
            payload: { ...state.advancedConditions, keyword: value as string },
          }),
      },
      {
        id: 'classId',
        label: '班级',
        type: 'select' as const,
        options: classList.map((c) => ({ value: String(c.id), label: c.name })),
        value: state.advancedConditions.classId,
        onChange: (value: unknown) =>
          dispatch({
            type: 'SET_ADVANCED_CONDITIONS',
            payload: { ...state.advancedConditions, classId: value as string },
          }),
      },
      {
        id: 'minScore',
        label: '最低积分',
        type: 'number' as const,
        placeholder: '最低积分',
        value: state.advancedConditions.minScore,
        onChange: (value: unknown) =>
          dispatch({
            type: 'SET_ADVANCED_CONDITIONS',
            payload: { ...state.advancedConditions, minScore: value as number },
          }),
      },
      {
        id: 'maxScore',
        label: '最高积分',
        type: 'number' as const,
        placeholder: '最高积分',
        value: state.advancedConditions.maxScore,
        onChange: (value: unknown) =>
          dispatch({
            type: 'SET_ADVANCED_CONDITIONS',
            payload: { ...state.advancedConditions, maxScore: value as number },
          }),
      },
    ],
    [state.advancedConditions, classList, dispatch]
  );

  if (state.isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='h-8 bg-gray-200 rounded w-48 animate-pulse' />
            <div className='h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse' />
          </div>
          <div className='flex gap-2'>
            <div className='h-10 bg-gray-200 rounded w-28 animate-pulse' />
            <div className='h-10 bg-gray-200 rounded w-28 animate-pulse' />
            <div className='h-10 bg-gray-200 rounded w-28 animate-pulse' />
          </div>
        </div>
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4'>
          <div className='h-12 bg-gray-200 rounded mb-4 animate-pulse' />
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
        onAction={handleRetry}
      />
    );
  }

  if (state.users.length === 0) {
    return (
      <div className='space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>学生管理</h1>
            <p className='text-gray-500 mt-1'>管理学生信息和积分</p>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <PermissionButton
              permission='student.edit'
              variant='secondary'
              onClick={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: true })}
            >
              <Upload className='w-4 h-4 mr-2' />
              导入学生
            </PermissionButton>
            <PermissionButton permission='student.edit' variant='secondary' onClick={handleExport}>
              <Download className='w-4 h-4 mr-2' />
              导出学生
            </PermissionButton>
            <PermissionButton permission='student.edit' onClick={() => handleOpenModal()}>
              <Plus className='w-4 h-4 mr-2' />
              添加学生
            </PermissionButton>
          </div>
        </div>

        <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4'>
          <SearchFilter
            value={state.searchTerm}
            onChange={handleSearch}
            placeholder='搜索学生姓名、卡号或手机号'
            loading={state.isFetching}
            autoSearch={false}
          />
        </div>

        <EmptyState
          icon='search'
          title='暂无搜索结果'
          description='没有找到匹配的用户'
          actionLabel='清除筛选'
          onAction={handleClearFilters}
        />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>学生管理</h1>
          <p className='text-gray-500 mt-1'>管理学生信息和积分</p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <PermissionButton
            permission='student.edit'
            variant='secondary'
            onClick={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: true })}
          >
            <Upload className='w-4 h-4 mr-2' />
            导入学生
          </PermissionButton>
          <PermissionButton permission='student.edit' variant='secondary' onClick={handleExport}>
            <Download className='w-4 h-4 mr-2' />
            导出学生
          </PermissionButton>
          <PermissionButton permission='student.edit' onClick={() => handleOpenModal()}>
            <Plus className='w-4 h-4 mr-2' />
            添加学生
          </PermissionButton>
        </div>
      </div>

      <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4'>
        <div className='flex flex-wrap items-center gap-4'>
          <SearchFilter
            value={state.searchTerm}
            onChange={handleSearch}
            placeholder='搜索学生姓名、卡号或手机号'
            loading={state.isFetching}
            autoSearch={false}
          />
          <div className='flex items-center gap-2'>
            <Filter className='w-4 h-4 text-gray-400' />
            <select
              value={state.selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className='px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50'
              disabled={state.isFetching}
            >
              <option value=''>全部班级</option>
              {classList.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() =>
              dispatch({ type: 'SET_SHOW_ADVANCED_SEARCH', payload: !state.showAdvancedSearch })
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              state.showAdvancedSearch
                ? 'bg-primary-50 text-primary-700 border border-primary-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
            }`}
          >
            <Filter className='w-4 h-4' />
            <span className='font-medium'>高级筛选</span>
            {state.showAdvancedSearch ? (
              <ChevronUp className='w-4 h-4' />
            ) : (
              <ChevronDown className='w-4 h-4' />
            )}
          </button>
        </div>
        {state.showAdvancedSearch && (
          <div className='mt-4 pt-4 border-t border-gray-200'>
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

      <div className='bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'>
        <DataTable<User>
          rowKey='id'
          columns={userColumns}
          dataSource={state.users}
          loading={state.isLoading || state.isFetching}
          total={state.pagination.total}
          page={state.pagination.page}
          pageSize={state.pagination.per_page}
          onPageChange={handlePageChange}
          selectable
          selectedRowKeys={selectedUsersArray}
          onSelectChange={handleSelectionChange}
          scroll={{ x: 'max-content' }}
          empty={{ icon: 'users', title: '暂无学生', description: '添加或导入学生开始管理' }}
        />
      </div>

      <Modal
        isOpen={state.showModal}
        onClose={handleCloseModal}
        title={state.editingUser ? '编辑学生' : '添加学生'}
      >
        <form onSubmit={handleSubmit} className='space-y-4'>
          {autoSaveHasUnsaved && (
            <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between'>
              <span className='text-sm text-blue-700'>有未保存的更改，自动保存中...</span>
            </div>
          )}

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>姓名 *</label>
            <input
              type='text'
              value={state.formData.name}
              onChange={(e) =>
                dispatch({ type: 'SET_FORM_DATA', payload: { name: e.target.value } })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入学生姓名'
            />
            {formErrors.name && <p className='mt-1 text-sm text-red-600'>{formErrors.name}</p>}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>性别</label>
            <select
              value={state.formData.gender}
              onChange={(e) =>
                dispatch({ type: 'SET_FORM_DATA', payload: { gender: e.target.value } })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value='男'>男</option>
              <option value='女'>女</option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级 *</label>
            <select
              value={state.formData.class_name}
              onChange={(e) =>
                dispatch({ type: 'SET_FORM_DATA', payload: { class_name: e.target.value } })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>请选择班级</option>
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            {formErrors.class_name && (
              <p className='mt-1 text-sm text-red-600'>{formErrors.class_name}</p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>卡号 *</label>
            <input
              type='text'
              value={state.formData.card_id}
              onChange={(e) =>
                dispatch({ type: 'SET_FORM_DATA', payload: { card_id: e.target.value } })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入卡号'
            />
            {formErrors.card_id && (
              <p className='mt-1 text-sm text-red-600'>{formErrors.card_id}</p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>初始积分</label>
            <input
              type='number'
              value={state.formData.current_score}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FORM_DATA',
                  payload: { current_score: parseInt(e.target.value) || 0 },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>

          {state.editingUser && (
            <div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
              <div>
                <p className='text-sm font-medium text-gray-700'>账号状态</p>
                <p className='text-xs text-gray-500'>
                  {state.editingUser.is_active
                    ? '当前已启用，可正常使用'
                    : '当前已禁用，无法使用开锁等功能'}
                </p>
              </div>
              <div className='flex items-center gap-3'>
                <span className='text-xs text-gray-400'>
                  {state.editingUser.is_active ? '启用' : '禁用'}
                </span>
                <ToggleSwitch
                  checked={state.editingUser.is_active}
                  onChange={() => state.editingUser && handleToggleActive(state.editingUser)}
                  size='md'
                />
              </div>
            </div>
          )}

          <div className='flex justify-end gap-3 pt-4'>
            <Button type='button' variant='secondary' onClick={handleCloseModal}>
              取消
            </Button>
            <Button type='submit' disabled={state.isFetching}>
              {state.editingUser ? '更新' : '创建'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={state.showImportModal}
        onClose={() => dispatch({ type: 'SET_SHOW_IMPORT_MODAL', payload: false })}
        title='导入学生'
      >
        <ImportExportPanel
          type='user'
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
          <div className='space-y-4'>
            <div className='flex items-center gap-4 p-4 bg-gray-50 rounded-lg'>
              <div className='w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center'>
                <UserIcon className='w-6 h-6 text-primary-600' />
              </div>
              <div>
                <p className='font-medium text-gray-900'>{state.quickScoreUser.name}</p>
                <p className='text-sm text-gray-500'>
                  班级: {state.quickScoreUser.class_name || '未分配'} | 当前积分:{' '}
                  <span className='font-bold text-primary-600'>
                    {state.quickScoreUser.current_score}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <h3 className='text-sm font-medium text-gray-700 mb-3'>选择评分规则</h3>
              <div className='grid grid-cols-1 gap-2 max-h-80 overflow-y-auto'>
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
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='font-medium text-gray-900'>{rule.name}</p>
                        <p className='text-sm text-gray-500'>{rule.description || '无描述'}</p>
                      </div>
                      <span
                        className={`font-bold text-lg ${
                          rule.score > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {rule.score > 0 ? '+' : ''}
                        {rule.score}
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

export default UserListView;
