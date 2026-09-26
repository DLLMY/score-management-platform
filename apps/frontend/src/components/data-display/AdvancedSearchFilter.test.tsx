/// <reference types="jest" />
import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdvancedSearchFilter from './AdvancedSearchFilter';
import type { SearchCondition, SavedSearch } from './AdvancedSearchFilter';

const baseConditions: SearchCondition = {};

function makeSaved(): SavedSearch[] {
  return [
    {
      id: 's1',
      name: '我的筛选',
      createdAt: '2024-01-01T00:00:00.000Z',
      conditions: { status: 'active' },
    },
  ];
}

describe('AdvancedSearchFilter · 高级搜索筛选器', () => {
  it('渲染主栏：关键字输入、筛选按钮、搜索按钮', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter conditions={baseConditions} onChange={onChange} onSearch={onSearch} />
    );
    expect(screen.getByPlaceholderText('搜索...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /筛选/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '搜索' })).toBeInTheDocument();
  });

  it('关键字输入触发 onChange({ keyword })', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter conditions={baseConditions} onChange={onChange} onSearch={onSearch} />
    );
    const input = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '语文' } });
    expect(onChange).toHaveBeenCalledWith({ keyword: '语文' });
  });

  it('点击筛选展开高级面板，再点取消收起', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter conditions={baseConditions} onChange={onChange} onSearch={onSearch} />
    );
    fireEvent.click(screen.getByRole('button', { name: /筛选/ }));
    expect(screen.getByRole('button', { name: '应用筛选' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置条件' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('button', { name: '应用筛选' })).toBeNull();
  });

  it('应用筛选按钮：onChange(localConditions) + onSearch + 收起', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter conditions={{ keyword: 'x' }} onChange={onChange} onSearch={onSearch} />
    );
    fireEvent.click(screen.getByRole('button', { name: /筛选/ }));
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));
    expect(onChange).toHaveBeenCalledWith({ keyword: 'x' });
    expect(onSearch).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '应用筛选' })).toBeNull();
  });

  it('重置条件按钮：onChange({}) + onSearch', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter
        conditions={{ status: 'active' }}
        onChange={onChange}
        onSearch={onSearch}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /筛选/ }));
    fireEvent.click(screen.getByRole('button', { name: '重置条件' }));
    expect(onChange).toHaveBeenCalledWith({});
    expect(onSearch).toHaveBeenCalled();
  });

  it('activeFiltersCount 角标：存在激活条件时显示数量', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter
        conditions={{ status: 'active', category: 'a' }}
        onChange={onChange}
        onSearch={onSearch}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('已保存搜索：展开下拉、列出、点击加载触发 onChange+onSearch', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <AdvancedSearchFilter
        conditions={baseConditions}
        onChange={onChange}
        onSearch={onSearch}
        savedSearches={makeSaved()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(screen.getByText('我的筛选')).toBeInTheDocument();
    fireEvent.click(screen.getByText('我的筛选'));
    expect(onChange).toHaveBeenCalledWith({ status: 'active' });
    expect(onSearch).toHaveBeenCalled();
  });

  it('已保存搜索：删除按钮触发 onDeleteSearch', () => {
    const onDeleteSearch = vi.fn();
    render(
      <AdvancedSearchFilter
        conditions={baseConditions}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        savedSearches={makeSaved()}
        onDeleteSearch={onDeleteSearch}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '' }));
    const loadBtn = screen.getByText('我的筛选').closest('button')!;
    const row = loadBtn.parentElement!;
    const buttons = within(row).getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDeleteSearch).toHaveBeenCalledWith('s1');
  });

  it('无已保存搜索：下拉显示空态文案', () => {
    render(
      <AdvancedSearchFilter
        conditions={baseConditions}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        savedSearches={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(screen.getByText('暂无保存的搜索条件')).toBeInTheDocument();
  });

  it('保存模态：输入名称后保存触发 onSaveSearch；空名禁用', () => {
    const onSaveSearch = vi.fn();
    const { container } = render(
      <AdvancedSearchFilter
        conditions={{ keyword: 'k' }}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        onSaveSearch={onSaveSearch}
      />
    );
    const saveToggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.querySelector('svg.lucide-save')
    )!;
    fireEvent.click(saveToggle);
    fireEvent.click(screen.getByText('保存当前筛选条件'));
    const saveBtn = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    const nameInput = screen.getByPlaceholderText('输入搜索名称') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '收藏A' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSaveSearch).toHaveBeenCalledWith('收藏A', { keyword: 'k' });
  });

  it('高级面板：日期/状态/分类/班级/积分/排序 各字段变更触发 onChange', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    const { container } = render(
      <AdvancedSearchFilter
        conditions={baseConditions}
        onChange={onChange}
        onSearch={onSearch}
        showDateRange
        showStatus
        showCategory
        showClass
        showScoreRange
        showSort
        statusOptions={[{ label: '启用', value: 'active' }]}
        categoryOptions={[{ label: 'A类', value: 'a' }]}
        classOptions={[{ label: '一班', value: '1' }]}
        dateFields={[
          { label: '开始', value: 'date' },
          { label: '结束', value: 'dateTo' },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /筛选/ }));

    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });
    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2024-01-01' });

    const statusSelect = screen.getByText('全部状态').closest('select') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'active' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));

    const catSelect = screen.getByText('全部分类').closest('select') as HTMLSelectElement;
    fireEvent.change(catSelect, { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'a' }));

    const classSelect = screen.getByText('全部班级').closest('select') as HTMLSelectElement;
    fireEvent.change(classSelect, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ className: '1' }));

    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minScore: 10 }));

    fireEvent.change(numberInputs[1], { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxScore: 100 }));

    const sortSelect = screen.getByText('默认排序').closest('select') as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: 'score_asc' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'score', sortOrder: 'asc' })
    );
  });

  it('loading 时搜索按钮 disabled', () => {
    render(
      <AdvancedSearchFilter
        conditions={baseConditions}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        loading
      />
    );
    const searchBtn = screen.getByRole('button', { name: '搜索中...' }) as HTMLButtonElement;
    expect(searchBtn.disabled).toBe(true);
  });
});
