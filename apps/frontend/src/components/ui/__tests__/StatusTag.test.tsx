import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusTag from '../StatusTag';

describe('StatusTag', () => {
  it('tone=success → 绿底 + 默认文案"正常"', () => {
    const { getByText, container } = render(<StatusTag tone='success' />);
    expect(getByText('正常')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-green-100');
  });

  it('tone=warning → 黄底 + "待处理"', () => {
    const { getByText, container } = render(<StatusTag tone='warning' />);
    expect(getByText('待处理')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-yellow-100');
  });

  it('tone=danger → 红底 + "异常"', () => {
    const { getByText, container } = render(<StatusTag tone='danger' />);
    expect(getByText('异常')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-red-100');
  });

  it('tone=info → 蓝底 + "进行中"', () => {
    const { getByText, container } = render(<StatusTag tone='info' />);
    expect(getByText('进行中')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-blue-100');
  });

  it('tone=neutral → 灰底 + "停用"', () => {
    const { getByText, container } = render(<StatusTag tone='neutral' />);
    expect(getByText('停用')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-gray-100');
  });

  it('toneKey 命中映射（published→info）→ 自动推断 tone + info 默认文案', () => {
    const { getByText, container } = render(<StatusTag toneKey='published' />);
    expect(getByText('进行中')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-blue-100');
  });

  it('toneKey 未命中映射 → 回退 neutral（"停用"）', () => {
    const { getByText, container } = render(<StatusTag toneKey='some_unknown_key' />);
    expect(getByText('停用')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-gray-100');
  });

  it('tone 与 toneKey 同时传入 → tone 优先', () => {
    const { getByText, container } = render(<StatusTag tone='danger' toneKey='published' />);
    expect(getByText('异常')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-red-100');
  });

  it('label 自定义 → 覆盖默认文案', () => {
    const { getByText, queryByText } = render(<StatusTag tone='success' label='已启用' />);
    expect(getByText('已启用')).toBeInTheDocument();
    expect(queryByText('正常')).toBeNull();
  });

  it('className 透传 → 追加到根 span', () => {
    const { container } = render(<StatusTag tone='success' className='my-tag' />);
    expect(container.firstElementChild?.className).toContain('my-tag');
  });
});
