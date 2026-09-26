import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdvancedSearch from './AdvancedSearch';
import type { FilterField } from './AdvancedSearch';

const base = { onSearch: vi.fn(), onReset: vi.fn() };

// jsdom 对 type=number 的 value setter 会清洗非数字值、且 fireEvent.change 不触发
// React onChange；用 Object.defineProperty 直接赋字符串值绕过校验，再用 RTL 的
// fireEvent.input 派发 input 事件（与历史 B10 一致）。
const setNativeValue = (input: HTMLInputElement, value: string) => {
  Object.defineProperty(input, 'value', { configurable: true, value });
  fireEvent.input(input, {});
};

const field = (over: Partial<FilterField>): FilterField => ({
  id: 'f',
  label: '字段',
  type: 'text',
  value: '',
  onChange: vi.fn(),
  ...over,
});

describe('AdvancedSearch', () => {
  it('renders text field and fires onChange', () => {
    const onChange = vi.fn();
    render(
      <AdvancedSearch
        fields={[
          field({ label: '关键词', type: 'text', placeholder: '搜索', value: '', onChange }),
        ]}
        {...base}
      />
    );
    const input = screen.getByPlaceholderText('搜索') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('renders select field with options', () => {
    const onChange = vi.fn();
    render(
      <AdvancedSearch
        fields={[
          field({
            label: '班级',
            type: 'select',
            options: [
              { value: '1', label: 'A' },
              { value: '2', label: 'B' },
            ],
            value: '',
            onChange,
          }),
        ]}
        {...base}
      />
    );
    const select = screen.getByText('班级').parentElement!.querySelector('select')!;
    fireEvent.change(select, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('renders number field and parses float (fallback 0)', () => {
    const onChange = vi.fn();
    render(
      <AdvancedSearch
        fields={[field({ label: '最低', type: 'number', placeholder: '最低', value: 0, onChange })]}
        {...base}
      />
    );
    const input = screen.getByPlaceholderText('最低') as HTMLInputElement;
    setNativeValue(input, '12.5');
    expect(onChange).toHaveBeenCalledWith(12.5);
    setNativeValue(input, '');
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('renders date field', () => {
    const onChange = vi.fn();
    render(
      <AdvancedSearch
        fields={[field({ label: '日期', type: 'date', value: '', onChange })]}
        {...base}
      />
    );
    const input = screen.getByText('日期').parentElement!.querySelector('input[type="date"]')!;
    fireEvent.change(input, { target: { value: '2026-01-01' } });
    expect(onChange).toHaveBeenCalledWith('2026-01-01');
  });

  it('renders dateRange field merging start/end', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AdvancedSearch
        fields={[
          field({ label: '范围', type: 'dateRange', value: { start: '', end: '' }, onChange }),
        ]}
        {...base}
      />
    );
    const inputs = container.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(inputs[0], { target: { value: '2026-01-01' } });
    fireEvent.change(inputs[1], { target: { value: '2026-02-02' } });
    expect(onChange).toHaveBeenCalledTimes(2);
    const calls = onChange.mock.calls.map((c) => c[0] as { start?: string; end?: string });
    expect(calls.some((c) => c.start === '2026-01-01')).toBe(true);
    expect(calls.some((c) => c.end === '2026-02-02')).toBe(true);
  });

  it('renders boolean field converting to boolean', () => {
    const onChange = vi.fn();
    render(
      <AdvancedSearch
        fields={[field({ label: '是否', type: 'boolean', value: undefined, onChange })]}
        {...base}
      />
    );
    const select = screen.getByText('是否').parentElement!.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'true' } });
    expect(onChange).toHaveBeenCalledWith(true);
    fireEvent.change(select, { target: { value: 'false' } });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('shows 清除筛选 button when filters active and calls onReset', () => {
    const onReset = vi.fn();
    render(
      <AdvancedSearch
        fields={[field({ label: '关键词', type: 'text', value: 'abc', onChange: vi.fn() })]}
        onSearch={vi.fn()}
        onReset={onReset}
      />
    );
    fireEvent.click(screen.getByText('清除筛选'));
    expect(onReset).toHaveBeenCalled();
  });

  it('hides 清除筛选 button when no active filters', () => {
    render(
      <AdvancedSearch
        fields={[field({ label: '关键词', type: 'text', value: '', onChange: vi.fn() })]}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.queryByText('清除筛选')).not.toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <AdvancedSearch fields={[]} onSearch={vi.fn()} onReset={vi.fn()}>
        额外内容
      </AdvancedSearch>
    );
    expect(screen.getByText('额外内容')).toBeInTheDocument();
  });

  it('fires onSearch and onReset via footer buttons', () => {
    const onSearch = vi.fn();
    const onReset = vi.fn();
    render(<AdvancedSearch fields={[]} onSearch={onSearch} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(onSearch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('uses custom searchButtonLabel', () => {
    render(
      <AdvancedSearch fields={[]} onSearch={vi.fn()} onReset={vi.fn()} searchButtonLabel='查询' />
    );
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
  });

  it('handles unknown field type (default branch)', () => {
    expect(() =>
      render(
        <AdvancedSearch
          fields={[field({ label: 'X', type: 'weird' as any, value: '', onChange: vi.fn() })]}
          onSearch={vi.fn()}
          onReset={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});
