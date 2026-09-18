/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-9 拆分（2026-09-12）：选择与评分域（快捷评分乐观更新 / 批量删除 / 批量评分 / 导出 / 多选）。
 * 自 useUserListLogic.ts 原样搬出，共享原语由组合根注入。
 */

import { useCallback, useMemo } from 'react';
import type { Dispatch, MutableRefObject } from 'react';
import api, { getAuthHeaders } from '../../../services/api';
import logger from '../../../utils/logger';
import { downloadBlob } from '../../../utils/download';
import { withOptimisticUpdate } from '../../../utils/optimisticUpdate';
import { useAppState, useStableToast, useUndoRedo } from '../../../hooks';
import { useConfirm } from '../../../components';
import type { User } from '../../../types';
import type { UserListAction } from '../reducer';
import type { Rule } from '../types';

type WrapAsync = ReturnType<typeof useAppState>['wrapAsync'];
type AddOperation = ReturnType<typeof useUndoRedo>['addOperation'];
type ShowToast = ReturnType<typeof useStableToast>['showToast'];

export interface useUserListScoreParams {
  dispatch: Dispatch<UserListAction>;
  showToast: ShowToast;
  wrapAsync: WrapAsync;
  addOperation: AddOperation;
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
  users: User[];
  quickScoreUser: User | null;
  selectedUsers: Set<number>;
}

export interface useUserListScoreResult {
  selectedUsersArray: number[];
  selectedUsersData: User[];
  handleOpenQuickScore: (user: User) => void;
  handleQuickScore: (rule: Rule) => Promise<void>;
  handleBatchDelete: () => Promise<void>;
  handleBatchScore: (scoreChange: number) => Promise<void>;
  handleExport: () => Promise<void>;
  handleClearSelection: () => void;
  handleSelectionChange: (keys: Array<string | number>) => void;
}

export function useUserListScore(params: useUserListScoreParams): useUserListScoreResult {
  const {
    dispatch,
    showToast,
    wrapAsync,
    addOperation,
    confirmRef,
    users,
    quickScoreUser,
    selectedUsers,
  } = params;

  const selectedUsersArray = useMemo(() => Array.from(selectedUsers), [selectedUsers]);
  const selectedUsersData = useMemo(
    () => users.filter((user) => selectedUsers.has(Number(user.id))),
    [users, selectedUsers]
  );

  const handleOpenQuickScore = useCallback((user: User) => {
    dispatch({ type: 'SET_QUICK_SCORE_USER', payload: user });
    dispatch({ type: 'SET_SHOW_QUICK_SCORE_MODAL', payload: true });
  }, []);

  const handleQuickScore = useCallback(
    async (rule: Rule) => {
      if (!quickScoreUser) return;

      const userId = Number(quickScoreUser.id);
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
                    description: `${quickScoreUser?.name} ${action} ${Math.abs(scoreChange)}分`,
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
    [quickScoreUser, showToast, addOperation, wrapAsync]
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedUsersArray.length === 0) return;

    const ok = await confirmRef.current({
      title: '批量删除学生',
      message: `确定要删除选中的 ${selectedUsersArray.length} 名学生吗？此操作不可恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

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

      const action = scoreChange > 0 ? '加分' : '减分';
      const ok = await confirmRef.current({
        title: `批量${action}`,
        message: `确定要为选中的 ${selectedUsersArray.length} 名学生${action} ${Math.abs(
          scoreChange
        )}分吗？`,
        confirmText: '确定',
        cancelText: '取消',
        type: 'warning',
      });
      if (!ok) return;

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

  return {
    selectedUsersArray,
    selectedUsersData,
    handleOpenQuickScore,
    handleQuickScore,
    handleBatchDelete,
    handleBatchScore,
    handleExport,
    handleClearSelection,
    handleSelectionChange,
  };
}
