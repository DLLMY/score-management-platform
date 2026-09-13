/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-9 拆分（2026-09-12）：增删改域（表单模态 / 校验提交 / 删除与撤销 / 启用禁用 / M3 草稿自动保存）。
 * 自 useUserListLogic.ts 原样搬出，共享原语由组合根注入。
 */

import { useState, useCallback } from 'react';
import type { Dispatch, FormEvent, MutableRefObject } from 'react';
import { useConfirm } from '../../../components';
import api from '../../../services/api';
import { validateForm } from '../../../utils/validation';
import { useAppState, useAutoSave, useUndoRedo } from '../../../hooks';
import type { User } from '../../../types';
import type { UserListAction } from '../reducer';
import type { FormData } from '../types';

type WrapAsync = ReturnType<typeof useAppState>['wrapAsync'];
type AddOperation = ReturnType<typeof useUndoRedo>['addOperation'];

export interface useUserListCrudParams {
  dispatch: Dispatch<UserListAction>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  wrapAsync: WrapAsync;
  addOperation: AddOperation;
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
  formData: FormData;
  editingUser: User | null;
  showModal: boolean;
  users: User[];
}

export interface useUserListCrudResult {
  formErrors: Record<string, string>;
  autoSaveHasUnsaved: boolean;
  handleOpenModal: (user?: User) => void;
  handleCloseModal: () => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDelete: (userId: number) => Promise<void>;
  handleToggleActive: (user: User) => Promise<void>;
}

export function useUserListCrud(params: useUserListCrudParams): useUserListCrudResult {
  const { dispatch, showToast, wrapAsync, addOperation, confirmRef } = params;
  const { formData, editingUser, showModal, users } = params;

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const autoSave = useAutoSave({
    key: 'user-form',
    data: formData,
    onSave: async (data) => {
      if (editingUser) {
        await api.users.update(Number(editingUser.id), {
          ...data,
        });
      }
    },
    debounceMs: 3000,
    enabled: showModal && !!editingUser,
  });

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
        ...formData,
        current_score: formData.current_score,
      };

      const { isValid, errors } = validateForm(submitData, validationRules);

      if (!isValid) {
        setFormErrors(errors);
        return;
      }

      setFormErrors({});

      const isEditing = !!editingUser;

      await wrapAsync(
        isEditing ? `update-user-${editingUser!.id}` : 'create-user',
        async () => {
          if (isEditing && editingUser) {
            const res = await api.users.update(Number(editingUser.id), submitData);
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
              description: isEditing ? `更新用户: ${formData.name}` : `创建用户: ${formData.name}`,
            });
          },
          onError: (error) => {
            showToast('error', '操作失败: ' + error.message);
          },
        }
      );
    },
    [formData, editingUser, showToast, handleCloseModal, wrapAsync, addOperation]
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
      const deletedUser = users.find((u) => u.id === userId);

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
    [showToast, users, wrapAsync, addOperation]
  );

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

  return {
    formErrors,
    autoSaveHasUnsaved: autoSave.hasUnsavedChanges,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete,
    handleToggleActive,
  };
}
