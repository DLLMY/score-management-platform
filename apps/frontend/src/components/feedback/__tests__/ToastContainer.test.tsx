/* eslint-disable react-hooks/exhaustive-deps */
/**
 * ToastContainer 补测（B32）。
 * 纯展示组件：mock ToastContext 注入受控 toasts/removeToast，覆盖
 * 空态早返、success/error 图标与配色分支、点击 X 触发 removeToast。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ToastContainer from '../ToastContainer';

const { useToastMock, removeToast } = vi.hoisted(() => ({
  useToastMock: vi.fn(),
  removeToast: vi.fn(),
}));

vi.mock('../../../context/ToastContext', () => ({ useToast: useToastMock }));

beforeEach(() => {
  useToastMock.mockReset();
  removeToast.mockReset();
});

const setToasts = (toasts: any[]) => {
  useToastMock.mockReturnValue({ toasts, removeToast });
};

describe('ToastContainer', () => {
  it('无 toast → 返回 null（不渲染容器）', () => {
    setToasts([]);
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('success toast → 渲染消息且配色为绿色（getToastStyle success 分支）', () => {
    setToasts([{ id: 1, type: 'success', message: '保存成功' }]);
    render(<ToastContainer />);
    const el = screen.getByText('保存成功');
    expect(el).toBeInTheDocument();
    // 绿色背景来自 getToastStyle 的 success 分支
    const toastBox = el.closest('div[style]') as HTMLElement;
    expect(toastBox.style.backgroundColor).toBe('rgb(34, 197, 94)'); // #22c55e
  });

  it('error toast → 配色为红色（getToastStyle error 分支）', () => {
    setToasts([{ id: 2, type: 'error', message: '操作失败' }]);
    render(<ToastContainer />);
    const el = screen.getByText('操作失败');
    expect(el).toBeInTheDocument();
    const toastBox = el.closest('div[style]') as HTMLElement;
    expect(toastBox.style.backgroundColor).toBe('rgb(239, 68, 68)'); // #ef4444
  });

  it('点击 X 按钮 → 以 toast.id 调用 removeToast（toastId 命中分支）', () => {
    setToasts([{ id: 7, type: 'success', message: '可关闭' }]);
    render(<ToastContainer />);
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(removeToast).toHaveBeenCalledWith(7);
  });

  it('多个 toast 各自独立渲染并可分别关闭', () => {
    setToasts([
      { id: 10, type: 'success', message: '第一条' },
      { id: 11, type: 'error', message: '第二条' },
    ]);
    render(<ToastContainer />);
    expect(screen.getByText('第一条')).toBeInTheDocument();
    expect(screen.getByText('第二条')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(removeToast).toHaveBeenCalledWith(11);
  });
});
