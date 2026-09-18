/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 用户列表页的逻辑层组合根 hook（T12-9 拆分，2026-09-12）。
 *
 * reducer 与 initialState 见 ./reducer；领域子 hooks（./hooks/）：useUserListFetch（拉取/筛选/分页）、
 * useUserListCrud（增删改/草稿自动保存）、useUserListScore（快捷评分/批量/导出/多选）。
 * 本文件持有共享原语（dispatch / showToast / wrapAsync / addOperation / confirmRef）与列定义装配。
 * 主文件退化为「hook → UserListView」的薄装配。
 */

import { useReducer, useMemo, useRef } from 'react';
import type { ColumnType } from '../../components';
import type { User } from '../../types';
import { useAppState, usePermissions, useStableToast, useUndoRedo } from '../../hooks';
import { useConfirm } from '../../components';
import { buildUserColumns } from './columns';
import { initialState, reducer, type Action, type State } from './reducer';
import { useUserListCrud, useUserListFetch, useUserListScore } from './hooks';

export type UserListState = State;
export type UserListAction = Action;

/**
 * 用户列表页逻辑 hook。
 */
export function useUserListLogic() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { showToast } = useStableToast();

  const { wrapAsync } = useAppState();
  usePermissions();

  const { addOperation } = useUndoRedo({ maxHistory: 50 });

  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const fetchDomain = useUserListFetch({
    dispatch,
    showToast,
    advancedConditions: state.advancedConditions,
    selectedClass: state.selectedClass,
    searchTerm: state.searchTerm,
    showAdvancedSearch: state.showAdvancedSearch,
    pagination: state.pagination,
  });

  const crudDomain = useUserListCrud({
    dispatch,
    showToast,
    wrapAsync,
    addOperation,
    confirmRef,
    formData: state.formData,
    editingUser: state.editingUser,
    showModal: state.showModal,
    users: state.users,
  });

  const scoreDomain = useUserListScore({
    dispatch,
    showToast,
    wrapAsync,
    addOperation,
    confirmRef,
    users: state.users,
    quickScoreUser: state.quickScoreUser,
    selectedUsers: state.selectedUsers,
  });

  const userColumns = useMemo<ColumnType<User>[]>(
    () =>
      buildUserColumns({
        handleOpenQuickScore: scoreDomain.handleOpenQuickScore,
        handleOpenModal: crudDomain.handleOpenModal,
        handleDelete: crudDomain.handleDelete,
        handleToggleActive: crudDomain.handleToggleActive,
      }),
    [
      scoreDomain.handleOpenQuickScore,
      crudDomain.handleOpenModal,
      crudDomain.handleDelete,
      crudDomain.handleToggleActive,
    ]
  );

  const props = {
    state,
    dispatch,
    classes: fetchDomain.classes,
    classList: fetchDomain.classList,
    formErrors: crudDomain.formErrors,
    selectedUsersArray: scoreDomain.selectedUsersArray,
    selectedUsersData: scoreDomain.selectedUsersData,
    userColumns,
    autoSaveHasUnsaved: crudDomain.autoSaveHasUnsaved,
    handleSearch: fetchDomain.handleSearch,
    handleClassChange: fetchDomain.handleClassChange,
    handleAdvancedSearch: fetchDomain.handleAdvancedSearch,
    handlePageChange: fetchDomain.handlePageChange,
    handleOpenModal: crudDomain.handleOpenModal,
    handleCloseModal: crudDomain.handleCloseModal,
    handleSubmit: crudDomain.handleSubmit,
    handleToggleActive: crudDomain.handleToggleActive,
    handleQuickScore: scoreDomain.handleQuickScore,
    handleExport: scoreDomain.handleExport,
    handleClearSelection: scoreDomain.handleClearSelection,
    handleSelectionChange: scoreDomain.handleSelectionChange,
    handleBatchDelete: scoreDomain.handleBatchDelete,
    handleBatchScore: scoreDomain.handleBatchScore,
    handleClearFilters: fetchDomain.handleClearFilters,
    handleRetry: fetchDomain.handleRetry,
    fetchUsers: fetchDomain.fetchUsers,
  };

  return props;
}
