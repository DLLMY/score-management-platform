/**
 * ToastContext 补测（B33）。
 * 基础 provider：覆盖 showToast 四类型渲染 + getToastStyles 兜底、removeToast（X 关闭）、
 * handleUndo（undoAction 调用并移除）、toggleExpand（details / errorFields 展开收起）、
 * 5s 自动消失（useEffect setTimeout → removeToast）、useToast 无 Provider 抛错。
 * 用 fake timers 精确控制自动消失计时。
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../ToastContext';

let captured: any = null;
function Capture() {
  captured = useToast();
  return null;
}

const setup = () =>
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>
  );

beforeEach(() => {
  captured = null;
  vi.useFakeTimers();
  vi.clearAllTimers();
});

describe('ToastContext · showToast 渲染', () => {
  it('success / error / warning / info 四种类型均能渲染消息', () => {
    setup();
    act(() => {
      captured.showToast('success', '成功消息');
    });
    expect(screen.getByText('成功消息')).toBeInTheDocument();
    act(() => {
      captured.showToast('error', '错误消息');
    });
    expect(screen.getByText('错误消息')).toBeInTheDocument();
    act(() => {
      captured.showToast('warning', '警告消息');
    });
    expect(screen.getByText('警告消息')).toBeInTheDocument();
    act(() => {
      captured.showToast('info', '信息消息');
    });
    expect(screen.getByText('信息消息')).toBeInTheDocument();
  });

  it('未知 type → getToastStyles 兜底 info 样式，正常渲染', () => {
    setup();
    act(() => {
      captured.showToast('weird' as any, '兜底消息');
    });
    expect(screen.getByText('兜底消息')).toBeInTheDocument();
  });
});

describe('ToastContext · removeToast', () => {
  it('点击 X 按钮 → 移除对应 toast', () => {
    setup();
    act(() => {
      captured.showToast('success', '关闭我');
    });
    const xBtn = screen.getByRole('button');
    fireEvent.click(xBtn);
    expect(screen.queryByText('关闭我')).not.toBeInTheDocument();
  });

  it('多个 toast 各自独立，按 id 关闭', () => {
    setup();
    act(() => {
      captured.showToast('success', '第一条');
    });
    act(() => {
      captured.showToast('error', '第二条');
    });
    expect(screen.getByText('第一条')).toBeInTheDocument();
    expect(screen.getByText('第二条')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(screen.queryByText('第二条')).not.toBeInTheDocument();
    expect(screen.getByText('第一条')).toBeInTheDocument();
  });
});

describe('ToastContext · handleUndo', () => {
  it('带 undoAction → 点击撤销调用回调并移除 toast', () => {
    const undo = vi.fn();
    setup();
    act(() => {
      captured.showToast('success', '可撤销', { undoAction: undo, undoLabel: '撤回' });
    });
    const undoBtn = screen.getByText('撤回');
    fireEvent.click(undoBtn);
    expect(undo).toHaveBeenCalled();
    expect(screen.queryByText('可撤销')).not.toBeInTheDocument();
  });

  it('不带 undoAction → 不渲染撤销按钮', () => {
    setup();
    act(() => {
      captured.showToast('success', '无撤销');
    });
    expect(screen.queryByText('撤销')).not.toBeInTheDocument();
  });
});

describe('ToastContext · toggleExpand（details / errorFields）', () => {
  it('details 存在 → 点击查看详情展开/收起', () => {
    setup();
    act(() => {
      captured.showToast('info', '详情条', { details: '错误详情内容' });
    });
    fireEvent.click(screen.getByText('查看详情'));
    expect(screen.getByText('错误详情内容')).toBeInTheDocument();
    fireEvent.click(screen.getByText('收起详情'));
    expect(screen.queryByText('错误详情内容')).not.toBeInTheDocument();
  });

  it('errorFields 存在 → 展开后渲染错误字段 chips', () => {
    setup();
    act(() => {
      captured.showToast('error', '字段错误', { errorFields: ['name', 'age'] });
    });
    fireEvent.click(screen.getByText('查看详情'));
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });
});

describe('ToastContext · 自动消失', () => {
  it('toast 在 5s 后自动移除（useEffect setTimeout → removeToast）', () => {
    setup();
    act(() => {
      captured.showToast('info', '自动消失');
    });
    expect(screen.getByText('自动消失')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('自动消失')).not.toBeInTheDocument();
  });
});

describe('ToastContext · useToast 守卫', () => {
  it('无 Provider → 抛出 useToast must be used within a ToastProvider', () => {
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow('useToast must be used within a ToastProvider');
  });
});
