import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BatchActionBar, { type BatchAction } from './BatchActionBar';

const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('./ConfirmDialog', () => ({ useConfirm: () => mockConfirm }));
vi.mock('../../utils/logger', () => ({ default: mockLogger }));

interface Item {
  id: string;
  name: string;
}

const items: Item[] = [
  { id: '1', name: '张三' },
  { id: '2', name: '李四' },
  { id: '3', name: '王五' },
  { id: '4', name: '赵六' },
];

describe('BatchActionBar', () => {
  beforeEach(() => {
    mockConfirm.mockReset();
    mockLogger.error.mockClear();
    mockConfirm.mockResolvedValue(true);
  });

  const makeAction = (overrides: Partial<BatchAction<Item>> = {}): BatchAction<Item> => ({
    id: 'act',
    label: '批量导出',
    handler: vi.fn(),
    ...overrides,
  });

  const setup = (
    props: Partial<{
      selectedItems: Item[];
      actions: BatchAction<Item>[];
      onClearSelection: () => void;
      getItemName: (item: Item) => string;
    }> = {}
  ) => {
    const onClearSelection = props.onClearSelection ?? vi.fn();
    const utils = render(
      <BatchActionBar<Item>
        selectedItems={props.selectedItems ?? items}
        selectedIds={new Set(items.map((i) => i.id))}
        onClearSelection={onClearSelection}
        actions={props.actions ?? [makeAction()]}
        getItemName={props.getItemName}
      />
    );
    return { onClearSelection, ...utils };
  };

  it('渲染已选择数量，点击清除选择回调 onClearSelection', () => {
    const { onClearSelection } = setup();
    expect(screen.getByText('已选择 4 项')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /清除选择/ }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('无选中项时执行操作直接早退（handler 不调用）', () => {
    const handler = vi.fn();
    setup({ selectedItems: [], actions: [makeAction({ handler })] });
    expect(screen.getByText('已选择 0 项')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    expect(handler).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('无 confirmMessage 时直接执行 handler 并在成功后清除选择', async () => {
    const handler = vi.fn();
    const { onClearSelection } = setup({ actions: [makeAction({ handler })] });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(handler).toHaveBeenCalledWith(items));
    await waitFor(() => expect(onClearSelection).toHaveBeenCalledTimes(1));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('confirmMessage 且用户确认时执行 handler', async () => {
    const handler = vi.fn();
    mockConfirm.mockResolvedValue(true);
    setup({ actions: [makeAction({ handler, confirmMessage: '确定导出所选？' })] });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const opts = mockConfirm.mock.calls[0][0];
    expect(opts.confirmText).toBe('确认');
    expect(opts.cancelText).toBe('取消');
    expect(opts.type).toBe('warning');
  });

  it('确认消息含数量与前 3 项名称，超过 3 项追加省略号', async () => {
    mockConfirm.mockResolvedValue(true);
    setup({ actions: [makeAction({ confirmMessage: '确定导出？' })] });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    const msg = String(mockConfirm.mock.calls[0][0].message);
    expect(msg).toContain('确定导出？');
    expect(msg).toContain('已选择 4 项');
    expect(msg).toContain('张三');
    expect(msg).toContain('王五');
    expect(msg).not.toContain('赵六');
    expect(msg).toContain('...');
  });

  it('选中不超过 3 项时确认消息不含省略号', async () => {
    mockConfirm.mockResolvedValue(true);
    setup({
      selectedItems: items.slice(0, 2),
      actions: [makeAction({ confirmMessage: '确定删除？' })],
    });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    const msg = String(mockConfirm.mock.calls[0][0].message);
    expect(msg).toContain('已选择 2 项');
    expect(msg).not.toContain('...');
  });

  it('用户在确认弹窗取消时不执行 handler 且不清除选择', async () => {
    const handler = vi.fn();
    const { onClearSelection } = setup({
      actions: [makeAction({ handler, confirmMessage: '确定删除？' })],
    });
    mockConfirm.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(handler).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('handler 抛错时记录日志、不清除选择并复位 loading', async () => {
    const err = new Error('boom');
    const handler = vi.fn().mockRejectedValue(err);
    const { onClearSelection } = setup({ actions: [makeAction({ handler })] });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(mockLogger.error).toHaveBeenCalledWith('批量操作失败:', err));
    expect(onClearSelection).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '批量导出' })).not.toBeDisabled()
    );
  });

  it('action.disabled 为真时主操作按钮禁用', () => {
    setup({ actions: [makeAction({ disabled: (sel) => sel.length === 4 })] });
    expect(screen.getByRole('button', { name: '批量导出' })).toBeDisabled();
  });

  it('操作进行中（loading）时其余主操作按钮禁用', async () => {
    let release!: () => void;
    const slow = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    setup({
      actions: [makeAction({ id: 'slow', label: '慢操作', handler: slow }), makeAction()],
    });
    fireEvent.click(screen.getByRole('button', { name: '慢操作' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '批量导出' })).toBeDisabled());

    await act(async () => {
      release();
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '批量导出' })).not.toBeDisabled()
    );
  });

  it('有二级操作时渲染「更多操作」按钮，展开后点击菜单项执行', async () => {
    const secondaryHandler = vi.fn();
    setup({
      actions: [
        makeAction({ id: 'primary', label: '主操作' }),
        makeAction({
          id: 'export',
          label: '导出Excel',
          variant: 'secondary',
          handler: secondaryHandler,
        }),
      ],
    });
    expect(screen.getByRole('button', { name: '主操作' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '导出Excel' })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: '导出Excel' }));
    await waitFor(() => expect(secondaryHandler).toHaveBeenCalledWith(items));
  });

  it('无二级操作时不渲染「更多操作」按钮', () => {
    setup({ actions: [makeAction()] });
    expect(screen.queryByRole('button', { name: /更多操作/ })).not.toBeInTheDocument();
  });

  it('点击菜单遮罩层收起二级菜单', async () => {
    const { container } = setup({
      actions: [makeAction({ id: 's', label: '次要操作', variant: 'secondary' })],
    });
    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }));
    await waitFor(() => expect(screen.getByText('次要操作')).toBeInTheDocument());
    const backdrop = container.querySelector('.fixed.inset-0.z-10') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByText('次要操作')).not.toBeInTheDocument());
  });

  it('二级操作 disabled 时菜单项禁用', async () => {
    setup({
      actions: [
        makeAction({
          id: 's',
          label: '禁用项',
          variant: 'secondary',
          disabled: () => true,
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: '禁用项' })).toBeDisabled());
  });

  it('自定义 getItemName 用于确认消息', async () => {
    mockConfirm.mockResolvedValue(true);
    setup({
      actions: [makeAction({ confirmMessage: '确定？' })],
      getItemName: (item) => `学号${item.id}`,
    });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(String(mockConfirm.mock.calls[0][0].message)).toContain('学号1');
  });

  it('默认 getItemName 在无 name 字段时回落「项目」', async () => {
    mockConfirm.mockResolvedValue(true);
    const nameless = [{ id: 'x' }] as unknown as Item[];
    setup({
      selectedItems: nameless,
      actions: [makeAction({ confirmMessage: '确定？' })],
    });
    fireEvent.click(screen.getByRole('button', { name: '批量导出' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(String(mockConfirm.mock.calls[0][0].message)).toContain('项目');
  });
});
