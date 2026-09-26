/// <reference types="jest" />
import { render, fireEvent, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SearchFilter from './SearchFilter';

describe('SearchFilter · 通用搜索/筛选栏', () => {
  it('渲染输入框，placeholder 与受控 value 优先于 searchTerm', () => {
    const { rerender } = render(<SearchFilter searchTerm='term' placeholder='查一下' />);
    const input = screen.getByPlaceholderText('查一下') as HTMLInputElement;
    expect(input.value).toBe('term');

    // value 优先：同时给 value 与 searchTerm 时取 value
    rerender(<SearchFilter searchTerm='term' value='val' placeholder='查一下' />);
    expect((screen.getByPlaceholderText('查一下') as HTMLInputElement).value).toBe('val');
  });

  it('autoSearch 模式：输入经防抖触发 onChange（fake timers）', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<SearchFilter onChange={onChange} />);
      const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'abc' } });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(onChange).toHaveBeenCalledWith('abc');
    } finally {
      vi.useRealTimers();
    }
  });

  it('autoSearch=false：输入不触发 onChange（直接 return）', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<SearchFilter onChange={onChange} autoSearch={false} />);
      const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'abc' } });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('输入为空串的受控同步：props 变化同步本地值', () => {
    const { rerender } = render(<SearchFilter value='a' />);
    rerender(<SearchFilter value='' />);
    expect((screen.getByPlaceholderText('搜索...') as HTMLInputElement).value).toBe('');
  });

  it('清空按钮（X）：有内容时出现，点击清空并调用 onChange("")', () => {
    const onChange = vi.fn();
    render(<SearchFilter value='abc' onChange={onChange} />);
    const clearBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
    expect((screen.getByPlaceholderText('搜索...') as HTMLInputElement).value).toBe('');
  });

  it('回车：调用 resolvedOnChange(localSearchTerm) 且触发 onSearch', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(<SearchFilter value='xyz' onChange={onChange} onSearch={onSearch} />);
    const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('xyz');
    expect(onSearch).toHaveBeenCalled();
  });

  it('无 filters 时不渲染筛选 chips；有 filters 时点击触发 onFilterChange', () => {
    const { rerender } = render(<SearchFilter />);
    expect(screen.queryByRole('button', { name: '活跃' })).toBeNull();

    const onFilterChange = vi.fn();
    rerender(
      <SearchFilter
        activeFilter='active'
        onFilterChange={onFilterChange}
        filters={[
          { label: '活跃', value: 'active' },
          { label: '禁用', value: 'inactive' },
        ]}
      />
    );
    const activeBtn = screen.getByRole('button', { name: '活跃' });
    fireEvent.click(activeBtn);
    expect(onFilterChange).toHaveBeenCalledWith('active');
  });

  it('selectFilters 渲染 <select>，变更调用对应 onChange', () => {
    const sfOnChange = vi.fn();
    render(
      <SearchFilter
        selectFilters={[
          {
            label: '班级',
            value: '1',
            onChange: sfOnChange,
            options: [
              { label: '全部', value: '' },
              { label: '一班', value: '1' },
            ],
          },
        ]}
      />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: '1' } });
    expect(sfOnChange).toHaveBeenCalledWith('1');
  });

  it('showReset + 有激活条件：渲染重置按钮，点击重置全部并回调', () => {
    const onChange = vi.fn();
    const onFilterChange = vi.fn();
    const onReset = vi.fn();
    const sfOnChange = vi.fn();
    render(
      <SearchFilter
        value='abc'
        showReset
        activeFilter='active'
        onFilterChange={onFilterChange}
        onChange={onChange}
        onReset={onReset}
        selectFilters={[
          {
            label: '班级',
            value: '1',
            onChange: sfOnChange,
            options: [{ label: '全部', value: '' }],
          },
        ]}
      />
    );
    const resetBtn = screen.getByRole('button', { name: '重置' });
    fireEvent.click(resetBtn);
    expect(onChange).toHaveBeenCalledWith('');
    expect(onFilterChange).toHaveBeenCalledWith('active');
    expect(sfOnChange).toHaveBeenCalledWith('1');
    expect(onReset).toHaveBeenCalled();
  });

  it('loading 时输入框 disabled', () => {
    render(<SearchFilter loading />);
    const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('children 透传渲染', () => {
    render(
      <SearchFilter>
        <span data-testid='child'>子节点</span>
      </SearchFilter>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
