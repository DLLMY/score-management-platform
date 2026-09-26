import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialogUI, { ConfirmProvider, useConfirm, type ConfirmOptions } from './ConfirmDialog';

describe('ConfirmDialogUI', () => {
  const noop = vi.fn();

  beforeEach(() => {
    noop.mockClear();
  });

  it.each([
    ['danger', 'text-red-500', 'bg-red-500'],
    ['warning', 'text-amber-500', 'bg-amber-500'],
    ['info', 'text-blue-500', 'bg-blue-500'],
    ['success', 'text-green-500', 'bg-green-500'],
  ] as const)('type=%s 使用对应图标强调色与确认按钮底色', (type, accent, confirmBg) => {
    render(<ConfirmDialogUI options={{ message: 'msg', type }} onConfirm={noop} onCancel={noop} />);
    expect(screen.getByRole('dialog').innerHTML).toContain(accent);
    expect(screen.getByRole('button', { name: '确认' }).className).toContain(confirmBg);
  });

  it('默认渲染标题、消息与默认按钮文案（type 缺省为 warning）', () => {
    render(
      <ConfirmDialogUI options={{ message: '确定删除该学生？' }} onConfirm={noop} onCancel={noop} />
    );
    expect(screen.getByText('确认操作')).toBeInTheDocument();
    expect(screen.getByText('确定删除该学生？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument();
    expect(screen.getByRole('dialog').innerHTML).toContain('text-amber-500');
  });

  it('支持自定义 title / confirmText / cancelText', () => {
    render(
      <ConfirmDialogUI
        options={{
          title: '删除确认',
          message: '此操作不可恢复',
          confirmText: '删除',
          cancelText: '再想想',
        }}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText('删除确认')).toBeInTheDocument();
    expect(screen.getByText('此操作不可恢复')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再想想' })).toBeInTheDocument();
  });

  it('点击确认按钮触发 onConfirm 且不触发 onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialogUI options={{ message: 'm' }} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('点击取消按钮 / 右上角关闭按钮 / 遮罩层均触发 onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialogUI options={{ message: 'm' }} onConfirm={noop} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('presentation'));
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('点击对话框内容区不冒泡到遮罩（stopPropagation 生效）', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialogUI options={{ message: 'm' }} onConfirm={noop} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('m'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape 键触发 onCancel，卸载后监听器被移除', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <ConfirmDialogUI options={{ message: 'm' }} onConfirm={noop} onCancel={onCancel} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // 非 Escape 键不应触发
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmProvider + useConfirm', () => {
  let confirmFn: (options: ConfirmOptions) => Promise<boolean>;

  function Probe() {
    confirmFn = useConfirm();
    return <div data-testid='probe'>probe</div>;
  }

  const setup = () => {
    render(
      <ConfirmProvider>
        <Probe />
      </ConfirmProvider>
    );
  };

  it('confirm() 打开弹窗，点击确认 resolve true 并关闭', async () => {
    setup();
    let p!: Promise<boolean>;
    act(() => {
      p = confirmFn({ message: '提交成绩？', title: '成绩提交' });
    });
    await waitFor(() => expect(screen.getByText('提交成绩？')).toBeInTheDocument());
    expect(screen.getByText('成绩提交')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    await expect(p).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('点击取消 resolve false 并关闭', async () => {
    setup();
    let p!: Promise<boolean>;
    act(() => {
      p = confirmFn({ message: '放弃编辑？', cancelText: '再想想' });
    });
    await waitFor(() => expect(screen.getByText('放弃编辑？')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '再想想' }));
    await expect(p).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Escape 关闭并 resolve false；关闭后可再次 confirm', async () => {
    setup();
    let p1!: Promise<boolean>;
    act(() => {
      p1 = confirmFn({ message: '第一次' });
    });
    await waitFor(() => expect(screen.getByText('第一次')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'Escape' });
    await expect(p1).resolves.toBe(false);

    let p2!: Promise<boolean>;
    act(() => {
      p2 = confirmFn({ message: '第二次', confirmText: '好的' });
    });
    await waitFor(() => expect(screen.getByText('第二次')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '好的' }));
    await expect(p2).resolves.toBe(true);
  });
});

describe('useConfirm 无 Provider 降级', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('未挂载 Provider 时降级为 window.confirm（字符串消息原样透传）', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let confirmFn!: (options: ConfirmOptions) => Promise<boolean>;
    function Probe() {
      confirmFn = useConfirm();
      return null;
    }
    render(<Probe />);

    await expect(confirmFn({ message: '确定退出？' })).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith('确定退出？');

    spy.mockReturnValue(false);
    await expect(confirmFn({ message: '确定退出？' })).resolves.toBe(false);
  });

  it('消息为 ReactNode 时降级提示为兜底文案', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let confirmFn!: (options: ConfirmOptions) => Promise<boolean>;
    function Probe() {
      confirmFn = useConfirm();
      return null;
    }
    render(<Probe />);

    await expect(confirmFn({ message: <strong>富文本</strong> })).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith('确认操作？');
  });
});
