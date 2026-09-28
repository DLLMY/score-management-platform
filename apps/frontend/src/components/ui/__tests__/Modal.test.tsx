import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from '../Modal';

describe('Modal', () => {
  it('isOpen=false → 渲染 null', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title='T' children={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true → 渲染标题与右上角关闭按钮', () => {
    const { getByText, container } = render(
      <Modal isOpen onClose={vi.fn()} title='标题' children={null} />
    );
    expect(getByText('标题')).toBeInTheDocument();
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('size=sm → 应用 max-w-md', () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title='T' size='sm' children={null} />
    );
    expect(container.innerHTML).toContain('max-w-md');
  });

  it('size=md（默认）→ 应用 max-w-2xl', () => {
    const { container } = render(<Modal isOpen onClose={vi.fn()} title='T' children={null} />);
    expect(container.innerHTML).toContain('max-w-2xl');
  });

  it('size=lg → 应用 max-w-4xl', () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title='T' size='lg' children={null} />
    );
    expect(container.innerHTML).toContain('max-w-4xl');
  });

  it('size=xl → 应用 max-w-6xl', () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title='T' size='xl' children={null} />
    );
    expect(container.innerHTML).toContain('max-w-6xl');
  });

  it('点击遮罩（target===currentTarget）→ 触发 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal isOpen onClose={onClose} title='T' children={null} />);
    const overlay = container.firstElementChild!.children[0] as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击内容区（target!==currentTarget）→ 不触发 onClose', () => {
    const onClose = vi.fn();
    const { getByText } = render(<Modal isOpen onClose={onClose} title='T' children={null} />);
    // 标题位于内容区内部：target=标题元素，冒泡后 currentTarget=遮罩 → 不相等 → 不关闭
    fireEvent.click(getByText('T'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('footer 存在 → 渲染 footer 内容', () => {
    const { getByText } = render(
      <Modal isOpen onClose={vi.fn()} title='T' footer={<button>保存</button>} children={null} />
    );
    expect(getByText('保存')).toBeInTheDocument();
  });

  it('footer 缺省 → footer 容器（border-t）不渲染', () => {
    const { container, queryByText } = render(
      <Modal isOpen onClose={vi.fn()} title='T' children={null} />
    );
    expect(container.querySelector('.border-t')).toBeNull();
    expect(queryByText('保存')).toBeNull();
  });

  it('点击右上角关闭按钮 → 触发 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal isOpen onClose={onClose} title='T' children={null} />);
    fireEvent.click(container.querySelector('button')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
