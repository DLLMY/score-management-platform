import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Toast from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('type 缺省 → 默认 info 提示文案「提示」', () => {
    render(<Toast message={{}} onClose={vi.fn()} />);
    expect(screen.getByText('提示')).toBeInTheDocument();
  });

  it('type=success → 默认文案「操作成功」', () => {
    render(<Toast message={{ type: 'success' }} onClose={vi.fn()} />);
    expect(screen.getByText('操作成功')).toBeInTheDocument();
  });

  it('type=error → 默认文案「操作失败」', () => {
    render(<Toast message={{ type: 'error' }} onClose={vi.fn()} />);
    expect(screen.getByText('操作失败')).toBeInTheDocument();
  });

  it('type=warning → 默认文案「请注意」', () => {
    render(<Toast message={{ type: 'warning' }} onClose={vi.fn()} />);
    expect(screen.getByText('请注意')).toBeInTheDocument();
  });

  it('自定义 text → 渲染自定义文案', () => {
    render(<Toast message={{ type: 'info', text: '你好世界' }} onClose={vi.fn()} />);
    expect(screen.getByText('你好世界')).toBeInTheDocument();
  });

  it('无 details/errorFields → 不渲染「查看详情」按钮', () => {
    render(<Toast message={{ type: 'info' }} onClose={vi.fn()} />);
    expect(screen.queryByText('查看详情')).toBeNull();
  });

  it('details 默认隐藏，点击切换显示', () => {
    render(<Toast message={{ type: 'error', details: '出错了' }} onClose={vi.fn()} />);
    expect(screen.queryByText('出错了')).toBeNull();
    fireEvent.click(screen.getByText('查看详情'));
    expect(screen.getByText('出错了')).toBeInTheDocument();
    // 再次点击收起
    fireEvent.click(screen.getByText('收起详情'));
    expect(screen.queryByText('出错了')).toBeNull();
  });

  it('errorFields → 渲染为标签', () => {
    render(<Toast message={{ type: 'error', errorFields: ['name', 'age'] }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('查看详情'));
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('渲染类型图标（svg 存在）', () => {
    const { container } = render(<Toast message={{ type: 'info' }} onClose={vi.fn()} />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('点击关闭按钮 → 300ms 后调用 onClose', () => {
    const onClose = vi.fn();
    render(<Toast message={{ type: 'info' }} onClose={onClose} />);
    // 关闭按钮是带 X 图标的 button，用容器定位
    const closeBtn = document.querySelector('button[class*="p-1 rounded-lg"]') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('5s 自动关闭 → 5000ms 后进入 closing，5300ms 后调用 onClose', () => {
    const onClose = vi.fn();
    render(<Toast message={{ type: 'info' }} onClose={onClose} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // 仍在 DOM（isClosing 状态）
    expect(screen.getByText('提示')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
