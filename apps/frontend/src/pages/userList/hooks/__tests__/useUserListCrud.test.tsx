import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FormEvent } from 'react';
import { useUserListCrud } from '../useUserListCrud';
import type { useUserListCrudParams } from '../useUserListCrud';
import type { User } from '../../../../types';
import type { FormData } from '../../types';

const { mockApi, mockWrapAsync, mockAddOperation, mockConfirm } = vi.hoisted(() => ({
  mockApi: {
    users: {
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      toggleActive: vi.fn(),
    },
  },
  mockWrapAsync: vi.fn(
    async (
      _key: string,
      fn: () => Promise<unknown>,
      opts?: { onSuccess?: () => void; onError?: (e: Error) => void }
    ) => {
      try {
        await fn();
        opts?.onSuccess?.();
      } catch (e) {
        opts?.onError?.(e as Error);
      }
    }
  ),
  mockAddOperation: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks', () => ({
  useAppState: () => ({ wrapAsync: mockWrapAsync }),
  useAutoSave: () => ({ hasUnsavedChanges: false }),
  useUndoRedo: () => ({ addOperation: mockAddOperation }),
}));

const sampleUser: User = {
  id: 1,
  name: '张三',
  card_id: '123456',
  current_score: 60,
  is_active: true,
  is_blacklisted: false,
  daily_unlock_limit: 5,
  today_unlock_count: 0,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  class_name: '一班',
  guardian_name: '',
  guardian_phone: '',
  guardian_relation: '',
};

const validForm: FormData = {
  name: '李四',
  gender: '男',
  class_name: '一班',
  phone: '',
  parent_info: '',
  father_name: '',
  father_phone: '',
  mother_name: '',
  mother_phone: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_relation: '',
  card_id: '999',
  current_score: 60,
};

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    dispatch: vi.fn(),
    showToast: vi.fn(),
    wrapAsync: mockWrapAsync,
    addOperation: mockAddOperation,
    confirmRef: { current: mockConfirm },
    formData: validForm,
    editingUser: null,
    showModal: false,
    users: [sampleUser],
    ...overrides,
  } as unknown as useUserListCrudParams;
}

describe('useUserListCrud · 增删改域', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    mockApi.users.update.mockResolvedValue({ user: { ...sampleUser, name: '李四' } });
    mockApi.users.create.mockResolvedValue({ user: { ...sampleUser, id: 2, name: '李四' } });
    mockApi.users.delete.mockResolvedValue({ success: true });
    mockApi.users.toggleActive.mockResolvedValue({ is_active: true });
  });

  it('handleOpenModal(有 user) → 写入 editingUser + 表单数据 + 打开弹窗', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListCrud(params));
    act(() => result.current.handleOpenModal(sampleUser));
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_EDITING_USER', payload: sampleUser });
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_FORM_DATA',
        payload: expect.objectContaining({ name: '张三' }),
      })
    );
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_SHOW_MODAL', payload: true });
    expect(result.current.formErrors).toEqual({});
  });

  it('handleOpenModal(无 user) → 清空 editingUser + 默认表单 + 打开弹窗', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListCrud(params));
    act(() => result.current.handleOpenModal());
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_EDITING_USER', payload: null });
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_FORM_DATA',
        payload: expect.objectContaining({ name: '' }),
      })
    );
  });

  it('handleCloseModal → 关闭弹窗并清空 editingUser', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListCrud(params));
    act(() => result.current.handleCloseModal());
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_SHOW_MODAL', payload: false });
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_EDITING_USER', payload: null });
  });

  it('handleSubmit 校验失败 → 写回 formErrors 且不调用接口', async () => {
    const params = makeParams({ formData: { ...validForm, name: '' } });
    const { result } = renderHook(() => useUserListCrud(params));
    const fakeEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(result.current.formErrors).not.toEqual({});
    expect(mockApi.users.create).not.toHaveBeenCalled();
    expect(mockApi.users.update).not.toHaveBeenCalled();
  });

  it('handleSubmit 创建用户 → 调 create + 派发 ADD_USER + 成功提示 + 关闭弹窗', async () => {
    const params = makeParams({ editingUser: null });
    const { result } = renderHook(() => useUserListCrud(params));
    const fakeEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(mockApi.users.create).toHaveBeenCalledTimes(1);
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_USER',
        payload: expect.objectContaining({ name: '李四' }),
      })
    );
    expect(params.showToast).toHaveBeenCalledWith('success', '用户创建成功');
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'SET_SHOW_MODAL', payload: false });
    expect(mockAddOperation).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'create', description: '创建用户: 李四' })
    );
  });

  it('handleSubmit 编辑用户 → 调 update + 派发 UPDATE_USER', async () => {
    const params = makeParams({ editingUser: sampleUser });
    const { result } = renderHook(() => useUserListCrud(params));
    const fakeEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(mockApi.users.update).toHaveBeenCalledWith(
      Number(sampleUser.id),
      expect.objectContaining({ name: '李四' })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_USER',
        payload: expect.objectContaining({ name: '李四' }),
      })
    );
    expect(params.showToast).toHaveBeenCalledWith('success', '用户信息更新成功');
  });

  it('handleDelete(确认) → 调 delete + 派发 DELETE_USER + 记录可撤销操作', async () => {
    const params = makeParams({ users: [sampleUser] });
    const { result } = renderHook(() => useUserListCrud(params));
    await act(async () => {
      await result.current.handleDelete(1);
    });
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockApi.users.delete).toHaveBeenCalledWith(1);
    expect(params.dispatch).toHaveBeenCalledWith({ type: 'DELETE_USER', payload: 1 });
    expect(params.showToast).toHaveBeenCalledWith('success', '删除成功');
    expect(mockAddOperation).toHaveBeenCalledWith(expect.objectContaining({ type: 'delete' }));
  });

  it('handleDelete(取消) → 不调用接口', async () => {
    mockConfirm.mockResolvedValue(false);
    const params = makeParams({ users: [sampleUser] });
    const { result } = renderHook(() => useUserListCrud(params));
    await act(async () => {
      await result.current.handleDelete(1);
    });
    expect(mockApi.users.delete).not.toHaveBeenCalled();
  });

  it('handleToggleActive 启用 → 调 toggleActive + 派发 UPDATE_USER/SET_EDITING_USER + 提示', async () => {
    const disabledUser: User = { ...sampleUser, is_active: false };
    const params = makeParams({ users: [disabledUser] });
    const { result } = renderHook(() => useUserListCrud(params));
    await act(async () => {
      await result.current.handleToggleActive(disabledUser);
    });
    expect(mockApi.users.toggleActive).toHaveBeenCalledWith(Number(disabledUser.id));
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_USER',
        payload: expect.objectContaining({ is_active: true }),
      })
    );
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_EDITING_USER',
        payload: expect.objectContaining({ is_active: true }),
      })
    );
    expect(params.showToast).toHaveBeenCalledWith('success', '已启用');
  });

  it('handleToggleActive 禁用 → 提示已禁用', async () => {
    mockApi.users.toggleActive.mockResolvedValue({ is_active: false });
    const params = makeParams({ users: [sampleUser] });
    const { result } = renderHook(() => useUserListCrud(params));
    await act(async () => {
      await result.current.handleToggleActive(sampleUser);
    });
    expect(params.showToast).toHaveBeenCalledWith('success', '已禁用');
  });

  it('autoSaveHasUnsaved 透传 useAutoSave 的 hasUnsavedChanges', () => {
    const params = makeParams();
    const { result } = renderHook(() => useUserListCrud(params));
    expect(result.current.autoSaveHasUnsaved).toBe(false);
  });
});
